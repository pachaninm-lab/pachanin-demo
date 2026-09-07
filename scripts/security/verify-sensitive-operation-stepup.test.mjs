import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  auditController,
  auditRegistry,
  controllerRoutes,
  REGISTRY,
} from './verify-sensitive-operation-stepup.mjs';

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
const settlement = registry.controllers[0];
const source = readFileSync(settlement.file, 'utf8');

test('every mutating route on the money surface carries the step-up or a reasoned exemption', () => {
  assert.deepEqual(auditRegistry(registry).problems, []);
});

test('the route count agrees with an independent grep, so the parse cannot silently miss routes', () => {
  // The first version of this parser walked line by line and reset its accumulator
  // on any line not starting with @. A multi-line @RateLimit({ ... }) does exactly
  // that, so it lost three routes of nine - including deal/:id/release, the most
  // sensitive one. A parse that misses a route reports a clean surface.
  const grepped = Number(execFileSync(
    'bash',
    ['-c', `grep -cE "@(Post|Patch|Put|Delete)\\('" ${settlement.file}`],
    { encoding: 'utf8' },
  ).trim());
  assert.equal(controllerRoutes(source).length, grepped);
  assert.equal(controllerRoutes(source).length, 9);
});

test('the guard is attached below the route decorator, and the parse sees it there', () => {
  // @UseGuards comes AFTER @Post in this codebase. A parser expecting it before
  // would call every guarded route unguarded.
  const release = controllerRoutes(source).find((route) => route.path === 'deal/:id/release');
  assert.ok(release);
  assert.ok(release.decorators.indexOf('@Post(') < release.decorators.indexOf('@UseGuards(SettlementFinancialMfaGuard)'));
});

test('releasing funds requires further authentication', () => {
  // The single most consequential operation on the platform.
  const release = controllerRoutes(source).find((route) => route.path === 'deal/:id/release');
  assert.match(release.decorators, /@UseGuards\(SettlementFinancialMfaGuard\)/u);
});

test('a new mutating route without the step-up fails, and so does an exemption with no reason', () => {
  const added = source.replace(
    "  @Post('deal/:id/terms')",
    [
      "  @Post('deal/:id/drain')",
      '  drain() {',
      '    return null;',
      '  }',
      '',
      "  @Post('deal/:id/terms')",
    ].join('\n'),
  );
  const problems = auditController(added, settlement).problems;
  assert.ok(problems.some((p) => p.kind === 'SENSITIVE_ROUTE_WITHOUT_STEP_UP' && p.detail.includes('drain')));

  const thin = { ...settlement, exemptRoutes: [{ verb: 'Post', path: 'bank-callback', because: 'internal' }] };
  assert.ok(auditController(source, thin).problems.some((p) => p.kind === 'EXEMPTION_WITHOUT_REASON'));
});

test('an exemption for a route that does not exist, and one for a route already guarded, both fail', () => {
  const ghost = { ...settlement, exemptRoutes: [...settlement.exemptRoutes, { verb: 'Post', path: 'gone', because: 'a'.repeat(40) }] };
  assert.ok(auditController(source, ghost).problems.some((p) => p.kind === 'EXEMPTION_FOR_MISSING_ROUTE'));

  const redundant = { ...settlement, exemptRoutes: [...settlement.exemptRoutes, { verb: 'Post', path: 'deal/:id/release', because: 'a'.repeat(40) }] };
  assert.ok(auditController(source, redundant).problems.some((p) => p.kind === 'REDUNDANT_EXEMPTION'));
});

test('a surface that declares no step-up marker is refused rather than trivially passing', () => {
  // With no marker nothing could ever satisfy the check, so every route would
  // read as guarded-by-nothing. That must fail loudly, not quietly pass.
  const markerless = { ...registry, controllers: [{ ...settlement, stepUpMarkers: [] }] };
  assert.ok(auditRegistry(markerless).problems.some((p) => p.kind === 'CONTROLLER_WITHOUT_MARKER'));

  const unjudged = { ...registry, controllers: [{ ...settlement, whySensitive: 'money' }] };
  assert.ok(auditRegistry(unjudged).problems.some((p) => p.kind === 'CONTROLLER_WITHOUT_JUDGEMENT'));
});

test('the registry records the step-ups this scanner cannot see rather than implying they are absent', () => {
  // The membership commands are gated in the service, not by a decorator, so a
  // controller scanner cannot observe them. Silence there would read as absence.
  assert.match(registry.serviceLayerStepUps, /organization-membership-reauth\.spec\.ts/u);
  assert.match(registry.serviceLayerStepUps, /requireFreshMfa/u);
  assert.match(registry.serviceLayerStepUps, /registration-decision\.service\.ts/u);
});

test('the guard it names actually fails closed', () => {
  const guard = readFileSync('apps/api/src/modules/settlement-engine/settlement-financial-mfa.guard.ts', 'utf8');
  assert.match(guard, /if \(!request\.user\)/u);
  assert.match(guard, /RECENT_FINANCIAL_MFA_REQUIRED/u);
  assert.match(guard, /assertRecentSettlementFinancialMfa\(request\.user\)/u);
});
