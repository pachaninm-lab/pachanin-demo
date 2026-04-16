import Link from 'next/link';

const STEPS = [
  'Лот и readiness',
  'Создание draft-сделки',
  'Логистика и прибытие',
  'Приёмка и лаборатория',
  'Деньги, удержание и спор',
];

export default function DemoModePage() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Демо-режим</div>
        <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Отдельный презентационный сценарий. Не пересекается с основной логикой платформы и не подменяет рабочие кабинеты.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/platform-v7/demo/deals/DL-9103" style={{ padding: '12px 16px', borderRadius: 12, background: '#0A7A5F', color: '#fff', textDecoration: 'none', fontWeight: 800 }}>Запустить демо сделки</Link>
          <Link href="/platform-v7/investor" style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', textDecoration: 'none', fontWeight: 700 }}>Investor-режим</Link>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Сценарий показа</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {STEPS.map((step, index) => (
            <div key={step} style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{index + 1}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{step}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
