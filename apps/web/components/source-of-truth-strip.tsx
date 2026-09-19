export function SourceOfTruthStrip({ entries = [] }: { entries?: Array<{ label: string; value: string; tone?: string }> }) {
  return (
    <section className="section-card-tight">
      <div className="section-title">Source of truth</div>
      <div className="detail-meta" style={{ marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
        {entries.map((entry, index) => (
          <span key={`${entry.label}-${index}`} className={`mini-chip ${entry.tone || 'gray'}`}>
            {entry.label}: {entry.value}
          </span>
        ))}
        {!entries.length ? <span className="mini-chip gray">no truth markers</span> : null}
      </div>
    </section>
  );
}
