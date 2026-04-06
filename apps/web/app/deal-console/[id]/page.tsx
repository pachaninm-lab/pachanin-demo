import { AppShell } from '../../../components/app-shell';

export default function DealConsoleDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell title={`Deal console ${params.id}`} subtitle="Единый workspace сделки: status, owners, blockers, next action">
      <div className="card">Deal console detail placeholder for {params.id}.</div>
    </AppShell>
  );
}
