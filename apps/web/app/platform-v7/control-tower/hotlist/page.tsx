import Link from 'next/link';
import { SberKorusBadge } from '@/components/v7r/SberKorusBadge';
import { getTransportHotlist, moneyImpactLabel } from '@/lib/v7r/transport-docs';

export default function ControlTowerHotlistPage() {
  const items = getTransportHotlist();

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Горячий список Control Tower</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
              Быстрый экран для оператора: здесь собраны транспортные документные кейсы, которые держат сделку, рейс и выпуск денег. Это уже не декоративный список, а очередь действий по контуру СберКорус.
            </div>
          </div>
          <SberKorusBadge subtitle='Транспортный документный контур' compact />
        </div>
      </section>

      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item) => (
          <article key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>{item.id}</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: item.moneyImpactStatus === 'release_allowed' ? 'rgba(10,122,95,0.08)' : item.moneyImpactStatus === 'partially_blocks_release' ? 'rgba(217,119,6,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${item.moneyImpactStatus === 'release_allowed' ? 'rgba(10,122,95,0.18)' : item.moneyImpactStatus === 'partially_blocks_release' ? 'rgba(217,119,6,0.18)' : 'rgba(220,38,38,0.18)'}`, color: item.moneyImpactStatus === 'release_allowed' ? '#0A7A5F' : item.moneyImpactStatus === 'partially_blocks_release' ? '#B45309' : '#B91C1C', fontSize: 11, fontWeight: 800 }}>
                {moneyImpactLabel(item.moneyImpactStatus)}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{item.note}</div>
            <div style={{ fontSize: 12, color: '#6B778C' }}>Провайдер: {item.providerLabel}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={item.primaryHref} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
                Открыть пакет
              </Link>
              <Link href={item.simulationHref} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
                Открыть симуляцию
              </Link>
              <Link href={item.secondaryHref} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
                Открыть сделку
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Control Tower
        </Link>
        <Link href='/platform-v7/bank' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Банковый контур
        </Link>
      </div>
    </div>
  );
}
