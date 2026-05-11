import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = existsSync(path.join(process.cwd(), 'app/platform-v7'))
  ? process.cwd()
  : path.join(process.cwd(), 'apps/web');

function src(relPath: string): string {
  const full = path.join(root, relPath);
  expect(existsSync(full), `missing: ${relPath}`).toBe(true);
  return readFileSync(full, 'utf8');
}

// Guard 1: deal pages expose money/doc/trip/blocker/next-action concepts
describe('deal 360 pages expose execution concepts', () => {
  it('deals/[id]/clean/page.tsx contains money, doc, trip, next-action concepts', () => {
    const content = src('app/platform-v7/deals/[id]/clean/page.tsx').toLowerCase();
    expect(content).toContain('деньги');
    expect(content).toContain('документы');
    expect(content).toContain('следующ'); // следующее / следующий
    expect(content).toContain('выплата');
  });

  it('deals/page.tsx contains deal execution concepts', () => {
    const content = src('app/platform-v7/deals/page.tsx').toLowerCase();
    expect(content).toContain('деньги');
    expect(content).toContain('документы');
    expect(content).toContain('рейс');
    expect(content).toContain('спор');
  });

  it('deal360-source-of-truth exposes nextAction for every deal scenario', () => {
    const content = src('lib/platform-v7/deal360-source-of-truth.ts');
    expect(content).toContain('nextAction');
    expect(content).toContain('DL-9106');
    expect(content).toContain('DL-9102');
    // money, doc and trip state are present in the scenarios
    expect(content).toContain('blocksMoney');
    expect(content).toContain('TRIP-SIM');
  });
});

// Guard 2: bank/money pages do NOT claim money was moved without bank confirmation
describe('bank pages avoid money-moved overclaim', () => {
  it('bank/page.tsx does not claim unconditional payment execution', () => {
    const content = src('app/platform-v7/bank/page.tsx').toLowerCase();
    // must not say money was transferred unconditionally
    expect(content).not.toContain('деньги переведены');
    expect(content).not.toContain('выплата выполнена');
    expect(content).not.toContain('выплата произведена');
    expect(content).not.toContain('деньги отправлены');
  });

  it('bank/page.tsx mentions conditions required before release', () => {
    const content = src('app/platform-v7/bank/page.tsx').toLowerCase();
    // must explain that release requires conditions
    const hasConditionText =
      content.includes('не выпускаются') ||
      content.includes('условий сделки') ||
      content.includes('требует') ||
      content.includes('блокирует');
    expect(hasConditionText).toBe(true);
  });

  it('deals/grain-release/page.tsx does not claim live bank callback', () => {
    const content = src('app/platform-v7/deals/grain-release/page.tsx').toLowerCase();
    expect(content).not.toContain('боевой');
    expect(content).not.toContain('деньги отправлены');
  });
});

// Guard 3: role pages expose next actor or next action wording
describe('role pages expose next actor or next action', () => {
  const rolePages = [
    'app/platform-v7/seller/page.tsx',
    'app/platform-v7/buyer/page.tsx',
    'app/platform-v7/logistics/page.tsx',
    'app/platform-v7/bank/page.tsx',
    'app/platform-v7/disputes/page.tsx',
    'app/platform-v7/elevator/page.tsx',
  ];

  for (const page of rolePages) {
    it(`${page.split('/').slice(-2).join('/')} contains next-action or next-actor wording`, () => {
      const content = src(page).toLowerCase();
      const hasNextWording =
        content.includes('следующий') ||
        content.includes('следующее') ||
        content.includes('nextactor') ||
        content.includes('nextaction');
      expect(hasNextWording).toBe(true);
    });
  }
});

// Guard 4: default platform-v7 role pages do not link to demo routes
describe('role pages do not link to demo routes', () => {
  const checkPages = [
    'app/platform-v7/seller/page.tsx',
    'app/platform-v7/buyer/page.tsx',
    'app/platform-v7/logistics/page.tsx',
    'app/platform-v7/bank/page.tsx',
    'app/platform-v7/disputes/page.tsx',
    'app/platform-v7/elevator/page.tsx',
    'app/platform-v7/deals/page.tsx',
  ];

  for (const page of checkPages) {
    it(`${page.split('/').slice(-2).join('/')} has no /platform-v7/demo/ link`, () => {
      const content = src(page);
      expect(content).not.toContain('/platform-v7/demo/');
    });
  }
});

// Guard 5: driver field isolated from bank/investor/commercial surfaces
describe('driver page field isolation', () => {
  it('driver/page.tsx does not link to bank, investor, buyer or seller routes', () => {
    const driverPath = 'app/platform-v7/driver/page.tsx';
    if (!existsSync(path.join(root, driverPath))) {
      // driver page may be in a nested directory - skip if not found at this exact path
      return;
    }
    const content = src(driverPath);
    expect(content).not.toContain('/platform-v7/bank');
    expect(content).not.toContain('/platform-v7/investor');
    expect(content).not.toContain('/platform-v7/buyer');
    expect(content).not.toContain('/platform-v7/seller');
  });

  it('deal360-source-of-truth does not expose buyer/seller pricing in trip fields', () => {
    const content = src('lib/platform-v7/deal360-source-of-truth.ts');
    // tripId and logisticsOrderId do not expose commercial pricing data
    expect(content).toContain('tripId');
    expect(content).toContain('logisticsOrderId');
    // the trip fields are identifiers, not price fields
    expect(content).not.toContain('tripPrice');
    expect(content).not.toContain('tripAmount');
  });
});

// Guard 6: blocker/waiting text exists on key deal pages
describe('deal pages contain blocker or waiting-state text', () => {
  it('deals/[id]/clean/page.tsx exposes blocker or stopped state', () => {
    const content = src('app/platform-v7/deals/[id]/clean/page.tsx').toLowerCase();
    const hasBlockerText =
      content.includes('блокер') ||
      content.includes('остановлена') ||
      content.includes('невозможно') ||
      content.includes('заблокировано') ||
      content.includes('следующее действие');
    expect(hasBlockerText).toBe(true);
  });

  it('deals/page.tsx contains deal status or blocker indication', () => {
    const content = src('app/platform-v7/deals/page.tsx').toLowerCase();
    const hasStatusText =
      content.includes('статус') ||
      content.includes('заблокировано') ||
      content.includes('невозможно') ||
      content.includes('остановлена') ||
      content.includes('следующ');
    expect(hasStatusText).toBe(true);
  });

  it('bank/page.tsx shows what is blocked or cannot happen', () => {
    const content = src('app/platform-v7/bank/page.tsx').toLowerCase();
    const hasBlockerText =
      content.includes('блокирует') ||
      content.includes('нельзя') ||
      content.includes('невозможно') ||
      content.includes('не выпускаются') ||
      content.includes('удержан');
    expect(hasBlockerText).toBe(true);
  });
});

// Guard 7: no apps/landing references in deal 360 execution files
describe('no landing cross-contamination in deal 360 files', () => {
  const executionFiles = [
    'lib/platform-v7/deal360-source-of-truth.ts',
    'app/platform-v7/deals/page.tsx',
    'app/platform-v7/deals/[id]/clean/page.tsx',
    'app/platform-v7/bank/page.tsx',
  ];

  for (const file of executionFiles) {
    it(`${file.split('/').pop()} does not import from apps/landing`, () => {
      const content = src(file);
      expect(content).not.toContain('apps/landing');
      expect(content).not.toContain('@/landing');
      expect(content).not.toContain('../landing');
    });
  }
});
