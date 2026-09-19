import Link from 'next/link';

function amount(value?: number | null) {
  if (!value) return '—';
  return `${Number(value).toLocaleString('ru-RU')} ₽`;
}

function tone(state?: string | null) {
  if (state === 'DONE') return 'highlight-green';
  if (state === 'ACTIVE') return 'highlight-amber';
  if (state === 'BLOCKED') return 'highlight-red';
  return 'mini-chip';
}

export function ExecutionFlowPanel({
  flow,
  title = 'Deal → dispute → payment flow',
  subtitle = 'Один канонический контур: где сейчас спор, что удержано, что можно выпускать и что блокирует финальные деньги.',
  primaryHref
}: {
  flow: any;
  title?: string;
  subtitle?: string;
  primaryHref?: string;
}) {
  if (!flow) return null;

  return (
    <section className="card">
      <div className="section-title">{title}</div>
      <div className="muted small" style={{ marginTop: 8 }}>{subtitle}</div>

      <div className="mobile-stat-grid" style={{ marginTop: 12 }}>
        <div className="soft-box"><div className="muted tiny">Phase</div><div style={{ marginTop: 6, fontWeight: 700 }}>{flow.currentPhase || '—'}</div></div>
        <div className="soft-box"><div className="muted tiny">Спорная сумма</div><div style={{ marginTop: 6, fontWeight: 700 }}>{amount(flow.releasePlan?.disputedAmountRub)}</div></div>
        <div className="soft-box"><div className="muted tiny">Partial candidate</div><div style={{ marginTop: 6, fontWeight: 700 }}>{amount(flow.releasePlan?.partialReleaseCandidateRub)}</div></div>
        <div className="soft-box"><div className="muted tiny">Final candidate</div><div style={{ marginTop: 6, fontWeight: 700 }}>{amount(flow.releasePlan?.finalReleaseCandidateRub)}</div></div>
      </div>

      <div className="soft-box" style={{ marginTop: 12 }}>
        <div className="muted tiny">Следующий шаг</div>
        <div style={{ marginTop: 6, fontWeight: 700 }}>{flow.nextAction || '—'}</div>
        {flow.releasePlan?.payoutInstruction ? <div className="muted tiny" style={{ marginTop: 6 }}>{flow.releasePlan.payoutInstruction}</div> : null}
      </div>

      <div className="stack-sm" style={{ marginTop: 12 }}>
        {(flow.steps || []).map((step: any) => (
          <div key={step.id} className="soft-box">
            <div className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <b>{step.title}</b>
                <div className="muted tiny" style={{ marginTop: 4 }}>{step.detail || '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={tone(step.state)}>{step.state || 'PENDING'}</div>
                <div className="muted tiny" style={{ marginTop: 4 }}>{amount(step.amountRub)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="stack-sm" style={{ marginTop: 12 }}>
        {(flow.blockers || []).length ? (
          <div className="soft-box">
            <div className="muted tiny">Блокеры</div>
            <div style={{ marginTop: 6 }}>{flow.blockers.join(' · ')}</div>
          </div>
        ) : (
          <div className="soft-box"><div className="muted tiny">Блокеры</div><div style={{ marginTop: 6 }}>Критичных blockers в flow не видно.</div></div>
        )}
      </div>

      {primaryHref ? <div style={{ marginTop: 12 }}><Link href={primaryHref} className="button-secondary">Открыть связанный контур</Link></div> : null}
    </section>
  );
}
