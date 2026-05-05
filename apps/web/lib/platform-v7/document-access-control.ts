import { PlatformRole } from './core-types';
import { BypassRiskProfile } from './bypass-risk-score';

export interface DocumentAccessContext {
  role: PlatformRole;
  hasDealDraft: boolean;
  hasAcceptedOffer: boolean;
  operatorApproved?: boolean;
  bypassRiskProfile?: BypassRiskProfile;
  maturity: 'simulation' | 'manual' | 'controlled-pilot' | 'live';
}

export function canPreviewDocument(context: DocumentAccessContext): boolean {
  if (context.role === 'driver') return false;
  if ((context.bypassRiskProfile?.totalScore ?? 0) >= 80) return false;
  return context.hasAcceptedOffer || context.hasDealDraft || context.operatorApproved === true;
}

export function canDownloadDocument(context: DocumentAccessContext): { allowed: boolean; reason?: string } {
  if (context.role === 'driver' || context.role === 'investor') return { allowed: false, reason: 'role_not_allowed' };
  if (!context.hasDealDraft) return { allowed: false, reason: 'deal_draft_required' };
  if ((context.bypassRiskProfile?.totalScore ?? 0) >= 35 && !context.operatorApproved) return { allowed: false, reason: 'operator_approval_required' };
  return { allowed: true };
}

export function documentAccessLabel(context: DocumentAccessContext): string {
  if (canDownloadDocument(context).allowed) return 'доступно скачивание с водяным знаком';
  if (canPreviewDocument(context)) return 'доступен preview без чувствительных данных';
  return 'закрыто до допустимого этапа сделки';
}
