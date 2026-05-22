'use client';

import * as React from 'react';
import { CauseLine, CauseLineList } from './CauseLine';
import { MoneyLockHalo } from './MoneyLockHalo';
import { UnlockPath } from './UnlockPath';
import { DealMiniMap } from './DealMiniMap';
import { FocusDetailMode } from './FocusDetailMode';
import { MagneticActionDock } from './MagneticActionDock';
import { ActionPreview } from './ActionPreview';
import { AfterActionReceipt } from './AfterActionReceipt';
import { SmartSectionSummary } from './SmartSectionSummary';
import { ProofRibbon } from './ProofRibbon';
import { TrustDot } from './TrustDot';
import { QuietIntelligenceHint } from './QuietIntelligenceHint';
import { ExecutionHeader } from './ExecutionHeader';
import { MobileExecutionHeader } from './MobileExecutionHeader';
import type { FocusMode } from './FocusDetailMode';
import type { DealMiniMapSectionId } from './DealMiniMap';
import type { MagneticAction } from './MagneticActionDock';
import type { UnlockStep } from './UnlockPath';
import type { CauseLineProps } from './CauseLine';
import type { ProofRibbonItems } from './ProofRibbon';
import type { ExecutionZoneItem, ExecutionHeaderBlocker } from './ExecutionHeader';

/**
 * DealWorkspaceVisualLayer — клиентский компонент Visual Intelligence Layer.
 *
 * Первый viewport: только ExecutionHeader + QuietIntelligenceHint (если есть блокер).
 * CauseLines / UnlockPath / MoneyLockHalo — только в режиме «Детали» или по раскрытию.
 * Presentational: данные через props, не fetch-ит сам.
 */

export interface DealWorkspaceVLProps {
  readonly dealId: string;
  readonly dealStatus: 'moving' | 'waiting' | 'blocked';
  readonly totalMoney: string;
  readonly lockState: 'blocked-docs' | 'blocked-dispute' | 'hold' | 'manual-review' | 'ready' | 'released';
  readonly lockReason?: string;
  readonly primaryBlocker?: string;
  readonly primaryBlockerMoney?: string;
  readonly causeLines?: CauseLineProps[];
  readonly unlockSteps?: UnlockStep[];
  readonly proofItems?: ProofRibbonItems;
  readonly primaryAction?: MagneticAction | null;
  readonly hintProblem?: string;
  readonly hintAction?: string;
  readonly hintOutcome?: string;
  readonly docSummary?: string;
  readonly tripSummary?: string;
  readonly qualitySummary?: string;
  readonly disputeSummary?: string;
  readonly execZones?: {
    money?: ExecutionZoneItem;
    documents?: ExecutionZoneItem;
    trip?: ExecutionZoneItem;
    quality?: ExecutionZoneItem;
    dispute?: ExecutionZoneItem;
    blocker?: ExecutionHeaderBlocker | null;
  };
}

export function DealWorkspaceVisualLayer({
  dealId,
  dealStatus,
  totalMoney,
  lockState,
  lockReason,
  causeLines = [],
  unlockSteps = [],
  proofItems,
  primaryAction,
  hintProblem,
  hintAction,
  hintOutcome,
  docSummary,
  tripSummary,
  qualitySummary,
  disputeSummary,
  execZones,
}: DealWorkspaceVLProps) {
  const [focusMode, setFocusMode] = React.useState<FocusMode>('focus');
  const [activeSection, setActiveSection] = React.useState<DealMiniMapSectionId>('pulse');
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [receiptVisible, setReceiptVisible] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [causesOpen, setCausesOpen] = React.useState(false);

  const isBlocked = dealStatus === 'blocked' || lockState === 'blocked-docs' || lockState === 'blocked-dispute' || lockState === 'hold';
  const primaryCause = causeLines[0];
  const moneyPressure =
    lockState === 'hold' || lockState === 'blocked-dispute'
      ? { label: 'Давление: высокое', tone: '#B91C1C', bg: 'var(--p7-color-danger-soft, #FEF3F2)' }
      : lockState === 'blocked-docs' || lockState === 'manual-review'
        ? { label: 'Давление: среднее', tone: '#B54708', bg: 'var(--p7-color-warning-soft, #FFFAEB)' }
        : { label: 'Давление: низкое', tone: '#027A48', bg: 'var(--p7-color-success-soft, #ECFDF3)' };

  function handlePrimaryAction() {
    if (!primaryAction) return;
    setPreviewOpen(true);
  }

  function handleConfirmAction() {
    setPreviewOpen(false);
    setActionLoading(true);
    setTimeout(() => {
      setActionLoading(false);
      primaryAction?.onClick?.();
      setReceiptVisible(true);
    }, 1000);
  }

  return (
    <>
      {/* ── ABOVE FOLD: ExecutionHeader (compact 5-zone panel) ── */}
      {execZones && (
        <>
          <div className='p7-exec-header-desktop'>
            <ExecutionHeader
              money={execZones.money}
              documents={execZones.documents}
              trip={execZones.trip}
              quality={execZones.quality}
              dispute={execZones.dispute}
              blocker={execZones.blocker}
              trustState='test'
            />
          </div>
          <div className='p7-exec-header-mobile'>
            <MobileExecutionHeader
              money={execZones.money ? { label: 'Деньги', value: execZones.money.value, tone: execZones.money.tone ?? 'neutral', href: execZones.money.href } : undefined}
              documents={execZones.documents ? { label: 'Документы', value: execZones.documents.value, tone: execZones.documents.tone ?? 'neutral', href: execZones.documents.href } : undefined}
              trip={execZones.trip ? { label: 'Рейс', value: execZones.trip.value, tone: execZones.trip.tone ?? 'neutral', href: execZones.trip.href } : undefined}
              dispute={execZones.dispute ? { label: 'Спор', value: execZones.dispute.value, tone: execZones.dispute.tone ?? 'neutral', href: execZones.dispute.href } : undefined}
              blocker={execZones.blocker ? { text: execZones.blocker.text, moneyAmount: execZones.blocker.moneyAmount } : undefined}
            />
          </div>
        </>
      )}

      {/* ── ABOVE FOLD: Quiet hint (one line, only if blocked) ── */}
      {hintProblem && (
        <QuietIntelligenceHint
          problem={hintProblem}
          action={hintAction}
          outcome={hintOutcome}
        />
      )}

      {/* ── ABOVE FOLD: Focus/Detail toggle + TrustDot (compact row) ── */}
      <div
        data-testid='p7-vil-deal-workspace-vl'
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}
      >
        <FocusDetailMode mode={focusMode} onChange={setFocusMode} />
        <TrustDot state='test' size='sm' label='тестовый контур' />
      </div>

      {/* ── ABOVE FOLD: money pressure + cause-to-money line ── */}
      <div
        data-testid='p7-vil-money-pressure'
        style={{
          display: 'grid',
          gap: 8,
          padding: '12px 14px',
          borderRadius: 16,
          border: '1px solid color-mix(in srgb, var(--p7-color-money, #155EEF) 24%, transparent)',
          background: 'linear-gradient(180deg, var(--pc-bg-card, #FFFFFF) 0%, var(--p7-color-money-soft, #EFF4FF) 100%)',
          marginBottom: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
            <span style={{ color: 'var(--p7-color-text-muted, #667085)', fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Деньги под давлением
            </span>
            <strong style={{ color: 'var(--p7-color-money, #155EEF)', fontSize: 22, lineHeight: 1.08, fontWeight: 950 }}>
              {totalMoney} {isBlocked ? 'стоят' : 'готовы к движению'}
            </strong>
          </div>
          <span style={{ borderRadius: 999, padding: '5px 9px', background: moneyPressure.bg, color: moneyPressure.tone, fontSize: 11, fontWeight: 900 }}>
            {moneyPressure.label}
          </span>
        </div>
        <div style={{ color: 'var(--p7-color-text-secondary, #475569)', fontSize: 12, lineHeight: 1.45, fontWeight: 650 }}>
          Причина: {lockReason ?? hintProblem ?? (isBlocked ? 'условия сделки не закрыты' : 'критичных блокеров нет')}
        </div>
        {primaryCause ? (
          <CauseLine {...primaryCause} compact data-testid='p7-vil-primary-cause-to-money' />
        ) : null}
      </div>

      {proofItems ? (
        <div style={{ marginBottom: 4 }}>
          <ProofRibbon items={proofItems} compact data-testid='p7-vil-evidence-ribbon' />
        </div>
      ) : null}

      {/* ── IN-CONTENT: section summaries (focus mode — compact, after deal header) ── */}
      {focusMode === 'focus' && (docSummary || tripSummary || qualitySummary || disputeSummary) && (
        <div style={{ display: 'grid', gap: 6, marginBottom: 4 }}>
          {docSummary && (
            <SmartSectionSummary
              label='Документы'
              items={[{ text: docSummary, tone: docSummary.includes('блокир') ? 'block' : 'neutral' }]}
            />
          )}
          {tripSummary && (
            <SmartSectionSummary
              label='Рейс'
              items={[{ text: tripSummary, tone: 'neutral' }]}
            />
          )}
          {qualitySummary && (
            <SmartSectionSummary
              label='Качество'
              items={[{ text: qualitySummary, tone: qualitySummary.includes('удерж') ? 'warn' : 'neutral' }]}
            />
          )}
          {disputeSummary && (
            <SmartSectionSummary
              label='Спор'
              items={[{ text: disputeSummary, tone: disputeSummary.includes('открыт') ? 'block' : 'ok' }]}
            />
          )}
        </div>
      )}

      {/* ── DETAIL MODE: CauseLines + UnlockPath + MoneyLockHalo (reveal on demand) ── */}
      {focusMode === 'detail' && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 8 }}>
          {isBlocked && causeLines.length > 0 && (
            <div>
              <button
                type='button'
                onClick={() => setCausesOpen((v) => !v)}
                style={{
                  all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  color: '#475569', fontSize: 12, fontWeight: 900, textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: causesOpen ? 8 : 0,
                }}
                aria-expanded={causesOpen}
              >
                <span style={{ transform: causesOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 120ms' }}>▶</span>
                Причины блокировки ({causeLines.length})
              </button>
              {causesOpen && (
                <CauseLineList
                  items={causeLines}
                  compact={typeof window !== 'undefined' && window.innerWidth < 640}
                />
              )}
            </div>
          )}

          {isBlocked && unlockSteps.length > 0 && (
            <UnlockPath title='Чтобы открыть движение денег:' steps={unlockSteps} />
          )}

          <div id='deal-money'>
            <MoneyLockHalo
              amount={totalMoney}
              lockState={lockState}
              reason={lockReason}
              trustState='test'
            />
          </div>

          {proofItems && (
            <div id='deal-evidence'>
              <ProofRibbon items={proofItems} />
            </div>
          )}
        </div>
      )}

      {/* ── STICKY: DealMiniMap ── */}
      <div
        style={{
          position: 'sticky',
          top: 58,
          zIndex: 30,
          background: 'var(--pc-bg, #F7F9F5)',
          paddingTop: 6,
          paddingBottom: 6,
          marginBottom: 12,
          borderBottom: '1px solid var(--pc-border, #D7DEE3)',
        }}
      >
        <DealMiniMap
          activeSection={activeSection}
          onSectionClick={setActiveSection}
          mobile
        />
      </div>

      {/* ── Action Preview ── */}
      <ActionPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={handleConfirmAction}
        title={primaryAction ? `Вы выполняете: ${primaryAction.label}.` : ''}
        changes={[
          { area: 'документы', before: isBlocked ? 'блокируют' : undefined, after: 'уйдут в проверку основания', tone: 'neutral' },
          { area: 'деньги', before: isBlocked ? 'стоят' : undefined, after: 'ожидают подтверждения банка', tone: 'money' },
          { area: 'журнал', after: 'будет создана запись', tone: 'neutral' },
        ]}
        loading={actionLoading}
        mobile={typeof window !== 'undefined' && window.innerWidth < 768}
      />

      {/* ── After Action Receipt ── */}
      <AfterActionReceipt
        visible={receiptVisible}
        onClose={() => setReceiptVisible(false)}
        title={`${primaryAction?.label ?? 'Действие'} выполнено.`}
        notes={['Журнал обновлён.', 'Основание и деньги перешли в следующий статус проверки.']}
        nextAction='Дождаться подтверждения банка или закрыть следующий блокер.'
        journalHref={`/platform-v7/deals/${dealId}/audit`}
        tone='ok'
      />

      {/* ── MagneticActionDock ── */}
      {primaryAction && (
        <MagneticActionDock
          action={{
            ...primaryAction,
            loading: actionLoading,
            onClick: handlePrimaryAction,
            consequence: 'Это действие будет записано в журнал.',
          }}
          position='bottom'
        />
      )}
    </>
  );
}
