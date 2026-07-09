'use client';

import * as React from 'react';
import { P7ActionButton } from './P7ActionButton';
import { executeP7DealWorkspaceRuntimeIntentAction } from '@/app/platform-v7/actions/deal-workspace-runtime-intent-actions';
import type { P7DealWorkspaceRuntimeIntent } from '@/lib/platform-v7/deal-workspace-runtime-intents';
import { p7RuntimeSnapshotStateText, type P7DealWorkspaceRuntimeRefreshSnapshot } from '@/lib/platform-v7/deal-workspace-runtime-snapshot';
import type { P7DealWorkspaceRuntimeStoreReceipt } from '@/lib/platform-v7/deal-workspace-runtime-store';

const okBg = 'rgba(10,122,95,0.08)';
const okBorder = 'rgba(10,122,95,0.18)';
const okText = '#0A7A5F';
const errBg = 'rgba(220,38,38,0.08)';
const errBorder = 'rgba(220,38,38,0.18)';
const errText = '#B91C1C';
const waitBg = 'rgba(180,83,9,0.08)';
const waitBorder = 'rgba(180,83,9,0.18)';
const waitText = '#B45309';
const muted = 'var(--pc-text-secondary, #475569)';
const text = 'var(--pc-text-primary, #0F1419)';

export function P7DealWorkspaceRuntimeActionButton({ dealId, intent }: { readonly dealId: string; readonly intent: P7DealWorkspaceRuntimeIntent }) {
  const [isPending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<boolean | null>(null);
  const [snapshot, setSnapshot] = React.useState<P7DealWorkspaceRuntimeRefreshSnapshot | null>(null);
  const [receipt, setReceipt] = React.useState<P7DealWorkspaceRuntimeStoreReceipt | null>(null);

  const variant = intent.tone === 'danger' ? 'danger' : intent.tone === 'secondary' ? 'secondary' : 'primary';

  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <P7ActionButton
        variant={variant}
        state={isPending ? 'loading' : ok === true ? 'success' : ok === false ? 'error' : 'idle'}
        loadingLabel={intent.loadingLabel}
        successLabel={intent.successLabel}
        errorLabel='Не выполнено'
        disabled={intent.blocked || isPending}
        disabledReason={intent.blockedReason ?? undefined}
        onClick={() => {
          startTransition(async () => {
            const result = await executeP7DealWorkspaceRuntimeIntentAction({ dealId, intentId: intent.id });
            setOk(result.ok);
            setSnapshot(result.refreshSnapshot);
            setReceipt(result.runtimeStoreReceipt);
            setMessage(result.ok ? `${result.message} ${result.refreshSnapshot.auditLabel}.` : result.message);
          });
        }}
      >
        {intent.label}
      </P7ActionButton>
      <div style={{ color: muted, fontSize: 12, lineHeight: 1.4 }}>{intent.safeReason}</div>
      {intent.blocked && intent.blockedReason ? <RuntimeNotice tone='error'>{intent.blockedReason}</RuntimeNotice> : null}
      {message ? <RuntimeNotice tone={ok === true ? 'ok' : 'error'}>{message}</RuntimeNotice> : null}
      {snapshot ? <RuntimeSnapshotCard snapshot={snapshot} receipt={receipt} /> : null}
    </div>
  );
}

function RuntimeSnapshotCard({ snapshot, receipt }: { readonly snapshot: P7DealWorkspaceRuntimeRefreshSnapshot; readonly receipt: P7DealWorkspaceRuntimeStoreReceipt | null }) {
  const tone = snapshot.state === 'updated' ? 'ok' : snapshot.state === 'blocked' || snapshot.state === 'failed' ? 'error' : 'wait';
  return (
    <div style={{ border: `1px solid ${toneBorder(tone)}`, background: toneBg(tone), borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
      <div style={{ color: toneText(tone), fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Runtime refresh · {p7RuntimeSnapshotStateText(snapshot.state)}
      </div>
      <div style={{ color: text, fontSize: 14, fontWeight: 900 }}>{snapshot.title}</div>
      <div style={{ color: muted, fontSize: 12, lineHeight: 1.4 }}>Статус: {snapshot.statusLabel}</div>
      <div style={{ color: muted, fontSize: 12, lineHeight: 1.4 }}>Следующий шаг: {snapshot.nextVisibleStep}</div>
      {receipt ? (
        <div style={{ borderTop: '1px solid rgba(15,20,25,0.08)', paddingTop: 6, display: 'grid', gap: 3 }}>
          <div style={{ color: text, fontSize: 12, fontWeight: 900 }}>Runtime store: {receipt.version}</div>
          <div style={{ color: muted, fontSize: 11, lineHeight: 1.4 }}>Запись: {receipt.recordId}</div>
          <div style={{ color: muted, fontSize: 11, lineHeight: 1.4 }}>История сделки: {receipt.historyCount} · режим: {receipt.maturity}</div>
        </div>
      ) : null}
      <div style={{ color: muted, fontSize: 11, lineHeight: 1.4 }}>Режим snapshot: {snapshot.persistenceMode}. Это процессное runtime-состояние для обновления карточки; не внешняя банковская/ФГИС/ЭДО интеграция и не production-DB.</div>
    </div>
  );
}

function RuntimeNotice({ tone, children }: { readonly tone: 'ok' | 'error' | 'wait'; readonly children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${toneBorder(tone)}`, background: toneBg(tone), color: toneText(tone), borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 800, lineHeight: 1.35 }}>
      <span style={{ color: text }}>{children}</span>
    </div>
  );
}

function toneBg(tone: 'ok' | 'error' | 'wait') {
  if (tone === 'ok') return okBg;
  if (tone === 'wait') return waitBg;
  return errBg;
}

function toneBorder(tone: 'ok' | 'error' | 'wait') {
  if (tone === 'ok') return okBorder;
  if (tone === 'wait') return waitBorder;
  return errBorder;
}

function toneText(tone: 'ok' | 'error' | 'wait') {
  if (tone === 'ok') return okText;
  if (tone === 'wait') return waitText;
  return errText;
}
