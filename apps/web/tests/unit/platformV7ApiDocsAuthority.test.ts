import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/api-docs/page.tsx');
const contract = read('apps/api/openapi.yaml');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 partner API authority boundary', () => {
  it('uses the governed v8 cockpit without route-local visual overrides', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('OperationalQueueLink');
    expect(page).toContain('InlineNotice');
    expect(page).toContain('StatusChip');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('matches the source-controlled OpenAPI contract without presenting it as a live endpoint', () => {
    expect(contract).toContain('openapi: "3.0.3"');
    expect(contract).toContain('version: "3.0.0"');
    expect(contract).toContain('BearerAuth:');
    expect(contract).toContain('name: X-Api-Key');
    expect(page).toContain('OpenAPI 3.0.3');
    expect(page).toContain('версия контракта 3.0.0');
    expect(page).toContain('не подтверждён этим экраном');
    expect(page).toContain('does not prove a published endpoint');
    expect(page).toContain('不能证明 endpoint 已发布');
  });

  it('keeps credential and webhook authority server-side and Deal-scoped', () => {
    for (const required of [
      'Deal-scoped авторизация',
      'Жизненный цикл credentials',
      'durable inbox',
      'replay-защита',
      'rate limits',
      'audit trail',
      'reconciliation',
      'server-side credential issuance and revocation',
      '交易范围授权',
    ]) {
      expect(page).toContain(required);
    }

    for (const forbidden of [
      'ApiKeysPanel',
      'generateApiKey',
      'createApiKey',
      'localStorage',
      'sessionStorage',
      'setTimeout',
      'sk_live_',
      'api.grainflow.ru',
      'Production подключён',
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });

  it('states the non-production evidence boundary in RU EN and ZH', () => {
    expect(page).toContain('не создаёт API-ключи');
    expect(page).toContain('does not create API keys');
    expect(page).toContain('不会创建 API 密钥');
    expect(page).toContain('не подтверждает production-доступность');
    expect(page).toContain('confirm production availability');
    expect(page).toContain('确认生产可用性');
  });

  it('runs on the minimal v8 runtime and is registered in governance', () => {
    expect(routePolicy).toContain("'/platform-v7/api-docs'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/api-docs/page.tsx');
    expect(governance.version).toBeGreaterThanOrEqual(22);
  });
});
