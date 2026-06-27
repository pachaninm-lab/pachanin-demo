import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
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
    const netTons = params.grossTons - params.tareTons;
    const moistureDeduction = params.moisturePct ? netTons * (params.moisturePct / 100) * 0.5 : 0;
    const impurityDeduction = params.impuritiesPct ? netTons * (params.impuritiesPct / 100) : 0;
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

    const gross = correction.grossTons ?? act.grossTons;
    const tare = correction.tareTons ?? act.tareTons;
    const net = gross - tare;
    const moisture = correction.moisturePct ?? act.moisturePct ?? 0;
    const impurity = correction.impuritiesPct ?? act.impuritiesPct ?? 0;
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
        entityType: 'weighing_act',
        entityId: act.id,
        outcome: 'OK',
        reason: JSON.stringify({ shipmentId: act.shipmentId, netTons: act.netTons, acceptedTons: act.acceptedTons }),
        hash: '',
      },
    }).catch(() => {});
  }
}
