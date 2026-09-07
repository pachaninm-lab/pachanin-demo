import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  measure,
  measureRoles,
  measureResourceAttributes,
  reconcile,
  REGISTRY,
  renderRules,
  RULES_MD,
} from './build-authorization-rules.mjs';

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));

test('the rules cover exactly the roles, attributes and policy files the tree has', () => {
  assert.deepEqual(reconcile(measure(), registry), []);
});

test('the committed document is what the generator produces', () => {
  assert.equal(readFileSync(RULES_MD, 'utf8'), renderRules(measure(), registry));
});

test('a role that gates a handler but states no rule fails, and so does a rule for a role that gates nothing', () => {
  const measured = measure();
  const withoutAdmin = { ...registry, roles: registry.roles.filter((r) => r.id !== 'ADMIN') };
  assert.ok(reconcile(measured, withoutAdmin).some((p) => p.kind === 'UNDOCUMENTED_ROLE'));

  const invented = { ...registry, roles: [...registry.roles, { id: 'OVERLORD', mayDo: 'everything there is to do here' }] };
  assert.ok(reconcile(measured, invented).some((p) => p.kind === 'PHANTOM_ROLE'));
});

test('a resource attribute a policy decides on must be described, and a described one must be used', () => {
  const measured = measure();
  const dropped = {
    ...registry,
    resourceAttributes: registry.resourceAttributes.filter((a) => a.id !== 'app.current_tenant_id'),
  };
  assert.ok(reconcile(measured, dropped).some((p) => p.kind === 'UNDOCUMENTED_RESOURCE_ATTRIBUTE'));

  const invented = {
    ...registry,
    resourceAttributes: [...registry.resourceAttributes, { id: 'app.made_up', restricts: 'nothing at all in this tree', setBy: 'nobody' }],
  };
  assert.ok(reconcile(measured, invented).some((p) => p.kind === 'PHANTOM_RESOURCE_ATTRIBUTE'));
});

test('a file that defines row-level policies cannot go unaccounted for', () => {
  const measured = measure();
  const dropped = { ...registry, policyFiles: registry.policyFiles.filter((f) => !f.endsWith('production-rls-policies.sql')) };
  assert.ok(reconcile(measured, dropped).some((p) => p.kind === 'UNDOCUMENTED_POLICY_FILE'));

  const invented = { ...registry, policyFiles: [...registry.policyFiles, 'infra/sql/never-existed.sql'] };
  assert.ok(reconcile(measured, invented).some((p) => p.kind === 'PHANTOM_POLICY_FILE'));
});

test('a rule entry that says nothing is not a rule', () => {
  const measured = measure();
  const blank = { ...registry, roles: registry.roles.map((r) => (r.id === 'ADMIN' ? { ...r, mayDo: 'stuff' } : r)) };
  assert.ok(reconcile(measured, blank).some((p) => p.kind === 'RULE_WITHOUT_CONTENT'));

  const blankAttribute = {
    ...registry,
    resourceAttributes: registry.resourceAttributes.map((a) => (
      a.id === 'app.current_org_id' ? { ...a, setBy: '' } : a
    )),
  };
  assert.ok(reconcile(measured, blankAttribute).some((p) => p.kind === 'RULE_WITHOUT_CONTENT'));
});

test('a multi-line @Roles decorator is read in full', () => {
  // The role list on commercial-rules.controller.ts spans fourteen lines. A
  // single-line grep misses it entirely, and missing it would hide GUEST from
  // the vocabulary the rules have to account for.
  const source = "@Roles(\n  'FARMER',\n  'BUYER',\n  'GUEST',\n)\n@Controller('x')";
  const { roles, sites } = measureRoles(['x.ts'], () => source);
  assert.equal(sites, 1);
  assert.deepEqual([...roles.keys()].sort(), ['BUYER', 'FARMER', 'GUEST']);
});

test('the rules record the layer disagreement over GUEST rather than smoothing it over', () => {
  // commercial-rules.controller.ts admits GUEST at the HTTP layer while
  // policy-engine.service.ts denies GUEST unconditionally and the RLS
  // transaction layer refuses it outright. Two layers state opposite intent,
  // which is exactly what this requirement asks to be made visible.
  const controller = readFileSync('apps/api/src/modules/commercial-rules/commercial-rules.controller.ts', 'utf8');
  assert.match(controller, /'GUEST',/u);
  const engine = readFileSync('apps/api/src/common/security/policy-engine.service.ts', 'utf8');
  assert.match(engine, /deny\.guest\.all/u);
  const rls = readFileSync('apps/api/src/common/prisma/rls-transaction.service.ts', 'utf8');
  assert.match(rls, /guest_role_forbidden/u);

  assert.match(registry.notCovered, /CommercialRulesController/u);
  assert.match(registry.notCovered, /deny\.guest\.all/u);
  assert.match(registry.notCovered, /guest_role_forbidden/u);
});

test('the rules say plainly which layer they do not cover', () => {
  // Field-level access is V8.1.2 and stays FAIL; claiming it here would close a
  // requirement with its neighbour.
  assert.match(registry.notCovered, /V8\.1\.2/u);
  assert.match(registry.notCovered, /ПОЛЕЙ/u);
  assert.match(readFileSync(RULES_MD, 'utf8'), /Чего эти правила НЕ покрывают/u);
});

test('ANY_AUTHENTICATED is recorded as a marker, not as a role with privileges', () => {
  const marker = registry.roles.find((r) => r.id === 'ANY_AUTHENTICATED');
  assert.ok(marker);
  assert.match(marker.mayDo, /не роль/iu);
  const guard = readFileSync('apps/api/src/common/guards/roles.guard.ts', 'utf8');
  assert.match(guard, /if \(roles\.includes\('ANY_AUTHENTICATED'\)\) return true;/u);
  // The guard also permits when no user is attached: it authorizes, it does not
  // authenticate. That is only safe because AppAuthGuard runs first and @Public()
  // is the deliberate exception, which the rules record as such.
  assert.match(guard, /if \(!user\) return true;/u);
});

test('policy and attribute measurement reads the SQL, not a hardcoded list', () => {
  const { attributes, policies } = measureResourceAttributes(['a.sql'], () => (
    "CREATE POLICY x ON t USING (current_setting('app.current_org_id') = org);\nCREATE POLICY y ON t FOR INSERT WITH CHECK (true);"
  ));
  assert.deepEqual([...attributes.keys()], ['app.current_org_id']);
  assert.equal(policies.get('a.sql'), 2);
});
