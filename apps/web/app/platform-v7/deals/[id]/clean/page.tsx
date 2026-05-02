import Link from 'next/link';

export default function PlatformV7CleanDealPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: '#0F1419' }}>Deal card</h1>
        <p style={{ color: '#475569' }}>Stable pilot card for deal execution.</p>
        <Link href="/platform-v7/bank/clean" style={{ color: '#0A7A5F', fontWeight: 800 }}>Money</Link>
      </section>
    </main>
  );
}
