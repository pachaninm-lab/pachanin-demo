import { LiveResourceTable } from './live-resource-table';
import { DisputeActions } from './dispute-actions';

export function DisputeWorkspace({
  dispute,
  evidenceRows = [],
}: {
  dispute: { id: string; title: string; status: string; detail?: string; owner?: string };
  evidenceRows?: Array<Record<string, string | number | null | undefined>>;
}) {
  return (
    <div className="space-y-6">
      <section className="section-card">
        <div className="list-row"><div className="section-title">{dispute.title}</div><span className="mini-chip">{dispute.status}</span></div>
        {dispute.detail ? <div className="muted small" style={{ marginTop: 8 }}>{dispute.detail}</div> : null}
        {dispute.owner ? <div className="muted tiny" style={{ marginTop: 6 }}>owner {dispute.owner}</div> : null}
      </section>
      <LiveResourceTable title="Evidence rows" rows={evidenceRows} />
      <DisputeActions />
    </div>
  );
}
