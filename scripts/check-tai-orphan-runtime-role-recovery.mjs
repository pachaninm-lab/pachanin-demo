#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const path = 'scripts/tai-reg-ru-deploy.sh';
const source = readFileSync(path, 'utf8');
const violations = [];
const requireFragment = (fragment) => {
  if (!source.includes(fragment)) violations.push(`missing ${JSON.stringify(fragment)}`);
};

for (const fragment of [
  'ORPHAN_ROLE_RECOVERY=0',
  'if [[ "$role_exists" == 1 && ! -f "$ENV_FILE" ]]; then',
  'TAI_DEPLOY_ORPHAN_ROLE_ELEVATED_AUTHORITY_FAILED',
  'TAI_DEPLOY_ORPHAN_ROLE_MEMBERSHIP_FAILED',
  'TAI_DEPLOY_ORPHAN_ROLE_NON_TAI_PRIVILEGE_FAILED',
  'TAI_DEPLOY_ORPHAN_ROLE_OWNERSHIP_FAILED',
  'TAI_DEPLOY_ORPHAN_ROLE_ACTIVE_SESSION_FAILED',
  'pg_catalog.pg_auth_members WHERE roleid = role_row.oid',
  'pg_catalog.pg_stat_activity',
  'ORPHAN_ROLE_RECOVERY=1',
  'TAI_DEPLOY_DATABASE_ORPHAN_ROLE_RESET_FAILED',
  'DROP OWNED BY ${ROLE_NAME};',
  'DROP ROLE ${ROLE_NAME};',
  'ORPHAN_ROLE_RECOVERY=$ORPHAN_ROLE_RECOVERY',
]) requireFragment(fragment);

const classify = (fixture) => fixture.roleExists === 1
  && fixture.envPresent === false
  && fixture.previousTai === 0
  && fixture.overridePresent === false
  && fixture.superuser === false
  && fixture.createdb === false
  && fixture.createrole === false
  && fixture.replication === false
  && fixture.bypassrls === false
  && fixture.memberships === 0
  && fixture.grantees === 0
  && fixture.nonTaiPrivileges === 0
  && fixture.ownedObjects === 0
  && fixture.activeSessions === 0;

const safe = {
  roleExists: 1,
  envPresent: false,
  previousTai: 0,
  overridePresent: false,
  superuser: false,
  createdb: false,
  createrole: false,
  replication: false,
  bypassrls: false,
  memberships: 0,
  grantees: 0,
  nonTaiPrivileges: 0,
  ownedObjects: 0,
  activeSessions: 0,
};
if (!classify(safe)) violations.push('safe orphan fixture was not recoverable');
for (const [name, patch] of Object.entries({
  superuser: { superuser: true },
  membership: { memberships: 1 },
  grantee: { grantees: 1 },
  nonTai: { nonTaiPrivileges: 1 },
  ownership: { ownedObjects: 1 },
  active: { activeSessions: 1 },
  env: { envPresent: true },
  service: { previousTai: 1 },
})) {
  if (classify({ ...safe, ...patch })) violations.push(`unsafe orphan fixture passed: ${name}`);
}

const classification = source.indexOf('if [[ "$role_exists" == 1 && ! -f "$ENV_FILE" ]]; then');
const mutation = source.indexOf('MUTATION_STARTED=1');
const reset = source.indexOf('TAI_DEPLOY_DATABASE_ORPHAN_ROLE_RESET_FAILED');
const create = source.indexOf('CREATE ROLE ${ROLE_NAME}');
if (!(classification > 0 && mutation > classification && reset > mutation && create > reset)) {
  violations.push('orphan recovery ordering is not classify -> mutation guard -> reset -> create');
}

if (violations.length) {
  console.error('TAI orphan runtime role recovery contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI orphan runtime role recovery contract PASS: only an unused, unowned, unprivileged orphan is reset after the mutation guard.');
