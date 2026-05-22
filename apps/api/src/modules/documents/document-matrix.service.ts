import { Injectable } from '@nestjs/common';

export type DocType =
  | 'contract'
  | 'transport_waybill'        // ТТН / ЭТрН
  | 'quality_certificate'     // сертификат качества
  | 'acceptance_act'          // акт приёмки
  | 'sdiz'                    // СДИЗ
  | 'epd'                     // ЭПД
  | 'lab_protocol'            // лабораторный протокол
  | 'bank_basis'              // банковское основание
  | 'dispute_resolution';     // решение арбитра

export type DocAction =
  | 'deal.sign'
  | 'shipment.start'
  | 'sample.finalize'
  | 'acceptance.confirm'
  | 'money.release.request'
  | 'deal.close'
  | 'dispute.decide';

export interface DocRequirement {
  docType: DocType;
  label: string;
  responsibleRole: string;
  /** Actions that are blocked until this document is present and not rejected */
  blocks: DocAction[];
  source: 'upload' | 'auto_generated' | 'external_api';
  nextActionIfMissing: string;
}

export interface DocGateResult {
  /** Whether all required documents for this action are present */
  canProceed: boolean;
  blocking: BlockingDoc[];
}

export interface BlockingDoc {
  docType: DocType;
  label: string;
  responsibleRole: string;
  nextAction: string;
  reason: 'missing' | 'rejected' | 'expired' | 'manual_review';
}

export const DOCUMENT_REQUIREMENTS: DocRequirement[] = [
  {
    docType: 'contract',
    label: 'Договор купли-продажи',
    responsibleRole: 'FARMER',
    blocks: ['deal.sign', 'money.release.request'],
    source: 'auto_generated',
    nextActionIfMissing: 'Сгенерировать и подписать договор',
  },
  {
    docType: 'sdiz',
    label: 'СДИЗ',
    responsibleRole: 'FARMER',
    blocks: ['shipment.start', 'acceptance.confirm', 'money.release.request'],
    source: 'external_api',
    nextActionIfMissing: 'Запросить СДИЗ в ФГИС Зерно',
  },
  {
    docType: 'transport_waybill',
    label: 'ТТН / ЭТрН',
    responsibleRole: 'LOGISTICIAN',
    blocks: ['acceptance.confirm', 'money.release.request'],
    source: 'upload',
    nextActionIfMissing: 'Загрузить ТТН или оформить ЭТрН',
  },
  {
    docType: 'lab_protocol',
    label: 'Лабораторный протокол',
    responsibleRole: 'LAB',
    blocks: ['acceptance.confirm', 'money.release.request'],
    source: 'auto_generated',
    nextActionIfMissing: 'Финализировать лабораторный протокол',
  },
  {
    docType: 'quality_certificate',
    label: 'Сертификат качества',
    responsibleRole: 'LAB',
    blocks: ['money.release.request'],
    source: 'auto_generated',
    nextActionIfMissing: 'Сформировать сертификат качества после протокола',
  },
  {
    docType: 'acceptance_act',
    label: 'Акт приёмки',
    responsibleRole: 'BUYER',
    blocks: ['money.release.request'],
    source: 'auto_generated',
    nextActionIfMissing: 'Подтвердить приёмку и подписать акт',
  },
  {
    docType: 'bank_basis',
    label: 'Банковское основание для выпуска',
    responsibleRole: 'ACCOUNTING',
    blocks: ['money.release.request'],
    source: 'external_api',
    nextActionIfMissing: 'Получить подтверждение банка',
  },
  {
    docType: 'dispute_resolution',
    label: 'Решение арбитра по спору',
    responsibleRole: 'SUPPORT_MANAGER',
    blocks: ['money.release.request', 'deal.close'],
    source: 'auto_generated',
    nextActionIfMissing: 'Дождаться решения арбитра по спору',
  },
];

const RELEASE_DOCS: Set<DocType> = new Set(
  DOCUMENT_REQUIREMENTS.filter((r) => r.blocks.includes('money.release.request')).map((r) => r.docType),
);

@Injectable()
export class DocumentMatrixService {
  getRequirementsForAction(action: DocAction): DocRequirement[] {
    return DOCUMENT_REQUIREMENTS.filter((r) => r.blocks.includes(action));
  }

  /**
   * Check if all required documents for a given action are present and valid.
   * Returns a DocGateResult with canProceed flag and list of blocking docs.
   */
  checkGate(action: DocAction, presentDocs: PresentDoc[]): DocGateResult {
    const required = this.getRequirementsForAction(action);
    const blocking: BlockingDoc[] = [];

    for (const req of required) {
      const doc = presentDocs.find((d) => d.type === req.docType);
      if (!doc) {
        blocking.push({
          docType: req.docType,
          label: req.label,
          responsibleRole: req.responsibleRole,
          nextAction: req.nextActionIfMissing,
          reason: 'missing',
        });
        continue;
      }
      if (doc.status === 'REJECTED') {
        blocking.push({
          docType: req.docType,
          label: req.label,
          responsibleRole: req.responsibleRole,
          nextAction: `Исправить и повторно загрузить: ${req.label}`,
          reason: 'rejected',
        });
      } else if (doc.status === 'MANUAL_REVIEW') {
        blocking.push({
          docType: req.docType,
          label: req.label,
          responsibleRole: req.responsibleRole,
          nextAction: `Документ на ручной проверке: ${req.label}`,
          reason: 'manual_review',
        });
      }
    }

    return { canProceed: blocking.length === 0, blocking };
  }

  /**
   * Full release readiness check — returns all blocking docs for money.release.request.
   */
  releaseReadiness(presentDocs: PresentDoc[]): DocGateResult {
    return this.checkGate('money.release.request', presentDocs);
  }

  /**
   * Convert raw doc list from RuntimeCoreService to PresentDoc format.
   */
  toPresentDocs(rawDocs: any[]): PresentDoc[] {
    return rawDocs.map((d) => ({
      type: d.type as DocType,
      status: d.status as DocStatus,
      id: d.id,
      bankAcceptance: d.bankAcceptance,
    }));
  }

  /**
   * Returns a summary of which doc types are required for release but missing/blocked.
   */
  releaseBlockerSummary(rawDocs: any[]): {
    requiredForRelease: DocType[];
    missing: DocType[];
    rejected: DocType[];
    manualReview: DocType[];
    allClear: boolean;
  } {
    const present = this.toPresentDocs(rawDocs);
    const gate = this.releaseReadiness(present);
    return {
      requiredForRelease: [...RELEASE_DOCS],
      missing: gate.blocking.filter((b) => b.reason === 'missing').map((b) => b.docType),
      rejected: gate.blocking.filter((b) => b.reason === 'rejected').map((b) => b.docType),
      manualReview: gate.blocking.filter((b) => b.reason === 'manual_review').map((b) => b.docType),
      allClear: gate.canProceed,
    };
  }
}

export type DocStatus = 'DRAFT' | 'UPLOADED' | 'GENERATED' | 'SIGNED' | 'REJECTED' | 'EXPIRED' | 'MANUAL_REVIEW';

export interface PresentDoc {
  id: string;
  type: DocType;
  status: DocStatus;
  bankAcceptance?: string;
}
