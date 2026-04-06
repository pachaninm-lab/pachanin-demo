import { AppShell } from '../../../components/app-shell';

export default function ScenarioDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell title={`Scenario ${params.id}`} subtitle="Сценарий, условия запуска, ожидаемые исходы и checkpoints">
      <div className="card">Scenario detail placeholder for {params.id}.</div>
    </AppShell>
  );
}
