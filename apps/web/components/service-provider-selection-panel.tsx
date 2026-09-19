import Link from 'next/link';

type RankedItem = {
  id?: string;
  name?: string;
  score?: number;
  region?: string;
  why?: string[];
  warnings?: string[];
};

type Selection = {
  recommended?: RankedItem | null;
  ranked?: RankedItem[];
};

export function ServiceProviderSelectionPanel({
  title,
  subtitle,
  selection,
  policy,
  primaryHref,
  primaryLabel,
}: {
  title: string;
  subtitle?: string;
  selection: Selection;
  policy?: any;
  primaryHref?: string;
  primaryLabel?: string;
}) {
  const recommended = selection?.recommended || null;
  const ranked = selection?.ranked || [];

  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">{title}</div>
          {subtitle ? <div className="muted small" style={{ marginTop: 6 }}>{subtitle}</div> : null}
        </div>
        {primaryHref ? <Link href={primaryHref} className="mini-chip">{primaryLabel || 'Открыть'}</Link> : null}
      </div>

      {recommended ? (
        <div className="soft-box" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700 }}>{recommended.name || 'recommended'}</div>
          <div className="muted tiny" style={{ marginTop: 4 }}>
            score {recommended.score ?? '—'} · {recommended.region || '—'}
          </div>
          {!!recommended.why?.length && (
            <div className="muted tiny" style={{ marginTop: 8 }}>
              {recommended.why.join(' · ')}
            </div>
          )}
          {!!recommended.warnings?.length && (
            <div className="muted tiny" style={{ marginTop: 6 }}>
              warnings: {recommended.warnings.join(' · ')}
            </div>
          )}
        </div>
      ) : null}

      {!!policy && (
        <div className="section-stack" style={{ marginTop: 12 }}>
          <div className="list-row"><span>Категория</span><b>{policy.category || '—'}</b></div>
          <div className="list-row"><span>Override</span><b>{policy.overridePolicy || policy.override || 'controlled'}</b></div>
          <div className="list-row"><span>Fallback</span><b>{policy.fallbackPolicy || policy.fallback || 'manual review'}</b></div>
        </div>
      )}

      {!!ranked.length && (
        <div className="section-stack" style={{ marginTop: 14 }}>
          {ranked.slice(0, 5).map((item, index) => (
            <div key={item.id || `${item.name}-${index}`} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{index + 1}. {item.name || 'provider'}</div>
                <div className="muted tiny" style={{ marginTop: 4 }}>{item.region || '—'} · score {item.score ?? '—'}</div>
              </div>
              <span className="mini-chip">candidate</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
