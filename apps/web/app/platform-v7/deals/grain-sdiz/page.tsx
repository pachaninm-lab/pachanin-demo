import Link from 'next/link';
import { DEAL360_SCENARIOS } from '@/lib/platform-v7/deal360-source-of-truth';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

const SDIZ_DATA = Object.values(DEAL360_SCENARIOS).map((s) => ({
  dealId: s.dealId,
  lotId: s.lotId,
  sdizNumber: `СДИЗ-${s.dealId.replace('DL-', '')}`,
  fgisId: `ФГИС-${s.lotId.replace('LOT-', '24')}`,
  status: s.cockpit.docStatus.state === 'stop' ? 'НЕ ЗАКРЫТ' : 'ЗАКРЫТ',
  blocksMoney: s.cockpit.docStatus.state === 'stop',
  responsible: 'Продавец',
  closedAt: s.cockpit.docStatus.state !== 'stop' ? '09:21 сегодня' : null,
}));

export default function PlatformV7DealSdizPage() {
  const blocked = SDIZ_DATA.filter((d) => d.blocksMoney);

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Оператор · Сделки</p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>СДИЗ по сделкам</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Статус сопроводительных документов на зерно (СДИЗ) по всем активным сделкам. Незакрытый СДИЗ блокирует выплату.
            </p>
          </div>
          <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
            ← Сделки
          </Link>
        </div>
        {blocked.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.14)', fontSize: 13, color: red, fontWeight: 700 }}>
            {blocked.length} {blocked.length === 1 ? 'СДИЗ блокирует' : 'СДИЗ блокируют'} выплату
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Всего', value: String(SDIZ_DATA.length), color: text },
            { label: 'Закрыто', value: String(SDIZ_DATA.filter((d) => !d.blocksMoney).length), color: green },
            { label: 'Блокирует выплату', value: String(blocked.length), color: blocked.length > 0 ? red : green },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Статусы СДИЗ</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {SDIZ_DATA.map((d) => (
            <div key={d.dealId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 130px auto', gap: 12, border: `1px solid ${d.blocksMoney ? 'rgba(220,38,38,0.16)' : border}`, borderRadius: 14, padding: 14, background: d.blocksMoney ? 'rgba(220,38,38,0.03)' : '#F8FAFB', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: green }}>{d.dealId}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: text, marginTop: 2 }}>{d.sdizNumber}</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>{d.fgisId}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: muted }}>Ответственный: {d.responsible}</div>
                {d.closedAt && <div style={{ fontSize: 11, color: green, marginTop: 2 }}>Закрыт: {d.closedAt}</div>}
              </div>
              <div>
                <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 999, background: d.blocksMoney ? 'rgba(220,38,38,0.07)' : 'rgba(10,122,95,0.07)', border: `1px solid ${d.blocksMoney ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}`, color: d.blocksMoney ? red : green, fontSize: 11, fontWeight: 900 }}>
                  {d.status}
                </span>
                {d.blocksMoney && <div style={{ fontSize: 10, color: red, marginTop: 3, fontWeight: 700 }}>блокирует выплату</div>}
              </div>
              <Link href={`/platform-v7/deals/${d.dealId}/clean`} style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                Сделка →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/documents/grain' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Загрузить документы
        </Link>
        <Link href='/platform-v7/deals/grain-quality' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Качество по сделкам
        </Link>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Все сделки
        </Link>
      </div>
    </div>
  );
}
