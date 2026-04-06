export function KpiCard({ title, value, hint, tone = 'green' }: { title: string; value: string; hint?: string; tone?: 'green' | 'amber' | 'blue' | 'violet' }) {
  return (
    <div className="card">
      <div className={`badge ${tone}`}>{title}</div>
      <div className="kpi">{value}</div>
      {hint ? <div className="muted small">{hint}</div> : null}
    </div>
  );
}
