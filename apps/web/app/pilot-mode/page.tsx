import { AppShell } from '../../components/app-shell';
import { KpiCard } from '../../components/kpi-card';

export default function PilotModePage() {
  return (
    <AppShell title="Pilot mode" subtitle="Controlled pilot readiness и ограничения режима">
      <div className="grid-3">
        <KpiCard title="Режим" value="pilot-controlled" />
        <KpiCard title="Live connectors" value="off" tone="amber" />
        <KpiCard title="Fallback" value="visible" tone="blue" />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        В этом режиме деньги и юридически значимые шаги должны оставаться fail-closed. Sandbox и manual fallback показываются честно.
      </div>
    </AppShell>
  );
}
