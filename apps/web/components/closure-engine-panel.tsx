type ClosureItem = {
  id: string;
  title: string;
  status?: string;
  detail?: string;
};

export function ClosureEnginePanel({
  title = 'Closure engine',
  subtitle,
  items = [],
}: {
  title?: string;
  subtitle?: string;
  items?: ClosureItem[];
}) {
  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">{title}</div>
          {subtitle ? <div className="muted small" style={{ marginTop: 6 }}>{subtitle}</div> : null}
        </div>
        <span className="mini-chip amber">closure</span>
      </div>
      <div className="section-stack" style={{ marginTop: 14 }}>
        {items.length ? items.map((item) => (
          <div key={item.id} className="list-row">
            <div>
              <div style={{ fontWeight: 700 }}>{item.title}</div>
              {item.detail ? <div className="muted small" style={{ marginTop: 4 }}>{item.detail}</div> : null}
            </div>
            <span className="mini-chip">{item.status || 'pending'}</span>
          </div>
        )) : <div className="muted small">Closure-правила пока не переданы.</div>}
      </div>
    </section>
  );
}
