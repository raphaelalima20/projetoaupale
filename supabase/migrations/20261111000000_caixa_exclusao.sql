-- =====================================================================================
-- AUPALE — Exclusão de movimentações de caixa + totais do fechamento sempre consistentes
-- Aditiva às migrações anteriores. Pode ser colada com o app rodando.
--
-- Os totais gravados em cash_register (total_entries, total_exits, total_day, total_pix...)
-- eram uma "foto" tirada no fechamento: se uma transação era excluída depois (pelo app ou
-- direto no Supabase), o resumo do fechamento continuava somando o valor que já não existe.
-- Agora um trigger recalcula esses campos a partir das transações reais sempre que uma
-- transação de um caixa FECHADO é inserida, alterada ou excluída. (Caixa aberto não precisa:
-- a tela calcula ao vivo e os campos só são gravados no momento do fechamento.)
-- =====================================================================================

-- Mesma regra de src/lib/cash.ts → computeCashSummary / computePaymentTotals:
--   entradas/saídas: todas as transações do caixa (inclusive "fora do caixa");
--   totais por forma de pagamento: apenas entradas.
create or replace function public.recalc_cash_register_totals(p_register_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_register_id is null then
    return;
  end if;

  update public.cash_register r
     set total_entries  = coalesce(t.entries, 0),
         total_exits    = coalesce(t.exits, 0),
         total_day      = coalesce(t.entries, 0) - coalesce(t.exits, 0),
         total_pix      = coalesce(t.pix, 0),
         total_dinheiro = coalesce(t.dinheiro, 0),
         total_credito  = coalesce(t.credito, 0),
         total_debito   = coalesce(t.debito, 0)
    from (
      select
        sum(amount) filter (where type = 'entrada')                               as entries,
        sum(amount) filter (where type = 'saida')                                 as exits,
        sum(amount) filter (where type = 'entrada' and payment_method = 'pix')      as pix,
        sum(amount) filter (where type = 'entrada' and payment_method = 'dinheiro') as dinheiro,
        sum(amount) filter (where type = 'entrada' and payment_method = 'credito')  as credito,
        sum(amount) filter (where type = 'entrada' and payment_method = 'debito')   as debito
      from public.cash_transactions
      where cash_register_id = p_register_id
    ) t
   where r.id = p_register_id
     and r.status = 'fechado';
end;
$$;

revoke execute on function public.recalc_cash_register_totals(uuid) from public, anon, authenticated;

create or replace function public.cash_transactions_recalc_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recalc_cash_register_totals(old.cash_register_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE')
     and (tg_op = 'INSERT' or new.cash_register_id is distinct from old.cash_register_id) then
    perform public.recalc_cash_register_totals(new.cash_register_id);
  end if;
  return null;
end;
$$;

drop trigger if exists cash_transactions_recalc_totals on public.cash_transactions;
create trigger cash_transactions_recalc_totals
  after insert or update or delete on public.cash_transactions
  for each row execute function public.cash_transactions_recalc_totals();

-- Corrige agora os fechamentos que já estão desatualizados (ex.: transação apagada direto no
-- Supabase antes desta migração).
do $$
declare
  r record;
begin
  for r in select id from public.cash_register where status = 'fechado' loop
    perform public.recalc_cash_register_totals(r.id);
  end loop;
end;
$$;

-- -------------------------------------------------------------------------------------
-- RLS: policies explícitas por comando. Só admin lê/escreve; DELETE exclusivo de admin.
-- (Colaboradoras continuam passando pelas rotas de API com service-role.)
-- -------------------------------------------------------------------------------------
drop policy if exists cash_transactions_admin_all on public.cash_transactions;
drop policy if exists cash_transactions_admin_select on public.cash_transactions;
drop policy if exists cash_transactions_admin_insert on public.cash_transactions;
drop policy if exists cash_transactions_admin_update on public.cash_transactions;
drop policy if exists cash_transactions_admin_delete on public.cash_transactions;

create policy cash_transactions_admin_select on public.cash_transactions
  for select to authenticated using (public.is_admin());
create policy cash_transactions_admin_insert on public.cash_transactions
  for insert to authenticated with check (public.is_admin());
create policy cash_transactions_admin_update on public.cash_transactions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy cash_transactions_admin_delete on public.cash_transactions
  for delete to authenticated using (public.is_admin());

-- Realtime: com REPLICA IDENTITY FULL o evento DELETE carrega a linha antiga inteira
-- (inclusive cash_register_id), então as telas abertas conseguem reagir à exclusão.
alter table public.cash_transactions replica identity full;
