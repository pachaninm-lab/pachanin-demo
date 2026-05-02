import Link from 'next/link';

export default function BankCleanPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: '#0F1419' }}>Деньги по сделкам</h1>
        <p style={{ color: '#475569' }}>Стабильная пилотная страница контроля денег по сделке.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/platform-v7/bank/release-safety" style={{ color: '#0A7A5F', fontWeight: 800 }}>Проверка выплаты</Link>
          <Link href="/platform-v7/control-tower" style={{ color: '#0A7A5F', fontWeight: 800 }}>Центр управления</Link>
        </div>
      </section>
    </main>
  );
}
