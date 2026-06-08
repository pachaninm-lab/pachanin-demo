import Link from 'next/link';
import { lots } from '@/lib/v7r/esia-fgis-data';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

const stateStyle = {
  PASS: { label: 'ГОТОВА К ПРОДАЖЕ', color: green, bg: 'rgba(10,122,95,0.07)', borderColor: 'rgba(10,122,95,0.18)' },
  REVIEW: { label: 'НА ПРОВЕРКЕ', color: amber, bg: 'rgba(217,119,6,0.07)', borderColor: 'rgba(217,119,6,0.18)' },
  FAIL: { label: 'ТРЕБУЕТ ДОКУМЕНТОВ', color: red, bg: 'rgba(220,38,38,0.07)', borderColor: 'rgba(220,38,38,0.18)' },
};

export default function PlatformV7BatchByIdPage({ params }: { params: { batchId: string } }) {
  const { batchId } = params;
  const lot = lots.find((l) => l.id === batchId) ?? lots[0];
  if (!lot) {
    return (
      <div style={{ padding: 24, color: muted }}>
        Партия {batchId} не найдена. <Link href='/platform-v7/seller/batches' style={{ color: green }}>← К партиям</Link>
      </div>
    );
  }

  const ss = stateStyle[lot.readiness.state];
  const isReady = lot.readiness.state === 'PASS';

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Продавец · Партия
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>{lot.grain}</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: muted }}>
              {lot.id} · {lot.volumeTons} т · {lot.sourceType === 'FGIS' ? 'ФГИС' : 'Ручная запись'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <span style={{ padding: '7px 12px', borderRadius: 10, background: ss.bg, border: `1px solid ${ss.borderColor}`, color: ss.color, fontSize: 12, fontWeight: 900 }}>
              {ss.label}
            </span>
            <Link href='/platform-v7/seller/batches' style={{ textDecoration: 'none', padding: '7px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
              ← Партии
            </Link>
          </div>
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Параметры партии</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {[
            { label: 'Культура', value: lot.grain },
            { label: 'Объём', value: `${lot.volumeTons} т` },
            { label: 'Источник', value: lot.sourceType === 'FGIS' ? 'ФГИС Зерно' : 'Ручная запись' },
            { label: 'Ссылка', value: lot.sourceReference ?? '—' },
          ].map((item) => (
            <div key={item.label} style={{ padding: '10px 14px', borderRadius: 12, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: text, marginTop: 4 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      {!isReady && (
        <section style={{ border: `1px solid rgba(217,119,6,0.18)`, borderRadius: 18, padding: 18, background: 'rgba(217,119,6,0.03)', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: amber }}>Требуется для выхода на рынок</div>
          {lot.readiness.blockers.map((b, i) => (
            <div key={i} style={{ fontSize: 13, color: amber, display: 'flex', gap: 8 }}>
              <span>→</span>
              <span>{b.title}</span>
            </div>
          ))}
          {lot.readiness.nextStep && (
            <div style={{ fontSize: 13, color: text, marginTop: 4 }}>
              <strong>Следующий шаг:</strong> {lot.readiness.nextStep}
            </div>
          )}
        </section>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {isReady ? (
          <Link href='/platform-v7/seller/lots/new' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, color: '#fff', fontSize: 13, fontWeight: 800 }}>
            Создать лот на продажу
          </Link>
        ) : (
          <Link href='/platform-v7/documents/grain' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: amber, color: '#fff', fontSize: 13, fontWeight: 800 }}>
            Загрузить документы
          </Link>
        )}
        <Link href='/platform-v7/seller/batches' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Все партии
        </Link>
      </div>
    </div>
  );
}
