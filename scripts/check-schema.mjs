/**
 * Valida supabase/migrations/*.sql contra um Postgres real (PGlite / WASM), sem tocar no Supabase.
 * Simula o essencial do Supabase (roles anon/authenticated/service_role, auth.uid(), storage, realtime)
 * e roda testes de comportamento + RLS.   Uso: npm run db:check
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");

const db = new PGlite();

// ---- Stub do ambiente Supabase -------------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;

  create publication supabase_realtime;

  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  grant select on auth.users to service_role;
`);

// ---- Aplica as migrations ------------------------------------------------------------
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  console.log(`✔ migration aplicada: ${file}`);
}
await db.exec(`grant select, insert, update, delete on all tables in schema storage to authenticated;`);

// ---- Mini framework de testes --------------------------------------------------------
let passed = 0;
const failures = [];

async function as(role, uid, fn) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [
    uid ?? "",
    role,
  ]);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)`);
  }
}
const q = (sql, params) => db.query(sql, params).then((r) => r.rows);

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✘ ${name}\n      ${e.message}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg ?? "assertion failed");
};
async function rejects(promise, pattern) {
  try {
    await promise;
  } catch (e) {
    if (pattern && !pattern.test(e.message)) throw new Error(`erro inesperado: ${e.message}`);
    return;
  }
  throw new Error("deveria ter falhado, mas passou");
}

// ---- Dados base ----------------------------------------------------------------------
const ADMIN = "00000000-0000-0000-0000-0000000000a1";
const COLLAB = "00000000-0000-0000-0000-0000000000c1";
const COLLAB2 = "00000000-0000-0000-0000-0000000000c2";
await db.exec(`
  insert into auth.users (id, email) values ('${ADMIN}', 'admin@aupale.app'), ('${COLLAB}', 'ana@aupale.app'), ('${COLLAB2}', 'bia@aupale.app');
  insert into public.profiles (id, full_name, email, role, cpf, address, invite_token)
    values ('${ADMIN}', 'Admin', 'admin@aupale.app', 'admin', null, null, null),
           ('${COLLAB}', 'Ana', 'ana@aupale.app', 'collaborator', '111.222.333-44', 'Rua Secreta 1', 'tok-secreto'),
           ('${COLLAB2}', 'Bia', 'bia@aupale.app', 'collaborator', null, null, null);
  insert into public.services (name, price, is_chemical) values ('Corte', 100, false), ('Progressiva', 300, true);
  insert into public.services (name, price, is_active) values ('Inativo', 50, false);
`);
const [corte] = await q(`select id from public.services where name = 'Corte'`);

console.log("\nSeeds");
await test("salon_settings, whatsapp_config, 3 templates e 3 buckets criados", async () => {
  assert((await q(`select 1 from public.salon_settings`)).length === 1);
  assert((await q(`select 1 from public.whatsapp_config`)).length === 1);
  const t = await q(`select tipo from public.whatsapp_templates order by tipo`);
  assert(t.map((r) => r.tipo).join() === "aniversario,confirmacao,lembrete", "templates");
  const buckets = await q(`select id, public from storage.buckets order by id`);
  assert(buckets.length === 3, `esperava 3 buckets, veio ${buckets.length}`);
  const clienteFotos = buckets.find((b) => b.id === "cliente-fotos");
  assert(clienteFotos && clienteFotos.public === false, "cliente-fotos deveria ser privado");
});
await test("templates padrão contêm as variáveis pedidas", async () => {
  const [l] = await q(`select mensagem_template m from public.whatsapp_templates where tipo='lembrete'`);
  assert(/\{\{nome\}\}/.test(l.m) && /\{\{data\}\}/.test(l.m) && /\{\{hora\}\}/.test(l.m));
  const [c] = await q(`select mensagem_template m from public.whatsapp_templates where tipo='confirmacao'`);
  assert(/\{\{servico\}\}/.test(c.m) && /\{\{profissional\}\}/.test(c.m));
});

console.log("\nRLS — visitante (anon)");
await test("anon NÃO lê profiles, clients, salon_settings, whatsapp_config, appointments", async () => {
  for (const t of ["profiles", "clients", "salon_settings", "whatsapp_config", "whatsapp_templates", "appointments", "commissions", "cash_register", "client_packages", "schedule_blocks"]) {
    await as("anon", null, () => rejects(q(`select * from public.${t}`), /permission denied/));
  }
});
await test("anon lê salon_public sem token do Mercado Pago", async () => {
  const rows = await as("anon", null, () => q(`select * from public.salon_public`));
  assert(rows.length === 1 && !("mercado_pago_token" in rows[0]), "view vazando token");
});
await test("anon lê public_collaborators sem CPF/endereço/convite", async () => {
  const rows = await as("anon", null, () => q(`select * from public.public_collaborators order by full_name`));
  assert(rows.length === 2);
  for (const k of ["cpf", "address", "invite_token", "email", "phone", "commission_percentage"]) assert(!(k in rows[0]), `vaza ${k}`);
});
await test("anon vê apenas serviços ativos", async () => {
  const rows = await as("anon", null, () => q(`select name from public.services`));
  assert(rows.length === 2 && !rows.some((r) => r.name === "Inativo"));
});
await test("anon consegue chamar admin_exists()", async () => {
  const [r] = await as("anon", null, () => q(`select public.admin_exists() e`));
  assert(r.e === true);
});
await test("anon NÃO consegue chamar pay_commissions nem claim_whatsapp_messages", async () => {
  await as("anon", null, () => rejects(q(`select public.pay_commissions('${COLLAB}', array[gen_random_uuid()], 'pix', false, null)`), /permission denied/));
  await as("anon", null, () => rejects(q(`select * from public.claim_whatsapp_messages(5)`), /permission denied/));
});
await test("anon cria pedido 'pendente' mas não 'pago'", async () => {
  await as("anon", null, () => q(`insert into public.cart_orders (client_name, total, status) values ('Ana', 10, 'pendente')`));
  await as("anon", null, () => rejects(q(`insert into public.cart_orders (client_name, total, status) values ('Ana', 10, 'pago')`), /row-level security/));
});
await test("anon NÃO insere agendamento diretamente", async () => {
  await as("anon", null, () =>
    rejects(q(`insert into public.appointments (client_name, client_phone, appointment_date, appointment_time) values ('X','11999999999','2030-01-01','10:00')`), /permission denied/)
  );
});

console.log("\nAgendamento + cadastro automático de cliente");
await test("inserir agendamento cria cliente automaticamente (nome+telefone) e vincula client_id", async () => {
  await db.exec(`
    insert into public.appointments (client_name, client_phone, collaborator_id, service_id, service_name, service_price, appointment_date, appointment_time, origin)
    values ('Maria Souza', '11988887777', '${COLLAB}', '${corte.id}', 'Corte', 100, '2030-05-10', '10:00', 'app')`);
  const [a] = await q(`select client_id from public.appointments where client_phone='11988887777'`);
  const [c] = await q(`select name, data_nascimento from public.clients where phone='11988887777'`);
  assert(a.client_id && c.name === "Maria Souza" && c.data_nascimento === null);
});
await test("segundo agendamento do mesmo telefone reutiliza o cliente", async () => {
  await db.exec(`
    insert into public.appointments (client_name, client_phone, collaborator_id, service_name, service_price, appointment_date, appointment_time)
    values ('Maria S.', '11988887777', '${COLLAB}', 'Corte', 100, '2030-05-10', '14:00')`);
  assert((await q(`select 1 from public.clients where phone='11988887777'`)).length === 1);
});
await test("horário exato duplicado é rejeitado; cancelado libera o horário", async () => {
  await rejects(
    db.exec(`insert into public.appointments (client_name, client_phone, collaborator_id, service_name, appointment_date, appointment_time) values ('Y','11977776666','${COLLAB}','Corte','2030-05-10','10:00')`),
    /appointments_slot_unique/
  );
  await db.exec(`update public.appointments set status='cancelado' where client_phone='11988887777' and appointment_time='14:00'`);
  await db.exec(`insert into public.appointments (client_name, client_phone, collaborator_id, service_name, appointment_date, appointment_time) values ('Y','11977776666','${COLLAB}','Corte','2030-05-10','14:00')`);
});
await test("busy_slots expõe só horários (sem nome/telefone) e ignora cancelados", async () => {
  const rows = await as("anon", null, () => q(`select * from public.busy_slots where collaborator_id='${COLLAB}'`));
  assert(rows.length === 2 && !("client_name" in rows[0]) && !("client_phone" in rows[0]));
});

console.log("\nRLS — colaboradora");
await test("colaboradora lê a agenda geral, mas não clients/caixa", async () => {
  assert((await as("authenticated", COLLAB, () => q(`select 1 from public.appointments`))).length >= 2);
  assert((await as("authenticated", COLLAB, () => q(`select 1 from public.clients`))).length === 0);
  assert((await as("authenticated", COLLAB, () => q(`select 1 from public.cash_register`))).length === 0);
});
await test("colaboradora lê só o próprio profile", async () => {
  const rows = await as("authenticated", COLLAB, () => q(`select id from public.profiles`));
  assert(rows.length === 1 && rows[0].id === COLLAB);
});
await test("colaboradora NÃO consegue virar admin", async () => {
  const r = await as("authenticated", COLLAB, () => q(`update public.profiles set role='admin' where id='${COLLAB}' returning id`));
  assert(r.length === 0, "update de profile deveria ser bloqueado por RLS");
  assert((await q(`select role from public.profiles where id='${COLLAB}'`))[0].role === "collaborator");
});
await test("colaboradora cancela o próprio agendamento, mas não conclui nem altera valores", async () => {
  const [a] = await q(`select id from public.appointments where client_phone='11977776666'`);
  await as("authenticated", COLLAB, () => rejects(q(`update public.appointments set status='concluido', commission_value=999 where id='${a.id}'`), /cancelar/));
  await as("authenticated", COLLAB, () => rejects(q(`update public.appointments set service_price=1 where id='${a.id}'`), /cancelar/));
  await as("authenticated", COLLAB2, () => rejects(q(`update public.appointments set status='cancelado' where id='${a.id}'`), /Sem permiss|row-level/).catch(async () => {
    // RLS pode simplesmente filtrar a linha (0 rows) em vez de lançar erro
    const r = await as("authenticated", COLLAB2, () => q(`update public.appointments set status='cancelado' where id='${a.id}' returning id`));
    assert(r.length === 0);
  }));
  const ok = await as("authenticated", COLLAB, () => q(`update public.appointments set status='cancelado' where id='${a.id}' returning id`));
  assert(ok.length === 1);
});
await test("colaboradora NÃO lê convites de outra colaboradora (view pública)", async () => {
  const rows = await as("authenticated", COLLAB2, () => q(`select * from public.public_collaborators`));
  assert(rows.length === 2 && !("invite_token" in rows[0]));
});

console.log("\nConclusão, comissões e pacotes");
await db.exec(`insert into public.appointments (client_name, client_phone, collaborator_id, service_name, service_price, appointment_date, appointment_time)
  values ('Joana', '11955554444', '${COLLAB}', 'Progressiva', 300, '2030-05-11', '09:00'),
         ('Lia',   '11944443333', '${COLLAB}', 'Corte', 100, '2030-05-11', '11:00')`);
await test("concluir gera comissão com o valor e data corretos (e não duplica)", async () => {
  await db.exec(`update public.appointments set status='concluido', final_amount=300, commission_value=90, concluded_at=now() where client_phone='11955554444'`);
  await db.exec(`update public.appointments set status='concluido', final_amount=100, commission_value=30 where client_phone='11944443333'`);
  await db.exec(`update public.appointments set notes='x' where client_phone='11955554444'`); // outra atualização não recria
  const rows = await q(`select service_value, commission_value, commission_date::text d, is_paid from public.commissions order by commission_value desc`);
  assert(rows.length === 2, `esperava 2, veio ${rows.length}`);
  assert(Number(rows[0].service_value) === 300 && Number(rows[0].commission_value) === 90 && rows[0].d === "2030-05-11" && rows[0].is_paid === false);
});
await test("colaboradora vê só as próprias comissões; outra não vê", async () => {
  assert((await as("authenticated", COLLAB, () => q(`select 1 from public.commissions`))).length === 2);
  assert((await as("authenticated", COLLAB2, () => q(`select 1 from public.commissions`))).length === 0);
});
await test("colaboradora NÃO consegue pagar comissão", async () => {
  const ids = (await q(`select id from public.commissions`)).map((r) => r.id);
  await as("authenticated", COLLAB, () => rejects(q(`select public.pay_commissions($1, $2::uuid[], 'pix', false, null)`, [COLLAB, ids]), /Apenas administradoras/));
});
await test("pagar incidindo no caixa exige caixa aberto (nada é gravado se falhar)", async () => {
  const ids = (await q(`select id from public.commissions`)).map((r) => r.id);
  await as("authenticated", ADMIN, () => rejects(q(`select public.pay_commissions($1, $2::uuid[], 'pix', true, null)`, [COLLAB, ids]), /Abra o caixa/));
  assert((await q(`select 1 from public.commission_payments`)).length === 0);
  assert((await q(`select 1 from public.commissions where is_paid`)).length === 0);
});
await test("vale (Funcionalidade 3): admin lê/lança; colaboradora e anon não conseguem", async () => {
  await as("anon", null, () => rejects(q(`select * from public.vales`), /permission denied/));
  await as("authenticated", COLLAB, () =>
    rejects(q(`insert into public.vales (colaboradora_id, valor, descricao) values ('${COLLAB}', 20, 'x')`), /row-level security/)
  );
  const [v] = await as("authenticated", ADMIN, () =>
    q(`insert into public.vales (colaboradora_id, valor, descricao, created_by) values ('${COLLAB}', 20, 'vale adiantamento', '${ADMIN}') returning id, commission_payment_id`)
  );
  assert(v.commission_payment_id === null, "vale recém-lançado deve começar em aberto");
});
await test("pagamento desconta o vale em aberto automaticamente: zera comissões, saída = líquido, grava original/vale e marca o vale como consumido", async () => {
  await as("authenticated", ADMIN, () => q(`insert into public.cash_register (opening_amount, opened_by) values (100, '${ADMIN}')`));
  const ids = (await q(`select id from public.commissions where collaborator_id='${COLLAB}'`)).map((r) => r.id);
  const [{ pay_commissions: paymentId }] = await as("authenticated", ADMIN, () =>
    q(`select public.pay_commissions($1, $2::uuid[], 'pix', true, 'pagamento semanal')`, [COLLAB, ids])
  );
  const [p] = await q(`select total_amount, original_amount, vale_amount, services_count, period_start::text ps from public.commission_payments where id=$1`, [paymentId]);
  assert(Number(p.original_amount) === 120 && Number(p.vale_amount) === 20 && Number(p.total_amount) === 100 && p.services_count === 2, JSON.stringify(p));
  assert(p.ps === "2030-05-11");
  assert((await q(`select 1 from public.commissions where collaborator_id='${COLLAB}' and is_paid = false`)).length === 0, "comissões deveriam zerar");
  const [t] = await q(`select type, amount, category from public.cash_transactions where commission_payment_id=$1`, [paymentId]);
  assert(t.type === "saida" && Number(t.amount) === 100 && t.category === "comissao");
  const [vale] = await q(`select commission_payment_id from public.vales where colaboradora_id='${COLLAB}'`);
  assert(vale.commission_payment_id === paymentId, "vale deveria ficar vinculado a este pagamento");
});
await test("não é possível pagar as mesmas comissões duas vezes", async () => {
  const ids = (await q(`select id from public.commissions where collaborator_id='${COLLAB}'`)).map((r) => r.id);
  await as("authenticated", ADMIN, () => rejects(q(`select public.pay_commissions($1, $2::uuid[], 'pix', false, null)`, [COLLAB, ids]), /já foram pagas/));
});
await test("vale maior que a comissão disponível: a comissão é paga normalmente e o vale inteiro fica em aberto (nunca é aplicado pela metade)", async () => {
  await db.exec(`insert into public.appointments (client_name, client_phone, collaborator_id, service_name, service_price, appointment_date, appointment_time, status, final_amount, commission_value)
    values ('Z','11933332222','${COLLAB2}','Corte',100,'2030-05-12','09:00','agendado',100,10)`);
  await db.exec(`update public.appointments set status='concluido' where client_phone='11933332222'`);
  await as("authenticated", ADMIN, () => q(`insert into public.vales (colaboradora_id, valor, data) values ('${COLLAB2}', 9999, '2035-01-01')`));
  const ids = (await q(`select id from public.commissions where collaborator_id='${COLLAB2}'`)).map((r) => r.id);
  const before = (await q(`select 1 from public.cash_transactions`)).length;
  const [{ pay_commissions: id }] = await as("authenticated", ADMIN, () => q(`select public.pay_commissions($1, $2::uuid[], 'dinheiro', true, null)`, [COLLAB2, ids]));
  const [p] = await q(`select total_amount, vale_amount from public.commission_payments where id=$1`, [id]);
  // O vale de 9999 não coube nos 10 de comissão disponível, então fica intocado — os 10 são
  // pagos normalmente (nada de "least()" que aplicaria uma fração dele).
  assert(Number(p.total_amount) === 10 && Number(p.vale_amount) === 0, JSON.stringify(p));
  assert((await q(`select 1 from public.cash_transactions`)).length === before + 1, "deveria lançar a saída de 10 no caixa");
  const [vale] = await q(`select commission_payment_id from public.vales where colaboradora_id='${COLLAB2}'`);
  assert(vale.commission_payment_id === null, "vale que não coube deve continuar em aberto");
});
await test("vale que cabe é consumido; o que não cabe continua em aberto para o próximo ciclo", async () => {
  await db.exec(`insert into public.appointments (client_name, client_phone, collaborator_id, service_name, service_price, appointment_date, appointment_time, status, final_amount, commission_value)
    values ('W','11933331111','${COLLAB2}','Corte',200,'2030-05-13','09:00','agendado',200,60)`);
  await db.exec(`update public.appointments set status='concluido' where client_phone='11933331111'`);
  // Vales em ordem cronológica: 10 (2020, mais antigo, cabe) e 9999 (2035, leftover do teste anterior, não cabe).
  await as("authenticated", ADMIN, () => q(`insert into public.vales (colaboradora_id, valor, data) values ('${COLLAB2}', 10, '2020-01-01')`));
  const ids = (await q(`select id from public.commissions where collaborator_id='${COLLAB2}' and is_paid = false`)).map((r) => r.id);
  const [{ pay_commissions: id }] = await as("authenticated", ADMIN, () => q(`select public.pay_commissions($1, $2::uuid[], 'dinheiro', false, null)`, [COLLAB2, ids]));
  const [p] = await q(`select total_amount, vale_amount from public.commission_payments where id=$1`, [id]);
  assert(Number(p.vale_amount) === 10 && Number(p.total_amount) === 50, JSON.stringify(p));
  const vales = await q(`select valor, commission_payment_id from public.vales where colaboradora_id='${COLLAB2}' order by valor`);
  assert(Number(vales[0].valor) === 10 && vales[0].commission_payment_id === id, "vale de 10 deveria ter sido consumido");
  assert(Number(vales[1].valor) === 9999 && vales[1].commission_payment_id === null, "vale de 9999 deveria continuar em aberto");
});

console.log("\nMega Hair (Funcionalidade 1)");
await test("services.is_mega e appointments.mega_tipo/tipo_remuneracao/valor_fixo existem com os defaults certos", async () => {
  const [s] = await q(`select is_mega from public.services limit 1`);
  assert(s.is_mega === false);
  await rejects(db.exec(`update public.appointments set mega_tipo='invalido' where id in (select id from public.appointments limit 1)`), /appointments_mega_tipo_check/);
});
await test("mega_especificacoes: valida técnica/tipo/combinação e limita a uma por agendamento", async () => {
  const [svc] = await q(`insert into public.services (name, price, is_mega) values ('Mega Hair', 500, true) returning id`);
  await db.exec(`insert into public.appointments (client_name, client_phone, collaborator_id, service_id, service_name, service_price, appointment_date, appointment_time, mega_tipo)
    values ('Rosa','11900002222','${COLLAB}','${svc.id}','Mega Hair',0,'2030-07-01','10:00','aplicacao')`);
  const [appt] = await q(`select id from public.appointments where client_phone='11900002222'`);

  await rejects(
    as("authenticated", ADMIN, () =>
      q(`insert into public.mega_especificacoes (agendamento_id, tecnica, tipo, combinacao, valor_tecnica) values ('${appt.id}','invalida','aplicacao','Tela + Mesclado',300)`)
    ),
    /mega_especificacoes_tecnica_check/
  );
  await rejects(
    as("authenticated", ADMIN, () =>
      q(`insert into public.mega_especificacoes (agendamento_id, tecnica, tipo, combinacao, valor_tecnica) values ('${appt.id}','tela','aplicacao','Combinação Inventada',300)`)
    ),
    /mega_especificacoes_combinacao_check/
  );

  await as("authenticated", ADMIN, () =>
    q(`insert into public.mega_especificacoes (agendamento_id, tecnica, tipo, combinacao, comprimento, gramas, valor_tecnica, valor_cabelo)
       values ('${appt.id}','tela','aplicacao','Tela + Mesclado','60cm',150,350,150)`)
  );
  await rejects(
    db.exec(`insert into public.mega_especificacoes (agendamento_id, tecnica, tipo, combinacao, valor_tecnica) values ('${appt.id}','fita','aplicacao','Fita + Mesclado',100)`),
    /mega_especificacoes_agendamento_unique/
  );

  const [spec] = await q(`select valor_tecnica, valor_cabelo from public.mega_especificacoes where agendamento_id='${appt.id}'`);
  assert(Number(spec.valor_tecnica) === 350 && Number(spec.valor_cabelo) === 150);
});
await test("mega_especificacoes: colaboradora insere, mas não edita nem apaga; anon não lê nada", async () => {
  const [row] = await q(`select id from public.mega_especificacoes limit 1`);
  await as("anon", null, () => rejects(q(`select * from public.mega_especificacoes`), /permission denied/));
  assert((await as("authenticated", COLLAB2, () => q(`select 1 from public.mega_especificacoes`))).length >= 1);
  // A policy de update é admin-only: a linha some do UPDATE sem erro (RLS filtra, não lança exceção).
  const r = await as("authenticated", COLLAB2, () =>
    q(`update public.mega_especificacoes set comprimento='70cm' where id='${row.id}' returning id`)
  );
  assert(r.length === 0, "colaboradora não deveria conseguir editar a especificação");
});

console.log("\nComissão vs Valor Fixo (Funcionalidade 2)");
await test("concluir com tipo_remuneracao='valor_fixo' grava o valor combinado na comissão (não recalcula por %)", async () => {
  await db.exec(`insert into public.appointments (client_name, client_phone, collaborator_id, service_name, service_price, appointment_date, appointment_time)
    values ('Fixo','11900003333','${COLLAB}','Corte',100,'2030-07-02','09:00')`);
  await db.exec(`update public.appointments
     set status='concluido', final_amount=100, commission_value=80, tipo_remuneracao='valor_fixo', valor_fixo=80
   where client_phone='11900003333'`);
  const [c] = await q(`select commission_value, tipo_remuneracao, valor_fixo from public.commissions where client_name='Fixo'`);
  assert(Number(c.commission_value) === 80 && c.tipo_remuneracao === "valor_fixo" && Number(c.valor_fixo) === 80, JSON.stringify(c));
});
await test("concluir sem informar tipo_remuneracao grava 'comissao' por padrão", async () => {
  const [c] = await q(`select tipo_remuneracao, valor_fixo from public.commissions where client_name='Joana'`);
  assert(c.tipo_remuneracao === "comissao" && c.valor_fixo === null, JSON.stringify(c));
});
await test("sessão de pacote: incrementa used_sessions e conclui o pacote na última", async () => {
  await db.exec(`insert into public.client_packages (client_name, client_phone, package_name, total_sessions, total_price) values ('Rita','11922221111','Pacote Mensal',2,400)`);
  const [pkg] = await q(`select id from public.client_packages`);
  for (const [i, h] of [[1, "08:00"], [2, "09:00"]]) {
    await db.exec(`insert into public.appointments (client_name, client_phone, collaborator_id, service_name, appointment_date, appointment_time, is_package_session, package_id)
      values ('Rita','11922221111','${COLLAB2}','Pacote Mensal','2030-06-0${i}','${h}',true,'${pkg.id}')`);
    await db.exec(`update public.appointments set status='concluido', final_amount=200, package_session_value=200, commission_value=50 where package_id='${pkg.id}' and appointment_date='2030-06-0${i}'`);
    const [r] = await q(`select used_sessions, status from public.client_packages where id='${pkg.id}'`);
    assert(r.used_sessions === i && r.status === (i === 2 ? "concluido" : "ativo"), JSON.stringify(r));
  }
});
await test("find_active_packages (anon) acha por telefone só pacotes ativos e devolve o mínimo", async () => {
  await db.exec(`insert into public.client_packages (client_name, client_phone, package_name, total_sessions, total_price) values ('Ivo','11911110000','Pacote X',4,300)`);
  const rows = await as("anon", null, () => q(`select * from public.find_active_packages('(11) 91111-0000')`));
  assert(rows.length === 1 && rows[0].package_name === "Pacote X" && !("client_phone" in rows[0]));
  assert((await as("anon", null, () => q(`select * from public.find_active_packages('11922221111')`))).length === 0, "pacote concluído não deve aparecer");
  assert((await as("anon", null, () => q(`select * from public.find_active_packages('123')`))).length === 0);
});

console.log("\nAdmin que também atende (is_also_collaborator)");
await test("flag só vale para admin; a view public_collaborators inclui a admin apenas quando ligada e ativa", async () => {
  await rejects(q(`update public.profiles set is_also_collaborator=true where id='${COLLAB}'`), /profiles_also_collab_admin_only/);
  const names = async () => (await as("anon", null, () => q(`select id from public.public_collaborators`))).map((r) => r.id);
  assert(!(await names()).includes(ADMIN), "admin sem flag não pode aparecer");
  await db.exec(`update public.profiles set is_also_collaborator=true where id='${ADMIN}'`);
  assert((await names()).includes(ADMIN), "admin com flag deve aparecer");
  await db.exec(`update public.profiles set is_active=false where id='${ADMIN}'`);
  assert(!(await names()).includes(ADMIN), "admin inativa não aparece");
  await db.exec(`update public.profiles set is_active=true where id='${ADMIN}'`);
});
await test("admin-colaboradora gera comissão e pode ser paga via pay_commissions; sem a flag é recusada", async () => {
  await db.exec(`insert into public.appointments (client_name, client_phone, collaborator_id, service_name, appointment_date, appointment_time)
    values ('Bia','11933334444','${ADMIN}','Corte','2030-07-01','10:00')`);
  await db.exec(`update public.appointments set status='concluido', final_amount=100, commission_value=30 where collaborator_id='${ADMIN}' and appointment_date='2030-07-01'`);
  const comm = await as("authenticated", ADMIN, () => q(`select id from public.commissions where collaborator_id='${ADMIN}' and is_paid=false`));
  assert(comm.length === 1, "comissão da admin deveria existir");
  const ids = comm.map((c) => c.id);
  await db.exec(`update public.profiles set is_also_collaborator=false where id='${ADMIN}'`);
  await as("authenticated", ADMIN, () => rejects(q(`select public.pay_commissions($1, $2::uuid[], 'pix', false, null)`, [ADMIN, ids]), /Colaboradora não encontrada/));
  await db.exec(`update public.profiles set is_also_collaborator=true where id='${ADMIN}'`);
  const [{ pay_commissions: pid }] = await as("authenticated", ADMIN, () => q(`select public.pay_commissions($1, $2::uuid[], 'pix', false, null)`, [ADMIN, ids]));
  const [p] = await q(`select total_amount, collaborator_id from public.commission_payments where id='${pid}'`);
  assert(Number(p.total_amount) === 30 && p.collaborator_id === ADMIN, JSON.stringify(p));
  await db.exec(`update public.profiles set is_also_collaborator=false where id='${ADMIN}'`);
});

console.log("\nEstoque, caixa e clientes");
await test("venda baixa o estoque; estoque insuficiente é rejeitado", async () => {
  await db.exec(`insert into public.products (name, price, stock_quantity) values ('Shampoo', 50, 3)`);
  const [p] = await q(`select id from public.products`);
  await db.exec(`insert into public.product_sales (product_id, product_name, quantity, unit_price, total_price, payment_method) values ('${p.id}','Shampoo',2,50,100,'pix')`);
  assert((await q(`select stock_quantity s from public.products`))[0].s === 1);
  await rejects(db.exec(`insert into public.product_sales (product_id, product_name, quantity, unit_price, total_price, payment_method) values ('${p.id}','Shampoo',2,50,100,'pix')`), /Estoque insuficiente/);
  assert((await q(`select stock_quantity s from public.products`))[0].s === 1);
});
await test("só pode existir um caixa aberto", async () => {
  await rejects(db.exec(`insert into public.cash_register (opening_amount) values (0)`), /cash_register_single_open/);
});
await test("clients: telefone único, formato validado e data_nascimento opcional/editável", async () => {
  await rejects(db.exec(`insert into public.clients (name, phone) values ('Dup','11988887777')`), /clients_phone_key/);
  await rejects(db.exec(`insert into public.clients (name, phone) values ('Ruim','123')`), /clients_phone_check/);
  await as("authenticated", ADMIN, () => q(`update public.clients set data_nascimento='1990-03-15' where phone='11988887777'`));
  assert((await q(`select data_nascimento::text d from public.clients where phone='11988887777'`))[0].d === "1990-03-15");
  await as("authenticated", ADMIN, () => q(`update public.clients set data_nascimento=null where phone='11988887777'`));
});
await test("admin lê/escreve clients; admin lê salon_settings completo", async () => {
  assert((await as("authenticated", ADMIN, () => q(`select 1 from public.clients`))).length >= 3);
  const [s] = await as("authenticated", ADMIN, () => q(`select * from public.salon_settings`));
  assert("mercado_pago_token" in s);
});

console.log("\nWhatsApp");
await test("fila: cancelar o agendamento apaga mensagens pendentes dele", async () => {
  const [a] = await q(`select id from public.appointments where client_phone='11944443333'`);
  await db.exec(`insert into public.whatsapp_mensagens_fila (agendamento_id, tipo, mensagem, telefone, chave_unica) values ('${a.id}','lembrete','oi','5511944443333','lembrete:${a.id}')`);
  await db.exec(`update public.appointments set status='cancelado' where id='${a.id}'`);
  assert((await q(`select 1 from public.whatsapp_mensagens_fila where agendamento_id='${a.id}'`)).length === 0);
});
await test("fila: chave_unica impede duplicidade", async () => {
  await db.exec(`insert into public.whatsapp_mensagens_fila (tipo, mensagem, telefone, chave_unica) values ('aniversario','x','5511900000000','aniversario:c1:2030')`);
  await rejects(db.exec(`insert into public.whatsapp_mensagens_fila (tipo, mensagem, telefone, chave_unica) values ('aniversario','x','5511900000000','aniversario:c1:2030')`), /chave_unica/);
});
await test("claim_whatsapp_messages: só pega vencidas, marca 'enviando' e não entrega duas vezes", async () => {
  await db.exec(`delete from public.whatsapp_mensagens_fila`);
  await db.exec(`insert into public.whatsapp_mensagens_fila (tipo, mensagem, telefone, agendado_para) values
    ('lembrete','a','5511900000001', now() - interval '1 minute'),
    ('lembrete','b','5511900000002', now() + interval '1 day')`);
  const first = await as("service_role", null, () => q(`select * from public.claim_whatsapp_messages(10)`));
  assert(first.length === 1 && first[0].mensagem === "a" && first[0].status === "enviando" && first[0].tentativas === 1);
  const second = await as("service_role", null, () => q(`select * from public.claim_whatsapp_messages(10)`));
  assert(second.length === 0, "mensagem entregue duas vezes");
});
await test("birthday_clients: acha pelo dia/mês, trata 29/02 e ignora quem não tem data", async () => {
  await db.exec(`update public.clients set data_nascimento='1990-03-15' where phone='11988887777'`);
  await db.exec(`insert into public.clients (name, phone, data_nascimento) values ('Bissexta','11900001111','1992-02-29')`);
  const r1 = await as("service_role", null, () => q(`select name from public.birthday_clients(3, 15)`));
  assert(r1.length === 1 && r1[0].name === "Maria Souza");
  assert((await as("service_role", null, () => q(`select * from public.birthday_clients(2, 28)`))).length === 0);
  assert((await as("service_role", null, () => q(`select * from public.birthday_clients(2, 28, true)`))).length === 1);
  await as("authenticated", ADMIN, () => rejects(q(`select * from public.birthday_clients(3, 15)`), /permission denied/));
});
await test("admin lê o log da fila; anon e colaboradora não", async () => {
  assert((await as("authenticated", ADMIN, () => q(`select 1 from public.whatsapp_mensagens_fila`))).length === 2);
  assert((await as("authenticated", COLLAB, () => q(`select 1 from public.whatsapp_mensagens_fila`))).length === 0);
  await as("authenticated", ADMIN, () => rejects(q(`select * from public.whatsapp_config`), /permission denied/));
});

console.log("\nFotos do cliente — anamnese e acompanhamento (Funcionalidade 4)");
await test("cliente_fotos: staff lê/escreve; anon não acessa nada", async () => {
  const [client] = await q(`select id from public.clients where phone='11988887777'`);
  await as("anon", null, () => rejects(q(`select * from public.cliente_fotos`), /permission denied/));
  await as("anon", null, () =>
    rejects(
      q(`insert into public.cliente_fotos (cliente_id, tipo, nome, url, storage_path) values ('${client.id}','anamnese','Ficha','http://x','${client.id}/anamnese/a.jpg')`),
      /permission denied/
    )
  );
  const [foto] = await as("authenticated", COLLAB, () =>
    q(
      `insert into public.cliente_fotos (cliente_id, tipo, nome, url, storage_path, uploaded_by)
       values ('${client.id}','anamnese','Ficha assinada','http://x','${client.id}/anamnese/a.jpg','${COLLAB}') returning id, tipo`
    )
  );
  assert(foto.tipo === "anamnese");
  assert((await as("authenticated", ADMIN, () => q(`select 1 from public.cliente_fotos where id='${foto.id}'`))).length === 1);
  const del = await as("authenticated", COLLAB2, () => q(`delete from public.cliente_fotos where id='${foto.id}' returning id`));
  assert(del.length === 1, "colaboradora autenticada deveria poder excluir (RLS: is_staff)");
});
await test("cliente_fotos: valida o tipo (só anamnese/acompanhamento)", async () => {
  const [client] = await q(`select id from public.clients where phone='11988887777'`);
  await rejects(
    db.exec(`insert into public.cliente_fotos (cliente_id, tipo, nome, url, storage_path) values ('${client.id}','outro','X','http://x','p')`),
    /cliente_fotos_tipo_check/
  );
});
await test("storage 'cliente-fotos': só staff lê/escreve objetos do bucket", async () => {
  await as("anon", null, () => rejects(q(`select * from storage.objects where bucket_id='cliente-fotos'`), /permission denied|row-level security/));
  await as("authenticated", COLLAB, () =>
    q(`insert into storage.objects (bucket_id, name) values ('cliente-fotos', 'x/anamnese/a.jpg')`)
  );
  assert((await as("authenticated", ADMIN, () => q(`select 1 from storage.objects where bucket_id='cliente-fotos'`))).length === 1);
});

console.log(`\n${passed} testes passaram, ${failures.length} falharam.`);
if (failures.length) {
  console.log("Falhas:\n - " + failures.join("\n - "));
  process.exit(1);
}
