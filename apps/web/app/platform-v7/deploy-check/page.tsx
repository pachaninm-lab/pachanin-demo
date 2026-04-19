export default function DeployCheckPage() {
  return (
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Deploy Check</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Техническая страница для проверки, что production-алиас действительно обновляется после прямого коммита в main. Маркер: main-refresh-2.
        </div>
      </section>
    </div>
  );
}
