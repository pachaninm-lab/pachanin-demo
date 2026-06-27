import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';
import { MockFnsAdapter } from '../../../../../packages/integration-sdk/src/adapters/fns.adapter';
import { MockAmlAdapter } from '../../../../../packages/integration-sdk/src/adapters/aml.adapter';

const KYC_ROLES: Role[] = [Role.COMPLIANCE_OFFICER, Role.ADMIN];

export interface KycVerificationResult {
  passed: boolean;
  checks: {
    innVerification: { passed: boolean; data?: object; error?: string };
    sanctionScreening: { passed: boolean; riskLevel: string; matchedLists: string[]; referenceId: string };
    bankDetailsCheck?: { passed: boolean; bankName?: string; error?: string };
  };
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  verifiedAt: string;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private get fnsAdapter() {
    return integrationRegistry.get<MockFnsAdapter>('FNS');
  }

  private get amlAdapter() {
    return integrationRegistry.get<MockAmlAdapter>('AML_ROSFINMONITORING');
  }

  async verifyOrganization(params: {
    inn: string;
    organizationName?: string;
    bik?: string;
    bankAccount?: string;
    requestingUserId?: string;
  }): Promise<KycVerificationResult> {
    const checks: KycVerificationResult['checks'] = {} as any;

    // 1. ФНС: проверка ИНН
    try {
      const orgInfo = await this.fnsAdapter.getOrganizationByInn(params.inn);
      checks.innVerification = {
        passed: orgInfo?.status === 'ACTIVE',
        data: orgInfo ?? undefined,
        error: orgInfo ? undefined : `ИНН ${params.inn} не найден в реестре ФНС`,
      };
    } catch (err) {
      checks.innVerification = { passed: false, error: String(err) };
    }

    // 2. AML: санкционный скрининг (Росфинмониторинг)
    const amlResult = await this.amlAdapter.screenEntity({
      inn: params.inn,
      organizationName: params.organizationName,
    });
    checks.sanctionScreening = {
      passed: amlResult.cleared,
      riskLevel: amlResult.riskLevel,
      matchedLists: amlResult.matchedLists,
      referenceId: amlResult.referenceId,
    };

    // 3. Банковские реквизиты (если переданы)
    if (params.bik && params.bankAccount) {
      try {
        const bankCheck = await this.fnsAdapter.validateBankAccount(params.bik, params.bankAccount);
        checks.bankDetailsCheck = {
          passed: bankCheck.valid,
          bankName: bankCheck.bankName,
        };
      } catch (err) {
        checks.bankDetailsCheck = { passed: false, error: String(err) };
      }
    }

    const blocked = amlResult.riskLevel === 'BLOCKED';
    const highRisk = amlResult.riskLevel === 'HIGH' || !checks.innVerification.passed;
    const overallRisk = blocked ? 'BLOCKED' : highRisk ? 'HIGH' : amlResult.riskLevel as 'LOW' | 'MEDIUM';
    const passed = !blocked && checks.innVerification.passed && amlResult.cleared;

    this.logger.log(`KYC check INN=${params.inn} result=${overallRisk} passed=${passed}`);

    return {
      passed,
      checks,
      overallRisk,
      verifiedAt: new Date().toISOString(),
    };
  }

  async checkTransactionAml(params: {
    transactionId: string;
    amountKopecks: number;
    payerInn?: string;
    receiverInn?: string;
    dealId?: string;
  }): Promise<object> {
    const result = await this.amlAdapter.checkTransaction({
      transactionId: params.transactionId,
      amountKopecks: params.amountKopecks,
      payerInn: params.payerInn,
      receiverInn: params.receiverInn,
    });

    if (result.requiresReport) {
      this.logger.warn(
        `AML report required: tx=${params.transactionId} amount=${params.amountKopecks} kopecks patterns=${result.suspiciousPatterns.join('; ')}`
      );
      await this.prisma.auditEvent.create({
        data: {
          id: `aml-tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action: 'AML_TRANSACTION_FLAGGED',
          actorUserId: 'system',
          actorRole: 'SYSTEM',
          dealId: params.dealId,
          entityType: 'transaction',
          entityId: params.transactionId,
          outcome: 'FLAGGED',
          reason: JSON.stringify({ ...result }),
          hash: '',
        },
      }).catch(() => {});
    }

    return result;
  }

  async initiateKyc(params: {
    organizationId: string;
    inn: string;
    documentType?: string;
    notes?: string;
  }, user: RequestUser): Promise<object> {
    const task = await this.prisma.kycTask.create({
      data: {
        id: `kyc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        organizationId: params.organizationId,
        status: 'PENDING',
        notes: params.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }).catch(() => ({
      id: `kyc-${Date.now()}`,
      organizationId: params.organizationId,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    }));

    await this.audit.log({
      action: 'kyc:initiated',
      actorUserId: user.id,
      actorRole: user.role,
      objectType: 'KycTask',
      objectId: (task as any).id,
      outcome: 'SUCCESS',
    });

    return task;
  }

  async getKycStatus(organizationId: string, user: RequestUser): Promise<object> {
    const tasks = await this.prisma.kycTask.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }).catch(() => []);

    return {
      organizationId,
      tasks,
      latestStatus: tasks[0]?.status ?? 'NOT_STARTED',
    };
  }

  generateRknIncidentNotification(params: {
    incidentType: string;
    description: string;
    affectedSubjectsCount: number;
    detectedAt: string;
    reporterFullName: string;
    reporterPosition: string;
  }): { xml: string; deadlineAt: string } {
    const deadlineAt = new Date(new Date(params.detectedAt).getTime() + 72 * 60 * 60 * 1000).toISOString();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Уведомление xmlns="urn:РКН:инцидент:2023">
  <Оператор>
    <Наименование>ООО ГрейнФлоу</Наименование>
    <ИНН>placeholder</ИНН>
    <КонтактноеЛицо>
      <ФИО>${params.reporterFullName}</ФИО>
      <Должность>${params.reporterPosition}</Должность>
    </КонтактноеЛицо>
  </Оператор>
  <Инцидент>
    <Тип>${params.incidentType}</Тип>
    <Описание>${params.description}</Описание>
    <КоличествоСубъектов>${params.affectedSubjectsCount}</КоличествоСубъектов>
    <ДатаОбнаружения>${params.detectedAt}</ДатаОбнаружения>
    <СрокУведомления>${deadlineAt}</СрокУведомления>
    <Версия>1.0</Версия>
  </Инцидент>
</Уведомление>`;

    return { xml, deadlineAt };
  }
}
