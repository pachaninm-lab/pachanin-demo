type Readiness = {
  docsReady?: boolean;
  bankReady?: boolean;
  labReady?: boolean;
  receivingReady?: boolean;
  disputeFree?: boolean;
  canPartialRelease?: boolean;
  canRelease?: boolean;
  owner?: string;
  nextAction?: string;
  reasonCodes?: string[];
  financialStatus?: string;
  bankStatus?: string;
  accountingStatus?: string;
  reconciliationStatus?: string;
};

export function MoneyReleaseGate({ readiness }: { readiness: Readiness | null | undefined }) {
  if (!readiness) return null;
  const cards = [
    { label: 'Docs', value: readiness.docsReady ? 'GREEN' : 'WAIT', detail: 'Обязательный пакет и trust по документам.' },
    { label: 'Receiving', value: readiness.receivingReady ? 'GREEN' : 'WAIT', detail: 'Фактическая приёмка и вес подтверждены.' },
    { label: 'Lab', value: readiness.labReady ? 'GREEN' : 'WAIT', detail: 'Финальный протокол качества закрыт.' },
    { label: 'Bank / callback', value: readiness.bankReady ? 'READY' : 'WAIT', detail: 'Callback банка и hold/release trace.' },
    { label: 'Dispute', value: readiness.disputeFree ? 'CLEAN' : 'HOLD', detail: 'Открытый спор держит final release.' },
    { label: 'Partial release', value: readiness.canPartialRelease ? 'READY' : 'WAIT', detail: 'Можно ли выпускать деньги частично.' },
    { label: 'Final release', value: readiness.canRelease ? 'READY' : 'HOLD', detail: 'Финальный выпуск только при green readiness.' },
  ];
  return (
    <section className="section-card-tight">
      <div className="section-title">Money truth / release gate</div>
      <div className="muted small" style={{ marginTop: 6 }}>
        Денежный контур отдельно показывает readiness по документам, приёмке, качеству, банку, сверке и спору. Это убирает серую зону между «платёж есть» и «платёж реально можно выпускать».
      </div>
      <div className="mobile-stat-grid" style={{ marginTop: 14 }}>
        {cards.map((item) => (
          <div key={item.label} className="border rounded-xl p-4">
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <div className="font-semibold mt-1">{item.value}</div>
            <div className="text-sm text-muted-foreground mt-2">{item.detail}</div>
          </div>
        ))}
      </div>
      <div className="soft-box" style={{ marginTop: 14 }}>
        <div className="list-row"><span>Owner</span><b>{readiness.owner || '—'}</b></div>
        <div className="list-row"><span>Next action</span><b>{readiness.nextAction || '—'}</b></div>
        <div className="list-row"><span>Financial / bank / accounting / recon</span><b>{readiness.financialStatus || '—'} · {readiness.bankStatus || '—'} · {readiness.accountingStatus || '—'} · {readiness.reconciliationStatus || '—'}</b></div>
        <div className="muted tiny" style={{ marginTop: 8 }}>reason codes: {(readiness.reasonCodes || []).join(' · ') || '—'}</div>
      </div>
    </section>
  );
}
