import type { PlatformV7OnboardingDocumentsModel } from './onboarding-documents';
import type { PlatformV7OnboardingKycModel, PlatformV7OnboardingRole } from './onboarding-kyc';

export type PlatformV7OnboardingAccessAction =
  | 'create_lot'
  | 'create_purchase_request'
  | 'enter_deal'
  | 'sign_contract'
  | 'receive_money'
  | 'upload_transport_documents'
  | 'submit_lab_result'
  | 'operate_bank_review';
export type PlatformV7OnboardingAccessStatus = 'allowed' | 'blocked' | 'manual_review' | 'restricted';
export type PlatformV7OnboardingAccessTone = 'success' | 'warning' | 'danger';

export interface PlatformV7OnboardingAccessGateInput {
  companyId: string;
  role: PlatformV7OnboardingRole;
  kyc: PlatformV7OnboardingKycModel;
  documents: PlatformV7OnboardingDocumentsModel;
}

export interface PlatformV7OnboardingAccessRow {
  action: PlatformV7OnboardingAccessAction;
  status: PlatformV7OnboardingAccessStatus;
  allowed: boolean;
  reason: string;
  tone: PlatformV7OnboardingAccessTone;
}

export interface PlatformV7OnboardingAccessGateModel {
  companyId: string;
  role: PlatformV7OnboardingRole;
  status: PlatformV7OnboardingAccessStatus;
  allowedActions: PlatformV7OnboardingAccessAction[];
  blockedActions: PlatformV7OnboardingAccessAction[];
  blockerCount: number;
  blockers: string[];
  rows: PlatformV7OnboardingAccessRow[];
  nextAction: string;
  tone: PlatformV7OnboardingAccessTone;
}

export function platformV7OnboardingAccessGateModel(
  input: PlatformV7OnboardingAccessGateInput,
): PlatformV7OnboardingAccessGateModel {
  const actions = platformV7OnboardingRoleActions(input.role);
  const rows = actions.map((action) => platformV7OnboardingAccessRow(input, action));
  const allowedActions = rows.filter((row) => row.allowed).map((row) => row.action);
  const blockedActions = rows.filter((row) => !row.allowed).map((row) => row.action);
  const blockers = platformV7OnboardingAccessBlockers(input, rows);
  const status = platformV7OnboardingAccessStatus(input, blockedActions.length);

  return {
    companyId: input.companyId,
    role: input.role,
    status,
    allowedActions,
    blockedActions,
    blockerCount: blockers.length,
    blockers,
    rows,
    nextAction: platformV7OnboardingAccessNextAction(status, blockers),
    tone: platformV7OnboardingAccessTone(status),
  };
}

export function platformV7OnboardingRoleActions(role: PlatformV7OnboardingRole): PlatformV7OnboardingAccessAction[] {
  if (role === 'seller') return ['create_lot', 'enter_deal', 'sign_contract', 'receive_money'];
  if (role === 'buyer') return ['create_purchase_request', 'enter_deal', 'sign_contract'];
  if (role === 'carrier') return ['enter_deal', 'upload_transport_documents'];
  if (role === 'lab') return ['submit_lab_result'];
  if (role === 'bank_operator') return ['operate_bank_review'];
  return ['enter_deal', 'sign_contract'];
}

export function platformV7OnboardingAccessRow(
  input: PlatformV7OnboardingAccessGateInput,
  action: PlatformV7OnboardingAccessAction,
): PlatformV7OnboardingAccessRow {
  const hardBlocker = platformV7OnboardingAccessHardBlocker(input);
  if (hardBlocker) {
    return {
      action,
      status: hardBlocker.status,
      allowed: false,
      reason: hardBlocker.reason,
      tone: platformV7OnboardingAccessTone(hardBlocker.status),
    };
  }

  const allowedByKyc = platformV7OnboardingActionAllowedByKyc(input.kyc, action);
  const allowedByDocs = input.documents.canSubmitKyc;
  const allowedByRole = platformV7OnboardingRoleActions(input.role).includes(action);
  const allowed = allowedByRole && allowedByKyc && allowedByDocs;
  const status: PlatformV7OnboardingAccessStatus = allowed ? 'allowed' : 'blocked';

  return {
    action,
    status,
    allowed,
    reason: allowed
      ? 'Действие разрешено.'
      : platformV7OnboardingAccessReason(input, action, allowedByRole, allowedByKyc, allowedByDocs),
    tone: platformV7OnboardingAccessTone(status),
  };
}

export function platformV7OnboardingActionAllowedByKyc(
  kyc: PlatformV7OnboardingKycModel,
  action: PlatformV7OnboardingAccessAction,
): boolean {
  if (action === 'create_lot') return kyc.canCreateLot;
  if (action === 'create_purchase_request') return kyc.canCreatePurchaseRequest;
  if (action === 'receive_money') return kyc.canReceiveMoney;
  return kyc.canEnterDeal;
}

export function platformV7OnboardingAccessStatus(
  input: PlatformV7OnboardingAccessGateInput,
  blockedActionCount: number,
): PlatformV7OnboardingAccessStatus {
  if (input.kyc.status === 'restricted' || input.kyc.status === 'rejected') return 'restricted';
  if (input.kyc.status === 'manual_review') return 'manual_review';
  if (blockedActionCount > 0) return 'blocked';
  return 'allowed';
}

export function platformV7OnboardingAccessBlockers(
  input: PlatformV7OnboardingAccessGateInput,
  rows: PlatformV7OnboardingAccessRow[],
): string[] {
  return [
    ...input.kyc.blockers,
    ...input.kyc.reviewReasons.map((reason) => `kyc:${reason}`),
    ...input.documents.blockers.map((blocker) => `document:${blocker}`),
    ...rows.filter((row) => !row.allowed).map((row) => `${row.action}:${row.reason}`),
  ].filter((item, index, arr) => arr.indexOf(item) === index);
}

export function platformV7OnboardingAccessTone(status: PlatformV7OnboardingAccessStatus): PlatformV7OnboardingAccessTone {
  if (status === 'allowed') return 'success';
  if (status === 'manual_review') return 'warning';
  return 'danger';
}

export function platformV7OnboardingAccessNextAction(
  status: PlatformV7OnboardingAccessStatus,
  blockers: string[],
): string {
  if (status === 'allowed') return 'Участник допущен к своим действиям.';
  if (status === 'manual_review') return 'Передать участника оператору комплаенса.';
  if (status === 'restricted') return blockers[0] ?? 'Ограничить действия участника.';
  return blockers[0] ?? 'Закрыть блокеры допуска.';
}

function platformV7OnboardingAccessHardBlocker(
  input: PlatformV7OnboardingAccessGateInput,
): { status: PlatformV7OnboardingAccessStatus; reason: string } | null {
  if (input.kyc.status === 'rejected') return { status: 'restricted', reason: 'Компания отклонена KYC.' };
  if (input.kyc.status === 'restricted') return { status: 'restricted', reason: 'Компания ограничена комплаенсом.' };
  if (input.kyc.status === 'manual_review') return { status: 'manual_review', reason: 'Компания ожидает ручную проверку.' };
  return null;
}

function platformV7OnboardingAccessReason(
  input: PlatformV7OnboardingAccessGateInput,
  action: PlatformV7OnboardingAccessAction,
  allowedByRole: boolean,
  allowedByKyc: boolean,
  allowedByDocs: boolean,
): string {
  if (!allowedByRole) return `Роль ${input.role} не имеет права на действие ${action}.`;
  if (!allowedByKyc) return `KYC не разрешает действие ${action}.`;
  if (!allowedByDocs) return 'Документный пакет не готов.';
  return 'Действие заблокировано.';
}
