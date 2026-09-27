import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RailwayService } from './railway.service';

/**
 * V8.2.2 — объектный доступ железнодорожного модуля.
 *
 * Замерено ДО исправления на том же сервисе: логист организации org-attacker
 * переводил вагон org-logistics-001 в MAINTENANCE, ставил его в свою заявку
 * ГУ-12, подавал чужую заявку, считал демередж по чужому (и по
 * несуществующему) вагону, а списки заявок и демереджа отдавали записи всех
 * организаций. Роль проверялась, принадлежность объекта — нет.
 */

const OWNER = { id: 'u-owner', orgId: 'org-logistics-001', role: 'LOGISTICIAN', email: 'owner@example.test' } as const;
const OTHER = { id: 'u-other', orgId: 'org-attacker', role: 'LOGISTICIAN', email: 'other@example.test' } as const;
const ADMIN = { id: 'u-admin', orgId: 'org-platform', role: 'ADMIN', email: 'admin@example.test' } as const;
const NO_ORG = { id: 'u-none', orgId: '', role: 'LOGISTICIAN', email: 'none@example.test' } as const;

function gu12For(railway: RailwayService, requestorOrgId: string, wagonIds: string[]) {
  return {
    dealId: 'deal-1', requestorOrgId, wagonIds,
    departureStation: '000100', destinationStation: '000200', cargo: 'пшеница',
    volumeTons: 60, requestedDepartureAt: '2026-10-01T00:00:00.000Z',
  };
}

function setup() {
  const railway = new RailwayService();
  const wagons = railway.listWagons(OWNER);
  const free = wagons.find((wagon) => wagon.status === 'FREE');
  if (!free) throw new Error('в демонстрационном парке нет свободного вагона');
  return { railway, wagons, free };
}

describe('вагоны: чужая организация не видит и не меняет чужой парк', () => {
  it('статус чужого вагона не меняется, и отказ оставляет вагон нетронутым', () => {
    const { railway, free } = setup();
    expect(() => railway.updateWagonStatus(OTHER, free.id, 'MAINTENANCE')).toThrow(ForbiddenException);
    expect(railway.listWagons(OWNER).find((wagon) => wagon.id === free.id)?.status).toBe('FREE');
  });

  it('владелец и привилегированная роль меняют статус', () => {
    const { railway, free } = setup();
    expect(railway.updateWagonStatus(OWNER, free.id, 'MAINTENANCE').status).toBe('MAINTENANCE');
    expect(railway.updateWagonStatus(ADMIN, free.id, 'FREE').status).toBe('FREE');
  });

  it('несуществующий вагон — 404, а не 403', () => {
    const { railway } = setup();
    expect(() => railway.updateWagonStatus(OWNER, 'нет-такого', 'FREE')).toThrow(NotFoundException);
  });

  it('`?orgId=` чужой организации — отказ, а не чужой список', () => {
    const { railway } = setup();
    expect(() => railway.listWagons(OTHER, OWNER.orgId)).toThrow(ForbiddenException);
    expect(railway.listWagons(OTHER)).toHaveLength(0);
    expect(railway.listWagons(OWNER)).toHaveLength(3);
    expect(railway.listWagons(ADMIN, OWNER.orgId)).toHaveLength(3);
  });

  it('пустая организация вызывающего — отказ, а не доступ ко всему', () => {
    const { railway, free } = setup();
    expect(() => railway.listWagons(NO_ORG)).toThrow(ForbiddenException);
    expect(() => railway.updateWagonStatus(NO_ORG, free.id, 'MAINTENANCE')).toThrow(ForbiddenException);
  });

  it('вагон без организации-владельца не регистрируется', () => {
    const { railway } = setup();
    expect(() => railway.registerWagon({ wagonNumber: '70000001', type: 'HOPPER', capacityTons: 60, ownerOrgId: '' }))
      .toThrow(BadRequestException);
  });
});

describe('ГУ-12: только свои вагоны и свои заявки', () => {
  it('чужой вагон в своей заявке — отказ, и заявка не создаётся', () => {
    const { railway, free } = setup();
    expect(() => railway.createGU12(OTHER, gu12For(railway, OTHER.orgId, [free.id]))).toThrow(ForbiddenException);
    expect(railway.listGU12(ADMIN)).toHaveLength(0);
  });

  it('заявка от имени чужой организации — отказ', () => {
    const { railway, free } = setup();
    expect(() => railway.createGU12(OTHER, gu12For(railway, OWNER.orgId, [free.id]))).toThrow(ForbiddenException);
  });

  it('владелец создаёт заявку на свой вагон', () => {
    const { railway, free } = setup();
    expect(railway.createGU12(OWNER, gu12For(railway, OWNER.orgId, [free.id])).status).toBe('DRAFT');
  });

  it('чужую заявку подать нельзя, и она остаётся черновиком', async () => {
    jest.useFakeTimers();
    try {
      const { railway, free } = setup();
      const request = railway.createGU12(OWNER, gu12For(railway, OWNER.orgId, [free.id]));
      await expect(railway.submitGU12(OTHER, request.id)).rejects.toBeInstanceOf(ForbiddenException);
      expect(railway.listGU12(OWNER)[0]?.status).toBe('DRAFT');
      await expect(railway.submitGU12(OWNER, request.id)).resolves.toMatchObject({ status: 'SUBMITTED' });
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('список заявок — только свои; привилегированная роль видит все', () => {
    const { railway, free } = setup();
    railway.createGU12(OWNER, gu12For(railway, OWNER.orgId, [free.id]));
    expect(railway.listGU12(OWNER)).toHaveLength(1);
    expect(railway.listGU12(OTHER)).toHaveLength(0);
    expect(railway.listGU12(ADMIN)).toHaveLength(1);
    expect(railway.listGU12(NO_ORG)).toHaveLength(0);
  });
});

describe('демередж: деньги считаются только по своему вагону', () => {
  const period = { arrivedAt: '2026-09-01T00:00:00.000Z', unloadingCompletedAt: '2026-09-03T00:00:00.000Z' };

  it('по чужому вагону — отказ, и запись не сохраняется', () => {
    const { railway, free } = setup();
    expect(() => railway.calculateDemurrage(OTHER, { wagonId: free.id, ...period })).toThrow(ForbiddenException);
    expect(railway.listDemurrage(ADMIN)).toHaveLength(0);
  });

  it('по несуществующему вагону — 404, а не сумма', () => {
    const { railway } = setup();
    expect(() => railway.calculateDemurrage(OWNER, { wagonId: 'w-1', ...period })).toThrow(NotFoundException);
  });

  it('список демереджа — только по своим вагонам', () => {
    const { railway, free } = setup();
    railway.calculateDemurrage(OWNER, { wagonId: free.id, ...period });
    expect(railway.listDemurrage(OWNER)).toHaveLength(1);
    expect(railway.listDemurrage(OTHER)).toHaveLength(0);
    expect(railway.listDemurrage(ADMIN)).toHaveLength(1);
  });
});
