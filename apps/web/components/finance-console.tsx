type Product = { id: string; title: string; type?: string };
type Application = { id: string; companyName: string; amount: number; status: string };

export function FinanceConsole({
  initialProducts = [],
  initialApplications = [],
}: {
  initialProducts?: Product[];
  initialApplications?: Application[];
}) {
  return (
    <div className="space-y-6">
      <section className="section-card">
        <div className="section-title">Finance console</div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Финконтур рядом со сделкой: продукты, заявки и текущий статус рассмотрения.
        </div>
      </section>

      <div className="mobile-two-grid">
        <section className="section-card">
          <div className="section-title">Продукты</div>
          <div className="stack-sm" style={{ marginTop: 12 }}>
            {initialProducts.map((item) => (
              <div key={item.id} className="soft-box">
                <div className="list-row"><b>{item.title}</b><span className="mini-chip">{item.type || 'product'}</span></div>
              </div>
            ))}
          </div>
        </section>

        <section className="section-card">
          <div className="section-title">Заявки</div>
          <div className="stack-sm" style={{ marginTop: 12 }}>
            {initialApplications.map((item) => (
              <div key={item.id} className="soft-box">
                <div className="list-row"><b>{item.companyName}</b><span className="mini-chip">{item.status}</span></div>
                <div className="muted small" style={{ marginTop: 6 }}>{Number(item.amount || 0).toLocaleString('ru-RU')} ₽</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
