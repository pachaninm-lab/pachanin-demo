'use client';

import * as React from 'react';
import { Button, EmptyState, StatusChip, Surface } from '@pc/design-system-v8';

type PendingOrganization = Readonly<{
  id: string;
  name: string;
  inn: string;
  type: string;
  status: string;
  createdAt: string;
}>;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: PendingOrganization[] };

const ORG_TYPE_LABELS: Record<string, string> = {
  LEGAL: 'юридическое лицо',
  INDIVIDUAL: 'ИП',
  SELF_EMPLOYED: 'самозанятый',
};

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

const cellStyle: React.CSSProperties = {
  padding: 'var(--ds-space-3) var(--ds-space-4)',
  borderTop: '1px solid var(--ds-color-border)',
  verticalAlign: 'middle',
};
const headStyle: React.CSSProperties = {
  ...cellStyle,
  borderTop: 'none',
  color: 'var(--ds-color-text-muted)',
  fontSize: 'var(--ds-font-caption)',
  fontWeight: 600,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

/**
 * Консоль допуска организаций (CANONICAL_SCENARIO.md §3, PHASE1_BACKLOG №2).
 * Очередь PENDING и решение оператора — строго через живой API; каждое решение
 * требует письменного основания и journalируется сервером в audit_events.
 */
export function OrganizationVerificationPanel() {
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' });
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [notice, setNotice] = React.useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

  const load = React.useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch('/api/proxy/api/organizations?status=PENDING', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload)) {
        setState({ kind: 'error', message: `Сервер не подтвердил очередь организаций (HTTP ${response.status}).` });
        return;
      }
      // Защита от рассинхрона фильтра: в очереди — только PENDING.
      setState({ kind: 'ready', items: payload.filter((org: PendingOrganization) => org.status === 'PENDING') });
    } catch {
      setState({ kind: 'error', message: 'Сервер недоступен — очередь не обновилась.' });
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function decide(orgId: string, status: 'VERIFIED' | 'REJECTED') {
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/proxy/api/organizations/${encodeURIComponent(orgId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({ tone: 'warn', text: String(payload?.message ?? `Сервер отклонил решение (HTTP ${response.status}).`) });
        return;
      }
      setNotice({
        tone: 'ok',
        text: status === 'VERIFIED'
          ? 'Организация допущена. Решение и основание записаны в журнал.'
          : 'Организации отказано. Решение и основание записаны в журнал.',
      });
      setOpenId(null);
      setReason('');
      await load();
    } catch {
      setNotice({ tone: 'warn', text: 'Сервер недоступен — решение не выполнено, ничего не изменилось.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Surface aria-labelledby='org-verification-title' data-testid='organization-verification-panel'>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--ds-space-3)', flexWrap: 'wrap' }}>
        <h2 id='org-verification-title' style={{ margin: 0, fontSize: 'var(--ds-font-body)' }}>Организации на проверке</h2>
        <span style={{ color: 'var(--ds-color-text-muted)', fontSize: 'var(--ds-font-caption)' }}>
          Решение требует основания и записывается в журнал. До допуска организация не может войти на платформу.
        </span>
      </header>

      {notice ? (
        <p role='status' style={{
          margin: 'var(--ds-space-3) 0 0',
          color: notice.tone === 'ok' ? 'var(--ds-color-success)' : 'var(--ds-color-warning)',
          fontSize: 'var(--ds-font-caption)',
          fontWeight: 600,
        }}>{notice.text}</p>
      ) : null}

      {state.kind === 'loading' ? (
        <p role='status' style={{ color: 'var(--ds-color-text-muted)', margin: 'var(--ds-space-4) 0 0' }}>Загружаем очередь…</p>
      ) : null}

      {state.kind === 'error' ? (
        <div role='status' style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-3)', marginTop: 'var(--ds-space-4)' }}>
          <span style={{ color: 'var(--ds-color-warning)' }}>{state.message}</span>
          <Button variant='secondary' onClick={() => void load()}>Повторить</Button>
        </div>
      ) : null}

      {state.kind === 'ready' && state.items.length === 0 ? (
        <EmptyState
          title='Очередь пуста'
          description='Новые организации появятся здесь сразу после регистрации — с ИНН и данными для проверки.'
        />
      ) : null}

      {state.kind === 'ready' && state.items.length > 0 ? (
        <div style={{ overflowX: 'auto', marginTop: 'var(--ds-space-3)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--ds-font-body)' }}>
            <thead>
              <tr>
                <th style={headStyle}>Организация</th>
                <th style={headStyle}>ИНН</th>
                <th style={headStyle}>Форма</th>
                <th style={headStyle}>Заявка</th>
                <th style={headStyle}>Статус</th>
                <th style={headStyle} aria-label='Действие'></th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((org) => (
                <React.Fragment key={org.id}>
                  <tr>
                    <td style={cellStyle}><strong>{org.name}</strong></td>
                    <td style={{ ...cellStyle, fontVariantNumeric: 'tabular-nums' }}>{org.inn}</td>
                    <td style={cellStyle}>{ORG_TYPE_LABELS[org.type] ?? org.type}</td>
                    <td style={cellStyle}>{dateFmt.format(new Date(org.createdAt))}</td>
                    <td style={cellStyle}><StatusChip tone='warning'>ждёт решения</StatusChip></td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      <Button
                        variant='secondary'
                        onClick={() => { setOpenId(openId === org.id ? null : org.id); setReason(''); setNotice(null); }}
                      >
                        {openId === org.id ? 'Свернуть' : 'Рассмотреть'}
                      </Button>
                    </td>
                  </tr>
                  {openId === org.id ? (
                    <tr>
                      <td colSpan={6} style={{ ...cellStyle, background: 'var(--ds-color-surface-subtle)' }}>
                        <label style={{ display: 'block', fontSize: 'var(--ds-font-caption)', color: 'var(--ds-color-text-secondary)', marginBottom: 'var(--ds-space-2)' }}>
                          Основание решения (обязательно, попадает в журнал)
                          <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={2}
                            placeholder='Например: выписка ЕГРЮЛ проверена, реквизиты подтверждены банком.'
                            style={{
                              display: 'block',
                              width: '100%',
                              marginTop: 'var(--ds-space-2)',
                              padding: 'var(--ds-space-3)',
                              font: 'inherit',
                              color: 'var(--ds-color-text-primary)',
                              background: 'var(--ds-color-surface)',
                              border: '1px solid var(--ds-color-border)',
                              borderRadius: 'var(--ds-radius-md)',
                            }}
                          />
                        </label>
                        <div style={{ display: 'flex', gap: 'var(--ds-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                          <Button disabled={submitting || reason.trim().length < 10} onClick={() => void decide(org.id, 'VERIFIED')}>
                            Допустить организацию
                          </Button>
                          <Button variant='secondary' disabled={submitting || reason.trim().length < 10} onClick={() => void decide(org.id, 'REJECTED')}>
                            Отказать
                          </Button>
                          <span style={{ color: 'var(--ds-color-text-muted)', fontSize: 'var(--ds-font-caption)' }}>
                            Кнопки станут доступны после основания (от 10 символов).
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Surface>
  );
}
