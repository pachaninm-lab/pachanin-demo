import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();

const buyerPage = readFileSync(join(cwd, 'app/platform-v7/buyer/page.tsx'), 'utf8');
const sellerPage = readFileSync(join(cwd, 'app/platform-v7/seller/page.tsx'), 'utf8');
const disputesPage = readFileSync(join(cwd, 'app/platform-v7/disputes/page.tsx'), 'utf8');
const elevatorPage = readFileSync(join(cwd, 'app/platform-v7/elevator/page.tsx'), 'utf8');
const driverPage = readFileSync(join(cwd, 'app/platform-v7/driver/page.tsx'), 'utf8');
const cleanDealPage = readFileSync(join(cwd, 'app/platform-v7/deals/[id]/clean/page.tsx'), 'utf8');
const controlTowerPage = readFileSync(join(cwd, 'app/platform-v7/control-tower/page.tsx'), 'utf8');
const roleSummarySource = readFileSync(join(cwd, 'components/platform-v7/RoleExecutionSummary.tsx'), 'utf8');

const devTerms = [
  'денежный guard',
  'симуляция протокола',
  'Интеграции в сделке · симуляция',
  'симуляция по логике',
  'Тестовая цепочка',
  'Тестовый контур',
  'requestReserve',
  'simulation-grade',
  'action handoff',
];

describe('platform-v7 role UX regressions', () => {
  describe('dev terms must not appear in user-facing role page source', () => {
    const namedPages: Record<string, string> = {
      buyerPage, sellerPage, disputesPage, elevatorPage, cleanDealPage, controlTowerPage,
    };

    for (const term of devTerms) {
      it(`"${term}" absent from all checked role pages`, () => {
        for (const [name, source] of Object.entries(namedPages)) {
          expect(source, `${name} contains dev term "${term}"`).not.toContain(term);
        }
      });
    }
  });

  describe('no demo route links from role pages', () => {
    it('no role page links to /platform-v7/demo/ routes', () => {
      for (const source of [buyerPage, sellerPage, disputesPage, elevatorPage, driverPage, cleanDealPage, controlTowerPage]) {
        expect(source).not.toContain('/platform-v7/demo/');
      }
    });

    it('control tower does not link to demo grain-execution route', () => {
      expect(controlTowerPage).not.toContain('/platform-v7/demo/grain-execution');
    });
  });

  describe('driver page stays field-only', () => {
    const privilegedRoutes = [
      '/platform-v7/bank',
      '/platform-v7/investor',
      '/platform-v7/buyer',
      '/platform-v7/seller',
    ];

    for (const route of privilegedRoutes) {
      it(`driver page must not link to privileged route ${route}`, () => {
        expect(driverPage).not.toContain(route);
      });
    }

    it('driver page explicitly declares what is hidden', () => {
      expect(driverPage).toContain('скрыты');
    });

    it('driver role summary declares money and bids as hidden', () => {
      expect(roleSummarySource).toContain("деньги, ставки, банк, покупатель, кредит");
    });
  });

  describe('CTA discipline: hero sections reduced to 1 primary + 1 secondary', () => {
    it('buyer hero retains primary CTA Создать запрос', () => {
      expect(buyerPage).toContain('Создать запрос');
    });

    it('buyer hero retains secondary CTA Карточка сделки', () => {
      expect(buyerPage).toContain('Карточка сделки');
    });

    it('buyer hero has removed extra financing CTA', () => {
      expect(buyerPage).not.toContain('Оплата в кредит');
    });

    it('seller hero retains primary CTA Создать партию', () => {
      expect(sellerPage).toContain('Создать партию');
    });

    it('seller hero retains secondary CTA Открыть сделку', () => {
      expect(sellerPage).toContain('Открыть сделку');
    });

    it('disputes hero retains 2 action link targets', () => {
      expect(disputesPage).toContain('/platform-v7/operator');
      expect(disputesPage).toContain('/platform-v7/bank');
    });
  });

  describe('elevator quality wording stays pilot-safe', () => {
    it('quality section uses pilot wording, not simulation or external-confirmed wording', () => {
      expect(elevatorPage).toContain('пилотный протокол качества');
      expect(elevatorPage).not.toContain('симуляция протокола');
      expect(elevatorPage).not.toContain('ФГБУ ЦОК АПК');
    });

    it('elevator role summary hides commercial data from acceptance role', () => {
      const elevatorHiddenLine = roleSummarySource.match(/elevator[\s\S]{0,300}hidden:/)?.[0] ?? '';
      expect(elevatorHiddenLine).toContain('банк');
    });
  });

  describe('deal clean page uses pilot terminology, not simulation', () => {
    it('integration section uses "пилот" label', () => {
      expect(cleanDealPage).toContain('Интеграции в сделке · пилот');
    });

    it('external connections described as pilot mode', () => {
      expect(cleanDealPage).toContain('пилотный режим');
    });

    it('clean deal page has no simulation wording', () => {
      expect(cleanDealPage).not.toContain('симуляция');
    });
  });

  describe('control tower uses pilot terminology', () => {
    it('uses "Пилотная цепочка" not "Тестовая цепочка"', () => {
      expect(controlTowerPage).toContain('Пилотная цепочка');
      expect(controlTowerPage).not.toContain('Тестовая цепочка');
    });

    it('uses pilot execution section label', () => {
      expect(controlTowerPage).toContain('Контур исполнения (пилот)');
    });
  });

  describe('deal clean page navigation links have 44px tap target', () => {
    it('linkStyle function includes minHeight: 44', () => {
      expect(cleanDealPage).toContain('minHeight: 44');
    });
  });

  describe('role execution summaries declare field isolation for field roles', () => {
    it('driver summary has hidden declaration with money and bank', () => {
      expect(roleSummarySource).toMatch(/driver[\s\S]{0,400}hidden:.*деньги[\s\S]{0,200}банк/);
    });

    it('elevator summary has hidden declaration with bank and bids', () => {
      expect(roleSummarySource).toMatch(/elevator[\s\S]{0,400}hidden:.*банк/);
    });

    it('lab summary has hidden declaration', () => {
      expect(roleSummarySource).toMatch(/lab[\s\S]{0,400}hidden:/);
    });
  });
});
