import { describe, expect, it } from 'vitest';
import {
  createRoleNotification,
  createSupportTicket,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('support-sla', () => {
  it('links support ticket to deal document trip dispute SLA escalation and money at risk', () => {
    const ticket = createSupportTicket({
      ticketId: 'SUP-DL-9106-SDIZ',
      linkedDealId: 'DL-9106',
      linkedDocumentId: 'DOC-DL-9106-SDIZ-REDEEMED',
      linkedTripId: 'TRIP-SIM-001',
      linkedDisputeId: 'DSP-DL-9106-SDIZ',
      category: 'sdiz_blocker',
      priority: 'critical',
      createdAt: '2026-05-21T10:00:00.000Z',
      slaHours: 4,
      moneyAtRisk: 9_648_000,
      ownerRole: 'buyer',
      nextAction: 'погасить СДИЗ или зафиксировать отказ',
      escalationPath: ['buyer', 'support', 'compliance', 'bank'],
    });

    expect(ticket).toEqual(expect.objectContaining({
      ticketId: 'SUP-DL-9106-SDIZ',
      linkedDealId: 'DL-9106',
      linkedDocumentId: 'DOC-DL-9106-SDIZ-REDEEMED',
      linkedTripId: 'TRIP-SIM-001',
      linkedDisputeId: 'DSP-DL-9106-SDIZ',
      slaDeadline: '2026-05-21T14:00:00.000Z',
      moneyAtRisk: 9_648_000,
      ownerRole: 'buyer',
      status: 'open',
    }));
    expect(ticket.escalationPath).toEqual(['buyer', 'support', 'compliance', 'bank']);
    expect(ticket.auditEvents[0]?.note).toContain('money at risk');
  });

  it('creates next-role notification with action link and unread status', () => {
    const notification = createRoleNotification({
      notificationId: 'NOTIFY-DL-9106-BANK-1',
      targetRole: 'bank',
      targetUserId: 'bank-operator-1',
      linkedDealId: 'DL-9106',
      text: 'Основание готово к ручной проверке банка после решения спора.',
      priority: 'high',
      dueAt: '2026-05-21T16:00:00.000Z',
      actionLink: '/platform-v7/bank?dealId=DL-9106',
      createdByActionId: 'resolveDispute',
      readStatus: 'unread',
    });

    expect(notification.targetRole).toBe('bank');
    expect(notification.linkedDealId).toBe('DL-9106');
    expect(notification.actionLink).toContain('/platform-v7/bank');
    expect(notification.createdByActionId).toBe('resolveDispute');
    expect(notification.readStatus).toBe('unread');
  });
});
