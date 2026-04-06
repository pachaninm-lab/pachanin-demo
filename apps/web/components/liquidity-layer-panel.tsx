import Link from 'next/link';

export function LiquidityLayerPanel({
  targetOrders = [],
  recommendations = [],
  rescueFlows = [],
  strongestBuyers = [],
}: {
  targetOrders?: any[];
  recommendations?: any[];
  rescueFlows?: any[];
  strongestBuyers?: any[];
}) {
  return (
    <div className="section-stack">
      <section className="section-card-tight">
        <div className="section-title">Target orders</div>
        <div className="section-stack" style={{ marginTop: 12 }}>
          {targetOrders.map((item, index) => (
            <div key={item.id || index} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{item.title || item.culture || `order ${index + 1}`}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{item.detail || item.region || '—'}</div>
              </div>
              <span className="mini-chip">{item.status || 'target'}</span>
            </div>
          ))}
          {!targetOrders.length ? <div className="muted small">Target orders не выделены.</div> : null}
        </div>
      </section>

      <section className="section-card-tight">
        <div className="section-title">Recommendations</div>
        <div className="section-stack" style={{ marginTop: 12 }}>
          {recommendations.map((item, index) => (
            <div key={item.id || index} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{item.title || item.mode || `recommendation ${index + 1}`}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{item.detail || item.reason || '—'}</div>
              </div>
              <span className="mini-chip">{item.mode || 'action'}</span>
            </div>
          ))}
          {!recommendations.length ? <div className="muted small">Рекомендаций сейчас нет.</div> : null}
        </div>
      </section>

      <section className="section-card-tight">
        <div className="section-title">Rescue flows</div>
        <div className="section-stack" style={{ marginTop: 12 }}>
          {rescueFlows.map((item, index) => (
            <div key={item.id || index} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{item.title || item.lotId || `rescue ${index + 1}`}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{item.pain || item.detail || '—'}</div>
              </div>
              <span className="mini-chip">{item.status || 'rescue'}</span>
            </div>
          ))}
          {!rescueFlows.length ? <div className="muted small">Rescue flow не требуется.</div> : null}
        </div>
      </section>

      <section className="section-card-tight">
        <div className="section-title">Strongest buyers</div>
        <div className="section-stack" style={{ marginTop: 12 }}>
          {strongestBuyers.map((item, index) => (
            <div key={item.id || index} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{item.name || item.buyerName || `buyer ${index + 1}`}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{item.detail || item.region || '—'}</div>
              </div>
              <span className="mini-chip">{item.score || item.trust || 'buyer'}</span>
            </div>
          ))}
          {!strongestBuyers.length ? <div className="muted small">Сильные buyers не выделены.</div> : null}
        </div>
      </section>

      <div className="cta-stack">
        <Link href="/purchase-requests" className="secondary-link">Buyer requests</Link>
        <Link href="/market-center" className="secondary-link">Price desk</Link>
      </div>
    </div>
  );
}
