import Link from 'next/link';

type PaymentLike = {
  id: string;
  status: string;
  releaseGate?: string;
  beneficiaryName?: string;
  linkedDealId?: string | null;
};

export function PaymentRailConsole({
  payment,
  waterfall = [],
  documents = [],
  disputes = []
}: {
  payment: PaymentLike;
  waterfall?: any[];
  documents?: any[];
  disputes?: any[];
}) {
  return (
    <div className="section-card-tight">
      <div className="section-title">Payment rail console</div>
      <div className="section-stack" style={{ marginTop: 12 }}>
        <div className="list-row"><span>Status</span><b>{payment.status}</b></div>
        <div className="list-row"><span>Release gate</span><b>{payment.releaseGate || '—'}</b></div>
        <div className="list-row"><span>Beneficiary</span><b>{payment.beneficiaryName || '—'}</b></div>
        <div className="list-row"><span>Docs linked</span><b>{documents.length}</b></div>
        <div className="list-row"><span>Waterfall steps</span><b>{waterfall.length}</b></div>
        <div className="list-row"><span>Disputes</span><b>{disputes.length}</b></div>
      </div>

      {!!waterfall.length && (
        <div className="section-stack" style={{ marginTop: 16 }}>
          {waterfall.map((step: any, index: number) => (
            <div key={step.id || index} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{step.title || step.code || `Step ${index + 1}`}</div>
                <div className="muted tiny" style={{ marginTop: 4 }}>{step.detail || step.reason || '—'}</div>
              </div>
              <span className="mini-chip">{step.status || 'pending'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="cta-stack" style={{ marginTop: 16 }}>
        {payment.linkedDealId ? <Link href={`/deals/${payment.linkedDealId}`} className="secondary-link">Открыть сделку</Link> : null}
        <Link href="/documents" className="secondary-link">Документы</Link>
        <Link href="/disputes" className="secondary-link">Споры</Link>
      </div>
    </div>
  );
}
