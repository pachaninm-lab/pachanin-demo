'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { StaffCopy } from '@/i18n/staff-messages';

type DealProjection = {
  id: string;
  deal_number: string | null;
  status: string;
  next_action: string | null;
  sla_at: string | null;
  updated_at: string;
};

type CabinetProjection = {
  mode: 'READ_ONLY_VIEW_AS';
  actorUserId: string;
  actorStaffRole: string;
  accessSessionId: string;
  effectiveTenantId: string | null;
  effectiveOrganizationId: string;
  effectiveRole: string;
  expiresAt: string;
  deals: DealProjection[];
};

async function fetchProjection(organizationId: string, role: string) {
  const response = await fetch(`/api/staff/delegated/organizations/${encodeURIComponent(organizationId)}/cabinet/${encodeURIComponent(role)}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload: payload as CabinetProjection & { code?: string } };
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—';
}

export function StaffViewAsClient({ copy }: { copy: StaffCopy }) {
  const router = useRouter();
  const search = useSearchParams();
  const organizationId = search.get('organization') || '';
  const role = search.get('role') || '';
  const [projection, setProjection] = React.useState<CabinetProjection | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready' | 'denied' | 'unavailable'>('loading');
  const [remaining, setRemaining] = React.useState('—');

  const load = React.useCallback(async () => {
    if (!organizationId || !role) {
      setState('denied');
      return;
    }
    setState('loading');
    try {
      const { response, payload } = await fetchProjection(organizationId, role);
      if (response.status === 503) {
        setState('unavailable');
        return;
      }
      if (!response.ok || payload.mode !== 'READ_ONLY_VIEW_AS') {
        setState('denied');
        return;
      }
      setProjection(payload);
      setState('ready');
    } catch {
      setState('unavailable');
    }
  }, [organizationId, role]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!projection) return;
    const update = () => {
      const milliseconds = new Date(projection.expiresAt).getTime() - Date.now();
      if (milliseconds <= 0) {
        setRemaining('00:00');
        setState('denied');
        return;
      }
      const minutes = Math.floor(milliseconds / 60_000);
      const seconds = Math.floor((milliseconds % 60_000) / 1000);
      setRemaining(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [projection]);

  async function exitView() {
    const sessionId = projection?.accessSessionId;
    if (sessionId) {
      await fetch(`/api/staff/delegated/access/sessions/${encodeURIComponent(sessionId)}/end`, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'VIEW_AS closed by staff actor' }),
      }).catch(() => null);
    }
    router.replace('/platform-v7/staff');
  }

  if (state === 'loading') {
    return <section className='pc-staff-state' aria-live='polite' aria-busy='true'><span aria-hidden='true'>◆</span><h1>{copy.loading}</h1><p>{copy.readonly}</p></section>;
  }
  if (state === 'unavailable') {
    return <section className='pc-staff-state'><h1>{copy.unavailableTitle}</h1><p>{copy.unavailableText}</p><button type='button' onClick={() => void load()}>{copy.retry}</button></section>;
  }
  if (state === 'denied' || !projection) {
    return <section className='pc-staff-state'><h1>{copy.deniedTitle}</h1><p>{copy.forbidden}</p><button type='button' onClick={() => router.replace('/platform-v7/staff')}>{copy.close}</button></section>;
  }

  return (
    <main className='pc-staff-view-as'>
      <header className='pc-staff-view-as-banner' role='status' aria-live='polite'>
        <div>
          <span>{copy.readonly}</span>
          <strong>{copy.viewAsTitle}</strong>
          <small>{projection.effectiveOrganizationId} · {projection.effectiveRole}</small>
        </div>
        <dl>
          <div><dt>{copy.actor}</dt><dd>{projection.actorUserId}</dd></div>
          <div><dt>{copy.role}</dt><dd>{projection.actorStaffRole}</dd></div>
          <div><dt>{copy.expires}</dt><dd>{remaining}</dd></div>
        </dl>
        <button type='button' onClick={() => void exitView()}>{copy.close}</button>
      </header>

      <section className='pc-staff-view-as-content' aria-labelledby='view-as-workspace-title'>
        <header>
          <span>{projection.effectiveTenantId || '—'}</span>
          <h1 id='view-as-workspace-title'>{projection.effectiveRole}</h1>
          <p>{copy.viewAsText}</p>
        </header>

        <div className='pc-staff-view-as-guardrails'>
          <strong>{copy.readonly}</strong>
          <span>payment:release</span>
          <span>document:sign</span>
          <span>lab:finalize</span>
          <span>acceptance:sign</span>
          <span>arbitration:decide</span>
        </div>

        <section className='pc-staff-view-as-deals' aria-labelledby='view-as-deals-title'>
          <div className='pc-staff-section-heading'>
            <span>{copy.effectiveContext}</span>
            <h2 id='view-as-deals-title'>{copy.cardOrganizations}</h2>
            <p>{copy.organizationsLead}</p>
          </div>
          {projection.deals.length === 0 ? <p className='pc-staff-empty'>{copy.empty}</p> : (
            <div className='pc-staff-list'>
              {projection.deals.map((deal) => (
                <article className='pc-staff-projected-deal' key={deal.id}>
                  <div>
                    <span>{deal.deal_number || deal.id}</span>
                    <strong>{deal.status}</strong>
                    <small>{deal.next_action || '—'}</small>
                  </div>
                  <dl>
                    <div><dt>{copy.expires}</dt><dd>{formatDate(deal.sla_at)}</dd></div>
                    <div><dt>{copy.time}</dt><dd>{formatDate(deal.updated_at)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
