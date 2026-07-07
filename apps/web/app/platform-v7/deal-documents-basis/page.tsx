export default function DealDocumentsBasisPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Документы сделки</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>Документное основание</h1>
        <p style={{ margin: 0, maxWidth: 820, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Раздел собирает документы и проверки, которые идут после приёмки сделки.</p>
      </section>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Пакет</h2>
        {['Договор поставки', 'СДИЗ', 'Акт веса', 'Протокол качества', 'Акт приёмки', 'УПД или счёт'].map((item) => (
          <div key={item} style={{ padding: 12, borderRadius: 14, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)', fontSize: 13, fontWeight: 900, color: 'var(--pc-text-primary)' }}>{item}</div>
        ))}
      </section>
    </main>
  );
}
