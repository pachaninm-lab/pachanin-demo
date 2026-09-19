import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role, RequestUser } from '../types/request-user';

export type ObjectAction =
  | 'read'
  | 'write'
  | 'transition'
  | 'download'
  | 'moderate'
  | 'support'
  | 'internal_note'
  | 'evidence_attach'
  | 'decision';

type EntityKind =
  | 'Lot'
  | 'Deal'
  | 'Shipment'
  | 'Document'
  | 'Dispute'
  | 'SupportTicket'
  | 'ChatRoom'
  | 'EvidenceRecord';

@Injectable()
export class ObjectPolicyService {
  private readonly supportRoles = new Set<Role>([Role.ADMIN, Role.SUPPORT_MANAGER]);
  private readonly moneyRoles = new Set<Role>([Role.ADMIN, Role.ACCOUNTING, Role.SUPPORT_MANAGER]);
  private readonly disputeDecisionRoles = new Set<Role>([Role.ADMIN, Role.SUPPORT_MANAGER, Role.LAB]);
  private readonly operationalRoles = new Set<Role>([
    Role.ADMIN,
    Role.SUPPORT_MANAGER,
    Role.BUYER,
    Role.FARMER,
    Role.LOGISTICIAN,
    Role.ACCOUNTING,
    Role.ELEVATOR,
    Role.LAB,
    Role.DRIVER
  ]);

  assert(user: RequestUser, entity: EntityKind, action: ObjectAction, ownerOrgId?: string | null) {
    if (this.supportRoles.has(user.role)) return true;

    if (ownerOrgId && ownerOrgId !== user.orgId) {
      throw new ForbiddenException('Cross-tenant operation denied');
    }

    if (!this.operationalRoles.has(user.role)) {
      throw new ForbiddenException('Role is not allowed to access this object');
    }

    if (action === 'support' || action === 'internal_note' || action === 'moderate') {
      throw new ForbiddenException('Only platform support roles can perform this action');
    }

    if (action === 'decision' && !this.disputeDecisionRoles.has(user.role)) {
      throw new ForbiddenException('Only control/lab roles can record dispute decisions');
    }

    if (action === 'evidence_attach' && entity === 'Dispute') {
      if (['BUYER', 'FARMER', 'LOGISTICIAN', 'LAB', 'DRIVER', 'ELEVATOR'].includes(user.role)) {
        return true;
      }
      throw new ForbiddenException('Role cannot attach evidence to dispute');
    }

    if (entity === 'Deal' && action === 'write' && ['DRIVER', 'LAB'].includes(user.role)) {
      throw new ForbiddenException('Role cannot mutate commercial terms of the deal');
    }

    if (entity === 'Document' && action === 'download' && user.role === 'DRIVER') {
      return true;
    }

    if (entity === 'SupportTicket' && action === 'write' && user.role === 'DRIVER') {
      return true;
    }

    if (entity === 'Deal' && action === 'transition' && !this.moneyRoles.has(user.role) && user.role !== 'BUYER' && user.role !== 'FARMER' && user.role !== 'LOGISTICIAN') {
      throw new ForbiddenException('Role cannot transition this deal');
    }

    return true;
  }
}
