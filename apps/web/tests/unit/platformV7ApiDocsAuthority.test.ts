import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(repoRoot, relativePath));

const canonical = read('docs/api/openapi.yaml');
const published = read('apps/web/public/platform-v7/openapi.yaml');
const page = read('apps/web/app/platform-v7/api-docs/page.tsx');
const compliance = read('apps/web/app/platform-v7/compliance/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const cabinetPolicy = read('apps/web/lib/platform-v7/cabinet-access-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const authController = read('apps/api/src/modules/auth/auth.controller.ts');
const dealsController = read('apps/api/src/modules/deals/deals.controller.ts');
const logisticsController = read('apps/api/src/modules/logistics/logistics.controller.ts');
const disputesController = read('apps/api/src/modules/disputes/disputes.controller.ts');
const settlementController = read('apps/api/src/modules/settlement-engine/settlement-engine.controller.ts');
const integrationsController = read('apps/api/src/modules/integrations/integrations.controller.ts');

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;
const confirmedPaths = [
  '/health', '/ready', '/version', '/api/auth/me', '/api/deals',
  '/api/deals/{dealId}/workspace', '/api/deals/{dealId}/execution-workspace',
  '/api/logistics/shipments', '/api/logistics/shipments/{shipmentId}/workspace',
  '/api/disputes', '/api/disputes/{disputeId}',
  '/api/settlement-engine/deal/{dealId}/bank-workspace',
  '/api/settlement-engine/outbox', '/api/integrations/health',
] as const;

describe('platform-v7 verified API contract', () => {
  it('publishes one byte-identical conservative OpenAPI source', () => {
    expect(published).toBe(canonical);
    expect(canonical).toContain('openapi: 3.0.3');
    expect(canonical).toContain('x-maturity: controlled-integration-contract');
    expect(canonical).toContain('url: /');
    expect(canonical.match(/\n    get:\n/g)).toHaveLength(14);
    for (const apiPath of confirmedPaths) expect(canonical).toContain(`  ${apiPath}:`);
    for (const forbidden of [
      'GrainFlow', 'grainflow.ru', '/api/v1', '/market-news', '/scenario-runtime',
      '/handoff-runtime', 'DL-9095', 'DL-9110', '\n    post:', '\n    patch:',
      '\n    put:', '\n    delete:',
    ]) expect(canonical).not.toContain(forbidden);
  });

  it('grounds every published route in an actual controller boundary', () => {
    expect(authController).toContain("@Controller('auth')");
    expect(authController).toContain("@Get('me')");
    expect(dealsController).toContain("@Controller('deals')");
    expect(dealsController).toContain("@Get(':id/workspace')");
    expect(dealsController).toContain("@Get(':id/execution-workspace')");
    expect(logisticsController).toContain("@Controller('logistics')");
    expect(logisticsController).toContain("@Get('shipments')");
    expect(logisticsController).toContain("@Get('shipments/:id/workspace')");
    expect(disputesController).toContain("@Controller('disputes')");
    expect(disputesController).toContain("@Get(':id')");
    expect(settlementController).toContain("@Controller('settlement-engine')");
    expect(settlementController).toContain("@Get('deal/:id/bank-workspace')");
    expect(settlementController).toContain("@Get('outbox')");
    expect(integrationsController).toContain("@Controller('integrations')");
    expect(integrationsController).toContain("@Get('health')");
  });

  it('uses a protected Design System v8 route without a synthetic API catalogue', () => {
    expect(page).toContain("testId='platform-v7-api-docs-v8'");
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain("href='/platform-v7/openapi.yaml'");
    expect(page).toContain("startsWith('en')");
    expect(page).toContain("startsWith('zh')");
    expect(page).not.toMatch(forbiddenPresentation);
    expect(routePolicy).toContain("'/platform-v7/api-docs'");
    expect(cabinetPolicy).toContain("'/platform-v7/api-docs'");
    expect(compliance).not.toContain('ApiDocPanel');
    expect(exists('apps/web/components/platform-v7/ApiDocPanel.tsx')).toBe(false);
  });

  it('keeps mutating and external-provider contracts unpublished', () => {
    for (const forbidden of [
      '/bank-callback', '/fgis/webhook', '/edo/webhook', '/commands/{actionId}',
      '/reserve', '/release', '/api/api/partner',
    ]) expect(canonical).not.toContain(forbidden);
    expect(page).toContain('Write API пока не опубликован');
    expect(page).toContain('Write API is not published yet');
    expect(page).toContain('写入 API 尚未发布');
  });

  it('remains governed by the v8 boundary', () => {
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/api-docs/page.tsx');
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/onboarding/page.tsx');
    expect(governance.governedRoots).toContain('apps/web/lib/platform-v7/cabinet-access-policy.ts');
    expect(governance.version).toBeGreaterThanOrEqual(24);
  });
});
