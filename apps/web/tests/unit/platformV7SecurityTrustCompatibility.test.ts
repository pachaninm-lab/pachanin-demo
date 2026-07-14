import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const security = read('apps/web/app/platform-v7/security/page.tsx');
const grainSecurity = read('apps/web/app/platform-v7/security/grain/page.tsx');
const trust = read('apps/web/app/platform-v7/trust/page.tsx');
const simulator = read('apps/web/app/platform-v7/simulator/page.tsx');
const profile = read('apps/web/app/platform-v7/profile/page.tsx');
const status = read('apps/web/app/platform-v7/status/page.tsx');
const controlTower = read('apps/web/app/platform-v7/control-tower/page.tsx');
const dealFlow = read('apps/web/app/platform-v7/deal-flow/page.tsx');
const scope = read('scripts/check-design-system-v8-pr-scope.mjs');

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 security, trust and simulator compatibility', () => {
  it('routes access security to the verified server profile', () => {
    expect(security).toContain("import { redirect } from 'next/navigation'");
    expect(security).toContain("redirect('/platform-v7/profile')");
    expect(security).not.toContain('WebAuthnPanel');
    expect(security).not.toContain('SsoSamlPanel');
    expect(security).not.toContain('pilot-ready');
    expect(security).not.toMatch(forbiddenPresentation);
    expect(profile).toContain('getAuthProfile');
    expect(profile).toContain('profile.mfaVerified');
    expect(profile).toContain('server security boundary');
  });

  it('routes fabricated grain-risk metrics to the server-authoritative control tower', () => {
    expect(grainSecurity).toContain("redirect('/platform-v7/control-tower')");
    for (const fixture of ['78/100', 'новое устройство', 'расхождение ожидаемое прибытие', 'выпуск закрыт']) {
      expect(grainSecurity).not.toContain(fixture);
    }
    expect(grainSecurity).not.toMatch(forbiddenPresentation);
    expect(controlTower).toContain('OperationalDecisionCockpit');
  });

  it('routes maturity claims to verified status evidence', () => {
    expect(trust).toContain("redirect('/platform-v7/status')");
    expect(trust).not.toContain('Подтверждено в платформе');
    expect(trust).not.toContain('Карта зрелости платформы');
    expect(trust).not.toMatch(forbiddenPresentation);
    expect(status).toContain('getOutboxStatus');
    expect(status).toContain('externalRequired');
  });

  it('routes static scenario cards to the canonical public deal flow', () => {
    expect(simulator).toContain("redirect('/platform-v7/deal-flow')");
    for (const fixture of ['Чистая сделка', 'Нет СДИЗ', 'Расхождение банка', 'Частичное банковское основание']) {
      expect(simulator).not.toContain(fixture);
    }
    expect(simulator).not.toMatch(forbiddenPresentation);
    expect(dealFlow).toContain('export default');
  });

  it('keeps all four compatibility routes inside exact migration scope', () => {
    expect(scope).toContain("'apps/web/app/platform-v7/security/page.tsx'");
    expect(scope).toContain("'apps/web/app/platform-v7/security/grain/page.tsx'");
    expect(scope).toContain("'apps/web/app/platform-v7/trust/page.tsx'");
    expect(scope).toContain("'apps/web/app/platform-v7/simulator/page.tsx'");
    expect(scope).toContain("'apps/web/tests/unit/platformV7SecurityTrustCompatibility.test.ts'");
  });
});
