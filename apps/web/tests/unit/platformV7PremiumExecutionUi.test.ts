import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 premium execution shell', () => {
  it('wires root command center to the premium shell', () => {
    const hub = read('apps/web/components/v7r/PlatformCommandCenterHub.tsx');

    expect(hub).toContain('PremiumDealShell');
    expect(hub).toContain('PLATFORM_V7_EXECUTION_SOURCE');
    expect(hub).toContain('normalizeRole');
    expect(hub).toContain('denormalizeRole');
  });

  it('keeps the premium deal shell light by default while preserving explicit dark mode', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(ui).toContain("theme = 'light'");
    expect(ui).toContain("theme?: 'dark' | 'light'");
    expect(ui).toContain('data-theme={theme}');
    expect(css).toContain(".root[data-theme='light']");
    expect(css).toContain(".driverRoot[data-theme='light']");
  });

  it('keeps premium top navigation compact with role always visible', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');

    expect(ui).toContain('function PremiumTopChrome');
    expect(ui).toContain('<PremiumTopChrome activeRole={activeRole} roles={roles} onSelectRole={handleRoleChange} />');
    expect(ui).toContain('<a href="/platform-v7">Сделки</a>');
    expect(ui).toContain('<a href="/platform-v7/lots">Лоты</a>');
    expect(ui).toContain('<a href="/platform-v7/bank">Деньги</a>');
    expect(ui).toContain('aria-label="Активная роль"');
    expect(ui).not.toContain('<a href="/platform-v7/logistics">Логистика</a>');
    expect(ui).not.toContain('<a href="/platform-v7/documents">Документы</a>');
    expect(ui).not.toContain('<a href="/platform-v7/disputes">Споры</a>');
    expect(ui).not.toContain('<a href="/platform-v7/support">Поддержка</a>');
  });

  it('keeps driver role on the field shell path', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');

    expect(ui).toContain("driver: ['execution']");
    expect(ui).toContain("activeRole === 'driver'");
    expect(ui).toContain('DriverFieldShell');
    expect(ui).toContain('return <DriverFieldShell task={deal.driverTask} theme={theme} />');
  });

  it('keeps adaptive mobile primitives in scoped styles', () => {
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(css).toContain('100dvh');
    expect(css).toContain('safe-area-inset-bottom');
    expect(css).toContain('container-type: inline-size');
    expect(css).toContain('@container');
    expect(css).toContain('overflow-x: clip');
  });

  it('keeps premium visual foundation tokens scoped to platform-v7', () => {
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(css).toContain('--p7-page-bg: #080a0d');
    expect(css).toContain('--p7-surface: #0e1116');
    expect(css).toContain('--p7-accent: #c6a15b');
    expect(css).toContain('--p7-shadow-floating');
    expect(css).toContain('--p7-z-sticky-header: 30');
    expect(css).toContain('--p7-ease-calm');
    expect(css).toContain(".root[data-theme='light']");
    expect(css).toContain('--p7-page-bg: #f7f4ee');
  });

  it('keeps visual foundation responsive, accessible and motion-safe', () => {
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(css).toContain('@media (max-width: 374px)');
    expect(css).toContain('@media (max-height: 430px) and (orientation: landscape)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('outline: 2px solid var(--p7-accent)');
    expect(css).toContain('font-variant-numeric: tabular-nums');
    expect(css).toContain('-webkit-line-clamp');
  });

  it('keeps every referenced premium style class defined in css', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');
    const referencedClasses = new Set<string>();

    for (const match of ui.matchAll(/styles\.([A-Za-z0-9_]+)/g)) referencedClasses.add(match[1]);
    for (const className of referencedClasses) expect(css).toContain(`.${className}`);
  });

  it('keeps deal core above-fold focused on money documents blocker and action', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(ui).toContain('function DealCoreSnapshot');
    expect(ui).toContain('aria-label="Главное по сделке"');
    expect(ui).toContain('<DealCoreSnapshot deal={deal} />');
    expect(ui).toContain('<span>Деньги</span>');
    expect(ui).toContain('<span>Документы</span>');
    expect(ui).toContain('<span>Главный блокер</span>');
    expect(ui).toContain('<span>Действие</span>');
    expect(css).toContain('.dealCore');
    expect(css).toContain('.coreActionCell');
    expect(css).toContain('.dealCore { grid-template-columns: repeat(4, minmax(0, 1fr)); }');
  });

  it('keeps deal core responsive without horizontal-scroll tables', () => {
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(css).toContain('.dealCore { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
    expect(css).toContain('.statusBar,\n  .dealCore {');
    expect(css).toContain('.dealCore { grid-template-columns: repeat(4, minmax(0, 1fr)); }');
    expect(css).toContain('.coreCell em { -webkit-line-clamp: 1; }');
  });

  it('keeps money rail dense without changing controlled money buckets', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(ui).toContain('const blockedRub = deal.money.heldRub + deal.money.awaitingDocsRub + deal.money.disputedRub;');
    expect(ui).toContain('К движению: {formatPremiumRubCompact(deal.money.readyToReleaseRub)}');
    expect(ui).toContain('Остановлено: {formatPremiumRubCompact(blockedRub)}');
    expect(ui).toContain('Выпущено: {formatPremiumRubCompact(deal.money.releasedRub)}');
    expect(ui).toContain("{ label: 'Ждёт документы', value: deal.money.awaitingDocsRub, tone: 'info' as DealTone }");
    expect(css).toContain('.moneyHeader');
    expect(css).toContain('.moneySummary');
    expect(css).toContain('.moneyParts {\n  display: grid;\n  grid-template-columns: repeat(5, minmax(0, 1fr));');
  });

  it('keeps document matrix dense and mobile-card based', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(ui).toContain('const readyCount = documents.filter((doc) => doc.status === \'ready\').length;');
    expect(ui).toContain('aria-label="Сводка документов"');
    expect(ui).toContain('className={styles.docMatrix}');
    expect(ui).toContain('className={styles.docRow} data-status={doc.status}');
    expect(ui).toContain('className={styles.docOwner}');
    expect(css).toContain('.docSummary');
    expect(css).toContain('.docRow {');
    expect(css).toContain(".docRow[data-status='blocked']");
    expect(css).toContain('.row,\n  .docRow { grid-template-columns: 1fr; }');
  });

  it('keeps execution evidence and timeline compact with mobile-card behavior', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(ui).toContain('className={styles.executionList}');
    expect(ui).toContain('className={styles.executionStep} data-status={step.status}');
    expect(ui).toContain('className={styles.executionMeta}');
    expect(ui).toContain('className={styles.evidenceSummary}');
    expect(ui).toContain('className={styles.evidenceGrid}');
    expect(ui).toContain('className={styles.evidenceItem} data-status={item.status}');
    expect(ui).toContain('className={styles.evidenceMeta}');
    expect(ui).toContain('const impactRub = evidence.reduce((sum, item) => sum + (item.moneyImpactRub ?? 0), 0);');
    expect(css).toContain('.executionList');
    expect(css).toContain('.evidenceGrid');
    expect(css).toContain('.executionStep,\n.evidenceItem {');
    expect(css).toContain('.executionStep[data-status=\'blocked\']');
    expect(css).toContain('.evidenceSummary { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
    expect(css).toContain('.executionStep,\n  .evidenceItem { grid-template-columns: 1fr; }');
  });

  it('keeps blocker and next action hierarchy clear without new css surfaces', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');

    expect(ui).toContain('причина остановки');
    expect(ui).toContain('<dt>Влияние</dt>');
    expect(ui).toContain('<dt>Ответственный</dt>');
    expect(ui).toContain('Действие: {limitPremiumText(item.nextAction, premiumTextLimits.cta)}');
    expect(ui).toContain('Почему сейчас: {limitPremiumText(action.reason, premiumTextLimits.description)}');
    expect(ui).toContain('Почему недоступно: {limitPremiumText(action.disabledReason, premiumTextLimits.description)}');
    expect(ui).not.toContain('blockerSignalGrid');
    expect(ui).not.toContain('nextActionGrid');
    expect(ui).not.toContain('nextActionTop');
  });

  it('keeps money reconciliation as one reserved amount split into controlled buckets', () => {
    const money = read('apps/web/lib/platform-v7/premium/money.ts');

    expect(money).toContain('money.reservedRub - (money.readyToReleaseRub + money.heldRub + money.awaitingDocsRub + money.disputedRub + money.releasedRub)');
    expect(money).toContain('Math.abs(getMoneyBalanceDelta(money)) < 1');
  });

  it('keeps unsafe maturity and guarantee claims out of premium UI sources', () => {
    const files = [
      'apps/web/components/platform-v7/premium/ExecutionUi.tsx',
      'apps/web/components/v7r/PlatformCommandCenterHub.tsx',
      'apps/web/lib/platform-v7/premium/copy.ts',
    ];

    const source = files.map(read).join('\n').toLowerCase();
    const forbiddenClaims = [
      'production-ready',
      'fully live',
      'fully integrated',
      'marketplace',
      'sandbox',
      'guarantee payment',
      'risk-free deal',
      'гарантируем оплату',
      'гарантия оплаты',
      'безрисковая сделка',
      'полностью интегрировано',
      'полностью готово',
      'лучшая платформа',
      'нет аналогов',
      'революционный',
      'уникальный',
    ];

    for (const claim of forbiddenClaims) expect(source).not.toContain(claim);
  });

  it('keeps bank as the release confirmer instead of the platform', () => {
    const files = [
      'apps/web/components/platform-v7/premium/ExecutionUi.tsx',
      'apps/web/components/v7r/PlatformCommandCenterHub.tsx',
      'apps/web/lib/platform-v7/deal-execution-source-of-truth.ts',
      'apps/web/lib/platform-v7/premium/copy.ts',
    ];
    const source = files.map(read).join('\n').toLowerCase();

    const forbiddenReleaseClaims = [
      'платформа выпускает деньги',
      'платформа переводит деньги',
      'платформа освобождает деньги',
      'мы выпускаем деньги',
      'мы переводим деньги',
      'automatic money release',
      'auto-release money',
      'platform releases money',
    ];

    for (const claim of forbiddenReleaseClaims) expect(source).not.toContain(claim);
    expect(source).toContain('подтверждение банка');
  });

  it('keeps role adapter explicit between product roles and stored platform roles', () => {
    const hub = read('apps/web/components/v7r/PlatformCommandCenterHub.tsx');

    expect(hub).toContain("if (role === 'arbitrator') return 'arbiter';");
    expect(hub).toContain("if (role === 'arbiter') return 'arbitrator';");
    expect(hub).toContain('onRoleChange={(nextRole) => setRole(denormalizeRole(nextRole))}');
  });

  it('keeps every live execution role available from the top role selector', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');
    const requiredRoles = [
      'seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab',
      'surveyor', 'bank', 'arbiter', 'compliance', 'operator', 'executive',
    ];

    for (const role of requiredRoles) expect(ui).toContain(`${role}:`);
    expect(ui).toContain('aria-label="Активная роль"');
    expect(ui).toContain('value={activeRole}');
    expect(ui).toContain('roleLabels[role]');
    expect(ui).toContain('onChange={(event) => onSelectRole(event.target.value as DealRole)}');
  });

  it('keeps the selected role visible in page state and above-fold status', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');

    expect(ui).toContain('<main className={styles.root} data-role={activeRole} data-theme={theme}>');
    expect(ui).toContain('{roleLabels[role]} · {limitPremiumText(deal.stageLabel, 48)}');
    expect(ui).toContain('<StatusBar deal={deal} role={activeRole} />');
  });

  it('keeps the driver shell isolated from desktop chrome and money surfaces', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');
    const driverReturn = ui.indexOf("if (activeRole === 'driver' && deal.driverTask) return <DriverFieldShell task={deal.driverTask} theme={theme} />;");
    const desktopChrome = ui.indexOf('styles.topChrome');

    expect(driverReturn).toBeGreaterThan(-1);
    expect(desktopChrome).toBeGreaterThan(driverReturn);
    expect(ui).toContain('Офлайн-очередь: {task.offlineQueueCount}');
    expect(css).toContain('min-height: 64px');
    expect(css).toContain('min-height: 56px');
  });
});
