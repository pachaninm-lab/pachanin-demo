#!/usr/bin/env node
/**
 * Executable proof for the API database principal confinement gate (#4890).
 *
 * Every RLS policy in this repository is worth exactly what the API's own
 * database principal cannot do. Before this gate, nothing on the deploy path
 * checked it: the DATABASE_URL parser reads the role name and only asserts it
 * is non-empty, so an admin role would deploy cleanly and every policy would be
 * inert with no gate noticing.
 *
 * This script does not restate the gate. It EXTRACTS the SQL out of
 * scripts/tai-reg-ru-deploy.sh and runs that exact text, so the proof cannot
 * drift from the thing that deploys - a second copy kept correct by attention
 * is how the password hash format comment went stale in #4683.
 *
 * The role shapes are measured, not assumed. rolsuper and rolbypassrls alone
 * are NOT sufficient, which is the whole reason this file exists:
 *
 *   granted a BYPASSRLS role   reads rolbypassrls=f, yet SET ROLE takes it
 *   granted a superuser role   reads rolsuper=f,     yet SET ROLE takes it
 *   owns an RLS table with no  reads f/f, yet selects every row, because an
 *   FORCE ROW LEVEL SECURITY   owner is exempt from its own policies
 *
 * Each shape is checked twice over: what the gate reports, and how many rows
 * the role can actually read through a USING (false) policy. A gate that
 * disagreed with the row count would be reporting something other than the
 * bypass it exists to catch.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const DEPLOY_SCRIPT = 'scripts/tai-reg-ru-deploy.sh';
const OPEN = 'api_principal_findings="$(psql_admin -Atv principal="$DB_APP_USER" <<\'SQL\'';

const adminUrl = process.env.CONFINEMENT_ADMIN_URL;
if (!adminUrl) {
  console.error('CONFINEMENT_ADMIN_URL is required. This gate proves behaviour against a real PostgreSQL; a skip would prove nothing.');
  process.exit(2);
}

/** Pull the gate's SQL out of the deploy script rather than restating it. */
function extractGateSql() {
  const lines = readFileSync(DEPLOY_SCRIPT, 'utf8').split('\n');
  const start = lines.indexOf(OPEN);
  if (start === -1) {
    throw new Error(`could not find the confinement heredoc in ${DEPLOY_SCRIPT}; if it moved, this proof must follow it rather than be deleted`);
  }
  const end = lines.indexOf('SQL', start + 1);
  if (end === -1) throw new Error('unterminated confinement heredoc');
  const sql = lines.slice(start + 1, end).join('\n');
  for (const required of ['pg_has_role', 'relforcerowsecurity', 'rolbypassrls', 'rolsuper']) {
    if (!sql.includes(required)) {
      throw new Error(`extracted SQL lacks ${required}; the extraction is matching the wrong block, or the gate lost a clause`);
    }
  }
  return sql;
}

function psql(args, input) {
  const result = spawnSync('psql', [adminUrl, '-X', '--set', 'ON_ERROR_STOP=1', ...args], {
    input, encoding: 'utf8', timeout: 60_000,
  });
  if (result.status !== 0) {
    throw new Error(`psql failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return (result.stdout || '').trim();
}

const ROLES = [
  'probe_plain_app',
  'probe_bypass_holder',
  'probe_inherits_bypass',
  'probe_inherits_super',
  'probe_table_owner',
  'probe_noinherit_member',
];

/** Every role the probe hands privileges to, hop targets included. */
const GRANTEES = [...ROLES, 'probe_superuser_stand_in'];

function setUp() {
  psql(['-q'], `
DROP SCHEMA IF EXISTS confinement_probe CASCADE;
${ROLES.map((r) => `DROP ROLE IF EXISTS ${r};`).join('\n')}
DROP ROLE IF EXISTS probe_superuser_stand_in;

CREATE SCHEMA confinement_probe;
-- A stand-in for the compose default, which initdb creates as a real
-- superuser. The probe cannot create a superuser unless it is one, so
-- membership in it is what the MEMBER clause is exercised against.
CREATE ROLE probe_superuser_stand_in BYPASSRLS;
CREATE ROLE probe_bypass_holder BYPASSRLS;
CREATE ROLE probe_inherits_bypass INHERIT;
GRANT probe_bypass_holder TO probe_inherits_bypass;
CREATE ROLE probe_inherits_super INHERIT;
GRANT probe_superuser_stand_in TO probe_inherits_super;
CREATE ROLE probe_plain_app;
CREATE ROLE probe_table_owner;
-- NOINHERIT is the shape that separates pg_has_role 'MEMBER' from 'USAGE'.
-- Measured: USAGE reads false for it, MEMBER reads true, and it reads every
-- row the moment it SET ROLEs. A USAGE-based gate would clear a principal that
-- can take the bypass whenever it likes.
CREATE ROLE probe_noinherit_member NOINHERIT;
GRANT probe_bypass_holder TO probe_noinherit_member;

CREATE TABLE confinement_probe.deals(id text primary key, tenant text);
INSERT INTO confinement_probe.deals VALUES ('a','t1'),('b','t2');
ALTER TABLE confinement_probe.deals OWNER TO probe_table_owner;
ALTER TABLE confinement_probe.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY probe_denies_everything ON confinement_probe.deals FOR SELECT USING (false);
-- BYPASSRLS and superuser bypass row level security, not GRANTs, so the hop
-- targets need the ordinary privileges too or the probe would fail for a
-- reason that has nothing to do with the bypass under test.
GRANT USAGE ON SCHEMA confinement_probe TO ${GRANTEES.join(', ')};
GRANT SELECT ON confinement_probe.deals TO ${GRANTEES.join(', ')};
`);
}

function tearDown() {
  try {
    psql(['-q'], `
DROP SCHEMA IF EXISTS confinement_probe CASCADE;
${ROLES.map((r) => `DROP ROLE IF EXISTS ${r};`).join('\n')}
DROP ROLE IF EXISTS probe_superuser_stand_in;
`);
  } catch { /* teardown of a probe schema must not mask a real finding */ }
}

/**
 * Rows the role can actually read through USING (false).
 *
 * `via` is the second SET ROLE hop, and it is the whole point of the two
 * membership shapes. Measured: a role merely GRANTed a BYPASSRLS or superuser
 * role reads ZERO rows as itself - plain inheritance does not carry either
 * attribute - and reads every row the moment it SET ROLEs to the role it holds.
 * The danger is latent rather than active, which is exactly why a check reading
 * only rolsuper and rolbypassrls clears it.
 */
function rowsVisibleTo(role, via) {
  const hops = via ? `SET ROLE ${role}; SET ROLE ${via};` : `SET ROLE ${role};`;
  const out = psql(['-At', '-c', `${hops} SELECT count(*) FROM confinement_probe.deals;`]);
  return out.split('\n').pop().trim();
}

function gateFindings(sql, role) {
  return psql(['-At', '-v', `principal=${role}`, '-f', '-'], sql);
}

const EXPECTED = [
  { role: 'probe_plain_app', confined: true, reason: '' },
  { role: 'probe_bypass_holder', confined: false, reason: 'BYPASSRLS' },
  {
    role: 'probe_inherits_bypass',
    confined: false,
    reason: 'MEMBER_OF_PRIVILEGED_ROLE:probe_bypass_holder',
    via: 'probe_bypass_holder',
  },
  {
    role: 'probe_inherits_super',
    confined: false,
    reason: 'MEMBER_OF_PRIVILEGED_ROLE:probe_superuser_stand_in',
    via: 'probe_superuser_stand_in',
  },
  {
    role: 'probe_table_owner',
    confined: false,
    reason: 'OWNS_UNFORCED_RLS_TABLE:confinement_probe.deals',
  },
  {
    role: 'probe_noinherit_member',
    confined: false,
    reason: 'MEMBER_OF_PRIVILEGED_ROLE:probe_bypass_holder',
    via: 'probe_bypass_holder',
  },
];

const violations = [];
const gateSql = extractGateSql();

setUp();
try {
  for (const { role, confined, reason, via } of EXPECTED) {
    const findings = gateFindings(gateSql, role);

    if (confined) {
      if (findings !== '') violations.push(`${role}: gate reported [${findings}] for a confined role`);
      if (rowsVisibleTo(role) !== '0') {
        violations.push(`${role}: confined role read rows through USING (false)`);
      }
      continue;
    }

    if (findings !== reason) violations.push(`${role}: gate reported [${findings}], expected [${reason}]`);

    // The bypass must be demonstrated, not inferred from the gate's own output.
    if (rowsVisibleTo(role, via) !== '2') {
      violations.push(`${role}: gate flags it, but it could not actually read the rows${via ? ` even via ${via}` : ''} - the gate would be reporting something other than a bypass`);
    }

    // For the membership shapes, the latency is the finding: as itself the role
    // is confined, and only the hop it is entitled to take opens the table.
    if (via && rowsVisibleTo(role) !== '0') {
      violations.push(`${role}: expected 0 rows without the SET ROLE hop, since inheritance was measured not to carry the attribute`);
    }
  }

  // The SUPERUSER clause needs a real superuser, and the probe cannot create
  // one unless it already is one. Every cluster has at least one - initdb makes
  // the bootstrap role a superuser, which on the deploy path is exactly the
  // compose POSTGRES_USER this whole issue is about - so the clause is asserted
  // against a superuser that already exists rather than left unproven or
  // skipped when the connecting role happens not to be one.
  const existingSuperuser = psql(['-At', '-c',
    "SELECT rolname FROM pg_catalog.pg_roles WHERE rolsuper AND rolcanlogin ORDER BY rolname LIMIT 1"]);
  if (!existingSuperuser) {
    violations.push('no superuser role found, so the SUPERUSER clause could not be proven; this gate does not report a pass it did not test');
  } else {
    const superFindings = gateFindings(gateSql, existingSuperuser);
    if (!superFindings.split(',').includes('SUPERUSER')) {
      violations.push(`${existingSuperuser} is a superuser but the gate reported [${superFindings}] without SUPERUSER`);
    }
    if (rowsVisibleTo(existingSuperuser) !== '2') {
      violations.push(`${existingSuperuser}: expected a superuser to read every row through USING (false), got a different count`);
    }
  }

  // The ownership clause must key on the missing FORCE, not on ownership. With
  // FORCE set, the owner is confined in fact, so the gate must clear it too.
  psql(['-q', '-c', 'ALTER TABLE confinement_probe.deals FORCE ROW LEVEL SECURITY']);
  const forcedFindings = gateFindings(gateSql, 'probe_table_owner');
  const forcedRows = rowsVisibleTo('probe_table_owner');
  if (forcedFindings !== '') violations.push(`owner under FORCE: gate still reported [${forcedFindings}]`);
  if (forcedRows !== '0') violations.push(`owner under FORCE: read ${forcedRows} rows, so FORCE did not confine`);
} finally {
  tearDown();
}

if (violations.length > 0) {
  console.error('API database principal confinement gate FAIL:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log(
  'API database principal confinement gate PASS: SQL extracted from '
  + `${DEPLOY_SCRIPT}; 6 role shapes plus the FORCE case, each checked against both `
  + 'the gate verdict and the rows the role can actually read.',
);
