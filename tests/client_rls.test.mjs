// Runs the real migration in PGlite (Postgres in WASM) with a minimal auth schema stub and checks RLS isolation.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
test('RLS isolates customers', async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261029230000_client_area.sql', import.meta.url), 'utf8'));
  await db.exec(`grant select, insert, update on all tables in schema public to authenticated; grant select on all tables in schema public to anon;`);
  const t = await db.query(`select tablename, rowsecurity from pg_tables where schemaname='public'`);
  assert.equal(t.rows.length, 5); assert.ok(t.rows.every((r) => r.rowsecurity), 'RLS on every table');
  await db.exec(`insert into auth.users values ('${A}','a@example.com'),('${B}','b@example.com');`);
  assert.equal((await db.query(`select count(*)::int n from public.products where user_id='${A}'`)).rows[0].n, 5, 'trigger seeds 5 not-active products');
  const as = async (uid, sql) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`); try { return await db.query(sql); } finally { await db.exec('reset role'); } };
  await as(A, `insert into public.support_tickets(user_id,subject,body,category) values('${A}','Menu page','Please add a new menu page','website')`);
  await assert.rejects(as(A, `insert into public.support_tickets(user_id,subject,body) values('${B}','Spoof','Pretending to be B here')`));
  await assert.rejects(as(A, `insert into public.support_tickets(user_id,subject,body,status) values('${A}','Closed?','Trying to set status closed','closed')`));
  assert.equal((await as(A, 'select * from public.support_tickets')).rows.length, 1);
  assert.equal((await as(B, 'select * from public.support_tickets')).rows.length, 0, 'B cannot see A tickets');
  assert.equal((await as(B, 'select * from public.products')).rows.length, 5);
  assert.equal((await as(B, `select * from public.profiles where id='${A}'`)).rows.length, 0);
  await assert.rejects(as(A, `insert into public.invoices(user_id,amount_cents) values('${A}',1)`), 'customers cannot write invoices');
  await db.exec(`set role anon; select set_config('request.jwt.claim.sub','',false);`);
  assert.equal((await db.query('select * from public.support_tickets')).rows.length, 0, 'anon sees nothing'); await db.exec('reset role');
});
