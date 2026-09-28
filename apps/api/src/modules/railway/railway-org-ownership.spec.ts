import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { RailwayController } from './railway.controller';
import { RailwayService } from './railway.service';

/**
 * Вагон принадлежит организации: менять его статус и ставить его в заявку
 * ГУ-12 может только она.
 *
 * До исправления `updateWagonStatus` и `createGU12` искали вагон только по
 * идентификатору. LOGISTICIAN или ADMIN любой организации мог перевести чужой
 * вагон в MAINTENANCE или вписать чужой свободный вагон в свою заявку; после
 * одобрения заявки вагон становился ASSIGNED с чужим currentDealId.
 *
 * ADMIN здесь — роль участника внутри организации, а не платформенный
 * персонал (тот описан отдельно в RequestUser.staffRoles), поэтому обхода
 * проверки для него нет.
 */

const OWNER = 'org-logistics-001';
const OTHER = 'org-attacker';

const gu12 = (requestorOrgId: string, wagonIds: string[]) => ({
  dealId: 'deal-1',
  requestorOrgId,
  wagonIds,
  departureStation: '000100',
  destinationStation: '000200',
  cargo: 'пшеница',
  volumeTons: 60,
  requestedDepartureAt: '2026-10-01T00:00:00.000Z',
});

function freeWagonOf(railway: RailwayService, orgId: string) {
  const wagon = railway.listWagons(orgId).find((w) => w.status === 'FREE');
  if (!wagon) throw new Error(`в демонстрационном парке нет свободного вагона ${orgId}`);
  return wagon;
}

describe('смена статуса вагона', () => {
  it('владелец меняет статус своего вагона', () => {
    const railway = new RailwayService();
    const wagon = freeWagonOf(railway, OWNER);
    expect(railway.updateWagonStatus(wagon.id, 'MAINTENANCE', OWNER)).toMatchObject({ status: 'MAINTENANCE' });
  });

  it('чужая организация получает отказ, и вагон не меняется', () => {
    const railway = new RailwayService();
    const wagon = freeWagonOf(railway, OWNER);
    expect(() => railway.updateWagonStatus(wagon.id, 'MAINTENANCE', OTHER, 'deal-x')).toThrow(NotFoundException);
    const after = railway.listWagons(OWNER).find((w) => w.id === wagon.id);
    expect(after?.status).toBe('FREE');
    expect(after?.currentDealId).toBeUndefined();
  });

  it('без организации вызывающего сервис отказывает, а не пропускает', () => {
    const railway = new RailwayService();
    const wagon = freeWagonOf(railway, OWNER);
    expect(() => railway.updateWagonStatus(wagon.id, 'MAINTENANCE', '')).toThrow(NotFoundException);
    expect(() => railway.updateWagonStatus(wagon.id, 'MAINTENANCE', undefined as never)).toThrow(NotFoundException);
  });

  it('чужой вагон неотличим от несуществующего', () => {
    const railway = new RailwayService();
    const wagon = freeWagonOf(railway, OWNER);
    const message = (fn: () => unknown) => {
      try { fn(); } catch (error) { return (error as Error).message.replace(wagon.id, '<id>').replace('нет-такого', '<id>'); }
      throw new Error('ожидался отказ');
    };
    expect(message(() => railway.updateWagonStatus(wagon.id, 'MAINTENANCE', OTHER)))
      .toBe(message(() => railway.updateWagonStatus('нет-такого', 'MAINTENANCE', OTHER)));
  });

  it('контроллер передаёт в сервис организацию из сессии, а не из запроса', () => {
    const railway = new RailwayService();
    const controller = new RailwayController(railway);
    const wagon = freeWagonOf(railway, OWNER);
    expect(() => controller.updateWagonStatus(wagon.id, { status: 'MAINTENANCE' } as never, { orgId: OTHER }))
      .toThrow(NotFoundException);
    expect(controller.updateWagonStatus(wagon.id, { status: 'MAINTENANCE' } as never, { orgId: OWNER }))
      .toMatchObject({ status: 'MAINTENANCE' });
  });
});

describe('заявка ГУ-12', () => {
  it('заявитель ставит в заявку свой свободный вагон', () => {
    const railway = new RailwayService();
    const wagon = freeWagonOf(railway, OWNER);
    expect(railway.createGU12(gu12(OWNER, [wagon.id]))).toMatchObject({ status: 'DRAFT', wagons: [wagon.id] });
  });

  it('чужой свободный вагон в заявку не попадает, и заявка не создаётся', () => {
    const railway = new RailwayService();
    const wagon = freeWagonOf(railway, OWNER);
    expect(() => railway.createGU12(gu12(OTHER, [wagon.id]))).toThrow(NotFoundException);
    expect(railway.listGU12()).toHaveLength(0);
  });

  it('один чужой вагон среди своих отклоняет всю заявку', () => {
    const railway = new RailwayService();
    const own = railway.registerWagon({ wagonNumber: '52999999', type: 'HOPPER', capacityTons: 60, ownerOrgId: OTHER });
    const foreign = freeWagonOf(railway, OWNER);
    expect(() => railway.createGU12(gu12(OTHER, [own.id, foreign.id]))).toThrow(NotFoundException);
    expect(railway.listGU12()).toHaveLength(0);
  });

  it('контроллер берёт заявителя из сессии', () => {
    const railway = new RailwayService();
    const controller = new RailwayController(railway);
    const wagon = freeWagonOf(railway, OWNER);
    const { requestorOrgId: _ignored, ...body } = gu12(OWNER, [wagon.id]);
    expect(() => controller.createGU12({ ...body, wagonIds: [wagon.id] } as never, { orgId: OTHER }))
      .toThrow(NotFoundException);
    expect(controller.createGU12({ ...body, wagonIds: [wagon.id] } as never, { orgId: OWNER }))
      .toMatchObject({ requestorOrgId: OWNER });
  });
});
