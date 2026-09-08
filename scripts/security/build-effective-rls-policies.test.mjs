import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  OUT_PATH,
  dynamicTables,
  isUnconditional,
  normaliseTable,
  parsePolicyStatements,
  replay,
  stripSql,
  tenantBearingTables,
} from './build-effective-rls-policies.mjs';

const chain = (...sqls) => sqls.map((sql, index) => ({ migration: `M${index}`, sql }));

// This is the defect that made the V8.2.2 record wrong: the migrations that DROP
// the three permissive policies quote the CREATE statements they are removing in
// their own header comments. A scanner that reads those reports the opposite of
// what the migration does.
test('a CREATE POLICY quoted in a comment is not replayed as one', () => {
  const result = replay(chain(`
    -- CREATE POLICY "deals_app_access" ON "deals" USING (TRUE);
    /* CREATE POLICY "audit_select_all" ON "audit_events" FOR SELECT USING (TRUE); */
    DROP POLICY IF EXISTS deals_app_access ON public."deals";
  `));
  assert.equal(result.policies.length, 0);
  assert.equal(result.openReads.length, 0);
});

test('a later DROP removes a policy created earlier in the chain', () => {
  const result = replay(chain(
    'CREATE POLICY deals_app_access ON public."deals" USING (TRUE);',
    'DROP POLICY IF EXISTS deals_app_access ON public."deals";',
  ));
  assert.equal(result.policies.length, 0);
});

// deals, "deals", public.deals and public."deals" all appear in this chain.
test('the same table written four ways is one table', () => {
  assert.equal(normaliseTable('deals'), 'public.deals');
  assert.equal(normaliseTable('"deals"'), 'public.deals');
  assert.equal(normaliseTable('public.deals'), 'public.deals');
  assert.equal(normaliseTable('public."deals"'), 'public.deals');
  assert.equal(normaliseTable('settlement.payments'), 'settlement.payments');
  const result = replay(chain(
    'CREATE POLICY p ON "deals" FOR SELECT USING (TRUE);',
    'DROP POLICY IF EXISTS p ON public."deals";',
  ));
  assert.equal(result.policies.length, 0);
});

test('the same policy name on two tables is two policies', () => {
  const result = replay(chain(
    'CREATE POLICY tenant_select ON public."a" FOR SELECT USING (x);'
    + 'CREATE POLICY tenant_select ON public."b" FOR SELECT USING (x);',
    'DROP POLICY IF EXISTS tenant_select ON public."a";',
  ));
  assert.deepEqual(result.policies.map((policy) => policy.table), ['public.b']);
});

test('a permissive PUBLIC read of every row is an open read', () => {
  const result = replay(chain('CREATE POLICY p ON public."deals" FOR SELECT USING (TRUE);'));
  assert.equal(result.openReads.length, 1);
  assert.equal(result.openReads[0].name, 'p');
});

// PostgreSQL ORs permissive policies but ANDs restrictive ones, so a RESTRICTIVE
// USING (TRUE) constrains nothing and defeats nothing.
test('a RESTRICTIVE policy over every row is not an open read', () => {
  const result = replay(chain('CREATE POLICY p ON public."deals" AS RESTRICTIVE FOR SELECT USING (TRUE);'));
  assert.equal(result.openReads.length, 0);
});

test('a policy granted to a named role is not an open read', () => {
  const result = replay(chain('CREATE POLICY p ON public."deals" FOR SELECT TO pc_reporting USING (TRUE);'));
  assert.equal(result.openReads.length, 0);
  assert.deepEqual(result.policies[0].roles, ['pc_reporting']);
});

test('a conditional policy is not an open read however long the expression', () => {
  const result = replay(chain(
    'CREATE POLICY p ON public."deals" FOR SELECT USING (app_rls_context_ready() AND ("tenantId" = current_setting(\'app.current_tenant_id\', true)));',
  ));
  assert.equal(result.openReads.length, 0);
  assert.match(result.policies[0].using, /current_setting/u);
});

test('a nested USING expression is read to its matching parenthesis, not the first one', () => {
  const [statement] = parsePolicyStatements(
    'CREATE POLICY p ON public."deals" FOR SELECT USING (f(g(1), h(2)) AND x);',
  );
  assert.equal(statement.using, 'f(g(1), h(2)) AND x');
});

test('one policy\'s clauses are not read as the next policy\'s', () => {
  const statements = parsePolicyStatements(
    'CREATE POLICY a ON public."x" FOR SELECT USING (TRUE);'
    + 'CREATE POLICY b ON public."y" FOR INSERT WITH CHECK (tenant = 1);',
  );
  assert.equal(statements[0].using, 'TRUE');
  assert.equal(statements[0].check, null);
  assert.equal(statements[1].using, null);
  assert.equal(statements[1].check, 'tenant = 1');
});

test('an unconditional PUBLIC write is an open write, whether by USING or WITH CHECK', () => {
  const result = replay(chain(
    'CREATE POLICY u ON public."deals" FOR UPDATE USING (TRUE) WITH CHECK (TRUE);'
    + 'CREATE POLICY i ON public."deals" FOR INSERT WITH CHECK (TRUE);',
  ));
  assert.deepEqual(result.openWrites.map((policy) => policy.name).sort(), ['i', 'u']);
});

test('ALTER on a live policy edits it; ALTER on a policy that is gone invents nothing', () => {
  const edited = replay(chain(
    'CREATE POLICY p ON public."deals" FOR SELECT USING (TRUE);',
    'ALTER POLICY p ON public."deals" USING (tenant = current_setting(\'t\', true));',
  ));
  assert.equal(edited.openReads.length, 0);
  assert.equal(replay(chain('ALTER POLICY ghost ON public."deals" USING (TRUE);')).policies.length, 0);
});

// A policy built by EXECUTE format() in a PL/pgSQL loop cannot be resolved
// statically. The requirement is that it is declared, never that it is guessed.
test('dynamic policy DDL is declared as unreplayed rather than silently dropped', () => {
  const result = replay(chain(`
    DO $settlement_policies$
    DECLARE table_name TEXT;
    BEGIN
      FOREACH table_name IN ARRAY ARRAY['payments','holds'] LOOP
        EXECUTE format('CREATE POLICY %I_select ON settlement.%I FOR SELECT USING (tenant_id = current_setting(''t'', true))', table_name, table_name);
      END LOOP;
    END
    $settlement_policies$;
  `));
  assert.equal(result.policies.length, 0);
  assert.equal(result.dynamicPolicyMigrations.length, 1);
  assert.deepEqual(result.dynamicPolicyMigrations[0].tables, ['payments', 'holds']);
});

test('a dollar-quoted function body is not scanned for policy statements', () => {
  const result = replay(chain(
    "CREATE FUNCTION f() RETURNS BOOLEAN AS $function$ SELECT current_setting('a.b', true) IS NOT NULL $function$;"
    + 'CREATE POLICY p ON public."deals" FOR SELECT USING (f());',
  ));
  assert.equal(result.policies.length, 1);
  assert.equal(result.dynamicPolicyMigrations.length, 0);
});

test('stripSql leaves ordinary statements intact', () => {
  assert.match(stripSql('CREATE POLICY p ON x USING (TRUE); -- trailing\n'), /CREATE POLICY p ON x USING \(TRUE\);/u);
});

test('only a literal TRUE is unconditional', () => {
  assert.equal(isUnconditional('TRUE'), true);
  assert.equal(isUnconditional(' true '), true);
  assert.equal(isUnconditional('true AND x'), false);
  assert.equal(isUnconditional(null), false);
});

test('dynamicTables reads the array a loop iterates', () => {
  assert.deepEqual(dynamicTables("FOREACH t IN ARRAY ARRAY['a','b','c'] LOOP"), ['a', 'b', 'c']);
  assert.deepEqual(dynamicTables('no array here'), []);
});

test('a table is tenant-bearing only when it declares a tenant column', () => {
  const migrations = chain(
    'CREATE TABLE public."deals" (id text PRIMARY KEY, "tenantId" text NOT NULL);'
    + 'CREATE TABLE inventory.availability_policies (id text PRIMARY KEY, definition jsonb NOT NULL);'
    + 'CREATE TABLE settlement.payments (id text PRIMARY KEY, tenant_id text NOT NULL);',
  );
  const tables = tenantBearingTables(migrations);
  assert.equal(tables.has('public.deals'), true);
  assert.equal(tables.has('settlement.payments'), true);
  assert.equal(tables.has('inventory.availability_policies'), false);
});

test('an open policy is marked with whether its table carries a tenant', () => {
  const result = replay(chain(
    'CREATE TABLE public."deals" (id text, "tenantId" text NOT NULL);'
    + 'CREATE TABLE public."rules" (id text, body jsonb);'
    + 'CREATE POLICY d ON public."deals" FOR SELECT USING (TRUE);'
    + 'CREATE POLICY r ON public."rules" FOR SELECT USING (TRUE);',
  ));
  const byName = Object.fromEntries(result.openReads.map((policy) => [policy.name, policy.tenantBearingTable]));
  assert.deepEqual(byName, { d: true, r: false });
});

// The committed artifact is the evidence V8.2.2 rests on, so its shape is
// asserted here rather than left to whoever reads the JSON next.
test('the committed inventory records exactly one tenant-bearing open read and one open write, both on deals', () => {
  const document = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
  assert.equal(document.schemaVersion, 'pc-crop.rls-effective-policies.v1');
  const reads = document.openReads.filter((policy) => policy.tenantBearingTable);
  const writes = document.openWrites.filter((policy) => policy.tenantBearingTable);
  assert.deepEqual(reads.map((policy) => `${policy.table}.${policy.name}`), ['public.deals.deals_uncontexted_read']);
  assert.deepEqual(writes.map((policy) => `${policy.table}.${policy.name}`), ['public.deals.deals_uncontexted_update']);
  assert.equal(document.tenantBearingOpenReadCount, 1);
});

// Every one of these was named by the V8.2.2 record as still installed. The
// chain drops all three; this is the assertion that the record was wrong.
test('the three policies the record called open are not live in the chain', () => {
  const document = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
  const live = new Set(document.policies.map((policy) => policy.name));
  for (const name of ['deals_app_access', 'audit_select_all', 'ledger_select_all']) {
    assert.equal(live.has(name), false, `${name} is not live in the migration chain`);
  }
});

test('the three tables the record called uncovered do carry policies', () => {
  const document = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
  const tables = new Set(document.policies.map((policy) => policy.table));
  for (const table of [
    'public.deal_events',
    'public.fgis_grain_tenant_read_provider_claims',
    'public.fgis_grain_tenant_read_audit_heads',
  ]) {
    assert.equal(tables.has(table), true, `${table} carries at least one policy`);
  }
});
