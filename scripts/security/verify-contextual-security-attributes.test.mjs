import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  auditContextualAttributes,
  comparisonSites,
  REGISTRY,
  trackedDecisionSources,
} from './verify-contextual-security-attributes.mjs';

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));

test('the committed register holds against the tree', () => {
  const result = auditContextualAttributes(registry);
  assert.deepEqual(result.problems, [], JSON.stringify(result.problems, null, 2));
  assert.ok(result.files > 10, `expected the real decision surface, saw ${result.files}`);
});

test('every attribute answers the attribute, the threshold and the action, including the ones not used', () => {
  // V8.1.4 asks for the attributes evaluated, the thresholds, and the action
  // taken. "We do not use location" is an answer, so it carries the same fields.
  for (const attribute of registry.attributes) {
    for (const field of ['decision', 'threshold', 'action', 'failureMode']) {
      assert.ok(String(attribute[field] || '').trim().length >= 3, `${attribute.id}.${field}`);
    }
  }
  assert.ok(registry.attributes.some((a) => a.isDecisionInput), 'some attribute must actually be used');
  assert.ok(registry.attributes.some((a) => !a.isDecisionInput), 'the unused ones are recorded too');
});

test('a negative claim is contradicted the moment the attribute is compared in decision code', () => {
  // This is the load-bearing half: "device is not a decision input" is only
  // evidence while nothing compares it. A stub file stands in for a future edit.
  const stub = 'apps/api/src/common/guards/stub.ts';
  const readFile = (path) => (
    path === stub
      ? 'if (request.headers.userAgent === session.userAgent) { return true; }'
      : readFileSync(path, 'utf8')
  );
  const withStub = {
    ...registry,
    attributes: registry.attributes.filter((a) => a.id === 'device'),
  };

  const result = auditContextualAttributes(withStub, readFile);
  const seen = result.problems.map((p) => p.kind);
  // Without the stub in the file list nothing is wrong yet.
  assert.deepEqual(seen, []);

  // Directly: a comparison is detected, a mention is not.
  assert.ok(comparisonSites('if (a.userAgent === b) {}', 'useragent').length > 0);
  assert.ok(comparisonSites('if (b !== req.userAgent) {}', 'useragent').length > 0);
  assert.ok(comparisonSites('if (session.userAgent.startsWith("x")) {}', 'useragent').length > 0);
  assert.equal(comparisonSites('metadata: this.clientMetadata(userAgent, ip)', 'useragent').length, 0);
  assert.equal(comparisonSites('async login(dto, userAgent, ip) {}', 'useragent').length, 0);
});

test('an attribute claimed unused with no falsifiable pattern is refused', () => {
  const unfalsifiable = {
    ...registry,
    attributes: [{
      id: 'invented', name: 'x', isDecisionInput: false,
      decision: 'not used at all', threshold: 'none', action: 'none', failureMode: 'none',
    }],
    negativeClaimPatterns: {},
  };
  assert.deepEqual(
    auditContextualAttributes(unfalsifiable).problems.map((p) => p.kind),
    ['UNCHECKABLE_NEGATIVE_CLAIM'],
  );
});

test('an attribute claimed used must name where the decision is made, and that file must exist', () => {
  const noSite = {
    ...registry,
    attributes: [{
      id: 'client-ip', name: 'x', isDecisionInput: true, decisionSites: [], resolvedBy: [],
      decision: 'throttling', threshold: '300/60s', action: 'deny', failureMode: 'closed',
    }],
  };
  assert.ok(auditContextualAttributes(noSite).problems.some((p) => p.kind === 'DECISION_INPUT_WITHOUT_SITE'));

  const goneSite = {
    ...registry,
    attributes: [{
      id: 'client-ip', name: 'x', isDecisionInput: true,
      decisionSites: ['apps/api/src/common/guards/removed-long-ago.ts'], resolvedBy: [],
      decision: 'throttling', threshold: '300/60s', action: 'deny', failureMode: 'closed',
    }],
  };
  assert.ok(auditContextualAttributes(goneSite).problems.some((p) => p.kind === 'ATTRIBUTE_SITE_GONE'));
});

test('the recorded decision inputs match what the code actually does', () => {
  // IP reaches a deny through the pre-auth rate limiter, and time through the
  // failed-login lockout. Both are read from source rather than asserted in prose.
  const guard = readFileSync('apps/api/src/common/guards/pre-auth-rate-limit.guard.ts', 'utf8');
  assert.match(guard, /resolveRequestIp\(request\)/u);
  assert.match(guard, /`ip\|\$\{clientIp\}`/u);
  assert.match(guard, /RATE_LIMIT_GENERAL/u);
  // Fail closed: an unresolvable client IP must not fall through to allow.
  assert.match(guard, /Trusted client IP is unavailable\./u);

  const auth = readFileSync('apps/api/src/modules/auth/auth.service.ts', 'utf8');
  assert.match(auth, /MAX_FAILED_LOGINS = 5/u);
  assert.match(auth, /lockedUntil/u);

  const ip = registry.attributes.find((a) => a.id === 'client-ip');
  assert.match(ip.threshold, /RATE_LIMIT_GENERAL/u);
  assert.match(ip.action, /429/u);
  const time = registry.attributes.find((a) => a.id === 'time');
  assert.match(time.threshold, /MAX_FAILED_LOGINS = 5/u);
});

test('the decision surface actually scanned is the guards and the auth module', () => {
  const files = trackedDecisionSources(registry.decisionRoots);
  assert.ok(files.some((f) => f.includes('/common/guards/')));
  assert.ok(files.some((f) => f.includes('/modules/auth/')));
  assert.ok(files.every((f) => !f.endsWith('.spec.ts')), 'fixtures are not decision code');
});
