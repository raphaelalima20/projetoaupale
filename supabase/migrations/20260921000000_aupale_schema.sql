-- =====================================================================================
-- AUPALE — schema completo (tabelas, funções, triggers, RLS, views públicas, storage, seeds)
--
-- Reconstruído a partir da aplicação Ilza Hair (o repositório original não traz o SQL) e
-- adaptado para o AUPALE: data_nascimento em clients + infraestrutura de WhatsApp.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Ele é idempotente apenas para seeds/buckets; as tabelas são criadas do zero.
--
-- Princípios de segurança (mais restritivos que o app original):
--   * O visitante (anon) NUNCA lê tabelas com dados pessoais: usa apenas as views públicas
--     (salon_public, public_collaborators, busy_slots, public_schedule_blocks) e RPCs.
--   * Token do Mercado Pago, config do WhatsApp e CPF/endereço/convites ficam fora do alcance anon.
--   * Escritas sensíveis (agendar, concluir, pagar comissão) passam por API server-side ou RPC.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 0. Helpers genéricos
-- -------------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Perfis (admin / colaboradora) — 1:1 com auth.users
-- -------------------------------------------------------------------------------------
create table public.profiles (
  id                             uuid primary key references auth.users (id) on delete cascade,
  full_name                      text        not null,
  email                          text,
  phone                          text,
  cpf                            text,
  address                        text,
  role                           text        not null default 'collaborator'
                                   check (role in ('admin', 'collaborator')),
  specialty                      text        not null default '',
  -- Percentual individual de comissão: normal e para serviços com a tag "químico".
  commission_percentage          numeric(5,2) not null default 0
                                   check (commission_percentage between 0 and 100),
  commission_chemical_percentage numeric(5,2) not null default 0
                                   check (commission_chemical_percentage between 0 and 100),
  photo_url                      text,
  avatar_color                   text,
  is_active                      boolean     not null default true,
  -- Sistema de convite CUSTOMIZADO (não usa convites nativos do Supabase).
  invite_token                   text unique,
  invite_accepted                boolean     not null default false,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Funções de autorização usadas pelas policies. SECURITY DEFINER evita recursão de RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'collaborator') and is_active
  );
$$;

-- Usada na tela de login para decidir se mostra "Primeiro acesso" (anon não lê profiles).
create or replace function public.admin_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where role = 'admin');
$$;

-- -------------------------------------------------------------------------------------
-- 2. Clientes (com data de nascimento — adaptação AUPALE)
-- -------------------------------------------------------------------------------------
create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  name             text        not null,
  phone            text        not null unique check (phone ~ '^[0-9]{10,13}$'),
  data_nascimento  date,                       -- opcional: só a admin preenche
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index clients_birthday_idx
  on public.clients ((extract(month from data_nascimento)), (extract(day from data_nascimento)))
  where data_nascimento is not null;
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------------------
-- 3. Serviços e pacotes
-- -------------------------------------------------------------------------------------
create sequence public.services_sort_seq;

create table public.services (
  id                      uuid primary key default gen_random_uuid(),
  name                    text        not null,
  description             text,
  type                    text        not null default 'individual' check (type in ('individual', 'pacote')),
  price                   numeric(10,2) not null default 0 check (price >= 0),
  duration_minutes        integer     not null default 60,
  -- Colunas legadas de comissão por serviço (a comissão real é por colaboradora + tag químico).
  commission_value        numeric(10,2) not null default 0,
  commission_is_percentage boolean    not null default true,
  is_chemical             boolean     not null default false,  -- tag "químico"
  is_variable_price       boolean     not null default false,  -- "a partir de"
  package_services        text,
  package_period          text,
  is_active               boolean     not null default true,
  sort_order              integer     not null default nextval('public.services_sort_seq'),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------------------
-- 4. Caixa
-- -------------------------------------------------------------------------------------
create table public.cash_register (
  id              uuid primary key default gen_random_uuid(),
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  opening_amount  numeric(12,2) not null default 0,
  status          text        not null default 'aberto' check (status in ('aberto', 'fechado')),
  total_pix       numeric(12,2) not null default 0,
  total_dinheiro  numeric(12,2) not null default 0,
  total_credito   numeric(12,2) not null default 0,
  total_debito    numeric(12,2) not null default 0,
  total_entries   numeric(12,2) not null default 0,
  total_exits     numeric(12,2) not null default 0,
  total_day       numeric(12,2) not null default 0,
  opened_by       uuid references public.profiles (id) on delete set null,
  closed_by       uuid references public.profiles (id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);
-- Abertura/fechamento diário obrigatório: no máximo UM caixa aberto por vez.
create unique index cash_register_single_open on public.cash_register ((status)) where status = 'aberto';
create index cash_register_opened_at_idx on public.cash_register (opened_at);

-- FKs para appointments / product_sales / commission_payments são adicionadas ao final
-- (dependência circular entre as tabelas).
create table public.cash_transactions (
  id                    uuid primary key default gen_random_uuid(),
  cash_register_id      uuid references public.cash_register (id) on delete set null,
  type                  text        not null check (type in ('entrada', 'saida')),
  amount                numeric(12,2) not null check (amount >= 0),
  payment_method        text        not null check (payment_method in ('pix', 'dinheiro', 'credito', 'debito', 'promissoria')),
  description           text        not null default '',
  category              text,
  appointment_id        uuid,
  product_sale_id       uuid,
  commission_payment_id uuid,
  affect_cash           boolean     not null default true,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now()
);
create index cash_transactions_register_idx on public.cash_transactions (cash_register_id);
create index cash_transactions_created_at_idx on public.cash_transactions (created_at);

-- -------------------------------------------------------------------------------------
-- 5. Pacotes vendidos a clientes
-- -------------------------------------------------------------------------------------
create table public.client_packages (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid references public.clients (id) on delete set null,
  client_name          text        not null,
  client_phone         text        not null,
  package_service_id   uuid references public.services (id) on delete set null,
  package_name         text        not null,
  package_description  text,
  total_sessions       integer     not null check (total_sessions > 0),
  used_sessions        integer     not null default 0 check (used_sessions >= 0),
  total_price          numeric(12,2) not null default 0,
  session_value        numeric(12,2) not null default 0,
  payment_method       text check (payment_method in ('pix', 'dinheiro', 'credito', 'debito', 'promissoria')),
  status               text        not null default 'ativo' check (status in ('ativo', 'concluido', 'expirado')),
  purchased_at         timestamptz not null default now(),
  expires_at           timestamptz,
  cash_transaction_id  uuid references public.cash_transactions (id) on delete set null,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index client_packages_phone_idx on public.client_packages (client_phone) where status = 'ativo';
create trigger client_packages_set_updated_at before update on public.client_packages
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------------------
-- 6. Agendamentos
-- -------------------------------------------------------------------------------------
create table public.appointments (
  id                     uuid primary key default gen_random_uuid(),
  client_id              uuid references public.clients (id) on delete set null,
  client_name            text        not null,
  client_phone           text        not null,
  collaborator_id        uuid references public.profiles (id) on delete set null,
  service_id             uuid references public.services (id) on delete set null,
  service_name           text        not null default '',
  service_price          numeric(10,2) not null default 0,
  commission_value       numeric(10,2) not null default 0,
  appointment_date       date        not null,
  appointment_time       time        not null,
  status                 text        not null default 'agendado' check (status in ('agendado', 'concluido', 'cancelado')),
  origin                 text        not null default 'manual' check (origin in ('manual', 'app')),
  payment_method         text check (payment_method in ('pix', 'dinheiro', 'credito', 'debito', 'promissoria')),
  notes                  text,
  created_by             uuid references public.profiles (id) on delete set null,
  concluded_at           timestamptz,
  discount_amount        numeric(10,2) not null default 0,
  surcharge_amount       numeric(10,2) not null default 0,
  surcharge_description  text,
  final_amount           numeric(10,2),
  is_package_session     boolean     not null default false,
  package_id             uuid references public.client_packages (id) on delete set null,
  package_session_value  numeric(10,2),
  is_split_payment       boolean     not null default false,
  payment_method_2       text check (payment_method_2 in ('pix', 'dinheiro', 'credito', 'debito', 'promissoria')),
  payment_amount_1       numeric(10,2),
  payment_amount_2       numeric(10,2),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index appointments_date_idx on public.appointments (appointment_date);
create index appointments_collab_date_idx on public.appointments (collaborator_id, appointment_date);
create index appointments_package_idx on public.appointments (package_id) where package_id is not null;
-- Nunca dois atendimentos ativos no mesmo horário exato para a mesma profissional (anti-corrida).
create unique index appointments_slot_unique
  on public.appointments (collaborator_id, appointment_date, appointment_time)
  where status <> 'cancelado' and collaborator_id is not null;
create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------------------
-- 7. Comissões
-- -------------------------------------------------------------------------------------
create table public.commission_payments (
  id                 uuid primary key default gen_random_uuid(),
  collaborator_id    uuid not null references public.profiles (id) on delete restrict,
  collaborator_name  text        not null,
  total_amount       numeric(12,2) not null check (total_amount >= 0),   -- valor efetivamente pago
  payment_method     text        not null check (payment_method in ('pix', 'dinheiro', 'credito', 'debito', 'promissoria')),
  affect_cash        boolean     not null default true,
  period_start       date        not null,
  period_end         date        not null,
  services_count     integer     not null default 0,
  notes              text,
  paid_by            uuid references public.profiles (id) on delete set null,
  paid_at            timestamptz not null default now(),
  vale_amount        numeric(12,2) not null default 0,                    -- abatimento (vale)
  original_amount    numeric(12,2),                                       -- comissão bruta antes do vale
  created_at         timestamptz not null default now()
);
create index commission_payments_collab_idx on public.commission_payments (collaborator_id, paid_at desc);

create table public.commissions (
  id               uuid primary key default gen_random_uuid(),
  collaborator_id  uuid not null references public.profiles (id) on delete cascade,
  appointment_id   uuid references public.appointments (id) on delete set null,
  service_name     text        not null,
  client_name      text        not null,
  service_value    numeric(12,2) not null default 0,
  commission_value numeric(12,2) not null default 0,
  commission_date  date        not null,
  is_paid          boolean     not null default false,
  payment_id       uuid references public.commission_payments (id) on delete set null,
  created_at       timestamptz not null default now()
);
create unique index commissions_appointment_unique on public.commissions (appointment_id) where appointment_id is not null;
create index commissions_pending_idx on public.commissions (collaborator_id) where is_paid = false;
create index commissions_date_idx on public.commissions (commission_date);

-- -------------------------------------------------------------------------------------
-- 8. Produtos, estoque, vendas, pedidos online
-- -------------------------------------------------------------------------------------
create sequence public.products_sort_seq;

create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  name               text        not null,
  brand              text,
  description        text,
  price              numeric(10,2) not null default 0 check (price >= 0),
  promotional_price  numeric(10,2) check (promotional_price is null or promotional_price >= 0),  -- "por" (price = "de")
  stock_quantity     integer     not null default 0 check (stock_quantity >= 0),
  min_stock_alert    integer     default 5,
  image_url          text,
  is_active          boolean     not null default true,
  sort_order         integer     not null default nextval('public.products_sort_seq'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_sales (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references public.products (id) on delete set null,
  product_name    text        not null,
  quantity        integer     not null check (quantity > 0),
  unit_price      numeric(10,2) not null,
  total_price     numeric(12,2) not null,
  payment_method  text        not null check (payment_method in ('pix', 'dinheiro', 'credito', 'debito', 'promissoria')),
  client_name     text,
  client_phone    text,
  sold_by         uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index product_sales_created_at_idx on public.product_sales (created_at);

create table public.cart_orders (
  id              uuid primary key default gen_random_uuid(),
  client_name     text,
  client_phone    text,
  items           jsonb       not null default '[]'::jsonb,
  total           numeric(12,2) not null default 0,
  payment_method  text check (payment_method in ('pix', 'dinheiro', 'credito', 'debito', 'promissoria')),
  status          text        not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger cart_orders_set_updated_at before update on public.cart_orders
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------------------
-- 9. Promissórias / a prazo
-- -------------------------------------------------------------------------------------
create table public.receivables (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references public.clients (id) on delete set null,
  client_name       text        not null,
  client_phone      text,
  appointment_id    uuid references public.appointments (id) on delete set null,
  service_name      text,
  original_amount   numeric(12,2) not null,
  remaining_amount  numeric(12,2) not null,
  status            text        not null default 'pendente' check (status in ('pendente', 'parcial', 'pago')),
  notes             text,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index receivables_open_idx on public.receivables (created_at) where status <> 'pago';
create trigger receivables_set_updated_at before update on public.receivables
  for each row execute function public.set_updated_at();

create table public.receivable_payments (
  id                   uuid primary key default gen_random_uuid(),
  receivable_id        uuid not null references public.receivables (id) on delete cascade,
  amount               numeric(12,2) not null check (amount > 0),
  payment_method       text        not null check (payment_method in ('pix', 'dinheiro', 'credito', 'debito', 'promissoria')),
  cash_transaction_id  uuid references public.cash_transactions (id) on delete set null,
  received_by          uuid references public.profiles (id) on delete set null,
  notes                text,
  created_at           timestamptz not null default now()
);
create index receivable_payments_receivable_idx on public.receivable_payments (receivable_id);

-- -------------------------------------------------------------------------------------
-- 10. Folgas / indisponibilidade das colaboradoras
-- -------------------------------------------------------------------------------------
create table public.schedule_blocks (
  id               uuid primary key default gen_random_uuid(),
  collaborator_id  uuid not null references public.profiles (id) on delete cascade,
  start_date       date        not null,
  end_date         date        not null,
  block_type       text        not null default 'full_day' check (block_type in ('full_day', 'morning', 'afternoon')),
  start_time       time,
  end_time         time,       -- null/00:00 = bloqueada o dia todo também em end_date
  reason           text,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  check (end_date >= start_date)
);
create index schedule_blocks_collab_idx on public.schedule_blocks (collaborator_id, start_date, end_date);

-- -------------------------------------------------------------------------------------
-- 11. Configurações do salão (singleton)
-- -------------------------------------------------------------------------------------
create table public.salon_settings (
  id                    uuid primary key default gen_random_uuid(),
  name                  text        not null default 'AUPALE',
  subtitle              text        default 'Salão de Beleza',
  phone                 text,
  address               text,
  city                  text        not null default 'SAO PAULO',   -- cidade do BR Code do Pix
  opening_time          time        not null default '08:00',
  closing_time          time        not null default '19:00',
  working_days          integer[]   not null default '{1,2,3,4,5,6}',
  pix_key               text,
  pix_key_type          text,
  pix_beneficiary       text,
  mercado_pago_token    text,       -- SECRETO: nunca exposto ao anon (fora da view salon_public)
  mercado_pago_enabled  boolean     not null default false,
  mercado_pago_link     text,       -- link de pagamento público mostrado ao cliente
  logo_url              text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index salon_settings_singleton on public.salon_settings ((true));
create trigger salon_settings_set_updated_at before update on public.salon_settings
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------------------
-- 12. WhatsApp — infraestrutura (adaptação AUPALE)
-- -------------------------------------------------------------------------------------
create table public.whatsapp_config (
  id          uuid primary key default gen_random_uuid(),
  token_api   text,
  url_api     text,
  instancia   text,
  provider    text        not null default 'z-api' check (provider in ('z-api', 'evolution', 'meta')),
  ativo       boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index whatsapp_config_singleton on public.whatsapp_config ((true));
create trigger whatsapp_config_set_updated_at before update on public.whatsapp_config
  for each row execute function public.set_updated_at();

create table public.whatsapp_templates (
  id                 uuid primary key default gen_random_uuid(),
  tipo               text        not null unique check (tipo in ('lembrete', 'aniversario', 'confirmacao')),
  nome               text        not null,
  mensagem_template  text        not null,   -- variáveis: {{nome}} {{servico}} {{profissional}} {{data}} {{hora}}
  ativo              boolean     not null default true,   -- liga/desliga cada tipo de mensagem
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger whatsapp_templates_set_updated_at before update on public.whatsapp_templates
  for each row execute function public.set_updated_at();

-- A própria fila é o log de auditoria: nada é apagado ao enviar, só muda de status.
create table public.whatsapp_mensagens_fila (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid references public.clients (id) on delete set null,
  agendamento_id  uuid references public.appointments (id) on delete cascade,
  tipo            text        not null check (tipo in ('lembrete', 'aniversario', 'confirmacao')),
  mensagem        text        not null,
  telefone        text        not null,
  status          text        not null default 'pendente' check (status in ('pendente', 'enviando', 'enviado', 'erro')),
  agendado_para   timestamptz not null default now(),
  enviado_em      timestamptz,
  erro_msg        text,
  tentativas      integer     not null default 0,
  reivindicada_em timestamptz,          -- quando um worker pegou a mensagem (recupera envios interrompidos)
  -- Idempotência: lembrete:<agendamento>, confirmacao:<agendamento>, aniversario:<cliente>:<ano>
  chave_unica     text unique,
  created_at      timestamptz not null default now()
);
create index whatsapp_fila_due_idx on public.whatsapp_mensagens_fila (status, agendado_para);
create index whatsapp_fila_agendamento_idx on public.whatsapp_mensagens_fila (agendamento_id);

-- -------------------------------------------------------------------------------------
-- 13. Foreign keys circulares do caixa
-- -------------------------------------------------------------------------------------
alter table public.cash_transactions
  add constraint cash_transactions_appointment_fk
    foreign key (appointment_id) references public.appointments (id) on delete set null,
  add constraint cash_transactions_product_sale_fk
    foreign key (product_sale_id) references public.product_sales (id) on delete set null,
  add constraint cash_transactions_commission_payment_fk
    foreign key (commission_payment_id) references public.commission_payments (id) on delete set null;

-- =====================================================================================
-- TRIGGERS DE NEGÓCIO
-- =====================================================================================

-- 14. Cadastro automático de cliente ao agendar (nome + telefone) --------------------
create or replace function public.auto_create_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
begin
  if new.client_id is null and new.client_phone is not null then
    select id into v_client from public.clients where phone = new.client_phone;
    if v_client is null then
      insert into public.clients (name, phone)
      values (btrim(new.client_name), new.client_phone)
      on conflict (phone) do nothing
      returning id into v_client;
      if v_client is null then
        select id into v_client from public.clients where phone = new.client_phone;
      end if;
    end if;
    new.client_id := v_client;
  end if;
  return new;
end;
$$;
create trigger appointments_auto_create_client before insert on public.appointments
  for each row execute function public.auto_create_client();

-- 15. Colaboradora só pode cancelar o próprio agendamento pelo client (concluir = API) ---
create or replace function public.guard_appointment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (API server-side) e chamadas internas passam direto.
  if auth.role() is distinct from 'authenticated' or public.is_admin() then
    return new;
  end if;

  if old.collaborator_id is distinct from auth.uid() then
    raise exception 'Sem permissão para alterar este agendamento.' using errcode = '42501';
  end if;
  if not (old.status = 'agendado' and new.status = 'cancelado') then
    raise exception 'Colaboradoras só podem cancelar agendamentos em aberto.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Apenas o status pode ser alterado.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger appointments_guard_update before update on public.appointments
  for each row execute function public.guard_appointment_update();

-- 16. Comissão gerada ao concluir o atendimento --------------------------------------
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
      service_value, commission_value, commission_date
    ) values (
      new.collaborator_id, new.id, new.service_name, new.client_name,
      coalesce(new.final_amount, new.package_session_value, new.service_price, 0),
      coalesce(new.commission_value, 0),
      new.appointment_date
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger appointments_create_commission after update of status on public.appointments
  for each row execute function public.create_commission_on_conclude();

-- 17. Sessão de pacote consumida ao concluir -----------------------------------------
create or replace function public.increment_package_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'concluido' and old.status is distinct from 'concluido'
     and new.is_package_session and new.package_id is not null then
    update public.client_packages
       set used_sessions = used_sessions + 1,
           status = case when used_sessions + 1 >= total_sessions then 'concluido' else status end
     where id = new.package_id;
  end if;
  return new;
end;
$$;
create trigger appointments_increment_package after update of status on public.appointments
  for each row execute function public.increment_package_session();

-- 18. Cancelar agendamento remove lembretes/confirmações ainda pendentes --------------
create or replace function public.cancel_pending_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelado' and old.status is distinct from 'cancelado' then
    delete from public.whatsapp_mensagens_fila
     where agendamento_id = new.id and status = 'pendente';
  end if;
  return new;
end;
$$;
create trigger appointments_cancel_whatsapp after update of status on public.appointments
  for each row execute function public.cancel_pending_whatsapp();

-- 19. Baixa de estoque ao vender produto ---------------------------------------------
create or replace function public.decrement_stock_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null then
    update public.products
       set stock_quantity = stock_quantity - new.quantity
     where id = new.product_id and stock_quantity >= new.quantity;
    if not found then
      raise exception 'Estoque insuficiente para "%".', new.product_name;
    end if;
  end if;
  return new;
end;
$$;
create trigger product_sales_decrement_stock before insert on public.product_sales
  for each row execute function public.decrement_stock_on_sale();

-- =====================================================================================
-- RPCs
-- =====================================================================================

-- 20. Pagar comissões: atômico (pagamento + comissões zeradas + saída no caixa) ------
create or replace function public.pay_commissions(
  p_collaborator_id uuid,
  p_commission_ids  uuid[],
  p_payment_method  text,
  p_affect_cash     boolean,
  p_vale_amount     numeric,
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

  -- Trava as linhas para impedir pagamento duplicado em cliques/abas simultâneas.
  perform 1 from public.commissions
   where id = any (p_commission_ids) and collaborator_id = p_collaborator_id and is_paid = false
   for update;

  select coalesce(sum(commission_value), 0), count(*), min(commission_date)
    into v_original, v_count, v_min_date
    from public.commissions
   where id = any (p_commission_ids) and collaborator_id = p_collaborator_id and is_paid = false;

  if v_count <> array_length(p_commission_ids, 1) then
    raise exception 'Algumas comissões já foram pagas ou não pertencem a esta colaboradora. Atualize a tela.';
  end if;

  v_vale  := least(greatest(coalesce(p_vale_amount, 0), 0), v_original);
  v_total := v_original - v_vale;

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

-- 21. Pacotes ativos por telefone (visitante sem login: retorna só o mínimo necessário) ---
create or replace function public.find_active_packages(p_phone text)
returns table (
  id             uuid,
  package_name   text,
  total_sessions integer,
  used_sessions  integer,
  expires_at     timestamptz,
  client_name    text
)
language sql
stable
security definer
set search_path = public
as $$
  select cp.id, cp.package_name, cp.total_sessions, cp.used_sessions, cp.expires_at, cp.client_name
    from public.client_packages cp
   where cp.client_phone = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
     and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 10
     and cp.status = 'ativo'
   order by cp.purchased_at desc;
$$;

-- 22. Fila do WhatsApp: reivindica mensagens vencidas de forma atômica (sem envio duplicado) ---
create or replace function public.claim_whatsapp_messages(p_limit integer default 20)
returns setof public.whatsapp_mensagens_fila
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Recupera mensagens "presas" em 'enviando' (processo interrompido) há mais de 10 minutos.
  update public.whatsapp_mensagens_fila
     set status = 'pendente'
   where status = 'enviando' and reivindicada_em < now() - interval '10 minutes'
     and enviado_em is null and tentativas < 3;

  return query
  update public.whatsapp_mensagens_fila f
     set status = 'enviando', tentativas = f.tentativas + 1, reivindicada_em = now()
   where f.id in (
     select q.id from public.whatsapp_mensagens_fila q
      where q.status = 'pendente' and q.agendado_para <= now()
      order by q.agendado_para
      limit greatest(p_limit, 1)
      for update skip locked
   )
  returning f.*;
end;
$$;

-- 23. Aniversariantes do dia (usada pelo cron do WhatsApp; 29/02 cai em 28/02 nos anos comuns) ---
create or replace function public.birthday_clients(p_month integer, p_day integer, p_include_feb29 boolean default false)
returns table (id uuid, name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.phone
    from public.clients c
   where c.data_nascimento is not null
     and (
       (extract(month from c.data_nascimento) = p_month and extract(day from c.data_nascimento) = p_day)
       or (p_include_feb29 and extract(month from c.data_nascimento) = 2 and extract(day from c.data_nascimento) = 29)
     );
$$;

-- =====================================================================================
-- VIEWS PÚBLICAS (o único acesso do visitante sem login)
-- =====================================================================================
create view public.salon_public as
  select id, name, subtitle, phone, address, city, opening_time, closing_time, working_days,
         pix_key, pix_key_type, pix_beneficiary, mercado_pago_enabled, mercado_pago_link, logo_url
    from public.salon_settings;

create view public.public_collaborators as
  select id, full_name, specialty, photo_url, avatar_color, is_active
    from public.profiles
   where role = 'collaborator' and is_active;

-- Só horários ocupados — sem nome/telefone de ninguém.
create view public.busy_slots as
  select collaborator_id, appointment_date, appointment_time
    from public.appointments
   where status <> 'cancelado' and collaborator_id is not null;

-- Folgas sem o motivo (que pode ser sensível, ex.: atestado).
create view public.public_schedule_blocks as
  select id, collaborator_id, start_date, end_date, block_type, start_time, end_time
    from public.schedule_blocks;

-- =====================================================================================
-- ROW LEVEL SECURITY
-- =====================================================================================
alter table public.profiles                enable row level security;
alter table public.clients                 enable row level security;
alter table public.services                enable row level security;
alter table public.cash_register           enable row level security;
alter table public.cash_transactions       enable row level security;
alter table public.client_packages          enable row level security;
alter table public.appointments            enable row level security;
alter table public.commission_payments     enable row level security;
alter table public.commissions             enable row level security;
alter table public.products                enable row level security;
alter table public.product_sales           enable row level security;
alter table public.cart_orders             enable row level security;
alter table public.receivables             enable row level security;
alter table public.receivable_payments     enable row level security;
alter table public.schedule_blocks         enable row level security;
alter table public.salon_settings          enable row level security;
alter table public.whatsapp_config         enable row level security;
alter table public.whatsapp_templates      enable row level security;
alter table public.whatsapp_mensagens_fila enable row level security;

-- profiles: cada um lê o próprio; admin lê/edita todos. Criação/convite = API (service role).
create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_admin on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- clients: somente admin (o cadastro automático roda no trigger SECURITY DEFINER).
create policy clients_admin_all on public.clients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- services: catálogo público (ativos); admin gerencia tudo.
create policy services_select_active on public.services
  for select to anon, authenticated using (is_active or public.is_admin());
create policy services_admin_write on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- caixa e financeiro: somente admin (colaboradoras passam por rotas de API).
create policy cash_register_admin_all on public.cash_register
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy cash_transactions_admin_all on public.cash_transactions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy receivables_admin_all on public.receivables
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy receivable_payments_admin_all on public.receivable_payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_sales_admin_all on public.product_sales
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- pacotes vendidos: equipe lê (agendar sessão); admin escreve.
create policy client_packages_staff_select on public.client_packages
  for select to authenticated using (public.is_staff());
create policy client_packages_admin_write on public.client_packages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- agendamentos: equipe enxerga a agenda geral; criação pública/manual passa pela API.
create policy appointments_staff_select on public.appointments
  for select to authenticated using (public.is_staff());
create policy appointments_admin_insert on public.appointments
  for insert to authenticated with check (public.is_admin());
create policy appointments_update on public.appointments
  for update to authenticated
  using (public.is_admin() or collaborator_id = auth.uid())
  with check (public.is_admin() or collaborator_id = auth.uid());
create policy appointments_admin_delete on public.appointments
  for delete to authenticated using (public.is_admin());

-- comissões: admin tudo; colaboradora só as próprias (somente leitura).
create policy commissions_select on public.commissions
  for select to authenticated using (public.is_admin() or collaborator_id = auth.uid());
create policy commission_payments_select on public.commission_payments
  for select to authenticated using (public.is_admin() or collaborator_id = auth.uid());

-- produtos: catálogo público (ativos); admin gerencia.
create policy products_select_active on public.products
  for select to anon, authenticated using (is_active or public.is_admin());
create policy products_admin_write on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- pedidos online: qualquer visitante cria (sempre 'pendente'); admin gerencia.
create policy cart_orders_public_insert on public.cart_orders
  for insert to anon, authenticated with check (status = 'pendente');
create policy cart_orders_admin_all on public.cart_orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- folgas: tabela completa (com motivo) só para admin; demais usam public_schedule_blocks.
create policy schedule_blocks_admin_all on public.schedule_blocks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- configurações: somente admin; visitantes usam a view salon_public.
create policy salon_settings_admin_all on public.salon_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- WhatsApp: config = somente servidor (sem policies => ninguém do client acessa);
-- templates e log = admin.
create policy whatsapp_templates_admin_all on public.whatsapp_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy whatsapp_fila_admin_select on public.whatsapp_mensagens_fila
  for select to authenticated using (public.is_admin());

-- =====================================================================================
-- GRANTS explícitos (defesa em profundidade: RLS + privilégios mínimos)
-- =====================================================================================
revoke all on public.whatsapp_config from anon, authenticated;
revoke all on public.whatsapp_mensagens_fila from anon;
revoke all on public.whatsapp_templates from anon;
revoke all on public.profiles, public.clients, public.cash_register, public.cash_transactions,
              public.client_packages, public.appointments, public.commission_payments,
              public.commissions, public.product_sales, public.receivables,
              public.receivable_payments, public.schedule_blocks, public.salon_settings
  from anon;
revoke insert, update, delete on public.whatsapp_mensagens_fila from authenticated;
revoke insert, update, delete on public.commissions, public.commission_payments from authenticated;

revoke all on public.salon_public, public.public_collaborators, public.busy_slots,
              public.public_schedule_blocks from anon, authenticated;
grant select on public.salon_public, public.public_collaborators, public.busy_slots,
                public.public_schedule_blocks to anon, authenticated;

grant usage, select on sequence public.services_sort_seq, public.products_sort_seq
  to authenticated, service_role;

-- RPCs
revoke execute on function public.pay_commissions(uuid, uuid[], text, boolean, numeric, text) from public, anon;
grant  execute on function public.pay_commissions(uuid, uuid[], text, boolean, numeric, text) to authenticated;
revoke execute on function public.claim_whatsapp_messages(integer) from public, anon, authenticated;
grant  execute on function public.claim_whatsapp_messages(integer) to service_role;
revoke execute on function public.birthday_clients(integer, integer, boolean) from public, anon, authenticated;
grant  execute on function public.birthday_clients(integer, integer, boolean) to service_role;
grant  execute on function public.admin_exists() to anon, authenticated;
grant  execute on function public.find_active_packages(text) to anon, authenticated;

-- =====================================================================================
-- REALTIME (telas que assinam postgres_changes)
-- =====================================================================================
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'appointments', 'cash_register', 'cash_transactions', 'commissions',
      'commission_payments', 'products', 'cart_orders'
    ] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then
        null;  -- já publicada
      end;
    end loop;
  end if;
end;
$$;

-- =====================================================================================
-- STORAGE: buckets públicos de imagem ('produtos' e 'salon'); escrita só admin
-- =====================================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('produtos', 'produtos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('salon',    'salon',    true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública dos arquivos é feita pela URL do bucket público; policies abaixo são das escritas.
create policy storage_admin_select on storage.objects
  for select to authenticated using (bucket_id in ('produtos', 'salon') and public.is_admin());
create policy storage_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id in ('produtos', 'salon') and public.is_admin());
create policy storage_admin_update on storage.objects
  for update to authenticated
  using (bucket_id in ('produtos', 'salon') and public.is_admin())
  with check (bucket_id in ('produtos', 'salon') and public.is_admin());
create policy storage_admin_delete on storage.objects
  for delete to authenticated using (bucket_id in ('produtos', 'salon') and public.is_admin());

-- =====================================================================================
-- SEEDS
-- =====================================================================================
insert into public.salon_settings (name, subtitle, city, opening_time, closing_time)
values ('AUPALE', 'Salão de Beleza', 'SAO PAULO', '08:00', '19:00')
on conflict do nothing;

insert into public.whatsapp_config (provider, ativo)
values ('z-api', false)
on conflict do nothing;

insert into public.whatsapp_templates (tipo, nome, mensagem_template) values
  ('lembrete',
   'Lembrete de agendamento (1 dia antes)',
   'Olá {{nome}}! 😊 Lembramos que você tem um horário amanhã ({{data}}) às {{hora}} na AUPALE. Confirma sua presença? Responda SIM ou NÃO.'),
  ('aniversario',
   'Feliz aniversário',
   'Feliz aniversário, {{nome}}! 🎂✨ A equipe AUPALE deseja um dia incrível pra você! Temos um presente especial esperando por você no salão. 💛'),
  ('confirmacao',
   'Confirmação de agendamento',
   'Olá {{nome}}! Seu agendamento na AUPALE foi confirmado: {{servico}} com {{profissional}} em {{data}} às {{hora}}. Até lá! ✨')
on conflict (tipo) do nothing;
