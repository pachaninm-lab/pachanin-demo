export type TrustProfileStatus = 'verified' | 'needs_review' | 'blocked';

export interface TrustProfile {
  readonly id: string;
  readonly name: string;
  readonly role: 'seller' | 'buyer' | 'carrier' | 'elevator';
  readonly region: string;
  readonly status: TrustProfileStatus;
  readonly documentsOk: boolean;
  readonly disputes: number;
  readonly latePayments: number;
}

export const MARKET_TRUST_PROFILES: readonly TrustProfile[] = [
  { id: 'tp-buyer-1', name: 'Контрагент под проверку', role: 'buyer', region: 'ЦФО', status: 'needs_review', documentsOk: true, disputes: 0, latePayments: 0 },
  { id: 'tp-carrier-1', name: 'Перевозчик под подтверждение', role: 'carrier', region: 'ЮФО', status: 'needs_review', documentsOk: false, disputes: 1, latePayments: 0 },
] as const;

export function trustRiskLabel(profile: TrustProfile): string {
  if (profile.status === 'blocked') return 'стоп';
  if (!profile.documentsOk || profile.disputes > 0 || profile.latePayments > 0) return 'требует проверки';
  return 'допуск возможен';
}
