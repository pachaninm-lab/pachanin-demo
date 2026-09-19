import Link from 'next/link';

export type LifecycleStep = {
  key: string;
  title: string;
  href: string;
  detail: string;
  state: 'DONE' | 'ACTIVE' | 'PENDING' | 'BLOCKED';
};

export function DealLifecycleLane({ title = 'Сквозной контур', steps }: { title?: string; steps: LifecycleStep[] }) {
  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title" style={{ marginBottom: 8 }}>{title}</h2>
      <p className="dashboard-section-subtitle" style={{ marginBottom: 0 }}>Каждый этап должен завершаться следующим логическим действием, а не тупиком.</p>
      <div className="workflow-steps" style={{ marginTop: 16 }}>
        {steps.map((step) => (
          <Link key={step.key} href={step.href} className={`workflow-step lifecycle-step ${step.state.toLowerCase()}`}>
            <div className="tiny muted">{step.key}</div>
            <div style={{ fontWeight: 700, marginTop: 6 }}>{step.title}</div>
            <div className="tiny" style={{ marginTop: 6 }}>{step.detail}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
