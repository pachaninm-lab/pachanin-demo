export function ViewStateCard({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <div className="dashboard-card">
      <div className="dashboard-card-title">{title}</div>
      <div className="dashboard-card-value">{value}</div>
      {detail ? <div className="dashboard-card-caption">{detail}</div> : null}
    </div>
  );
}
