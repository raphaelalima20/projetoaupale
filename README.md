# AUPALE — Salão de Beleza

Sistema de gestão do salão AUPALE. Next.js 14 (App Router) + Supabase + Tailwind CSS.
Baseado no sistema Ilza Hair, com identidade visual própria, tema claro/escuro, data de
nascimento de clientes e mensagens automáticas por WhatsApp.

## Rodando

```bash
npm install
cp .env.example .env.local   # preencha as chaves do Supabase
npm run dev                  # http://localhost:3000
```

> Nunca rode `npm run build` com o servidor de desenvolvimento ativo.

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente (navegador) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Somente servidor** (rotas `/api`). Nunca expor no client |
| `CRON_SECRET` | Segredo do cron diário do WhatsApp (Vercel envia como `Authorization: Bearer`) |

## Banco de dados (Supabase)

1. Abra **SQL Editor** e execute `supabase/migrations/20260921000000_aupale_schema.sql` **uma vez**
   (tabelas, funções, triggers, RLS, views públicas, buckets de storage e seeds).
2. Abra `/login` e use **"Primeiro acesso? Criar conta admin"**. Faça isso logo após o deploy: o
   primeiro acesso fica aberto até existir uma administradora.
3. (Produção) Configure um SMTP próprio em *Authentication → SMTP*: o e-mail padrão do Supabase só
   entrega para membros da organização, e a recuperação de senha da administradora depende dele.

Validação local do schema (Postgres real em WASM, sem tocar no Supabase): `npm run db:check`.

### Segurança em resumo

- Visitante (sem login) **não lê tabelas com dados pessoais**: usa só as views `salon_public`,
  `public_collaborators`, `busy_slots`, `public_schedule_blocks` e as RPCs `find_active_packages` /
  `admin_exists`. Token do Mercado Pago, CPF/endereço/convites e a config do WhatsApp ficam fora do alcance.
- Agendar (público ou manual), concluir atendimento e pagar comissão passam por API server-side ou
  RPC atômica — a origem (manual/app) e os preços vêm do servidor.
- Comissão: percentual individual da colaboradora (normal ou *químico*). Colaboradora nunca digita a
  própria comissão; só a administradora pode sobrescrever ao concluir.

## WhatsApp

Configurações → **WhatsApp**: provedor (Z-API, Evolution API ou Cloud API da Meta), URL, token e
instância, botão **Testar conexão**, liga/desliga por tipo de mensagem, editor de templates com
prévia e histórico de envios (auditoria).

| Rota | O que faz |
| --- | --- |
| `POST /api/whatsapp/enviar` | Envia (ou reenvia) uma mensagem da fila |
| `GET/POST /api/whatsapp/processar-fila` | Envia as mensagens vencidas (claim atômico, 3 tentativas) |
| `GET/POST /api/whatsapp/lembrete-agendamentos` | Cria lembretes dos agendamentos de amanhã |
| `GET/POST /api/whatsapp/aniversariantes` | Cria mensagens de aniversário do dia |
| `GET /api/cron/whatsapp` | Rotina diária: aniversariantes + lembretes + envio |

Ao criar um agendamento, a confirmação e o lembrete (manhã do dia anterior, 08h) entram na fila
automaticamente se o WhatsApp estiver ativo. O cron diário está em `vercel.json` (11:00 UTC = 08:00
em Brasília). As rotas exigem sessão de administradora **ou** `Authorization: Bearer $CRON_SECRET`.
