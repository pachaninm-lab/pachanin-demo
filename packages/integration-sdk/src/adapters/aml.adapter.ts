import { BaseMockAdapter } from '../adapter.interface';

export type AmlRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';

export interface AmlScreeningRequest {
  inn?: string;
  fullName?: string;
  organizationName?: string;
  passportSeries?: string;
  passportNumber?: string;
}

export interface AmlScreeningResult {
  cleared: boolean;
  riskLevel: AmlRiskLevel;
  matchedLists: string[];
  screenedAt: string;
  referenceId: string;
  details?: string;
}

export interface AmlTransactionCheck {
  transactionId: string;
  amountKopecks: number;
  payerInn?: string;
  receiverInn?: string;
}

export interface AmlTransactionResult {
  transactionId: string;
  requiresReport: boolean;
  thresholdExceeded: boolean;
  suspiciousPatterns: string[];
  checkedAt: string;
}

const BLOCKED_INNS = ['0000000000', '9999999999'];
const HIGH_RISK_INNS = ['1234567890', '0987654321'];
const THRESHOLD_KOPECKS = 600_000_00;

export class MockAmlAdapter extends BaseMockAdapter<AmlScreeningRequest, AmlScreeningResult> {
  readonly name = 'AML_ROSFINMONITORING';
  readonly version = '1.0.0';

  async execute(request: AmlScreeningRequest): Promise<AmlScreeningResult> {
    return this.screenEntity(request);
  }

  async screenEntity(req: AmlScreeningRequest): Promise<AmlScreeningResult> {
    const referenceId = `aml-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const matchedLists: string[] = [];
    let riskLevel: AmlRiskLevel = 'LOW';

    if (req.inn) {
      if (BLOCKED_INNS.includes(req.inn)) {
        riskLevel = 'BLOCKED';
        matchedLists.push('Перечень террористов и экстремистов (Росфинмониторинг)');
      } else if (HIGH_RISK_INNS.includes(req.inn)) {
        riskLevel = 'HIGH';
        matchedLists.push('Список юридических лиц повышенного риска');
      }
    }

    if (req.fullName || req.organizationName) {
      const name = (req.fullName || req.organizationName || '').toLowerCase();
      if (name.includes('тест-блок') || name.includes('blocked')) {
        riskLevel = 'BLOCKED';
        matchedLists.push('Санкционный список OFAC (mock)');
      }
    }

    return {
      cleared: riskLevel !== 'BLOCKED' && riskLevel !== 'HIGH',
      riskLevel,
      matchedLists,
      screenedAt: new Date().toISOString(),
      referenceId,
      details: riskLevel === 'LOW' ? 'Совпадений не найдено' : `Уровень риска: ${riskLevel}`,
    };
  }

  async checkTransaction(req: AmlTransactionCheck): Promise<AmlTransactionResult> {
    const suspiciousPatterns: string[] = [];
    const thresholdExceeded = req.amountKopecks >= THRESHOLD_KOPECKS;

    if (thresholdExceeded) {
      suspiciousPatterns.push('Сумма сделки превышает порог обязательного контроля 600 000 ₽ (115-ФЗ ст.6)');
    }

    if (BLOCKED_INNS.includes(req.payerInn ?? '') || BLOCKED_INNS.includes(req.receiverInn ?? '')) {
      suspiciousPatterns.push('Участник сделки находится в списке запрещённых лиц');
    }

    return {
      transactionId: req.transactionId,
      requiresReport: thresholdExceeded || suspiciousPatterns.length > 0,
      thresholdExceeded,
      suspiciousPatterns,
      checkedAt: new Date().toISOString(),
    };
  }
}
