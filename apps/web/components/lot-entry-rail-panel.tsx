import { buildLotEntryRail } from '../lib/lot-disclosure';

const modeLabel: Record<string, string> = {
  OPEN_AUCTION: 'open auction',
  PRIVATE_AUCTION: 'private auction',
  TARGET_ORDER: 'target order',
  OPERATOR_ASSISTED: 'operator-assisted',
  INSTANT_EXECUTION: 'instant execution',
  DEAL_ACCOUNT: 'deal account',
};

export function LotEntryRailPanel({ recommendation }: { recommendation: ReturnType<typeof buildLotEntryRail> }) {
  return (
    <section className="grid cols-2">
      <div className="card">
        <div className="section-title">Лот как вход в rail</div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Лоты не должны жить как отдельный мир. Их задача — завести сделку в правильный режим: open, private, target, operator-assisted или сразу в deal account.
        </div>
        <div className="soft-box" style={{ marginTop: 12 }}>
          <div className="list-row">
            <span>Рекомендованный режим</span>
            <b>{modeLabel[recommendation.recommendedMode] || recommendation.recommendedMode}</b>
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>{recommendation.reason}</div>
        </div>
        <div className="muted small" style={{ marginTop: 12 }}>{recommendation.stageWarning}</div>
        <div className="detail-meta" style={{ marginTop: 10 }}>
          {recommendation.factualSignals.map((item) => <span key={item} className="mini-chip">{item}</span>)}
        </div>
      </div>

      <div className="card">
        <div className="section-title">Все входные rails</div>
        <div className="stack-sm" style={{ marginTop: 12 }}>
          {recommendation.rails.map((rail) => (
            <div key={rail.code} className="soft-box">
              <div className="list-row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <b>{rail.title}</b>
                  <div className="muted small">{rail.useCase}</div>
                </div>
                <div className="detail-meta">
                  {rail.recommended ? <span className="mini-chip">выбран</span> : null}
                  <span className="mini-chip">{rail.fit ? 'fit' : 'secondary'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
