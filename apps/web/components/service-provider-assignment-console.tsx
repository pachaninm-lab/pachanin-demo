'use client';

import { useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api-client';

export function ServiceProviderAssignmentConsole({
  stage,
  category,
  linkedObjectType,
  linkedObjectId,
  linkedDealId,
  context,
  policy,
}: {
  stage: string;
  category: string;
  linkedObjectType: string;
  linkedObjectId: string;
  linkedDealId?: string | null;
  context?: any;
  policy?: any;
}) {
  const [providerId, setProviderId] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string>('');

  const suggested = useMemo(() => policy?.selection?.recommended?.id || policy?.selection?.recommended?.name || '', [policy]);

  async function assign() {
    setSaving(true);
    setResult('');
    try {
      await api.post('/commercial/provider-assignments', {
        stage,
        category,
        providerId: providerId || suggested,
        linkedObjectType,
        linkedObjectId,
        linkedDealId,
        context,
      });
      setResult('Назначение сохранено');
    } catch (e) {
      setResult(e instanceof ApiError ? e.message : 'Не удалось сохранить назначение');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">Assignment console</div>
          <div className="muted tiny" style={{ marginTop: 4 }}>{stage} · {category} · {linkedObjectType}:{linkedObjectId}</div>
        </div>
      </div>
      <div className="mobile-two-grid" style={{ marginTop: 12 }}>
        <label className="field-block">
          <span>Provider id</span>
          <input value={providerId} onChange={(e) => setProviderId(e.target.value)} placeholder={suggested || 'recommended provider'} />
        </label>
        <div className="soft-box">
          <div style={{ fontWeight: 700 }}>Suggested</div>
          <div className="muted tiny" style={{ marginTop: 4 }}>{suggested || '—'}</div>
        </div>
      </div>
      <div className="cta-stack" style={{ marginTop: 12 }}>
        <button onClick={assign} disabled={saving} className="button primary compact">{saving ? 'Сохраняю…' : 'Назначить исполнителя'}</button>
      </div>
      {result ? <div className="muted small" style={{ marginTop: 10 }}>{result}</div> : null}
    </section>
  );
}
