type CommercialExpansionPayload = {
  meta: { source: string; updatedAt: string; primaryDealId: string | null };
  modules: any;
  actions: Array<{ id: string; title: string; owner: string; href: string }>;
};

function Badge({ value }: { value: string }) {
  const normalized = String(value || '').toLowerCase();
  const cls = normalized.includes('partial') || normalized.includes('foundation') ? 'highlight-amber' : normalized.includes('missing') ? 'highlight-red' : 'highlight-green';
  return <span className={cls}>{value}</span>;
}

export function CommercialExpansionBoard({ payload }: { payload: CommercialExpansionPayload }) {
  const cards = [
    {
      key: 'insurance',
      title: 'Страхование внутри workflow',
      data: payload.modules.insurance,
      bullets: [
        `stage: ${payload.modules.insurance.currentStage}`,
        `offerRequired: ${String(payload.modules.insurance.currentPolicyGate.offerRequired)}`,
        `blockRelease: ${String(payload.modules.insurance.currentPolicyGate.blockMoneyReleaseWithoutDecision)}`,
      ],
    },
    {
      key: 'banks',
      title: 'Второй bank adapter',
      data: payload.modules.banks,
      bullets: payload.modules.banks.rails.map((item: any) => `${item.label}: ${item.currentState}`),
    },
    {
      key: 'esg',
      title: 'ESG по сделке',
      data: payload.modules.esg,
      bullets: [
        `kgCO2e: ${payload.modules.esg.carbon.kgCo2e}`,
        `kgCO2e/ton: ${payload.modules.esg.carbon.kgCo2ePerTon}`,
        `${payload.modules.esg.carbon.methodology}`,
      ],
    },
    {
      key: 'predictive',
      title: 'Predictive quality / dispute',
      data: payload.modules.predictive,
      bullets: [
        `deltaPerTon: ${payload.modules.predictive.qualityDelta.rubPerTonDelta}`,
        `deltaTotal: ${payload.modules.predictive.qualityDelta.totalDeltaRub}`,
        `sellerSuccess: ${payload.modules.predictive.predictiveDispute.sellerSuccessProbability}%`,
      ],
    },
    {
      key: 'exportRoutes',
      title: 'Экспортные corridor templates',
      data: payload.modules.exportRoutes,
      bullets: payload.modules.exportRoutes.templates.map((item: any) => `${item.originRegion} → ${item.destination}`),
    },
    {
      key: 'crops',
      title: 'Rollout смежных культур',
      data: payload.modules.crops,
      bullets: [
        `barley: ${String(payload.modules.crops.rollout.canExpandToBarley)}`,
        `sunflower: ${String(payload.modules.crops.rollout.canExpandToSunflower)}`,
        payload.modules.crops.rollout.policy,
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <section className="section-card-tight">
        <div className="panel-title-row">
          <div>
            <div className="section-title">Commercial expansion control board</div>
            <div className="muted small" style={{ marginTop: 6 }}>Шесть модулей подключены к runtime read-model и показываются как policy gates, а не как список идей.</div>
          </div>
          <div className="detail-meta">
            <span className="mini-chip">deal {payload.meta.primaryDealId || '—'}</span>
            <span className="mini-chip">{payload.meta.updatedAt}</span>
          </div>
        </div>
      </section>

      <section className="dashboard-grid-3">
        {cards.map((card) => (
          <div key={card.key} className="dashboard-card">
            <div className="dashboard-card-title">{card.title}</div>
            <div style={{ marginTop: 8 }}><Badge value={card.data.assessment.repoStatus} /></div>
            <div className="dashboard-card-caption" style={{ marginTop: 8 }}>{card.data.assessment.reason}</div>
            <div className="stack-sm" style={{ marginTop: 12 }}>
              {card.bullets.map((item: string) => <div key={item} className="muted tiny">• {item}</div>)}
            </div>
          </div>
        ))}
      </section>

      <section className="section-card">
        <div className="section-title">Следующие действия</div>
        <div className="stack-sm" style={{ marginTop: 12 }}>
          {payload.actions.map((item) => (
            <a key={item.id} href={item.href} className="soft-box">
              <div className="list-row"><b>{item.title}</b><span className="mini-chip">{item.owner}</span></div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
