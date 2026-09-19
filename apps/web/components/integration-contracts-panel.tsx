type Contract = { id: string; title: string; status: 'READY' | 'SANDBOX' | 'PLANNED'; detail: string; owner: string; adapter: string };

const toneMap: Record<Contract['status'], string> = {
  READY: 'highlight-green',
  SANDBOX: 'highlight-amber',
  PLANNED: 'highlight-gray',
};

export function IntegrationContractsPanel({ contracts }: { contracts: Contract[] }) {
  return (
    <section className="section-card">
      <div className="panel-title-row">
        <div>
          <div className="dashboard-section-title">Integration-ready contracts</div>
          <div className="dashboard-section-subtitle">Что уже готово к стыковке, а что ещё живёт в sandbox-режиме.</div>
        </div>
      </div>
      <div className="section-stack" style={{ marginTop: 16 }}>
        {contracts.map((contract) => (
          <div key={contract.id} className="section-card-tight">
            <div className="panel-title-row">
              <div>
                <div style={{ fontWeight: 700 }}>{contract.title}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{contract.detail}</div>
              </div>
              <span className={toneMap[contract.status]}>{contract.status}</span>
            </div>
            <div className="muted tiny" style={{ marginTop: 8 }}>owner {contract.owner} · adapter {contract.adapter}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
