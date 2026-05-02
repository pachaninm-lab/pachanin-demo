import Link from 'next/link';

const steps = [
  'Лот',
  'Ставка',
  'Сделка',
  'Резерв',
  'Рейс',
  'Приёмка',
  'Лаборатория',
  'Документы',
  'Проверка выплаты',
  'Спор',
  'Решение',
] as const;

export default function PlatformV7DemoExecutionFlowPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ border: '1px solid #E4E6EA', borderRadius: 20, padding: 22, background: '#fff', display: 'grid', gap: 14 }}>
        <div style={{ display: 'inline-flex', width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 900 }}>Демо-путь · controlled pilot</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.12, color: '#0F1419' }}>Сквозной путь сделки</h1>
        <p style={{ margin: 0, maxWidth: 860, fontSize: 14, lineHeight: 1.7, color: '#5B6576' }}>Тестовый маршрут показывает основные этапы сделки без заявлений о боевых внешних подключениях.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/platform-v7/control-tower" style={primaryLink}>Центр управления</Link>
          <Link href="/platform-v7/simulator" style={secondaryLink}>Симулятор</Link>
          <Link href="/platform-v7/bank/events" style={secondaryLink}>События банка</Link>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        {steps.map((step, index) => (
          <article key={step} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12, alignItems: 'center', padding: 12, borderRadius: 14, background: '#F8FAFB', border: '1px solid #EEF1F4' }}>
            <span style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{index + 1}</span>
            <strong style={{ fontSize: 15, color: '#0F1419' }}>{step}</strong>
          </article>
        ))}
      </section>
    </div>
  );
}

const primaryLink = { display: 'inline-flex', minHeight: 42, alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 900 } as const;
const secondaryLink = { ...primaryLink, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1' } as const;
