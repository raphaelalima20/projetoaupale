-- =====================================================================================
-- AUPALE — Admin que também atua como colaboradora (exceção configurável por admin)
-- Aditiva às migrações anteriores. Não existe tabela "collaborators": colaboradoras são
-- linhas de profiles (profiles.id = auth.users.id). Por isso a flag mora no próprio perfil
-- admin — nenhum segundo login/registro é criado; agenda, comissões e vales já se apoiam
-- em profiles.id.
-- =====================================================================================

alter table public.profiles
  add column if not exists is_also_collaborator boolean not null default false;

-- Só admin pode ter a flag (colaboradora normal já é colaboradora).
alter table public.profiles
  drop constraint if exists profiles_also_collab_admin_only;
alter table public.profiles
  add constraint profiles_also_collab_admin_only
  check (not is_also_collaborator or role = 'admin');

-- Profissionais disponíveis (agenda pública, agendamento manual, grade, comissões).
create or replace view public.public_collaborators as
  select id, full_name, specialty, photo_url, avatar_color, is_active
    from public.profiles
   where is_active and (role = 'collaborator' or (role = 'admin' and is_also_collaborator));

-- pay_commissions: passa a aceitar admin-colaboradora como beneficiária (mesmo corpo da versão
-- anterior; só a checagem de perfil mudou).
create or replace function public.pay_commissions(
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
    from public.profiles
   where id = p_collaborator_id
     and (role = 'collaborator' or (role = 'admin' and is_also_collaborator));
  if v_name is null then
    raise exception 'Colaboradora não encontrada.';
  end if;

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

-- Ativa para a Pamela (comissão 0% por padrão — ela ajusta em Configurações). Se a conta dela
-- ainda não existir quando esta migração rodar, este UPDATE é um no-op: basta ligar o toggle
-- "Também atendo como profissional" em Configurações depois de criar a conta.
update public.profiles
   set is_also_collaborator = true
 where role = 'admin' and lower(email) = 'pamelaesteves174@gmail.com';
