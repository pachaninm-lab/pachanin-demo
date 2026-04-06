type OfflineConflictCase = {
  id: string;
  title: string;
  detail?: string;
  trigger?: string;
  systemRule?: string;
  operatorRule?: string;
};

export function OfflineConflictPanel({ title = 'Offline conflict handling', cases }: { title?: string; cases: Array<OfflineConflictCase & { winner?: string; nextAction?: string }> }) {
  return (
    <section className="section-card-tight">
      <div className="section-title">{title}</div>
      <div className="section-stack" style={{ marginTop: 12 }}>
        {cases.map((item) => (
          <div key={item.id} className="soft-box">
            <div style={{ fontWeight: 700 }}>{item.title}</div>
            <div className="muted small" style={{ marginTop: 6 }}>trigger: {item.trigger}</div>
            <div className="muted small" style={{ marginTop: 6 }}>system: {item.systemRule}</div>
            <div className="muted tiny" style={{ marginTop: 6 }}>operator: {item.operatorRule}</div>
            {'winner' in item && item.winner ? <div className="muted tiny" style={{ marginTop: 6 }}>winner: {item.winner}</div> : null}
            {'nextAction' in item && item.nextAction ? <div className="muted tiny" style={{ marginTop: 6 }}>next: {item.nextAction}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
