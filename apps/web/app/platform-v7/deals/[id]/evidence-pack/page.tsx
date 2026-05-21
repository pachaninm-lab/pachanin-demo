import Link from 'next/link';
import { DealEvidencePackPreview } from '@/components/v7r/DealEvidencePackPreview';

export default function DealEvidencePackPage({ params }: { params: { id: string } }) {
  const dealId = decodeURIComponent(params.id);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 11, color: '#0A7A5F', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          P0-06 · отдельный preview-маршрут · sandbox
        </div>
        <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.15, fontWeight: 900, color: '#0F1419' }}>
          Evidence pack preview · {dealId}
        </h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#6B778C', maxWidth: 860 }}>
          Безопасный deal-level preview доказательного пакета. Маршрут не меняет основную страницу сделки и не заявляет live PDF, ЭДО, КЭП, банковую или ФГИС-интеграцию.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/deals/${dealId}`} style={btn('primary')}>Назад к сделке</Link>
          <Link href='/platform-v7/disputes' style={btn()}>Споры</Link>
          <Link href='/platform-v7/bank' style={btn()}>Банк</Link>
        </div>
      </section>

      <DealEvidencePackPreview dealId={dealId} />
    </div>
  );
}

function btn(kind: 'default' | 'primary' = 'default') {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 13, fontWeight: 800 };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 800 };
}
