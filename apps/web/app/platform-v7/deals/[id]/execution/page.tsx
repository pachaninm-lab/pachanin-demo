'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { selectExecutionSimulationByDealId } from '@/lib/platform-v7/domain/execution-simulation';

export default function ExecutionPage() {
  const params = useParams();
  const id = String(params.id);
  const sim = selectExecutionSimulationByDealId(id);

  if (!sim) return <div>Сделка не найдена</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h1>{sim.title}</h1>
      <div>{sim.subtitle}</div>

      <section>
        <h3>Маршрут</h3>
        {sim.routePoints.map(p => (
          <div key={p.label}>{p.label} · {p.progress}%</div>
        ))}
      </section>

      <section>
        <h3>Этапы</h3>
        {sim.stages.map(s => (
          <div key={s.key}>{s.title} — {s.description}</div>
        ))}
      </section>

      <section>
        <h3>Документы</h3>
        {sim.documents.map(d => (
          <div key={d.id}>{d.title} — {d.status}</div>
        ))}
      </section>

      <section>
        <h3>Деньги</h3>
        <div>{sim.releaseReadyLabel}</div>
      </section>

      <Link href="/platform-v7/control-tower">В контроль</Link>
    </div>
  );
}
