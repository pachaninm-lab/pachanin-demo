import Link from 'next/link';
import { EvidencePackOperationsQueue } from '@/components/v7r/EvidencePackOperationsQueue';

const SAMPLE_DEALS = ['DL-9113', 'DL-9114', 'DL-9116', 'DL-9118', 'DL-9120'];

export default function EvidencePackIndexPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 11, color: '#0A7A5F', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          P0-07 · evidence pack operations · sandbox
        </div>
        <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.15, fontWeight: 900, color: '#0F1419' }}>
          Evidence pack operations
        </h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#6B778C', maxWidth: 860 }}>
          Операционный индекс доказательных пакетов. Это sandbox-навигация: она не запускает live PDF, ЭДО, КЭП, банк, ФГИС или СберКорус.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/deals' style={btn('primary')}>Сделки</Link>
          <Link href='/platform-v7/disputes' style={btn()}>Споры</Link>
          <Link href='/platform-v7/bank' style={btn()}>Банк</Link>
        </div>
      </section>

      <EvidencePackOperationsQueue />

      <section data-testid='evidence-pack-index' style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#0F1419' }}>Доступные preview-пакеты</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          {SAMPLE_DEALS.map((dealId) => (
            <Link
              key={dealId}
              href={`/platform-v7/deals/${dealId}/evidence-pack`}
              style={{ textDecoration: 'none', border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, background: '#F8FAFB', display: 'grid', gap: 6 }}
            >
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#0A7A5F', fontWeight: 900, fontSize: 13 }}>{dealId}</span>
              <span style={{ color: '#0F1419', fontWeight: 800, fontSize: 14 }}>Открыть evidence pack preview</span>
              <span style={{ color: '#6B778C', fontSize: 12, lineHeight: 1.5 }}>Sandbox preview доказательств, спора, денег, audit и timeline.</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function btn(kind: 'default' | 'primary' = 'default') {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 13, fontWeight: 800 };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 800 };
}
