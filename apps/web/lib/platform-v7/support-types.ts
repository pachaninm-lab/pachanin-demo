import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export type SupportCategory = 'money' | 'documents' | 'logistics' | 'acceptance' | 'quality' | 'dispute' | 'access' | 'integration' | 'other';
export type SupportPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type SupportStatus = 'created' | 'accepted' | 'waiting_user' | 'waiting_external' | 'assigned_operator' | 'assigned_bank' | 'assigned_logistics' | 'resolved' | 'closed' | 'escalated';
export type SupportRelatedEntityType = 'deal' | 'lot' | 'trip' | 'document' | 'blocker' | 'dispute' | 'money' | 'integration' | 'other';

export type SupportCase = {
  id: string;
  title: string;
  description: string;
  status: SupportStatus;
  priority: SupportPriority;
  category: SupportCategory;
  requesterRole: PlatformRole;
  relatedEntityType: SupportRelatedEntityType;
  relatedEntityId: string;
  dealId?: string;
  lotId?: string;
  tripId?: string;
  moneyAtRiskRub: number;
  blocker: string;
  owner: string;
  nextAction: string;
  slaDueAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportMessage = { id: string; caseId: string; author: string; body: string; createdAt: string; public: boolean };
export type SupportInternalNote = { id: string; caseId: string; author: string; body: string; createdAt: string };
export type SupportAuditEvent = { id: string; caseId: string; actor: string; action: string; description: string; before?: string; after?: string; createdAt: string };

export const SUPPORT_MATURITY_LABEL = 'controlled-pilot support contour';
