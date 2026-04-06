import { buildLotDisclosureProfile } from '../lib/lot-disclosure';

export function LotDisclosurePanel({ profile }: { profile: ReturnType<typeof buildLotDisclosureProfile> }) {
  return (
    <section className="grid cols-2">
      <div className="card">
        <div className="section-title">Обезличенность и staged disclosure</div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Лот — это commercial entry object. До фиксации сделки платформа показывает trust и readiness, а не даёт ранний обход через контакты и точную точку исполнения.
        </div>
        <div className="detail-meta" style={{ marginTop: 10 }}>
          <span className="mini-chip">{profile.stageLabel}</span>
          <span className="mini-chip">{profile.maskedSeller}</span>
          <span className="mini-chip">Payment lane: {profile.paymentLane}</span>
        </div>
        <div className="info-grid-2" style={{ marginTop: 12 }}>
          <div className="info-card">
            <div className="label">Что видно сейчас</div>
            <div className="stack-sm" style={{ marginTop: 8 }}>
              {profile.visibleNow.map((item) => <div key={item} className="muted small">• {item}</div>)}
            </div>
          </div>
          <div className="info-card">
            <div className="label">Что скрыто до rail-lock</div>
            <div className="stack-sm" style={{ marginTop: 8 }}>
              {profile.hiddenNow.map((item) => <div key={item} className="muted small">• {item}</div>)}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Когда раскрытие допустимо</div>
        <div className="list-row" style={{ marginTop: 8 }}>
          <span>Trust tier продавца</span>
          <b>{profile.sellerTrustBand}</b>
        </div>
        <div className="list-row">
          <span>Точка исполнения</span>
          <b style={{ textAlign: 'right' }}>{profile.maskedAddress}</b>
        </div>
        <div className="stack-sm" style={{ marginTop: 12 }}>
          {profile.unlockRules.map((item) => (
            <div key={item} className="soft-box">
              <div className="muted small">{item}</div>
            </div>
          ))}
        </div>
        <div className="muted small" style={{ marginTop: 12 }}>
          <b>Anti-bypass:</b> {profile.antiBypassNote}
        </div>
      </div>
    </section>
  );
}
