import Link from 'next/link';

type Step = { code: string; title: string; owner: string; status: 'DONE' | 'ACTIVE' | 'PENDING' | 'BLOCKED'; detail: string; href: string };

const toneMap: Record<Step['status'], string> = {
  DONE: 'highlight-green',
  ACTIVE: 'highlight-amber',
  PENDING: 'highlight-gray',
  BLOCKED: 'highlight-red',
};

export function DealStateMachinePanel({ steps }: { steps: Step[] }) {
  return (
    <section className="section-card">
      <div className="panel-title-row">
        <div>
          <div className="dashboard-section-title">Сценарий статусов сделки</div>
          <div className="dashboard-section-subtitle">Один словарь статусов и один путь: от лота до финального закрытия и передачи в интеграционный контур.</div>
        </div>
      </div>
      <div className="section-stack" style={{ marginTop: 16 }}>
        {steps.map((step) => (
          <Link key={step.code} href={step.href} className="section-card-tight linkable">
            <div className="panel-title-row">
              <div>
                <div style={{ fontWeight: 700 }}>{step.title}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{step.detail}</div>
                <div className="muted tiny" style={{ marginTop: 6 }}>{step.code} · Ответственный: {step.owner}</div>
              </div>
              <span className={toneMap[step.status]}>{step.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
