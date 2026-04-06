export function SourceNote({ source, warning, updatedAt, compact = false }: { source?: string; warning?: string; updatedAt?: string | null; compact?: boolean }) {
  return (
    <section className="section-card-tight" style={compact ? { padding: 12 } : undefined}>
      <div className="panel-title-row">
        <div>
          <div className="section-title">Source note</div>
          {source ? <div className="muted tiny" style={{ marginTop: 4 }}>source: {source}</div> : null}
          {updatedAt ? <div className="muted tiny" style={{ marginTop: 4 }}>updated: {String(updatedAt).slice(0, 16).replace('T', ' ')}</div> : null}
        </div>
        <span className="mini-chip">note</span>
      </div>
      {warning ? <div className="muted small" style={{ marginTop: 8 }}>{warning}</div> : null}
    </section>
  );
}
