import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequestUser, Role } from '../../common/types/request-user';

const SUPPORT_ROLES: Role[] = [Role.SUPPORT_MANAGER, Role.ADMIN];

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ESCALATED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  reporterUserId: string;
  assignedTo?: string;
  dealId?: string;
  organizationId?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  comments: TicketComment[];
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorRole: string;
  text: string;
  isInternal: boolean;
  createdAt: string;
}

@Injectable()
export class SupportService {
  private readonly tickets: SupportTicket[] = [];
  private ticketCounter = 0;
  private commentCounter = 0;

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  private assertSupport(user: RequestUser): void {
    if (!SUPPORT_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Support cockpit requires SUPPORT_MANAGER or ADMIN role');
    }
  }

  createTicket(params: {
    subject: string;
    description: string;
    category: string;
    priority?: TicketPriority;
    dealId?: string;
    organizationId?: string;
  }, user: RequestUser): SupportTicket {
    const ticket: SupportTicket = {
      id: `TKT-${String(++this.ticketCounter).padStart(5, '0')}`,
      subject: params.subject,
      description: params.description,
      status: 'OPEN',
      priority: params.priority ?? 'MEDIUM',
      category: params.category,
      reporterUserId: user.id,
      dealId: params.dealId,
      organizationId: params.organizationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
    };
    this.tickets.push(ticket);
    return ticket;
  }

  listQueue(user: RequestUser, filters?: { status?: string; priority?: string; assignedTo?: string }): SupportTicket[] {
    this.assertSupport(user);
    return this.tickets
      .filter(t => {
        if (filters?.status && t.status !== filters.status) return false;
        if (filters?.priority && t.priority !== filters.priority) return false;
        if (filters?.assignedTo) {
          if (filters.assignedTo === 'me') return t.assignedTo === user.id;
          if (filters.assignedTo === 'unassigned') return !t.assignedTo;
          return t.assignedTo === filters.assignedTo;
        }
        return true;
      })
      .sort((a, b) => {
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      });
  }

  getTicket(id: string, user: RequestUser): SupportTicket {
    const ticket = this.tickets.find(t => t.id === id);
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    // Reporter can view own ticket; support/admin can view all
    if (ticket.reporterUserId !== user.id && !SUPPORT_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException();
    }
    return ticket;
  }

  assignTicket(id: string, assigneeId: string, user: RequestUser): SupportTicket {
    this.assertSupport(user);
    const ticket = this.findOrThrow(id);
    ticket.assignedTo = assigneeId;
    ticket.status = 'IN_PROGRESS';
    ticket.updatedAt = new Date().toISOString();
    this.logAudit('support:ticket:assign', user, id);
    return ticket;
  }

  resolveTicket(id: string, resolution: string, user: RequestUser): SupportTicket {
    this.assertSupport(user);
    const ticket = this.findOrThrow(id);
    ticket.status = 'RESOLVED';
    ticket.resolution = resolution;
    ticket.resolvedAt = new Date().toISOString();
    ticket.updatedAt = new Date().toISOString();
    this.logAudit('support:ticket:resolve', user, id);
    return ticket;
  }

  escalateTicket(id: string, reason: string, user: RequestUser): SupportTicket {
    this.assertSupport(user);
    const ticket = this.findOrThrow(id);
    ticket.status = 'ESCALATED';
    ticket.priority = 'CRITICAL';
    ticket.updatedAt = new Date().toISOString();
    this.addComment(id, `Эскалация: ${reason}`, user, true);
    this.logAudit('support:ticket:escalate', user, id);
    return ticket;
  }

  addComment(ticketId: string, text: string, user: RequestUser, isInternal = false): TicketComment {
    const ticket = this.findOrThrow(ticketId);
    if (!SUPPORT_ROLES.includes(user.role as Role) && ticket.reporterUserId !== user.id) {
      throw new ForbiddenException();
    }
    const comment: TicketComment = {
      id: `CMT-${String(++this.commentCounter).padStart(6, '0')}`,
      ticketId,
      authorId: user.id,
      authorRole: user.role,
      text,
      isInternal: isInternal && SUPPORT_ROLES.includes(user.role as Role),
      createdAt: new Date().toISOString(),
    };
    ticket.comments.push(comment);
    ticket.updatedAt = new Date().toISOString();
    return comment;
  }

  async viewDealReadOnly(dealId: string, user: RequestUser): Promise<object> {
    this.assertSupport(user);
    this.logAudit('support:deal:view', user, dealId);

    if (this.prisma) {
      const deal = await this.prisma.deal.findUnique({
        where: { id: dealId },
        include: { documents: true },
      }).catch(() => null);
      if (deal) return { ...deal, _viewedBy: user.id, _viewedAt: new Date().toISOString() };
    }
    return { dealId, _viewedBy: user.id, _viewedAt: new Date().toISOString(), _note: 'read-only view' };
  }

  resetUserPassword(userId: string, user: RequestUser): { message: string; resetToken: string } {
    this.assertSupport(user);
    const resetToken = `RESET-${Date.now().toString(36).toUpperCase()}`;
    this.logAudit('support:user:password_reset', user, userId);
    return { message: `Токен сброса пароля сгенерирован для пользователя ${userId}`, resetToken };
  }

  getStats(user: RequestUser): {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    escalated: number;
    avgResolutionHours: number;
  } {
    this.assertSupport(user);
    const open = this.tickets.filter(t => t.status === 'OPEN').length;
    const inProgress = this.tickets.filter(t => t.status === 'IN_PROGRESS').length;
    const resolved = this.tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
    const escalated = this.tickets.filter(t => t.status === 'ESCALATED').length;

    const resolvedWithTime = this.tickets.filter(t => t.resolvedAt);
    const avgMs = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((s, t) => s + (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()), 0) / resolvedWithTime.length
      : 0;

    return {
      total: this.tickets.length,
      open,
      inProgress,
      resolved,
      escalated,
      avgResolutionHours: Math.round(avgMs / 3_600_000 * 10) / 10,
    };
  }

  private findOrThrow(id: string): SupportTicket {
    const t = this.tickets.find(t => t.id === id);
    if (!t) throw new NotFoundException(`Ticket ${id} not found`);
    return t;
  }

  private logAudit(action: string, user: RequestUser, objectId: string): void {
    this.audit?.log({
      action,
      actorUserId: user.id,
      actorRole: user.role,
      objectType: 'SupportTicket',
      objectId,
      outcome: 'SUCCESS',
    }).catch(() => {});
  }
}
