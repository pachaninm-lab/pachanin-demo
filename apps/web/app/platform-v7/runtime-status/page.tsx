import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Статус системы',
  description: 'Состояние ключевых контуров сделки: деньги, документы, регуляторный gate и транспорт.',
};

const ITEMS = [
  {
    title: 'Денежный контур',
    state: 'Условно зелёный',
    note: 'Резерв, hold и release доступны, но финальный выпуск всё ещё зависит от блокеров сделки.',
    accent: { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' },
  },
  {
    title: 'Документный контур',
    state: 'Требует контроля',
    note: 'Неполный пакет документов должен сразу резать обещания о выпуске денег.',
    accent: { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' },
  },
  {
    title: 'Регуляторный gate',
    state: 'Ручная проверка',
    note: 'Связка с ФГИС и ЕСИА не должна маскироваться под fully live без боевого подтверждения.',
    accent: { bg: 'rgba(71,85,105,0.08)', border: 'rgba(71,85,105,0.18)', color: '#334155' },
  },
  {
    title: 'Транспортный пакет',
    state: 'Влияет на деньги',
    note: 'Транспортные документы уже участвуют в stop/release логике сделки.',
    accent: { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB' },
  },
];

export default function RuntimeStatusPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1120, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#0F1419' }}>Статус системы</div>
        <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Экран показывает, где сделка реально может застрять: деньги, документы, регуляторная связка и транспортный пакет. Это не декоративный health-check, а операционный слой для оператора и банка.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {ITEMS.map((item) => (
          <section key={item.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: item.accent.bg, border: `1px solid ${item.accent.border}`, color: item.accent.color, fontSize: 11, fontWeight: 800, width: 'fit-content' }}>
              {item.state}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6 }}>{item.note}</div>
          </section>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/control-tower/hotlist' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Hotlist
        </Link>
        <Link href='/platform-v7/bank' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Банк
        </Link>
        <Link href='/platform-v7/documents' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Документы
        </Link>
      </div>
    </div>
  );
}
