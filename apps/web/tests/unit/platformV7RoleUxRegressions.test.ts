import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();

const buyerPage = readFileSync(join(cwd, 'app/platform-v7/buyer/page.tsx'), 'utf8');
const sellerPage = readFileSync(join(cwd, 'app/platform-v7/seller/page.tsx'), 'utf8');
const disputesPage = readFileSync(join(cwd, 'app/platform-v7/disputes/page.tsx'), 'utf8');
const elevatorPage = readFileSync(join(cwd, 'app/platform-v7/elevator/page.tsx'), 'utf8');
const driverPage = readFileSync(join(cwd, 'app/platform-v7/driver/page.tsx'), 'utf8');
const driverFieldPage = readFileSync(join(cwd, 'app/platform-v7/driver/field/page.tsx'), 'utf8');
const cleanDealPage = readFileSync(join(cwd, 'app/platform-v7/deals/[id]/clean/page.tsx'), 'utf8');
const controlTowerPage = readFileSync(join(cwd, 'app/platform-v7/control-tower/page.tsx'), 'utf8');
const operatorPage = readFileSync(join(cwd, 'app/platform-v7/operator/page.tsx'), 'utf8');
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

    it('driver field page explicitly declares what is hidden', () => {
      expect(driverFieldPage).toContain('скрыт');
    });

    it('driver role summary declares money and bids as hidden', () => {
      expect(roleSummarySource).toContain('деньги, ставки, банк, покупатель, кредит');
    });
  });

  describe('CTA discipline: hero sections reduced to 1 primary + 1 secondary', () => {
    it('buyer hero retains a single primary CTA to the deal money screen', () => {
      expect(buyerPage).toContain('Открыть деньги сделки');
    });

    it('buyer hero retains a single secondary CTA to the deal card', () => {
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
      // Хиро спора ведёт к карточке спора и к аудиту сделки (реструктурировано
      // с прежних ссылок на operator/bank; маршрутизация ролей осталась в теле).
      expect(disputesPage).toContain('/platform-v7/disputes/');
      expect(disputesPage).toContain('/audit');
    });
  });

  describe('seller route cards stay on available seller surfaces', () => {
    it('does not link route cards to absent seller create-lot or RFQ pages', () => {
      expect(sellerPage).not.toContain('/platform-v7/seller/lots/new');
      expect(sellerPage).not.toContain('/platform-v7/seller/rfq');
    });

    it('keeps seller route cards on the existing lots and matches surfaces', () => {
      expect(sellerPage).toContain('/platform-v7/seller/lots');
      expect(sellerPage).toContain('/platform-v7/seller/matches');
    });
  });

  describe('elevator quality wording stays pilot-safe', () => {
    it('quality section uses pilot wording, not simulation or external-confirmed wording', () => {
      expect(elevatorPage).toContain('протокол качества');
      expect(elevatorPage).not.toContain('симуляция протокола');
      expect(elevatorPage).not.toContain('ФГБУ ЦОК АПК');
    });

    it('elevator role summary hides commercial data from acceptance role', () => {
      const elevatorHiddenLine = roleSummarySource.match(/elevator: \{[\s\S]{0,900}hidden:[^\n]*/)?.[0] ?? '';
      expect(elevatorHiddenLine).toContain('банк');
    });
  });

  describe('deal clean page uses pilot terminology, not simulation', () => {
    it('money state is visible without simulation framing', () => {
      expect(cleanDealPage).toContain('Резерв денег');
      expect(cleanDealPage).toContain('Удержание');
    });

    it('clean deal page has no simulation wording', () => {
      expect(cleanDealPage).not.toContain('симуляция');
    });
  });

  describe('control tower uses pilot terminology', () => {
    // Легаси /control-tower теперь редирект на каноничный кабинет оператора;
    // операторское обрамление и секция исполнения живут в operator/page.tsx.
    it('legacy control tower redirects to the canonical operator workspace', () => {
      expect(controlTowerPage).toContain("redirect('/platform-v7/operator')");
      expect(controlTowerPage).not.toContain('Тестовая цепочка');
    });

    it('keeps operator framing without dev chain wording', () => {
      expect(operatorPage).toContain('Оператор · управление исполнением');
      expect(operatorPage).not.toContain('Тестовая цепочка');
    });

    it('keeps the operator execution queue section', () => {
      expect(operatorPage).toContain('Очередь исполнения');
    });
  });

  describe('deal clean page stays on the shared platform shell', () => {
    it('uses the P7 page layout', () => {
      expect(cleanDealPage).toContain('P7DealWorkspaceTabs');
    });
  });

  describe('role execution summaries declare field isolation for field roles', () => {
    it('driver summary has hidden declaration with money and bank', () => {
      expect(roleSummarySource).toMatch(/driver: \{[\s\S]{0,900}hidden:[^\n]*деньги[^\n]*банк/);
    });

    it('elevator summary has hidden declaration with bank and bids', () => {
      expect(roleSummarySource).toMatch(/elevator: \{[\s\S]{0,900}hidden:[^\n]*банк/);
    });

    it('lab summary has hidden declaration', () => {
      expect(roleSummarySource).toMatch(/lab: \{[\s\S]{0,900}hidden:/);
    });
  });
});
