'use client';

import * as React from 'react';
import { P7ActionButton } from './P7ActionButton';
import { executeP7DealWorkspaceRuntimeIntentAction } from '@/app/platform-v7/actions/deal-workspace-runtime-intent-actions';
import type { P7DealWorkspaceRuntimeIntent } from '@/lib/platform-v7/deal-workspace-runtime-intents';

const okBg = 'rgba(10,122,95,0.08)';
const okBorder = 'rgba(10,122,95,0.18)';
const okText = '#0A7A5F';
const errBg = 'rgba(220,38,38,0.08)';
const errBorder = 'rgba(220,38,38,0.18)';
const errText = '#B91C1C';
const muted = 'var(--pc-text-secondary, #475569)';
const text = 'var(--pc-text-primary, #0F1419)';

export function P7DealWorkspaceRuntimeActionButton({ dealId, intent }: { readonly dealId: string; readonly intent: P7DealWorkspaceRuntimeIntent }) {
  const [isPending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<boolean | null>(null);

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
            setMessage(result.ok ? `${result.message} Audit events: ${result.auditPayloadCount}.` : result.message);
          });
        }}
      >
        {intent.label}
      </P7ActionButton>
      <div style={{ color: muted, fontSize: 12, lineHeight: 1.4 }}>{intent.safeReason}</div>
      {intent.blocked && intent.blockedReason ? <RuntimeNotice ok={false}>{intent.blockedReason}</RuntimeNotice> : null}
      {message ? <RuntimeNotice ok={ok === true}>{message}</RuntimeNotice> : null}
    </div>
  );
}

function RuntimeNotice({ ok, children }: { readonly ok: boolean; readonly children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${ok ? okBorder : errBorder}`, background: ok ? okBg : errBg, color: ok ? okText : errText, borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 800, lineHeight: 1.35 }}>
      <span style={{ color: text }}>{children}</span>
    </div>
  );
}
