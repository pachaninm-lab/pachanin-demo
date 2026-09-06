import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ElevatorService } from './elevator.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateWeighingActDto } from './dto/create-weighing-act.dto';
import { CorrectWeighingActDto } from './dto/correct-weighing-act.dto';
import { UpdateOrganizationStatusDto } from '../organizations/dto/update-organization-status.dto';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * V2.2.1/V2.2.2 на теле акта взвешивания — документа, которым решается,
 * сколько зерна принято, то есть на деньгах.
 *
 * Тело объявлялось буквально `any`. Замерено на живом сервисе ДО правки,
 * брутто 100 / тара 20:
 *
 *   grossTons: 'abc'     → netTons NaN, acceptedTons NaN → в JSON null/null
 *   grossTons: -50       → netTons -70, acceptedTons 0, discrepancyTons -70
 *   grossTons: Infinity  → netTons null, discrepancyPct null
 *   gross 20 / tare 100  → netTons -80
 *   correctAct({grossTons:'мусор'}) на ЧЕСТНОМ акте с нетто 80
 *                        → netTons null — портится верная запись
 *
 * Отказывают и граница, и сервис: вызывающий в обход DTO не должен уметь
 * записать акт приёмки без тоннажа.
 */

const ELEVATOR = { id: 'u1', role: Role.ELEVATOR, orgId: 'o1', tenantId: 't1' } as RequestUser;
const ADMIN = { id: 'u2', role: Role.ADMIN, orgId: 'o1', tenantId: 't1' } as RequestUser;
const VALID = { shipmentId: 's1', elevatorOrgId: 'o1', grossTons: 100, tareTons: 20 };

async function errorsFor<T extends object>(cls: new () => T, payload: unknown): Promise<string[]> {
  const result = await validate(plainToInstance(cls, payload) as object, { whitelist: true });
  return result.flatMap((item) => Object.keys(item.constraints ?? {}));
}

describe('граница: создание акта взвешивания', () => {
  it('пропускает честный акт', async () => {
    expect(await errorsFor(CreateWeighingActDto, VALID)).toEqual([]);
  });

  it('отвергает строку, NaN и бесконечность в тоннаже', async () => {
    expect(await errorsFor(CreateWeighingActDto, { ...VALID, grossTons: '100' })).toContain('isNumber');
    expect(await errorsFor(CreateWeighingActDto, { ...VALID, grossTons: Number.NaN })).toContain('isNumber');
    expect(await errorsFor(CreateWeighingActDto, { ...VALID, grossTons: Number.POSITIVE_INFINITY })).toContain('isNumber');
  });

  it('отвергает отрицательный тоннаж', async () => {
    expect(await errorsFor(CreateWeighingActDto, { ...VALID, grossTons: -50 })).toContain('min');
    expect(await errorsFor(CreateWeighingActDto, { ...VALID, tareTons: -1 })).toContain('min');
  });

  it('отвергает долю вне 0..100', async () => {
    expect(await errorsFor(CreateWeighingActDto, { ...VALID, moisturePct: 1_000_000 })).toContain('max');
    expect(await errorsFor(CreateWeighingActDto, { ...VALID, impuritiesPct: -1 })).toContain('min');
  });

  it('отвергает отсутствующий идентификатор отгрузки', async () => {
    expect(await errorsFor(CreateWeighingActDto, { ...VALID, shipmentId: undefined })).toContain('isString');
  });
});

describe('сервис: акт взвешивания отказывает и в обход границы', () => {
  it('мусор вместо тоннажа — отказ, а не акт с null', () => {
    const service = new ElevatorService();
    expect(() => service.createWeighingAct({ ...VALID, grossTons: 'abc' } as never, ELEVATOR))
      .toThrow(/неотрицательным числом/u);
  });

  it('NaN и Infinity — отказ', () => {
    const service = new ElevatorService();
    expect(() => service.createWeighingAct({ ...VALID, grossTons: Number.NaN } as never, ELEVATOR)).toThrow();
    expect(() => service.createWeighingAct({ ...VALID, grossTons: Number.POSITIVE_INFINITY } as never, ELEVATOR)).toThrow();
  });

  it('отрицательный тоннаж — отказ', () => {
    const service = new ElevatorService();
    expect(() => service.createWeighingAct({ ...VALID, grossTons: -50 } as never, ELEVATOR)).toThrow(/неотрицательным/u);
  });

  it('тара больше брутто — отказ, а не отрицательный нетто', () => {
    const service = new ElevatorService();
    expect(() => service.createWeighingAct({ ...VALID, grossTons: 20, tareTons: 100 }, ELEVATOR))
      .toThrow(/Тара не может превышать брутто/u);
  });

  it('честный акт по-прежнему считается верно', () => {
    const service = new ElevatorService();
    const act = service.createWeighingAct({ ...VALID, moisturePct: 14, impuritiesPct: 2 }, ELEVATOR);
    expect(act.netTons).toBe(80);
    // 80 − 80*0.14*0.5 − 80*0.02 = 80 − 5.6 − 1.6 = 72.8
    expect(act.acceptedTons).toBeCloseTo(72.8, 3);
  });

  it('корректировка не портит уже честный акт', () => {
    const service = new ElevatorService();
    const act = service.createWeighingAct(VALID, ELEVATOR);
    expect(act.netTons).toBe(80);
    expect(() => service.correctAct(act.id, { grossTons: 'мусор' } as never, ELEVATOR)).toThrow();
    // Акт остался прежним, а не превратился в null.
    expect(service.getAct(act.id, ELEVATOR).netTons).toBe(80);
  });

  it('настоящая корректировка проходит', () => {
    const service = new ElevatorService();
    const act = service.createWeighingAct(VALID, ELEVATOR);
    const corrected = service.correctAct(act.id, { grossTons: 120 }, ELEVATOR);
    expect(corrected.netTons).toBe(100);
    expect(corrected.actStatus).toBe('CORRECTED');
  });

  it('граница корректировки отвергает тот же мусор', async () => {
    expect(await errorsFor(CorrectWeighingActDto, { grossTons: 'мусор' })).toContain('isNumber');
    expect(await errorsFor(CorrectWeighingActDto, { moisturePct: 1_000_000 })).toContain('max');
    expect(await errorsFor(CorrectWeighingActDto, { grossTons: 120 })).toEqual([]);
  });
});

describe('статус организации', () => {
  function orgService(captured: Record<string, unknown>[]) {
    const prisma = { organization: { update: async (a: Record<string, unknown>) => { captured.push(a); return {}; } } };
    return new OrganizationsService(prisma as never);
  }

  it('граница отвергает произвольную строку и пустую', async () => {
    expect(await errorsFor(UpdateOrganizationStatusDto, { status: 'ЧТО-УГОДНО' })).toContain('isIn');
    expect(await errorsFor(UpdateOrganizationStatusDto, { status: '' })).toContain('isIn');
    expect(await errorsFor(UpdateOrganizationStatusDto, { status: 42 })).toContain('isIn');
  });

  it('граница пропускает все четыре статуса, которые платформа пишет сама', async () => {
    for (const status of ['PENDING', 'VERIFIED', 'SUSPENDED', 'BLOCKED']) {
      expect(await errorsFor(UpdateOrganizationStatusDto, { status })).toEqual([]);
    }
  });

  it('сервис не записывает произвольный статус в обход границы', async () => {
    const captured: Record<string, unknown>[] = [];
    await expect(orgService(captured).updateStatus('org-1', 'ЧТО-УГОДНО', ADMIN))
      .rejects.toThrow(/Недопустимый статус/u);
    expect(captured).toHaveLength(0);
  });

  it('настоящий статус записывается', async () => {
    const captured: Record<string, unknown>[] = [];
    await orgService(captured).updateStatus('org-1', 'BLOCKED', ADMIN);
    expect((captured[0]?.data as { status?: string }).status).toBe('BLOCKED');
  });

  it('ролевая проверка не тронута', async () => {
    const captured: Record<string, unknown>[] = [];
    await expect(orgService(captured).updateStatus('org-1', 'BLOCKED', { ...ADMIN, role: Role.BUYER } as RequestUser))
      .rejects.toThrow();
  });
});
