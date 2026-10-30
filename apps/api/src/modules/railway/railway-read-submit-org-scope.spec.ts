import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { RailwayController } from './railway.controller';
import { RailwayService } from './railway.service';

/**
 * Чтение парка и заявок ГУ-12, отправка заявки — только в пределах своей
 * организации.
 *
 * До исправления:
 * - `GET /railway/wagons?orgId=<чужая>` отдавал парк любой организации;
 * - `GET /railway/gu12` отдавал заявки всех организаций;
 * - `POST /railway/gu12/:id/submit` отправлял в ЭТРАН чужую заявку любому,
 *   кто знал её идентификатор, а после одобрения вагоны заявителя
 *   становились ASSIGNED по чужой команде.
 *
 * Организация берётся только из сессии; ADMIN здесь — роль внутри
 * организации, а не платформенный персонал, поэтому обхода нет.
 */

const OWNER = 'org-logistics-001';
const OTHER = 'org-attacker';

const gu12 = (requestorOrgId: string, wagonIds: string[], dealId = 'deal-1') => ({
  dealId,
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

afterEach(() => {
  jest.useRealTimers();
});

describe('список вагонов', () => {
  it('контроллер отдаёт только парк организации из сессии', () => {
    const railway = new RailwayService();
    const controller = new RailwayController(railway);
    const own = controller.listWagons({ orgId: OWNER });
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((w) => w.ownerOrgId === OWNER)).toBe(true);
    expect(controller.listWagons({ orgId: OTHER })).toEqual([]);
  });

  it('присланный orgId больше ничего не решает', () => {
    const railway = new RailwayService();
    const controller = new RailwayController(railway);
    // Прежняя сигнатура принимала `?orgId=` вторым аргументом.
    expect((controller.listWagons as (...args: unknown[]) => unknown[])({ orgId: OTHER }, OWNER)).toEqual([]);
  });

  it('без организации в сессии — пустой список, а не весь парк', () => {
    const controller = new RailwayController(new RailwayService());
    expect(controller.listWagons({})).toEqual([]);
    expect(controller.listWagons({ orgId: '' })).toEqual([]);
  });
});

describe('список заявок ГУ-12', () => {
  it('видны только заявки своей организации', () => {
    const railway = new RailwayService();
    const wagon = freeWagonOf(railway, OWNER);
    const req = railway.createGU12(gu12(OWNER, [wagon.id]));
    expect(railway.listGU12(OWNER).map((r) => r.id)).toEqual([req.id]);
    expect(railway.listGU12(OTHER)).toEqual([]);
    expect(railway.listGU12(OTHER, 'deal-1')).toEqual([]);
  });

  it('фильтр по сделке действует внутри своей организации', () => {
    const railway = new RailwayService();
    const [a, b] = railway.listWagons(OWNER).filter((w) => w.status === 'FREE');
    const first = railway.createGU12(gu12(OWNER, [a!.id], 'deal-1'));
    railway.createGU12(gu12(OWNER, [b!.id], 'deal-2'));
    expect(railway.listGU12(OWNER, 'deal-1').map((r) => r.id)).toEqual([first.id]);
  });

  it('без организации — пустой список', () => {
    const railway = new RailwayService();
    railway.createGU12(gu12(OWNER, [freeWagonOf(railway, OWNER).id]));
    expect(railway.listGU12('')).toEqual([]);
    expect(railway.listGU12(undefined as never)).toEqual([]);
  });

  it('контроллер берёт организацию из сессии', () => {
    const railway = new RailwayService();
    const controller = new RailwayController(railway);
    railway.createGU12(gu12(OWNER, [freeWagonOf(railway, OWNER).id]));
    expect(controller.listGU12({ orgId: OTHER })).toEqual([]);
    expect(controller.listGU12({ orgId: OWNER })).toHaveLength(1);
  });
});

describe('отправка заявки ГУ-12', () => {
  it('заявитель отправляет свою заявку', async () => {
    jest.useFakeTimers();
    const railway = new RailwayService();
    const wagon = freeWagonOf(railway, OWNER);
    const req = railway.createGU12(gu12(OWNER, [wagon.id]));
    await expect(railway.submitGU12(req.id, OWNER)).resolves.toMatchObject({ status: 'SUBMITTED' });
    jest.runOnlyPendingTimers();
    expect(railway.listGU12(OWNER)[0]?.status).toBe('APPROVED');
  });

  it('чужая организация получает отказ, заявка и вагоны не меняются', async () => {
    jest.useFakeTimers();
    const railway = new RailwayService();
    const wagon = freeWagonOf(railway, OWNER);
    const req = railway.createGU12(gu12(OWNER, [wagon.id]));
    await expect(railway.submitGU12(req.id, OTHER)).rejects.toThrow(NotFoundException);
    jest.runOnlyPendingTimers();
    const after = railway.listGU12(OWNER)[0];
    expect(after?.status).toBe('DRAFT');
    expect(after?.etranId).toBeUndefined();
    expect(railway.listWagons(OWNER).find((w) => w.id === wagon.id)?.status).toBe('FREE');
  });

  it('без организации вызывающего отказ', async () => {
    const railway = new RailwayService();
    const req = railway.createGU12(gu12(OWNER, [freeWagonOf(railway, OWNER).id]));
    await expect(railway.submitGU12(req.id, '')).rejects.toThrow(NotFoundException);
    await expect(railway.submitGU12(req.id, undefined as never)).rejects.toThrow(NotFoundException);
  });

  it('чужая заявка неотличима от несуществующей', async () => {
    const railway = new RailwayService();
    const req = railway.createGU12(gu12(OWNER, [freeWagonOf(railway, OWNER).id]));
    const message = async (p: Promise<unknown>) => {
      try { await p; } catch (error) { return (error as Error).message.replace(req.id, '<id>').replace('нет-такой', '<id>'); }
      throw new Error('ожидался отказ');
    };
    expect(await message(railway.submitGU12(req.id, OTHER)))
      .toBe(await message(railway.submitGU12('нет-такой', OTHER)));
  });

  it('контроллер передаёт в сервис организацию из сессии', async () => {
    jest.useFakeTimers();
    const railway = new RailwayService();
    const controller = new RailwayController(railway);
    const req = railway.createGU12(gu12(OWNER, [freeWagonOf(railway, OWNER).id]));
    await expect(controller.submitGU12(req.id, { orgId: OTHER })).rejects.toThrow(NotFoundException);
    await expect(controller.submitGU12(req.id, { orgId: OWNER })).resolves.toMatchObject({ status: 'SUBMITTED' });
    jest.runOnlyPendingTimers();
  });
});
