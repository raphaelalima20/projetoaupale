-- =====================================================================================
-- AUPALE — Ajustes: QR Code Pix nas configurações
-- Aditiva a 20260921000000_aupale_schema.sql + 20260922000000_aupale_features2.sql.
-- Os outros 4 ajustes deste lote (excluir colaboradora, pacotes no fechamento,
-- remover promissória da visão do cliente, máscara de CPF) não exigem mudança de schema.
-- =====================================================================================

alter table public.salon_settings
  add column if not exists pix_qrcode_url text;

-- Recria a view pública incluindo a nova coluna (imagem do QR, sem dado sensível).
-- Postgres só aceita coluna NOVA no FIM da lista em "create or replace view".
create or replace view public.salon_public as
  select id, name, subtitle, phone, address, city, opening_time, closing_time, working_days,
         pix_key, pix_key_type, pix_beneficiary, mercado_pago_enabled,
         mercado_pago_link, logo_url, pix_qrcode_url
    from public.salon_settings;
