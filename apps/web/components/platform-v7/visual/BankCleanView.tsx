'use client';

import * as React from 'react';
import { FileCheck, AlertTriangle, BookOpen, CheckCircle2, Clock } from 'lucide-react';
import { MoneyLockHalo } from './MoneyLockHalo';
import type { MoneyLockState } from './MoneyLockHalo';
import { TrustDot } from './TrustDot';
import type { TrustDotState } from './TrustDot';
import { UnlockPath } from './UnlockPath';
import type { UnlockStep } from './UnlockPath';
import { CauseLine } from './CauseLine';
import type { CauseLineProps } from './CauseLine';

/**
 * BankCleanView — для банка: только основание, сумма, документы, риски, журнал.
 *
 * Запрещено показывать: лоты, маркетинг, водительские детали без влияния на основание.
 * Запрещено писать: "платформа выпускает деньги", "гарантировано".
 *
 * Банк видит: основание → сумма → документы → риски → ручная проверка → журнал.
 */

export interface BankDocumentItem {
  readonly id: string;
  readonly label: string;
  readonly status: 'ready' | 'missing' | 'pending' | 'disputed';
  readonly impact?: string;
}

export interface BankRiskItem {
  readonly id: string;
  readonly text: string;
  readonly severity: 'high' | 'medium' | 'low';
}

export interface BankCleanViewProps {
  readonly dealId?: string;
  readonly amount: string;
  readonly lockState: MoneyLockState;
  readonly trustState?: TrustDotState;
  readonly basis?: string;
  readonly documents?: BankDocumentItem[];
  readonly risks?: BankRiskItem[];
  readonly unlockSteps?: UnlockStep[];
  readonly causeLines?: CauseLineProps[];
  readonly journalHref?: string;
  readonly manualReviewNote?: string;
  readonly 'data-testid'?: string;
}

const DOC_STATUS_STYLES = {
  ready:    { color: 'var(--p7-color-success, #027A48)',  icon: CheckCircle2,    bg: 'var(--p7-color-success-soft, #ECFDF3)' },
  missing:  { color: 'var(--p7-color-danger, #B42318)',   icon: AlertTriangle,   bg: 'var(--p7-color-danger-soft, #FEF3F2)' },
  pending:  { color: 'var(--p7-color-warning, #B54708)',  icon: Clock,           bg: 'var(--p7-color-warning-soft, #FFFAEB)' },
  disputed: { color: 'var(--p7-color-dispute, #9F1239)',  icon: AlertTriangle,   bg: 'var(--p7-color-dispute-soft, #FFF1F2)' },
};

const RISK_COLORS = {
  high:   { color: 'var(--p7-color-danger, #B42318)',  bg: 'var(--p7-color-danger-soft, #FEF3F2)' },
  medium: { color: 'var(--p7-color-warning, #B54708)', bg: 'var(--p7-color-warning-soft, #FFFAEB)' },
  low:    { color: 'var(--p7-color-text-muted, #667085)', bg: 'var(--p7-color-surface-muted, #F2F6F0)' },
};

const RISK_LABELS = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

export function BankCleanView({
  dealId,
  amount,
  lockState,
  trustState = 'test',
  basis,
  documents = [],
  risks = [],
  unlockSteps = [],
  causeLines = [],
  journalHref,
  manualReviewNote,
  'data-testid': testId,
}: BankCleanViewProps) {
  const readyDocs = documents.filter((d) => d.status === 'ready').length;
  const hasRisks = risks.some((r) => r.severity === 'high' || r.severity === 'medium');

  return (
    <div
      data-testid={testId ?? 'p7-vil-bank-clean-view'}
      style={{ display: 'grid', gap: 16 }}
    >
      {/* Basis */}
      {basis && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            border: '1px solid var(--p7-color-border, #D7DEE3)',
            background: 'var(--p7-color-surface, #FFFFFF)',
            display: 'grid',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--p7-color-text-muted, #667085)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Основание
          </span>
          <span style={{ fontSize: 13, fontWeight: 750, color: 'var(--p7-color-text-primary, #0F1419)', lineHeight: 1.4 }}>
            {basis}
          </span>
          {dealId && (
            <span style={{ fontSize: 11, color: 'var(--p7-color-text-muted, #667085)' }}>
              Сделка {dealId}
            </span>
          )}
        </div>
      )}

      {/* Amount */}
      <MoneyLockHalo
        amount={amount}
        lockState={lockState}
        trustState={trustState}
      />

      {/* Cause lines */}
      {causeLines.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--p7-color-text-muted, #667085)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Причины блокировки
          </span>
          {causeLines.map((props, index) => (
            <CauseLine key={index} {...props} compact />
          ))}
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            border: '1px solid var(--p7-color-border, #D7DEE3)',
            background: 'var(--p7-color-surface, #FFFFFF)',
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <FileCheck size={14} strokeWidth={2} style={{ color: 'var(--p7-color-document, #0369A1)' }} />
              <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--p7-color-text-muted, #667085)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Документы
              </span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 750, color: readyDocs === documents.length ? 'var(--p7-color-success, #027A48)' : 'var(--p7-color-warning, #B54708)' }}>
              {readyDocs}/{documents.length} готовы
            </span>
          </div>

          {documents.map((doc) => {
            const s = DOC_STATUS_STYLES[doc.status];
            const Icon = s.icon;
            return (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 9,
                  background: s.bg,
                }}
              >
                <Icon size={13} strokeWidth={2} style={{ color: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 650, color: 'var(--p7-color-text-primary, #0F1419)', lineHeight: 1.3 }}>
                  {doc.label}
                </span>
                {doc.impact && (
                  <span style={{ fontSize: 11, color: s.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {doc.impact}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--p7-color-text-muted, #667085)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Риски
          </span>
          {risks.map((risk) => {
            const rc = RISK_COLORS[risk.severity];
            return (
              <div
                key={risk.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 10,
                  background: rc.bg,
                }}
              >
                <AlertTriangle size={13} strokeWidth={2} style={{ color: rc.color, flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, display: 'grid', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--p7-color-text-primary, #0F1419)', lineHeight: 1.35 }}>
                    {risk.text}
                  </span>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    padding: '1px 6px',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 800,
                    color: rc.color,
                  }}
                >
                  {RISK_LABELS[risk.severity]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Unlock path */}
      {unlockSteps.length > 0 && (
        <UnlockPath
          title='Для подтверждения банком:'
          steps={unlockSteps}
        />
      )}

      {/* Manual review note */}
      {manualReviewNote && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid color-mix(in srgb, var(--p7-color-money, #155EEF) 28%, transparent)',
            background: 'var(--p7-color-money-soft, #EFF4FF)',
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: 'var(--p7-color-money, #155EEF)', fontWeight: 650, lineHeight: 1.5 }}>
            {manualReviewNote}
          </p>
        </div>
      )}

      {/* Trust note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TrustDot state={trustState} size='sm' label='Внешние подключения требуют договоров, доступов и подтверждения на реальных сделках.' />
      </div>

      {/* Journal link */}
      {journalHref && (
        <a
          href={journalHref}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 750,
            color: 'var(--p7-color-brand, #0A7A5F)',
            textDecoration: 'none',
            padding: '6px 0',
          }}
        >
          <BookOpen size={13} strokeWidth={2} />
          Открыть журнал сделки
        </a>
      )}
    </div>
  );
}
