import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

export interface WeighingAct {
  id: string;
  shipmentId: string;
  dealId?: string;
  elevatorOrgId: string;
  grossTons: number;
  tareTons: number;
  netTons: number;
  moisturePct?: number;
  impuritiesPct?: number;
  acceptedTons: number;
  discrepancyTons: number;
  discrepancyPct: number;
  actStatus: 'PENDING' | 'ACCEPTED' | 'DISPUTED' | 'CORRECTED';
  note?: string;
  operatorId: string;
  createdAt: string;
  updatedAt: string;
}

const ELEVATOR_ROLES: Role[] = [Role.ELEVATOR, Role.ADMIN, Role.SUPPORT_MANAGER];

/**
 * Тоннаж — это количество зерна, то есть деньги. NaN, Infinity, строка и
 * минус здесь не «странный ввод», а акт приёмки, которому нельзя верить.
 *
 * Замерено до правки: grossTons 'abc' давало netTons NaN и acceptedTons NaN,
 * что в JSON становится null — акт приёмки без тоннажа; grossTons -50
 * давало netTons -70. Сторож стоит в сервисе, а не только в DTO, потому что
 * вызывающий в обход границы не должен уметь записать такой акт.
 */
function weightTons(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new BadRequestException(`Поле "${field}" акта взвешивания должно быть неотрицательным числом.`);
  }
  return value;
}

/** Доля в процентах: вне 0..100 расчёт вычетов теряет смысл. */
function percent(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new BadRequestException(`Поле "${field}" акта взвешивания должно быть числом от 0 до 100.`);
  }
  return value;
}

/** Тара больше брутто — это отрицательный нетто, а не маленький. */
function assertNetIsPositive(gross: number, tare: number): number {
  if (tare > gross) {
    throw new BadRequestException('Тара не может превышать брутто: нетто акта взвешивания стало бы отрицательным.');
  }
  return gross - tare;
}

@Injectable()
export class ElevatorService {
  private readonly acts = new Map<string, WeighingAct>();
  private counter = 0;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  private assertElevatorRole(user: RequestUser): void {
    if (!ELEVATOR_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Доступ к функциям элеватора запрещён');
    }
  }

  createWeighingAct(
    params: {
      shipmentId: string;
      dealId?: string;
      elevatorOrgId: string;
      grossTons: number;
      tareTons: number;
      moisturePct?: number;
      impuritiesPct?: number;
      note?: string;
    },
    user: RequestUser,
  ): WeighingAct {
    this.assertElevatorRole(user);
    const grossTons = weightTons(params.grossTons, 'grossTons');
    const tareTons = weightTons(params.tareTons, 'tareTons');
    const netTons = assertNetIsPositive(grossTons, tareTons);
    const moisturePct = params.moisturePct === undefined || params.moisturePct === null
      ? undefined
      : percent(params.moisturePct, 'moisturePct');
    const impuritiesPct = params.impuritiesPct === undefined || params.impuritiesPct === null
      ? undefined
      : percent(params.impuritiesPct, 'impuritiesPct');
    const moistureDeduction = moisturePct ? netTons * (moisturePct / 100) * 0.5 : 0;
    const impurityDeduction = impuritiesPct ? netTons * (impuritiesPct / 100) : 0;
    const acceptedTons = Math.max(0, netTons - moistureDeduction - impurityDeduction);

    const id = `wa-${String(++this.counter).padStart(5, '0')}-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const act: WeighingAct = {
      id,
      shipmentId: params.shipmentId,
      dealId: params.dealId,
      elevatorOrgId: params.elevatorOrgId,
      grossTons: params.grossTons,
      tareTons: params.tareTons,
      netTons,
      moisturePct: params.moisturePct,
      impuritiesPct: params.impuritiesPct,
      acceptedTons: Math.round(acceptedTons * 1000) / 1000,
      discrepancyTons: Math.round((netTons - acceptedTons) * 1000) / 1000,
      discrepancyPct: netTons > 0 ? Math.round(((netTons - acceptedTons) / netTons) * 10000) / 100 : 0,
      actStatus: 'PENDING',
      note: params.note,
      operatorId: user.id,
      createdAt: now,
      updatedAt: now,
    };
    this.acts.set(id, act);
    this.persistAct(act).catch(() => {});
    return act;
  }

  getAct(id: string, user: RequestUser): WeighingAct {
    this.assertElevatorRole(user);
    const act = this.acts.get(id);
    if (!act) throw new NotFoundException(`Акт взвешивания ${id} не найден`);
    return act;
  }

  listActsByShipment(shipmentId: string, user: RequestUser): WeighingAct[] {
    this.assertElevatorRole(user);
    return Array.from(this.acts.values()).filter((a) => a.shipmentId === shipmentId);
  }

  listActsByDeal(dealId: string, user: RequestUser): WeighingAct[] {
    this.assertElevatorRole(user);
    return Array.from(this.acts.values()).filter((a) => a.dealId === dealId);
  }

  acceptAct(id: string, user: RequestUser): WeighingAct {
    this.assertElevatorRole(user);
    const act = this.acts.get(id);
    if (!act) throw new NotFoundException(`Акт ${id} не найден`);
    act.actStatus = 'ACCEPTED';
    act.updatedAt = new Date().toISOString();
    return act;
  }

  disputeAct(id: string, reason: string, user: RequestUser): WeighingAct {
    this.assertElevatorRole(user);
    const act = this.acts.get(id);
    if (!act) throw new NotFoundException(`Акт ${id} не найден`);
    act.actStatus = 'DISPUTED';
    act.note = reason;
    act.updatedAt = new Date().toISOString();
    return act;
  }

  correctAct(
    id: string,
    correction: { grossTons?: number; tareTons?: number; moisturePct?: number; impuritiesPct?: number; note?: string },
    user: RequestUser,
  ): WeighingAct {
    this.assertElevatorRole(user);
    const act = this.acts.get(id);
    if (!act) throw new NotFoundException(`Акт ${id} не найден`);
    if (act.actStatus === 'ACCEPTED') throw new ForbiddenException('Принятый акт нельзя корректировать');

    const gross = weightTons(correction.grossTons ?? act.grossTons, 'grossTons');
    const tare = weightTons(correction.tareTons ?? act.tareTons, 'tareTons');
    const net = assertNetIsPositive(gross, tare);
    const moisture = percent(correction.moisturePct ?? act.moisturePct ?? 0, 'moisturePct');
    const impurity = percent(correction.impuritiesPct ?? act.impuritiesPct ?? 0, 'impuritiesPct');
    const moistureDeduction = net * (moisture / 100) * 0.5;
    const impurityDeduction = net * (impurity / 100);
    const accepted = Math.max(0, net - moistureDeduction - impurityDeduction);

    act.grossTons = gross;
    act.tareTons = tare;
    act.netTons = net;
    act.moisturePct = moisture || undefined;
    act.impuritiesPct = impurity || undefined;
    act.acceptedTons = Math.round(accepted * 1000) / 1000;
    act.discrepancyTons = Math.round((net - accepted) * 1000) / 1000;
    act.discrepancyPct = net > 0 ? Math.round(((net - accepted) / net) * 10000) / 100 : 0;
    act.actStatus = 'CORRECTED';
    act.note = correction.note ?? act.note;
    act.updatedAt = new Date().toISOString();
    return act;
  }

  getDiscrepancySummary(dealId: string, user: RequestUser): {
    dealId: string;
    totalExpectedTons: number;
    totalAcceptedTons: number;
    totalDiscrepancyTons: number;
    discrepancyPct: number;
    acts: WeighingAct[];
  } {
    const acts = this.listActsByDeal(dealId, user).filter((a) => a.actStatus === 'ACCEPTED' || a.actStatus === 'CORRECTED');
    const totalNet = acts.reduce((s, a) => s + a.netTons, 0);
    const totalAccepted = acts.reduce((s, a) => s + a.acceptedTons, 0);
    const disc = totalNet - totalAccepted;
    return {
      dealId,
      totalExpectedTons: Math.round(totalNet * 1000) / 1000,
      totalAcceptedTons: Math.round(totalAccepted * 1000) / 1000,
      totalDiscrepancyTons: Math.round(disc * 1000) / 1000,
      discrepancyPct: totalNet > 0 ? Math.round((disc / totalNet) * 10000) / 100 : 0,
      acts,
    };
  }

  private async persistAct(act: WeighingAct): Promise<void> {
    if (!this.prisma) return;
    await this.prisma.auditEvent.create({
      data: {
        id: `el-${act.id}`,
        action: 'ELEVATOR_WEIGHING_ACT',
        actorUserId: act.operatorId,
        actorRole: 'ELEVATOR',
        objectType: 'weighing_act',
        objectId: act.id,
        outcome: 'OK',
        reason: JSON.stringify({ shipmentId: act.shipmentId, netTons: act.netTons, acceptedTons: act.acceptedTons }),
        hash: '',
      },
    }).catch(() => {});
  }
}
