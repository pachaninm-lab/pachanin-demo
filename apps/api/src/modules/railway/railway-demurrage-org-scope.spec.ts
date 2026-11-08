import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { RailwayController } from './railway.controller';
import { RailwayService } from './railway.service';

/**
 * Расчёт демереджа — только в пределах своей организации.
 *
 * До исправления `GET /railway/demurrage` отдавал расчёты всех организаций
 * вместе с их сделками и суммами, а `POST /railway/demurrage/calculate` писал
 * запись, не привязанную ни к какой организации.
 *
 * Владение вагоном здесь намеренно не проверяется: простой обычно считает
 * грузополучатель, а вагон принадлежит другой стороне. Запись принадлежит
 * той организации, которая её посчитала.
 */

const OWNER = 'org-logistics-001';
const OTHER = 'org-attacker';

const input = (dealId = 'deal-1') => ({
  wagonId: 'w-1',
  dealId,
  arrivedAt: '2026-09-01T00:00:00.000Z',
  unloadingCompletedAt: '2026-09-03T00:00:00.000Z',
});

describe('расчёт демереджа', () => {
  it('запись помечается организацией вызывающего', () => {
    const record = new RailwayService().calculateDemurrage(input(), OWNER);
    expect(record.orgId).toBe(OWNER);
  });

  it('без организации расчёт не пишется', () => {
    const railway = new RailwayService();
    expect(() => railway.calculateDemurrage(input(), '')).toThrow(ForbiddenException);
    expect(() => railway.calculateDemurrage(input(), undefined as never)).toThrow(ForbiddenException);
    expect([...railway.listDemurrage(OWNER), ...railway.listDemurrage(OTHER)]).toHaveLength(0);
  });

  it('контроллер берёт организацию из сессии, а не из тела', () => {
    const railway = new RailwayService();
    const controller = new RailwayController(railway);
    const record = controller.calculateDemurrage({ ...input(), orgId: OTHER } as never, { orgId: OWNER });
    expect(record.orgId).toBe(OWNER);
    expect(railway.listDemurrage(OTHER)).toEqual([]);
  });
});

describe('список демереджа', () => {
  it('видны только записи своей организации', () => {
    const railway = new RailwayService();
    const own = railway.calculateDemurrage(input(), OWNER);
    railway.calculateDemurrage(input(), OTHER);
    expect(railway.listDemurrage(OWNER).map((r) => r.id)).toEqual([own.id]);
  });

  it('фильтр по сделке не открывает чужие записи', () => {
    const railway = new RailwayService();
    railway.calculateDemurrage(input('deal-1'), OWNER);
    expect(railway.listDemurrage(OTHER, 'deal-1')).toEqual([]);
    expect(railway.listDemurrage(OWNER, 'deal-1')).toHaveLength(1);
    expect(railway.listDemurrage(OWNER, 'deal-2')).toEqual([]);
  });

  it('без организации — пустой список, а не все записи', () => {
    const railway = new RailwayService();
    railway.calculateDemurrage(input(), OWNER);
    expect(railway.listDemurrage('')).toEqual([]);
    expect(railway.listDemurrage(undefined as never)).toEqual([]);
  });

  it('контроллер передаёт в сервис организацию из сессии', () => {
    const railway = new RailwayService();
    const controller = new RailwayController(railway);
    railway.calculateDemurrage(input(), OWNER);
    expect(controller.listDemurrage({ orgId: OTHER })).toEqual([]);
    expect(controller.listDemurrage({ orgId: OWNER })).toHaveLength(1);
    expect(controller.listDemurrage({})).toEqual([]);
  });
});
