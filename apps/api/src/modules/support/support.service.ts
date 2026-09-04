import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordResetService } from '../auth/password-reset.service';
import { assertRecentSettlementFinancialMfa } from '../settlement-engine/settlement-financial-mfa.guard';
import { RequestUser, Role } from '../../common/types/request-user';
import type { TicketPriority } from './support.priorities';

const SUPPORT_ROLES: Role[] = [Role.SUPPORT_MANAGER, Role.ADMIN];

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ESCALATED';
export { TICKET_PRIORITIES, type TicketPriority } from './support.priorities';

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
    @Optional() private readonly passwordReset?: PasswordResetService,
  ) {}

  /**
   * Свежий MFA для административного действия над чужой учётной записью.
   *
   * Переиспользуется уже существующий и уже применённый механизм, а не пишется
   * второй: он читает mfaVerified и mfaVerifiedAt из серверной сессии и держит
   * окно свежести, а клиентским заголовкам не верит. Общего в нём только имя -
   * по существу это generic-проверка. Дублировать её значило бы завести вторую
   * расходящуюся реализацию, то есть ровно тот дефект, который эта программа
   * устраняет в других местах.
   *
   * Код ошибки переписывается на контекстный: возвращать вызывающему
   * RECENT_FINANCIAL_MFA_REQUIRED с эндпоинта поддержки было бы сообщением не о
   * том. Логика при этом не копируется - только формулировка отказа.
   */
  private assertRecentMfa(user: RequestUser): void {
    try {
      assertRecentSettlementFinancialMfa(user);
    } catch {
      throw new ForbiddenException({ code: 'RECENT_ADMIN_MFA_REQUIRED' });
    }
  }

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

  /**
   * Административная инициация сброса пароля (ASVS V6.4.6).
   *
   * Требование звучит так: администратор может ЗАПУСТИТЬ процедуру сброса, но
   * это не должно позволять ему сменить или выбрать пароль пользователя -
   * иначе он этот пароль знает.
   *
   * Поэтому здесь нет собственного механизма выдачи токена. Запуск передаётся
   * штатной authority - PasswordResetService, - которая создаёт непрозрачный
   * токен, сохраняет его и отправляет ПОЛЬЗОВАТЕЛЮ через durable outbox.
   * Администратору не возвращается ни пароль, ни токен, ни признак того,
   * существует ли учётная запись. Это строже требования: он не только не
   * выбирает пароль, но и не может воспользоваться ссылкой сам.
   *
   * До этого метод возвращал значение с префиксом RESET, выведённое из
   * системных часов в base36: полностью предсказуемое, к тому же нигде не
   * сохранявшееся и ни с чем не связанное. То есть контроль был одновременно
   * заявлен и не существовал, а его заготовка была небезопасна по построению.
   *
   * Литерал прежнего выражения здесь намеренно не приводится: условие в
   * реестре проверяет его отсутствие в этом файле, а проверка присутствия
   * строки не отличает живой код от цитаты в комментарии.
   */
  async resetUserPassword(userId: string, user: RequestUser): Promise<{ accepted: true; message: string }> {
    this.assertSupport(user);
    this.assertRecentMfa(user);

    // Fail-closed: без базы или без штатной authority инициировать нечего, и
    // притворяться, что сброс запущен, нельзя - именно это делала заглушка.
    if (!this.prisma || !this.passwordReset) {
      this.logAudit('support:user:password_reset:unavailable', user, userId);
      throw new ServiceUnavailableException('Password reset initiation is not available');
    }

    const deliveryKey = String(process.env.PASSWORD_RESET_DELIVERY_KEY ?? '');

    // Поиск по идентификатору, а ответ - одинаковый в любом случае, поэтому
    // отсутствие учётной записи через этот эндпоинт не различимо.
    let email: string | null = null;
    try {
      const target = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      email = target?.email ?? null;
    } catch {
      email = null;
    }

    if (email) {
      // Токен создаёт и отправляет штатная authority; сюда он не возвращается.
      await this.passwordReset.request(email, undefined, deliveryKey, undefined, undefined);
    }

    // В аудит - факт административного запуска, без секрета и без адреса.
    this.logAudit('support:user:password_reset', user, userId);

    return {
      accepted: true,
      message: 'Если учётная запись существует, инструкции по сбросу пароля отправлены её владельцу.',
    };
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
    try {
      this.audit?.log({
        action,
        actorUserId: user.id,
        actorRole: user.role,
        objectType: 'SupportTicket',
        objectId,
        outcome: 'SUCCESS',
      });
    } catch {}
  }
}
