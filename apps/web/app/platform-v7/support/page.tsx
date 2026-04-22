import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Поддержка',
  description: 'Контур поддержки: быстрый маршрут эскалации, Telegram и fallback для проблем в сделке.',
};

const SUPPORT_CHANNELS = [
  {
    title: 'Telegram-оператор',
    value: '@transparent_price_support',
    note: 'Быстрый канал для блокеров сделки, документов и споров.',
    accent: { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB' },
  },
  {
    title: 'Jivo fallback',
    value: 'Подключается по рабочему окну',
    note: 'Резервный канал, если нужно быстро собрать доказательства или дать handoff оператору.',
    accent: { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' },
  },
  {
    title: 'Почта эскалации',
    value: 'support@transparent-price.demo',
    note: 'Для формального следа, если спор уже влияет на деньги и сроки.',
    accent: { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' },
  },
];

const ESCALATION_STEPS = [
  'Сначала привяжи тикет к сделке, спору или документному пакету.',
  'Покажи, где именно блокер: деньги, документы, ФГИС, ЕСИА, транспорт или лаборатория.',
  'Приложи ID сделки, ID спора и что уже пытались сделать.',
  'Если блокер денежный, сразу укажи сумму hold / reserve / release.',
];

export default function SupportPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#0F1419' }}>Поддержка</div>
        <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Поддержка здесь не декоративная. Это рабочий канал эскалации, когда сделка уже застряла и нужно быстро передать проблему оператору с нормальным контекстом.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {SUPPORT_CHANNELS.map((item) => (
          <section key={item.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: item.accent.bg, border: `1px solid ${item.accent.border}`, color: item.accent.color, fontSize: 11, fontWeight: 800, width: 'fit-content' }}>
              {item.title}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{item.value}</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6 }}>{item.note}</div>
          </section>
        ))}
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Как правильно эскалировать блокер</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {ESCALATION_STEPS.map((step, index) => (
            <div key={step} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, alignItems: 'start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800 }}>{index + 1}</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{step}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/control-tower/hotlist' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Открыть hotlist
        </Link>
        <Link href='/platform-v7/disputes' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Споры
        </Link>
        <Link href='/platform-v7/documents' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Документы
        </Link>
      </div>
    </div>
  );
}
