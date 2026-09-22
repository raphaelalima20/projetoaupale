-- =====================================================================================
-- AUPALE — Funcionalidades adicionais: Mega Hair, Comissão vs Valor Fixo, Vales, Fotos do cliente
--
-- Migração ADITIVA: pressupõe que 20260921000000_aupale_schema.sql já foi aplicada.
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. Mega Hair — flag no serviço; especificação técnica só é preenchida no FECHAMENTO
-- -------------------------------------------------------------------------------------
alter table public.services
  add column if not exists is_mega boolean not null default false;

alter table public.appointments
  -- Escolhido pelo cliente/equipe no agendamento (nada técnico); editável no fechamento.
  add column if not exists mega_tipo text check (mega_tipo in ('aplicacao', 'manutencao')),
  -- Funcionalidade 2 — comissão por percentual (padrão) ou valor fixo negociado, em qualquer serviço.
  add column if not exists tipo_remuneracao text not null default 'comissao'
    check (tipo_remuneracao in ('comissao', 'valor_fixo')),
  add column if not exists valor_fixo numeric(12,2) check (valor_fixo is null or valor_fixo >= 0);

create table public.mega_especificacoes (
  id              uuid primary key default gen_random_uuid(),
  agendamento_id  uuid not null references public.appointments (id) on delete cascade,
  tecnica         text not null check (tecnica in ('fita', 'tela', 'queratina')),
  tipo            text not null check (tipo in ('aplicacao', 'manutencao')),
  combinacao      text not null check (combinacao in (
                    'Tela + Mesclado', 'Fita + Mesclado', 'Queratina + Mesclado',
                    'Mesclado + Luzes', 'Cabelo Natural (Fita)', 'Cabelo Natural (Tela)'
                  )),
  comprimento     text,
  gramas          numeric(8,2) check (gramas is null or gramas >= 0),
  -- A comissão da colaboradora incide SOMENTE sobre valor_tecnica — nunca sobre valor_cabelo.
  valor_tecnica   numeric(12,2) not null check (valor_tecnica >= 0),
  valor_cabelo    numeric(12,2) not null default 0 check (valor_cabelo >= 0),
  created_at      timestamptz not null default now()
);
-- No máximo uma especificação por agendamento (o fechamento faz upsert lógico via delete+insert).
create unique index mega_especificacoes_agendamento_unique on public.mega_especificacoes (agendamento_id);

alter table public.mega_especificacoes enable row level security;
create policy mega_especificacoes_staff_select on public.mega_especificacoes
  for select to authenticated using (public.is_staff());
create policy mega_especificacoes_staff_insert on public.mega_especificacoes
  for insert to authenticated with check (public.is_staff());
create policy mega_especificacoes_admin_update on public.mega_especificacoes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy mega_especificacoes_admin_delete on public.mega_especificacoes
  for delete to authenticated using (public.is_admin());
revoke all on public.mega_especificacoes from anon;

-- -------------------------------------------------------------------------------------
-- 2. Comissão vs Valor Fixo — também gravado no registro histórico de comissões
-- -------------------------------------------------------------------------------------
alter table public.commissions
  add column if not exists tipo_remuneracao text not null default 'comissao'
    check (tipo_remuneracao in ('comissao', 'valor_fixo')),
  add column if not exists valor_fixo numeric(12,2) check (valor_fixo is null or valor_fixo >= 0);

-- O trigger de conclusão precisa copiar os novos campos do agendamento para a comissão gerada.
create or replace function public.create_commission_on_conclude()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'concluido' and old.status is distinct from 'concluido'
     and new.collaborator_id is not null then
    insert into public.commissions (
      collaborator_id, appointment_id, service_name, client_name,
      service_value, commission_value, commission_date,
      tipo_remuneracao, valor_fixo
    ) values (
      new.collaborator_id, new.id, new.service_name, new.client_name,
      coalesce(new.final_amount, new.package_session_value, new.service_price, 0),
      coalesce(new.commission_value, 0),
      new.appointment_date,
      coalesce(new.tipo_remuneracao, 'comissao'), new.valor_fixo
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------------------------------
-- 3. Vales — lançados no dia, descontados automaticamente da próxima comissão paga
-- -------------------------------------------------------------------------------------
create table public.vales (
  id                    uuid primary key default gen_random_uuid(),
  colaboradora_id       uuid not null references public.profiles (id) on delete cascade,
  valor                 numeric(12,2) not null check (valor > 0),
  descricao             text,
  data                  date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  -- Preenchido pelo pay_commissions() quando este vale é finalmente descontado de um pagamento.
  -- null = ainda pendente (saldo em aberto da colaboradora).
  commission_payment_id uuid references public.commission_payments (id) on delete set null,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now()
);
create index vales_colaboradora_idx on public.vales (colaboradora_id, data);
create index vales_pending_idx on public.vales (colaboradora_id) where commission_payment_id is null;

alter table public.vales enable row level security;
create policy vales_admin_all on public.vales
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.vales from anon;

-- -------------------------------------------------------------------------------------
-- 4. Pagar Colaboradora — RPC atômica atualizada: desconta automaticamente os vales em
--    aberto (mais antigos primeiro), sem exceder a comissão bruta do lote. Um vale maior
--    que a comissão disponível fica parcialmente em aberto e é levado ao próximo pagamento
--    (nunca é "perdido" nem descontado em duplicidade).
-- -------------------------------------------------------------------------------------
drop function if exists public.pay_commissions(uuid, uuid[], text, boolean, numeric, text);

create function public.pay_commissions(
  p_collaborator_id uuid,
  p_commission_ids  uuid[],
  p_payment_method  text,
  p_affect_cash     boolean,
  p_notes           text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name       text;
  v_original   numeric(12,2);
  v_count      integer;
  v_min_date   date;
  v_vale       numeric(12,2);
  v_vale_ids   uuid[];
  v_total      numeric(12,2);
  v_register   uuid;
  v_payment_id uuid;
  v_today      date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradoras podem pagar comissões.' using errcode = '42501';
  end if;
  if p_commission_ids is null or coalesce(array_length(p_commission_ids, 1), 0) = 0 then
    raise exception 'Nenhuma comissão selecionada.';
  end if;

  select full_name into v_name
    from public.profiles where id = p_collaborator_id and role = 'collaborator';
  if v_name is null then
    raise exception 'Colaboradora não encontrada.';
  end if;

  -- Trava as linhas para impedir pagamento/consumo de vale duplicado em cliques simultâneos.
  perform 1 from public.commissions
   where id = any (p_commission_ids) and collaborator_id = p_collaborator_id and is_paid = false
   for update;
  perform 1 from public.vales
   where colaboradora_id = p_collaborator_id and commission_payment_id is null
   for update;

  select coalesce(sum(commission_value), 0), count(*), min(commission_date)
    into v_original, v_count, v_min_date
    from public.commissions
   where id = any (p_commission_ids) and collaborator_id = p_collaborator_id and is_paid = false;

  if v_count <> array_length(p_commission_ids, 1) then
    raise exception 'Algumas comissões já foram pagas ou não pertencem a esta colaboradora. Atualize a tela.';
  end if;

  -- Consome os vales mais antigos em ordem, só até onde a comissão bruta cobre — nunca deixa
  -- o valor a pagar negativo, e nunca marca como consumido um vale que não coube inteiro.
  select coalesce(array_agg(id), '{}'), coalesce(sum(valor), 0)
    into v_vale_ids, v_vale
  from (
    select id, valor, sum(valor) over (order by data, created_at) as running
      from public.vales
     where colaboradora_id = p_collaborator_id and commission_payment_id is null
  ) ordered
  where running <= v_original;

  v_total := greatest(v_original - v_vale, 0);

  if p_affect_cash and v_total > 0 then
    select id into v_register from public.cash_register where status = 'aberto' limit 1;
    if v_register is null then
      raise exception 'Abra o caixa antes de pagar incidindo no caixa.';
    end if;
  end if;

  insert into public.commission_payments (
    collaborator_id, collaborator_name, total_amount, original_amount, vale_amount,
    payment_method, affect_cash, period_start, period_end, services_count, notes, paid_by
  ) values (
    p_collaborator_id, v_name, v_total, v_original, v_vale,
    p_payment_method, p_affect_cash, coalesce(v_min_date, v_today), v_today, v_count,
    nullif(btrim(p_notes), ''), auth.uid()
  )
  returning id into v_payment_id;

  update public.commissions
     set is_paid = true, payment_id = v_payment_id
   where id = any (p_commission_ids);

  if array_length(v_vale_ids, 1) > 0 then
    update public.vales set commission_payment_id = v_payment_id where id = any (v_vale_ids);
  end if;

  if p_affect_cash and v_total > 0 then
    insert into public.cash_transactions (
      cash_register_id, type, amount, payment_method, description, category,
      commission_payment_id, affect_cash, created_by
    ) values (
      v_register, 'saida', v_total, p_payment_method,
      'Pagamento comissão — ' || v_name, 'comissao', v_payment_id, true, auth.uid()
    );
  end if;

  return v_payment_id;
end;
$$;

revoke execute on function public.pay_commissions(uuid, uuid[], text, boolean, text) from public, anon;
grant  execute on function public.pay_commissions(uuid, uuid[], text, boolean, text) to authenticated;

-- -------------------------------------------------------------------------------------
-- 5. Fotos do cliente — ficha de anamnese e acompanhamento (antes/depois, evolução)
-- -------------------------------------------------------------------------------------
create table public.cliente_fotos (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clients (id) on delete cascade,
  tipo          text not null check (tipo in ('anamnese', 'acompanhamento')),
  nome          text not null,
  url           text not null,
  storage_path  text not null,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index cliente_fotos_cliente_idx on public.cliente_fotos (cliente_id, tipo, created_at desc);

alter table public.cliente_fotos enable row level security;
create policy cliente_fotos_staff_all on public.cliente_fotos
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
revoke all on public.cliente_fotos from anon;

-- Bucket privado: leitura/escrita só via sessão autenticada de admin/colaboradora (RLS abaixo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cliente-fotos', 'cliente-fotos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy storage_cliente_fotos_select on storage.objects
  for select to authenticated using (bucket_id = 'cliente-fotos' and public.is_staff());
create policy storage_cliente_fotos_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'cliente-fotos' and public.is_staff());
create policy storage_cliente_fotos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'cliente-fotos' and public.is_staff())
  with check (bucket_id = 'cliente-fotos' and public.is_staff());
create policy storage_cliente_fotos_delete on storage.objects
  for delete to authenticated using (bucket_id = 'cliente-fotos' and public.is_staff());

-- -------------------------------------------------------------------------------------
-- 6. Realtime para as novas tabelas usadas em telas ao vivo
-- -------------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['vales', 'mega_especificacoes', 'cliente_fotos'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then
        null;  -- já publicada
      end;
    end loop;
  end if;
end;
$$;
