import {
  selectBlockingDealDocuments,
  selectDealExecutionCase,
  type MoneyState,
} from './deal-execution-source-of-truth';

export type PlatformV7CounterpartyAdmissionStatus = 'admitted' | 'manual_review' | 'stopped';
export type PlatformV7ContourEvidenceStatus = 'test_contour' | 'manual_review' | 'awaiting_external_confirmation' | 'requires_contract_and_access' | 'bank_confirmed';

export interface PlatformV7Fz115Identification {
  subject: 'client' | 'client_representative' | 'beneficiary' | 'beneficial_owner';
  name: string;
  identifier: string;
  status: PlatformV7ContourEvidenceStatus;
  checkedAt: string;
  checkedBy: string;
}

export interface PlatformV7ComplianceCounterpartyProfile {
  counterpartyId: string;
  dealId: string;
  role: 'seller' | 'buyer' | 'carrier' | 'elevator' | 'laboratory';
  companyName: string;
  inn: string;
  ogrn: string;
  egrulStatus: string;
  director: string;
  representative: string;
  beneficialOwner: string;
  beneficiary: string;
  authorityStatus: string;
  mchdStatus: string;
  kepStatus: string;
  taxRisk: 'low' | 'medium' | 'high';
  sanctionsRisk: 'low' | 'medium' | 'high';
  bankRisk: 'low' | 'medium' | 'high';
  pdnBasis: string;
  checkedAt: string;
  checkedBy: string;
  admissionStatus: PlatformV7CounterpartyAdmissionStatus;
  stopReason?: string;
}

export interface PlatformV7BankReviewCase {
  dealId: string;
  money: Pick<MoneyState, 'reserveAmount' | 'heldAmount' | 'manualReviewAmount' | 'readyToReleaseAmount' | 'releasedAmount' | 'bankStatus' | 'reconciliationStatus' | 'calculationFormula'>;
  kybStatus: PlatformV7CounterpartyAdmissionStatus;
  fz115Identifications: PlatformV7Fz115Identification[];
  beneficiary: string;
  beneficialOwner: string;
  basisStatus: 'not_ready' | 'basis_formed' | 'awaiting_bank_confirmation' | 'bank_confirmed_manual' | 'bank_confirmed_callback';
  partialReleaseStatus: 'not_allowed' | 'manual_review' | 'basis_ready' | 'bank_confirmed';
  reconciliationSource: PlatformV7ContourEvidenceStatus;
  manualCallbackStatus: PlatformV7ContourEvidenceStatus;
  blockers: string[];
  nextAction: string;
}

export const PLATFORM_V7_COMPLIANCE_PROFILES: readonly PlatformV7ComplianceCounterpartyProfile[] = [
  {
    counterpartyId: 'SELLER-SEVERNOE-POLE',
    dealId: 'DL-9106',
    role: 'seller',
    companyName: 'КФХ «Северное поле»',
    inn: '6829000001',
    ogrn: '326682900000001',
    egrulStatus: 'действует · ручная проверка выписки',
    director: 'Паханин С.П.',
    representative: 'Паханин С.П.',
    beneficialOwner: 'Паханин С.П.',
    beneficiary: 'КФХ «Северное поле»',
    authorityStatus: 'полномочия требуют проверки по МЧД',
    mchdStatus: 'МЧД не подтверждена во внешнем контуре',
    kepStatus: 'КЭП заявлена · требуется ручная проверка сертификата',
    taxRisk: 'medium',
    sanctionsRisk: 'low',
    bankRisk: 'medium',
    pdnBasis: 'договорное основание пилота · уведомление оператора ПДн требует проверки',
    checkedAt: '2026-05-21T09:30:00+03:00',
    checkedBy: 'compliance-operator',
    admissionStatus: 'manual_review',
    stopReason: 'нужна проверка МЧД/КЭП и основания ПДн до резерва или выплаты',
  },
  {
    counterpartyId: 'BUYER-1',
    dealId: 'DL-9106',
    role: 'buyer',
    companyName: 'Покупатель 1',
    inn: '7701000001',
    ogrn: '1027701000001',
    egrulStatus: 'действует · ручная проверка выписки',
    director: 'Директор Покупателя 1',
    representative: 'Закупщик Покупателя 1',
    beneficialOwner: 'Бенефициар Покупателя 1',
    beneficiary: 'Покупатель 1',
    authorityStatus: 'представитель допущен в тестовом контуре',
    mchdStatus: 'МЧД на ручной проверке',
    kepStatus: 'КЭП заявлена · тестовый контур',
    taxRisk: 'low',
    sanctionsRisk: 'low',
    bankRisk: 'medium',
    pdnBasis: 'договорное основание пилота · минимизация ПДн',
    checkedAt: '2026-05-21T09:35:00+03:00',
    checkedBy: 'compliance-operator',
    admissionStatus: 'manual_review',
    stopReason: 'банк ждёт решение по МЧД и 115-ФЗ risk до подтверждения основания',
  },
];

export const PLATFORM_V7_115_IDENTIFICATIONS: readonly PlatformV7Fz115Identification[] = [
  {
    subject: 'client',
    name: 'Покупатель 1',
    identifier: 'ИНН 7701000001',
    status: 'manual_review',
    checkedAt: '2026-05-21T09:40:00+03:00',
    checkedBy: 'bank-compliance',
  },
  {
    subject: 'client_representative',
    name: 'Закупщик Покупателя 1',
    identifier: 'МЧД BUYER-1-MCHD',
    status: 'manual_review',
    checkedAt: '2026-05-21T09:41:00+03:00',
    checkedBy: 'bank-compliance',
  },
  {
    subject: 'beneficiary',
    name: 'КФХ «Северное поле»',
    identifier: 'ИНН 6829000001',
    status: 'manual_review',
    checkedAt: '2026-05-21T09:42:00+03:00',
    checkedBy: 'bank-compliance',
  },
  {
    subject: 'beneficial_owner',
    name: 'Паханин С.П.',
    identifier: 'БВ SELLER-SEVERNOE-POLE',
    status: 'requires_contract_and_access',
    checkedAt: '2026-05-21T09:43:00+03:00',
    checkedBy: 'bank-compliance',
  },
] as const;

export function selectComplianceProfiles(dealId: string): PlatformV7ComplianceCounterpartyProfile[] {
  return PLATFORM_V7_COMPLIANCE_PROFILES.filter((profile) => profile.dealId === dealId);
}

export function canDealPassComplianceForReserve(dealId: string): boolean {
  const profiles = selectComplianceProfiles(dealId);
  return profiles.length > 0 && profiles.every((profile) => profile.admissionStatus === 'admitted');
}

export function selectBankReviewCase(dealId: string): PlatformV7BankReviewCase | undefined {
  const executionCase = selectDealExecutionCase(dealId);
  if (!executionCase) return undefined;

  const complianceProfiles = selectComplianceProfiles(dealId);
  const blockers = [
    ...selectBlockingDealDocuments(dealId).map((document) => `${document.title}: ${document.nextAction}`),
    ...complianceProfiles
      .filter((profile) => profile.admissionStatus !== 'admitted')
      .map((profile) => `${profile.companyName}: ${profile.stopReason ?? 'комплаенс не завершён'}`),
  ];

  return {
    dealId,
    money: {
      reserveAmount: executionCase.money.reserveAmount,
      heldAmount: executionCase.money.heldAmount,
      manualReviewAmount: executionCase.money.manualReviewAmount,
      readyToReleaseAmount: executionCase.money.readyToReleaseAmount,
      releasedAmount: executionCase.money.releasedAmount,
      bankStatus: executionCase.money.bankStatus,
      reconciliationStatus: executionCase.money.reconciliationStatus,
      calculationFormula: executionCase.money.calculationFormula,
    },
    kybStatus: canDealPassComplianceForReserve(dealId) ? 'admitted' : 'manual_review',
    fz115Identifications: [...PLATFORM_V7_115_IDENTIFICATIONS],
    beneficiary: 'КФХ «Северное поле»',
    beneficialOwner: 'Паханин С.П.',
    basisStatus: 'not_ready',
    partialReleaseStatus: 'not_allowed',
    reconciliationSource: 'manual_review',
    manualCallbackStatus: 'awaiting_external_confirmation',
    blockers,
    nextAction: blockers.length > 0
      ? 'закрыть документы, СДИЗ, ЭПД, комплаенс и получить ручное банковое подтверждение основания'
      : 'сформировать основание и ожидать подтверждение банка вручную или callback',
  };
}

export function canBankConfirmBasis(reviewCase: PlatformV7BankReviewCase): boolean {
  return (
    reviewCase.blockers.length === 0 &&
    reviewCase.kybStatus === 'admitted' &&
    reviewCase.basisStatus !== 'not_ready' &&
    reviewCase.manualCallbackStatus === 'bank_confirmed'
  );
}
