'use client';

import * as React from 'react';
import { SUPPORT_AUDIT_EVENTS, SUPPORT_CASES, SUPPORT_INTERNAL_NOTES, SUPPORT_MESSAGES } from './support-data';
import type { SupportAuditEvent, SupportCase, SupportInternalNote, SupportMessage, SupportStatus } from './support-types';

const STORAGE_KEY = 'pc-platform-v7-support-cases';

type SupportSnapshot = {
  cases: SupportCase[];
  messages: SupportMessage[];
  internalNotes: SupportInternalNote[];
  auditEvents: SupportAuditEvent[];
};

function dedupeCases(cases: SupportCase[]): SupportCase[] {
  const map = new Map<string, SupportCase>();
  for (const item of cases) map.set(item.id, item);
  return Array.from(map.values());
}

function initialSnapshot(): SupportSnapshot {
  return {
    cases: SUPPORT_CASES,
    messages: SUPPORT_MESSAGES,
    internalNotes: SUPPORT_INTERNAL_NOTES,
    auditEvents: SUPPORT_AUDIT_EVENTS,
  };
}

function readSnapshot(): SupportSnapshot {
  if (typeof window === 'undefined') return initialSnapshot();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialSnapshot();
  try {
    const parsed = JSON.parse(raw) as Partial<SupportSnapshot>;
    return {
      cases: dedupeCases([...SUPPORT_CASES, ...(parsed.cases ?? [])]),
      messages: [...SUPPORT_MESSAGES, ...(parsed.messages ?? [])],
      internalNotes: [...SUPPORT_INTERNAL_NOTES, ...(parsed.internalNotes ?? [])],
      auditEvents: [...SUPPORT_AUDIT_EVENTS, ...(parsed.auditEvents ?? [])],
    };
  } catch {
    return initialSnapshot();
  }
}

function writeSnapshot(snapshot: SupportSnapshot) {
  if (typeof window === 'undefined') return;
  const customCaseIds = new Set(SUPPORT_CASES.map((item) => item.id));
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      cases: snapshot.cases.filter((item) => !customCaseIds.has(item.id)),
      messages: snapshot.messages.filter((item) => !SUPPORT_MESSAGES.some((base) => base.id === item.id)),
      internalNotes: snapshot.internalNotes.filter((item) => !SUPPORT_INTERNAL_NOTES.some((base) => base.id === item.id)),
      auditEvents: snapshot.auditEvents.filter((item) => !SUPPORT_AUDIT_EVENTS.some((base) => base.id === item.id)),
    }),
  );
}

export function useSupportCases() {
  const [snapshot, setSnapshot] = React.useState<SupportSnapshot>(initialSnapshot);

  React.useEffect(() => {
    setSnapshot(readSnapshot());
  }, []);

  const persist = React.useCallback((next: SupportSnapshot) => {
    setSnapshot(next);
    writeSnapshot(next);
  }, []);

  const createCase = React.useCallback((supportCase: SupportCase, firstMessageBody?: string) => {
    const nextSnapshot = readSnapshot();
    const message: SupportMessage = {
      id: `SM-${supportCase.id}-1`,
      caseId: supportCase.id,
      author: 'Пользователь',
      body: firstMessageBody || supportCase.description,
      createdAt: supportCase.createdAt,
      public: true,
    };
    const audit: SupportAuditEvent = {
      id: `SAE-${supportCase.id}-1`,
      caseId: supportCase.id,
      actor: 'Пользователь',
      action: 'created',
      description: `Создано обращение по объекту ${supportCase.relatedEntityId}.`,
      createdAt: supportCase.createdAt,
    };
    const next = {
      cases: dedupeCases([...nextSnapshot.cases, supportCase]),
      messages: [...nextSnapshot.messages, message],
      internalNotes: nextSnapshot.internalNotes,
      auditEvents: [...nextSnapshot.auditEvents, audit],
    };
    persist(next);
    return supportCase;
  }, [persist]);

  const updateCaseStatus = React.useCallback((caseId: string, status: SupportStatus, actor: string, description: string) => {
    const current = readSnapshot();
    const before = current.cases.find((item) => item.id === caseId)?.status;
    const now = new Date().toISOString();
    const next = {
      ...current,
      cases: current.cases.map((item) => item.id === caseId ? { ...item, status, updatedAt: now } : item),
      auditEvents: [...current.auditEvents, {
        id: `SAE-${caseId}-${Date.now()}`,
        caseId,
        actor,
        action: 'status_changed',
        description,
        before,
        after: status,
        createdAt: now,
      }],
    };
    persist(next);
  }, [persist]);

  return { ...snapshot, createCase, updateCaseStatus };
}
