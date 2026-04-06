import Link from 'next/link';

type TrustGraphItem = {
  companyId: string;
  name: string;
  band: 'GREEN' | 'AMBER' | 'RED';
  score: number;
  kyb: string;
  paymentDiscipline: string;
  queuePriority: string;
  payoutSpeed: string;
  financeEligibility: string;
  noShowRate: string;
  disputeRate: string;
  bypassScore: string;
  reasons: string[];
};

type AdmissionDecision = {
  companyId: string;
  name: string;
  operatorOverride: string;
  publicAuctionAccess: string;
  privateAuctionAccess: string;
  payoutMode: string;
  financeMode: string;
  queueMode: string;
  disputeMode: string;
};

function bandClass(band: string) {
  if (band === 'GREEN') return 'highlight-green';
  if (band === 'RED') return 'highlight-red';
  return 'highlight-amber';
}

function nextStep(item: TrustGraphItem) {
  if (item.band === 'RED') return 'Оставить в manual gate, ограничить private mode и payout speed до operator sign-off.';
  if (item.band === 'AMBER') return 'Допускать по лимиту, ускорять только после проверки документов и истории исполнения.';
  return 'Пускать в whitelist, ускорять payout и использовать как якорный контрагент private режима.';
}

export function TrustGraphPanel({ items, admissions, compact = false }: { items: TrustGraphItem[]; admissions: AdmissionDecision[]; compact?: boolean }) {
  const visible = compact ? items.slice(0, 4) : items;
  const visibleAdmissions = admissions.slice(0, compact ? 4 : 6);

  return (
    <section className="grid cols-2">
      <div className="card">
        <div className="section-title">Trust Graph</div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Слой доверия управляет не только рейтингом, но и скоростью денег, private invite, dispute routing и приоритетом в очереди.
        </div>
        <div className="stack-sm" style={{ marginTop: 12 }}>
          {visible.map((item) => (
            <div key={item.companyId} className="soft-box">
              <div className="list-row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <b>{item.name}</b>
                  <div className="muted small">KYB {item.kyb} · payment {item.paymentDiscipline}</div>
                </div>
                <span className={bandClass(item.band)}>{item.score}</span>
              </div>
              <div className="detail-meta" style={{ marginTop: 8 }}>
                <span className="mini-chip">queue {item.queuePriority}</span>
                <span className="mini-chip">payout {item.payoutSpeed}</span>
                <span className="mini-chip">finance {item.financeEligibility}</span>
              </div>
              <div className="detail-meta" style={{ marginTop: 8 }}>
                <span className="mini-chip">no-show {item.noShowRate}</span>
                <span className="mini-chip">dispute {item.disputeRate}</span>
                <span className="mini-chip">bypass {item.bypassScore}</span>
              </div>
              <div className="muted tiny" style={{ marginTop: 8 }}>{item.reasons.join(' · ') || 'Жёстких красных флагов нет.'}</div>
              <div className="muted small" style={{ marginTop: 8 }}><b>Следующий шаг:</b> {nextStep(item)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-title">Admission Engine</div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Допуск должен управлять тем, куда пускать контрагента и как быстро ему доверять деньги, спор и очередь.
        </div>
        <div className="stack-sm" style={{ marginTop: 12 }}>
          {visibleAdmissions.map((item) => (
            <div key={item.companyId} className="soft-box">
              <div className="list-row" style={{ alignItems: 'flex-start' }}>
                <b>{item.name}</b>
                <span className="mini-chip">override {item.operatorOverride}</span>
              </div>
              <div className="section-stack" style={{ marginTop: 8 }}>
                <div className="list-row"><span>Public auction</span><b>{item.publicAuctionAccess}</b></div>
                <div className="list-row"><span>Private mode</span><b>{item.privateAuctionAccess}</b></div>
                <div className="list-row"><span>Payout</span><b>{item.payoutMode}</b></div>
                <div className="list-row"><span>Finance</span><b>{item.financeMode}</b></div>
                <div className="list-row"><span>Queue</span><b>{item.queueMode}</b></div>
                <div className="list-row"><span>Dispute</span><b>{item.disputeMode}</b></div>
              </div>
            </div>
          ))}
        </div>
        <div className="cta-stack" style={{ marginTop: 14 }}>
          <Link href="/onboarding" className="secondary-link">Допуск контрагентов</Link>
          <Link href="/anti-fraud" className="secondary-link">Антиобход</Link>
          <Link href="/liquidity-layer" className="secondary-link">Private / liquidity routing</Link>
        </div>
      </div>
    </section>
  );
}
