#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Which row policies does a deployed database actually end up with?
 *
 * Nobody could answer that without reading 608 policy statements across the
 * whole migration chain in order, and the answer decays every time a migration
 * lands. So it was answered by hand, and the answer went stale in every
 * particular. The V8.2.2 record said three permissive PUBLIC policies -
 * deals_app_access, audit_select_all, ledger_select_all - were still installed
 * because their DROP statements lived only in infra/sql/production-rls-policies.sql,
 * which no `prisma migrate deploy` applies. Two migrations had since dropped all
 * three inside the chain and replaced them with per-row policies. The same record
 * named three tenant-bearing tables with no policy at all; a third migration had
 * covered all three. The record was describing a database that stopped existing.
 *
 * The part that was still true is smaller and more precise than anything the
 * record said: 20260831180000 narrowed deals_app_access rather than removing the
 * exposure, leaving `deals_uncontexted_read FOR SELECT USING (TRUE)` granted to
 * PUBLIC. PostgreSQL ORs permissive policies together, so that one policy ORs
 * away the strict deals_select for every reader. It is deliberate and its own
 * COMMENT ON POLICY says so - but a deliberate hole that nothing measures is one
 * nobody notices closing or widening.
 *
 * This replays every statically written CREATE/ALTER/DROP POLICY in migration
 * order and writes what survives. A permissive policy granted to PUBLIC whose
 * USING is literally TRUE is reported as an open read: that is the shape that
 * silently defeats every strict policy on the same table.
 *
 * Five migrations build policies dynamically instead - a PL/pgSQL loop over an
 * array of table names running EXECUTE format('CREATE POLICY %I_select ON
 * settlement.%I', ...) - and no static reader can resolve those without
 * interpreting the loop. They are not replayed. They are also not passed over in
 * silence: each is listed in dynamicPolicyMigrations with the table array it
 * loops over, and the document says in its own note that its coverage is static
 * DDL only. An artifact that quietly claimed to be the whole picture would be a
 * more convincing version of the stale record it replaces.
 */

export const MIGRATIONS_DIR = 'apps/api/prisma/migrations';
export const OUT_PATH = 'docs/security/rls-effective-policies.json';

/**
 * Comments are stripped before parsing because migrations in this repository
 * habitually quote the DDL they are replacing in their header - the three
 * policies above appear as commented CREATE statements in the very migrations
 * that drop them, and a scanner that reads those as real reports the opposite
 * of the truth.
 */
export function stripSql(sql, dynamic = []) {
  let out = '';
  let i = 0;
  const text = String(sql ?? '');
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === '--') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end;
      continue;
    }
    if (two === '/*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    if (text[i] === "'") {
      const end = text.indexOf("'", i + 1);
      out += text.slice(i, end === -1 ? text.length : end + 1);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    const dollar = /^\$[A-Za-z_]*\$/u.exec(text.slice(i, i + 32));
    if (dollar) {
      const tag = dollar[0];
      const end = text.indexOf(tag, i + tag.length);
      const body = text.slice(i, end === -1 ? text.length : end + tag.length);
      // A policy built inside a dollar-quoted body is invisible to the statement
      // scanner below. Collect it so the caller can declare the gap rather than
      // present a partial replay as a complete one.
      if (/\b(?:CREATE|DROP|ALTER)\s+POLICY\b/iu.test(body)) dynamic.push(body);
      out += ' ';
      i = end === -1 ? text.length : end + tag.length;
      continue;
    }
    out += text[i];
    i += 1;
  }
  return out;
}

const IDENT = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)`;
const QUALIFIED = String.raw`(?:${IDENT}\s*\.\s*)*${IDENT}`;

export function normaliseIdent(raw) {
  return String(raw ?? '').trim().replace(/^"(.*)"$/su, '$1');
}

/**
 * A table is named as deals, "deals", public."deals" and public.deals across the
 * chain, and the same policy name recurs on different tables. Keying on the bare
 * relation name without its schema would merge unrelated tables; keeping the
 * schema qualifier verbatim would split one table into four.
 */
export function normaliseTable(raw) {
  const parts = String(raw ?? '').trim().split('.').map((part) => normaliseIdent(part));
  const relation = parts[parts.length - 1];
  const schema = parts.length > 1 ? parts[parts.length - 2] : 'public';
  return `${schema}.${relation}`;
}

function readClause(text, from) {
  // Reads a parenthesised expression by depth, so a USING clause containing its
  // own function calls and nested parentheses is not cut at the first ')'.
  const open = text.indexOf('(', from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return { body: text.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

export function parsePolicyStatements(sql, dynamic = []) {
  const text = stripSql(sql, dynamic);
  const statements = [];
  const pattern = new RegExp(
    String.raw`\b(CREATE|DROP|ALTER)\s+POLICY\s+(?:IF\s+EXISTS\s+)?(${IDENT})\s+ON\s+(${QUALIFIED})`,
    'giu',
  );
  let match = pattern.exec(text);
  while (match !== null) {
    const [, verb, name, table] = match;
    const statement = { verb: verb.toUpperCase(), name: normaliseIdent(name), table: normaliseTable(table) };

    if (statement.verb !== 'DROP') {
      // Only look as far as the next statement, so a following policy's clauses
      // are never read as this one's.
      pattern.lastIndex = match.index + match[0].length;
      const next = new RegExp(pattern.source, pattern.flags);
      next.lastIndex = pattern.lastIndex;
      const following = next.exec(text);
      const semicolon = text.indexOf(';', pattern.lastIndex);
      const bounds = [following ? following.index : text.length, semicolon === -1 ? text.length : semicolon]
        .filter((value) => value > pattern.lastIndex);
      const body = text.slice(pattern.lastIndex, Math.min(...bounds));

      const restrictive = /\bAS\s+RESTRICTIVE\b/iu.test(body);
      const forMatch = /\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/iu.exec(body);
      const toMatch = /\bTO\s+([A-Za-z_][\w$, ]*?)\s*(?:USING|WITH\s+CHECK|$)/iu.exec(body);
      const usingAt = /\bUSING\b/iu.exec(body);
      const using = usingAt ? readClause(body, usingAt.index) : null;
      const checkAt = /\bWITH\s+CHECK\b/iu.exec(body);
      const check = checkAt ? readClause(body, checkAt.index) : null;

      const roles = toMatch
        ? toMatch[1].split(',').map((role) => role.trim()).filter(Boolean)
        : ['PUBLIC'];

      Object.assign(statement, {
        permissive: !restrictive,
        command: forMatch ? forMatch[1].toUpperCase() : 'ALL',
        roles,
        using: using ? using.body.trim().replace(/\s+/gu, ' ') : null,
        check: check ? check.body.trim().replace(/\s+/gu, ' ') : null,
      });
    }

    statements.push(statement);
    pattern.lastIndex = match.index + match[0].length;
    match = pattern.exec(text);
  }
  return statements;
}

export function isUnconditional(expression) {
  return /^true$/iu.test(String(expression ?? '').trim());
}

/**
 * The table list a dynamic block loops over. Read out of the ARRAY[...] literal
 * so the declared gap says which tables it covers, rather than only that a gap
 * exists.
 */
export function dynamicTables(body) {
  const array = /ARRAY\s*\[([^\]]*)\]/su.exec(String(body ?? ''));
  if (!array) return [];
  return [...array[1].matchAll(/'([^']+)'/gu)].map((match) => match[1]);
}

/**
 * Three tables end up with an open read, and only one of them is a finding.
 * inventory.availability_policies holds a single immutable formula definition and
 * regulatory_rule_versions holds published rule text; neither has a tenant column,
 * so an unconditional read of them is correct rather than a leak. public.deals
 * does have one. Without this distinction the artifact reports three open reads
 * and leaves a reader to work out which one is the boundary - which is how the
 * record it replaces went wrong in the first place.
 */
export function tenantBearingTables(migrations) {
  const tables = new Set();
  const create = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w".]+)\s*\(/giu;
  for (const { sql } of migrations) {
    const text = stripSql(sql);
    let match = create.exec(text);
    while (match !== null) {
      const body = readClause(text, match.index + match[0].length - 1);
      if (body && /(?:^|[\s,("])(?:"tenantId"|tenantId|tenant_id)\s/iu.test(body.body)) {
        tables.add(normaliseTable(match[1]));
      }
      match = create.exec(text);
    }
  }
  return tables;
}

export function replay(migrations) {
  const live = new Map();
  const dynamicPolicyMigrations = [];
  let applied = 0;
  for (const { migration, sql } of migrations) {
    const dynamic = [];
    for (const statement of parsePolicyStatements(sql, dynamic)) {
      applied += 1;
      const key = `${statement.table}::${statement.name}`;
      if (statement.verb === 'DROP') { live.delete(key); continue; }
      if (statement.verb === 'ALTER') {
        const current = live.get(key);
        // ALTER on a policy that is not live is a no-op in this model rather than
        // a creation: replaying it as one would invent a policy the database
        // does not have.
        if (!current) continue;
        live.set(key, {
          ...current,
          roles: statement.roles && statement.roles[0] !== 'PUBLIC' ? statement.roles : current.roles,
          using: statement.using ?? current.using,
          check: statement.check ?? current.check,
          alteredBy: migration,
        });
        continue;
      }
      live.set(key, { ...statement, migration });
    }
    for (const body of dynamic) {
      dynamicPolicyMigrations.push({
        migration,
        tables: dynamicTables(body),
        statements: [...body.matchAll(/\b(?:CREATE|DROP|ALTER)\s+POLICY[^']*/giu)]
          .map((match) => match[0].trim().replace(/\s+/gu, ' '))
          .slice(0, 6),
      });
    }
  }

  const policies = [...live.values()]
    .map(({ verb, ...policy }) => policy)
    .sort((left, right) => (left.table.localeCompare(right.table, 'en') || left.name.localeCompare(right.name, 'en')));

  // An open read is the shape that defeats every strict policy beside it:
  // permissive, granted to PUBLIC, and true for every row.
  const tenantBearing = tenantBearingTables(migrations);
  const withTenancy = (policy) => ({ ...policy, tenantBearingTable: tenantBearing.has(policy.table) });
  const openReads = policies.filter((policy) => (
    policy.permissive
    && policy.roles.length === 1
    && policy.roles[0] === 'PUBLIC'
    && ['ALL', 'SELECT'].includes(policy.command)
    && isUnconditional(policy.using)
  ));
  const openWrites = policies.filter((policy) => (
    policy.permissive
    && policy.roles.length === 1
    && policy.roles[0] === 'PUBLIC'
    && ['ALL', 'INSERT', 'UPDATE'].includes(policy.command)
    && isUnconditional(policy.check ?? policy.using)
  ));

  return {
    statementsApplied: applied,
    policies,
    openReads: openReads.map(withTenancy),
    openWrites: openWrites.map(withTenancy),
    tenantBearingTables: [...tenantBearing].sort(),
    dynamicPolicyMigrations,
  };
}

export function readMigrations(dir = MIGRATIONS_DIR) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((migration) => {
      let sql;
      try { sql = readFileSync(resolve(dir, migration, 'migration.sql'), 'utf8'); } catch { return null; }
      return { migration, sql };
    })
    .filter(Boolean);
}

export function buildDocument(migrations, result) {
  return {
    schemaVersion: 'pc-crop.rls-effective-policies.v1',
    note: 'Replayed from the migration chain in order. This is what a database built by '
      + '`prisma migrate deploy` ends up with - not what infra/sql/*.sql would install, '
      + 'and not what any one migration says in isolation. Coverage is STATIC policy DDL '
      + 'only: the migrations in dynamicPolicyMigrations build policies inside PL/pgSQL '
      + 'loops via EXECUTE format(), and those are listed rather than replayed.',
    migrations: migrations.length,
    statementsApplied: result.statementsApplied,
    livePolicies: result.policies.length,
    openReadCount: result.openReads.length,
    openWriteCount: result.openWrites.length,
    tenantBearingOpenReadCount: result.openReads.filter((policy) => policy.tenantBearingTable).length,
    tenantBearingOpenWriteCount: result.openWrites.filter((policy) => policy.tenantBearingTable).length,
    tenantBearingTables: result.tenantBearingTables,
    dynamicPolicyMigrations: result.dynamicPolicyMigrations,
    openReads: result.openReads,
    openWrites: result.openWrites,
    policies: result.policies,
  };
}

function main(argv) {
  const check = argv.includes('--check');
  const migrations = readMigrations();
  const result = replay(migrations);
  const document = buildDocument(migrations, result);
  const serialised = `${JSON.stringify(document, null, 2)}\n`;

  if (check) {
    // Regenerating and comparing is the whole point. A committed inventory that
    // is never re-derived becomes exactly the stale record this replaces - it
    // would still name deals_uncontexted_read long after somebody dropped it.
    let committed = null;
    try { committed = readFileSync(OUT_PATH, 'utf8'); } catch { committed = null; }
    if (committed !== serialised) {
      console.error(`${OUT_PATH} does not match the migration chain.`);
      console.error('Regenerate it in the same change that adds the migration:');
      console.error('  node scripts/security/build-effective-rls-policies.mjs');
      return 1;
    }
  } else {
    writeFileSync(OUT_PATH, serialised, 'utf8');
  }

  console.log(
    `effective RLS: ${migrations.length} migrations, ${result.statementsApplied} policy statements, `
    + `${result.policies.length} live policies, ${result.openReads.length} open read(s), ${result.openWrites.length} open write(s), `
    + `${result.dynamicPolicyMigrations.length} migration(s) with dynamic policy DDL not replayed`,
  );
  const mark = (policy) => (policy.tenantBearingTable ? 'TENANT-BEARING' : 'no tenant column');
  for (const policy of result.openReads) console.log(`  OPEN READ  ${policy.table} ${policy.name} [${mark(policy)}] (${policy.migration})`);
  for (const policy of result.openWrites) console.log(`  OPEN WRITE ${policy.table} ${policy.name} [${mark(policy)}] (${policy.migration})`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
