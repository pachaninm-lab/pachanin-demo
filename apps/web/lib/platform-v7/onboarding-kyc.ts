export type PlatformV7OnboardingRole = 'seller' | 'buyer' | 'carrier' | 'elevator' | 'lab' | 'bank_operator';
export type PlatformV7OnboardingCheckStatus = 'missing' | 'pending' | 'verified' | 'failed' | 'manual_review';
export type PlatformV7OnboardingKycStatus = 'not_started' | 'incomplete' | 'manual_review' | 'approved' | 'restricted' | 'rejected';
export type PlatformV7OnboardingKycTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface PlatformV7OnboardingKycInput {
  companyId: string;
  role: PlatformV7OnboardingRole;
  inn: PlatformV7OnboardingCheckStatus;
  ogrn: PlatformV7OnboardingCheckStatus;
  legalAddress: PlatformV7OnboardingCheckStatus;
  signerAuthority: PlatformV7OnboardingCheckStatus;
  bankAccount: PlatformV7OnboardingCheckStatus;
  beneficialOwner: PlatformV7OnboardingCheckStatus;
  taxRisk: PlatformV7OnboardingCheckStatus;
  sanctionsScreening: PlatformV7OnboardingCheckStatus;
  amlScreening: PlatformV7OnboardingCheckStatus;
  roleDocumentsReady: boolean;
  manualRestriction: boolean;
}

export interface PlatformV7OnboardingKycModel {
  companyId: string;
  role: PlatformV7OnboardingRole;
  status: PlatformV7OnboardingKycStatus;
  readinessPercent: number;
  canCreateLot: boolean;
  canCreatePurchaseRequest: boolean;
  canEnterDeal: boolean;
  canReceiveMoney: boolean;
  blockerCount: number;
  blockers: string[];
  reviewReasons: string[];
  nextAction: string;
  tone: PlatformV7OnboardingKycTone;
}

export function platformV7OnboardingKycModel(input: PlatformV7OnboardingKycInput): PlatformV7OnboardingKycModel {
  const blockers = platformV7OnboardingKycBlockers(input);
  const reviewReasons = platformV7OnboardingKycReviewReasons(input);
  const readinessPercent = platformV7OnboardingKycReadinessPercent(input);
  const status = platformV7OnboardingKycStatus(input, blockers, reviewReasons);

  return {
    companyId: input.companyId,
    role: input.role,
    status,
    readinessPercent,
    canCreateLot: status === 'approved' && input.role === 'seller',
    canCreatePurchaseRequest: status === 'approved' && input.role === 'buyer',
    canEnterDeal: status === 'approved',
    canReceiveMoney: status === 'approved' && input.bankAccount === 'verified' && input.signerAuthority === 'verified',
    blockerCount: blockers.length,
    blockers,
    reviewReasons,
    nextAction: platformV7OnboardingKycNextAction(status, blockers, reviewReasons),
    tone: platformV7OnboardingKycTone(status),
  };
}

export function platformV7OnboardingKycBlockers(input: PlatformV7OnboardingKycInput): string[] {
  const blockers: string[] = [];

  if (input.inn === 'missing') blockers.push('Не указан ИНН.');
  if (input.ogrn === 'missing') blockers.push('Не указан ОГРН.');
  if (input.legalAddress === 'missing') blockers.push('Не указан юридический адрес.');
  if (input.signerAuthority === 'missing') blockers.push('Не подтверждены полномочия подписанта.');
  if (input.bankAccount === 'missing') blockers.push('Не указан расчётный счёт.');
  if (!input.roleDocumentsReady) blockers.push('Не загружены документы по роли участника.');
  if (input.manualRestriction) blockers.push('Компания ограничена оператором.');

  return [...new Set(blockers)];
}

export function platformV7OnboardingKycReviewReasons(input: PlatformV7OnboardingKycInput): string[] {
  const reasons: string[] = [];
  const reviewedFields: Array<[PlatformV7OnboardingCheckStatus, string]> = [
    [input.inn, 'inn'],
    [input.ogrn, 'ogrn'],
    [input.legalAddress, 'legal-address'],
    [input.signerAuthority, 'signer-authority'],
    [input.bankAccount, 'bank-account'],
    [input.beneficialOwner, 'beneficial-owner'],
    [input.taxRisk, 'tax-risk'],
    [input.sanctionsScreening, 'sanctions-screening'],
    [input.amlScreening, 'aml-screening'],
  ];

  reviewedFields.forEach(([status, reason]) => {
    if (status === 'manual_review') reasons.push(reason);
    if (status === 'failed') reasons.push(`${reason}-failed`);
    if (status === 'pending') reasons.push(`${reason}-pending`);
  });

  return [...new Set(reasons)];
}

export function platformV7OnboardingKycStatus(
  input: PlatformV7OnboardingKycInput,
  blockers: string[] = platformV7OnboardingKycBlockers(input),
  reviewReasons: string[] = platformV7OnboardingKycReviewReasons(input),
): PlatformV7OnboardingKycStatus {
  if (input.manualRestriction || hasFailedCriticalCheck(input)) return 'rejected';
  if (blockers.length > 0) return blockers.length === requiredMissingCount(input) ? 'not_started' : 'incomplete';
  if (reviewReasons.some((reason) => reason.endsWith('-failed'))) return 'restricted';
  if (reviewReasons.length > 0) return 'manual_review';
  return 'approved';
}

export function platformV7OnboardingKycReadinessPercent(input: PlatformV7OnboardingKycInput): number {
  const checks = [
    input.inn === 'verified',
    input.ogrn === 'verified',
    input.legalAddress === 'verified',
    input.signerAuthority === 'verified',
    input.bankAccount === 'verified',
    input.beneficialOwner === 'verified',
    input.taxRisk === 'verified',
    input.sanctionsScreening === 'verified',
    input.amlScreening === 'verified',
    input.roleDocumentsReady,
    !input.manualRestriction,
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function platformV7OnboardingKycTone(status: PlatformV7OnboardingKycStatus): PlatformV7OnboardingKycTone {
  if (status === 'approved') return 'success';
  if (status === 'manual_review' || status === 'incomplete') return 'warning';
  if (status === 'restricted' || status === 'rejected') return 'danger';
  return 'neutral';
}

export function platformV7OnboardingKycNextAction(
  status: PlatformV7OnboardingKycStatus,
  blockers: string[],
  reviewReasons: string[],
): string {
  if (status === 'approved') return 'Компания допущена к сделкам.';
  if (status === 'rejected') return blockers[0] ?? 'Отклонить компанию до повторной проверки.';
  if (status === 'restricted') return 'Ограничить действия компании до решения комплаенса.';
  if (status === 'manual_review') return `Передать на ручную проверку: ${reviewReasons[0] ?? 'kyc'}.`;
  if (status === 'incomplete') return blockers[0] ?? 'Дозаполнить профиль компании.';
  return 'Начать заполнение профиля компании.';
}

function hasFailedCriticalCheck(input: PlatformV7OnboardingKycInput): boolean {
  return input.sanctionsScreening === 'failed' || input.amlScreening === 'failed';
}

function requiredMissingCount(input: PlatformV7OnboardingKycInput): number {
  const requiredStatuses = [
    input.inn,
    input.ogrn,
    input.legalAddress,
    input.signerAuthority,
    input.bankAccount,
  ];
  const missing = requiredStatuses.filter((status) => status === 'missing').length;
  return missing + (input.roleDocumentsReady ? 0 : 1);
}
