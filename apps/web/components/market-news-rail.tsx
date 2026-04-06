import { getMarketNews } from '../lib/market-news-server';

export async function MarketNewsRail() {
  const items = await getMarketNews(6);
  const fallback = items.every((item: any) => !item.link);
  return (
    <div className="card">
      <div className="panel-title-row"><div className="section-title">Новости рынка</div><div className="mini-chip">{fallback ? 'fallback feed' : 'live / feed'}</div></div>
      <div className="stack-sm">
        {items.map((item) => (
          <div key={item.id} className="soft-box">
            <div className="panel-title-row"><b>{item.title}</b><span className="muted small">{item.time || '—'}</span></div>
            <div className="muted small">{item.source}</div>
            <div className="muted" style={{ marginTop: 8 }}>{item.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
