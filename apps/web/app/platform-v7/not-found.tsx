import Link from 'next/link';

export default function PlatformV7NotFound() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F1419', margin: 0 }}>Страница не найдена</h2>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 10 }}>Запрошенный экран сделки, спора или модуля отсутствует либо недоступен.</p>
        <Link href="/platform-v7/deals" style={{ display: 'inline-block', marginTop: 20, padding: '10px 16px', borderRadius: 8, border: '1px solid #0A7A5F', background: '#0A7A5F', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
          ← Все сделки
        </Link>
      </div>
    </div>
  );
}
