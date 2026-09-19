import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(repoRoot, relativePath));

const page = read('apps/web/app/platform-v7/connectors/page.tsx');
const reader = read('apps/web/lib/integrations-server.ts');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 connectors authority', () => {
  it('uses the governed v8 cockpit without route-local presentation', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('OperationalQueueLink');
    expect(page).toContain('InlineNotice');
    expect(page).toContain('StatusChip');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('renders only authenticated server diagnostics and never upgrades them to production connectivity', () => {
    expect(page).toContain('getIntegrationDiagnostics');
    expect(page).toContain('diagnostics.available');
    expect(page).toContain('diagnostics.connectors');
    expect(page).toContain('diagnosticOnly');
    expect(page).toContain('notConfirmed');
    expect(page).toContain('SANDBOX_ONLY');
    expect(page).toContain('LIVE_SIMULATED');
    expect(page).toContain('MANUAL');

    for (const forbidden of [
      'DL-9106',
      'ApiKeysPanel',
      'FgisZernoPanel',
      'CollapsibleSection',
      'connectorSummary',
      'const integrations =',
      'Останавливают выплату',
      'Сценарий закрыт',
      'stateBg(',
      'stateBorder(',
      'stateText(',
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });

  it('keeps the diagnostic reader fail-closed and validates every connector record', () => {
    expect(reader).toContain("serverApiUrl('/integrations/health')");
    expect(reader).toContain('serverAuthHeaders()');
    expect(reader).toContain("cache: 'no-store'");
    expect(reader).toContain('UNAVAILABLE');
    expect(reader).toContain('parseSnapshot');
    expect(reader).toContain('parseConnector');
    expect(reader).toContain('Number.isSafeInteger');
    expect(reader).not.toContain('SANDBOX_ONLY');
    expect(reader).not.toContain('LIVE_SIMULATED');
    expect(reader).not.toContain('DEAL-001');
  });

  it('provides complete RU EN ZH evidence boundaries', () => {
    expect(page).toContain('Диагностика не равна подключению');
    expect(page).toContain('Diagnostics are not a connection');
    expect(page).toContain('诊断不等于连接');
    expect(page).toContain('подтверждённый end-to-end обмен');
    expect(page).toContain('confirmed end-to-end exchange');
    expect(page).toContain('已确认的端到端交换');
  });

  it('removes obsolete static panels and runs on the minimal v8 runtime', () => {
    expect(exists('apps/web/components/platform-v7/ApiKeysPanel.tsx')).toBe(false);
    expect(exists('apps/web/components/platform-v7/FgisZernoPanel.tsx')).toBe(false);
    expect(routePolicy).toContain("'/platform-v7/connectors'");
    expect(governance.governedRoots).toContain('apps/web/lib/integrations-server.ts');
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/connectors/page.tsx');
  });
});
