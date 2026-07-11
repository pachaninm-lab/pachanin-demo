'use client';

import { useMemo, useState } from 'react';
import type { AppLocale } from '@/i18n/locale';
import styles from './StaffOperationalWorkspaces.module.css';

type Props = {
  locale: AppLocale;
  enabled: boolean;
  onCreated: () => Promise<void> | void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

const ACTIONS = [
  { action: 'deal:operation:retry', resourceType: 'deal' },
  { action: 'user:session:revoke', resourceType: 'user' },
  { action: 'user:mfa:reset', resourceType: 'user' },
  { action: 'user:access-recovery:initiate', resourceType: 'user' },
  { action: 'payment:manual-review', resourceType: 'payment' },
  { action: 'feature-flag:write', resourceType: 'feature-flag' },
] as const;

const COPY = {
  ru: {
    title: 'Запросить критическое действие',
    lead: 'Запрос фиксирует точное действие и неизменяемый payload. Выполнение возможно только после независимых одобрений и повторной проверки сервером.',
    action: 'Действие', resourceId: 'ID ресурса', payload: 'Payload JSON', submit: 'Создать двухконтрольный запрос', pending: 'Запрос создан и ожидает независимых одобрений.', invalid: 'Проверь ID ресурса и корректность JSON.',
  },
  en: {
    title: 'Request a critical action',
    lead: 'The request freezes the exact action and payload. Execution is possible only after independent approvals and a fresh server-side check.',
    action: 'Action', resourceId: 'Resource ID', payload: 'Payload JSON', submit: 'Create dual-control request', pending: 'The request was created and is awaiting independent approvals.', invalid: 'Check the resource ID and JSON payload.',
  },
  zh: {
    title: '申请关键操作',
    lead: '申请会固定具体操作和不可变 payload。只有在独立批准并由服务器重新校验后才能执行。',
    action: '操作', resourceId: '资源 ID', payload: 'Payload JSON', submit: '创建双人控制申请', pending: '申请已创建，正在等待独立批准。', invalid: '请检查资源 ID 和 JSON payload。',
  },
} as const;

function csrfToken() {
  if (typeof document === 'undefined') return '';
  const row = document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='));
  return row ? decodeURIComponent(row.slice(row.indexOf('=') + 1)) : '';
}

export function StaffCriticalActionRequestForm({ locale, enabled, onCreated, onError, onNotice }: Props) {
  const copy = COPY[locale];
  const [action, setAction] = useState<(typeof ACTIONS)[number]['action']>('deal:operation:retry');
  const [resourceId, setResourceId] = useState('');
  const [payloadText, setPayloadText] = useState('{\n  "expectedVersion": 1,\n  "idempotencyKey": ""\n}');
  const [busy, setBusy] = useState(false);
  const resourceType = useMemo(() => ACTIONS.find((item) => item.action === action)?.resourceType || 'resource', [action]);

  async function submit() {
    if (!enabled || resourceId.trim().length < 2) { onError(copy.invalid); return; }
    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(payloadText) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('payload');
      payload = parsed as Record<string, unknown>;
    } catch {
      onError(copy.invalid);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/staff/workspaces/critical-actions', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
        body: JSON.stringify({ action, resourceType, resourceId: resourceId.trim(), payload }),
      });
      const result = await response.json().catch(() => ({})) as { code?: string; message?: string };
      if (!response.ok) throw new Error(result.message || result.code || 'CRITICAL_ACTION_REQUEST_FAILED');
      setResourceId('');
      onNotice(copy.pending);
      await onCreated();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'CRITICAL_ACTION_REQUEST_FAILED');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={styles.panel} aria-labelledby="staff-critical-request-title">
      <h3 id="staff-critical-request-title">{copy.title}</h3>
      <p className={styles.empty}>{copy.lead}</p>
      <div className={styles.form}>
        <label><span>{copy.action}</span><select value={action} onChange={(event) => setAction(event.target.value as (typeof ACTIONS)[number]['action'])}>{ACTIONS.map((item) => <option key={item.action} value={item.action}>{item.action}</option>)}</select></label>
        <label><span>{copy.resourceId} · {resourceType}</span><input value={resourceId} onChange={(event) => setResourceId(event.target.value)} maxLength={256} autoComplete="off" /></label>
        <label><span>{copy.payload}</span><textarea value={payloadText} onChange={(event) => setPayloadText(event.target.value)} rows={8} spellCheck={false} /></label>
        <button type="button" className={styles.primary} onClick={() => void submit()} disabled={!enabled || busy}>{copy.submit}</button>
      </div>
    </article>
  );
}
