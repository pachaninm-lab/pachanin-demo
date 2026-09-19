import { describe, expect, it } from 'vitest';
import { supportAuditTransitionLabel, supportInternalNoteIntegrityLabel, supportSortedAuditEvents, supportSortedInternalNotes } from '@/lib/platform-v7/support-helpers';
import type { SupportAuditEvent, SupportInternalNote } from '@/lib/platform-v7/support-types';

const auditEvents: SupportAuditEvent[] = [
  { id: 'SAE-2', caseId: 'SC-1', actor: 'Оператор', action: 'status_changed', description: 'Второе действие', before: 'created', after: 'accepted', createdAt: '2026-05-05T09:00:00.000Z' },
  { id: 'SAE-1', caseId: 'SC-1', actor: 'Пользователь', action: 'created', description: 'Первое действие', createdAt: '2026-05-05T08:00:00.000Z' },
  { id: 'SAE-3', caseId: 'SC-1', actor: 'Оператор', action: 'escalated', description: 'Третье действие', before: 'accepted', after: 'escalated', createdAt: '2026-05-05T09:00:00.000Z' },
];

const notes: SupportInternalNote[] = [
  { id: 'SIN-2', caseId: 'SC-1', author: 'Банк', body: 'Вторая заметка', createdAt: '2026-05-05T09:00:00.000Z' },
  { id: 'SIN-1', caseId: 'SC-1', author: 'Оператор', body: 'Первая заметка', createdAt: '2026-05-05T08:00:00.000Z' },
];

describe('platform-v7 support detail audit journal', () => {
  it('keeps audit journal chronological and deterministic for equal timestamps', () => {
    expect(supportSortedAuditEvents(auditEvents).map((event) => event.id)).toEqual(['SAE-1', 'SAE-2', 'SAE-3']);
  });

  it('keeps internal notes chronological and visible with integrity label', () => {
    const sorted = supportSortedInternalNotes(notes);

    expect(sorted.map((note) => note.id)).toEqual(['SIN-1', 'SIN-2']);
    expect(supportInternalNoteIntegrityLabel(sorted[0])).toBe('Внутренняя заметка · SIN-1 · 2026-05-05T08:00:00.000Z');
  });

  it('shows before and after transition for status-changing audit events', () => {
    expect(supportAuditTransitionLabel(auditEvents[0])).toBe('created → accepted');
    expect(supportAuditTransitionLabel(auditEvents[1])).toBeNull();
  });
});
