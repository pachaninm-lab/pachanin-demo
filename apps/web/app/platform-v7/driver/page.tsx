import Link from 'next/link';
import { FieldDriverRuntime } from '@/components/v7r/FieldDriverRuntime';

const yandexRouteUrl = 'https://yandex.ru/maps/?rtext=52.721246%2C41.452238~52.632233%2C41.443594&rtt=auto';

const routeSteps = [
  ['1', 'Склад продавца', 'пройдено'],
  ['2', 'Погрузка', 'подтверждена'],
  ['3', 'В пути', '62% маршрута'],
  ['4', 'Элеватор ВРЖ-08', 'следующий пункт'],
] as const;

const routeDocs = [
  ['ЭТрН', 'СБИС / Saby ЭТрН', 'ждёт подписи грузополучателя', 'wait'],
  ['ГИС ЭПД', 'передача перевозочного документа', 'ожидает закрытия ЭТрН', 'wait'],
  ['Пломба', 'фото и номер пломбы', 'зафиксирована', 'ok'],
  ['Фото погрузки', 'журнал рейса', 'приложено', 'ok'],
] as const;

const driverSummary = [
  { label: 'Что сейчас', value: 'TRIP-SIM-001 · в пути · 62%', note: 'Водитель работает только с текущим рейсом и ближайшим действием.' },
  { label: 'Куда ехать', value: 'склад продавца → элеватор ВРЖ-08', note: 'Маршрут открыт в Яндекс.Картах, ETA — 14:28.' },
  { label: 'Что подтвердить', value: 'прибытие, пломба, фото, отклонение', note: 'Каждое полевое действие сохраняется в журнале рейса.' },
  { label: 'Документы рейса', value: 'ЭТрН ждёт подписи · ГИС ЭПД после ЭТрН', note: 'Водитель видит только транспортные документы своего рейса.' },
  { label: 'Что скрыто', value: 'деньги, ставки, банк, покупатель, кредит', note: 'Полевой кабинет не раскрывает коммерческие и банковские данные.' },
  { label: 'Если нет связи', value: 'действия сохраняются локально', note: 'Очередь событий уходит после восстановления сети.' },
] as const;

export default function DriverPage() {
  return (
    <main style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 760, margin: '0 auto', padding: '4px 0 18px' }}>
      <section style={card}>
        <div style={badge}>Рейс водителя</div>
        <h1 style={h1}>ТМБ-14 · склад продавца → элеватор ВРЖ-08</h1>
        <p style={lead}>Водитель видит только свой рейс, маршрут, транспортные документы и полевые действия. Деньги, ставки, банк, покупатель и кредит скрыты.</p>
        <div style={grid4}>
          <Info label='Рейс' value='TRIP-SIM-001' />
          <Info label='Контур' value='только перевозка' />
          <Info label='Статус' value='В пути · 62%' accent />
          <Info label='ETA' value='14:28' />
        </div>
      </section>

      <section style={darkCard}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ ...micro, color: '#A7F3D0' }}>полевой экран</div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(24px,6vw,34px)', lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950 }}>Что водитель должен понять за 5 секунд</h2>
          <p style={{ margin: 0, color: '#CBD5E1', fontSize: 14, lineHeight: 1.55 }}>Один рейс, один маршрут, одно следующее действие. Никаких ставок, денег, банка, покупателя и кредитных сценариев.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          {driverSummary.map((item) => <SummaryCard key={item.label} item={item} />)}
        </div>
      </section>

      <section style={card}>
        <div style={topRow}>
          <div>
            <div style={micro}>Яндекс.Карты</div>
            <h2 style={h2}>Маршрут рейса</h2>
            <p style={muted}>Склад продавца → Элеватор ВРЖ-08 · точка водителя показана в тестовом сценарии.</p>
          </div>
          <a href={yandexRouteUrl} target='_blank' rel='noreferrer' style={{ ...button, background: '#FFDD2D', borderColor: '#E8C600' }}>Открыть в Яндекс.Картах</a>
        </div>
        <div style={mapBox}>
          <div style={roadOne} />
          <div style={roadTwo} />
          <MapPoint left='12%' top='65%' label='Склад продавца' />
          <MapPoint left='76%' top='21%' label='Элеватор ВРЖ-08' dark />
          <div style={driverPoint}><span /></div>
          <div style={mapStatus}>62% пути · ETA 14:28</div>
        </div>
      </section>

      <section style={card}>
        <div style={micro}>Документы рейса</div>
        <div style={grid4}>
          {routeDocs.map(([title, source, status, state]) => <DocGate key={title} title={title} source={source} status={status} state={state} />)}
        </div>
        <div style={notice}>Следующее действие: довезти груз до элеватора и подтвердить прибытие. Подпись грузополучателя по ЭТрН закрывает транспортное условие для выплаты.</div>
      </section>

      <section style={card}>
        <div style={topRow}>
          <div>
            <div style={micro}>Маршрут</div>
            <h2 style={h2}>62% пути</h2>
          </div>
          <span style={darkPill}>в пути</span>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {routeSteps.map(([number, title, state], index) => (
            <div key={title} style={stepRow}>
              <span style={{ ...stepNo, background: index < 3 ? '#0A7A5F' : '#CBD5E1' }}>{number}</span>
              <span><strong style={stepTitle}>{title}</strong><br /><span style={mutedSmall}>{state}</span></span>
            </div>
          ))}
        </div>
      </section>

      <FieldDriverRuntime compact />

      <section style={card}>
        <div style={micro}>Связанные действия</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/elevator' style={button}>Приёмка</Link>
          <Link href='/platform-v7/logistics/inbox' style={button}>Заявка логистики</Link>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ item }: { item: typeof driverSummary[number] }) {
  return <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18, padding: 13, display: 'grid', gap: 7 }}><div style={{ ...micro, color: '#A7F3D0' }}>{item.label}</div><strong style={{ color: '#fff', fontSize: 14, lineHeight: 1.4 }}>{item.value}</strong><p style={{ margin: 0, color: '#CBD5E1', fontSize: 12, lineHeight: 1.45 }}>{item.note}</p></div>;
}

function Info({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div style={{ ...smallCard, background: accent ? 'rgba(10,122,95,0.08)' : '#F8FAFB', borderColor: accent ? 'rgba(10,122,95,0.18)' : '#E4E6EA' }}><div style={micro}>{label}</div><strong style={{ color: accent ? '#0A7A5F' : '#0F1419', fontSize: 15 }}>{value}</strong></div>;
}

function DocGate({ title, source, status, state }: { title: string; source: string; status: string; state: 'ok' | 'wait' }) {
  const wait = state === 'wait';
  return <div style={{ ...smallCard, background: wait ? 'rgba(217,119,6,0.08)' : 'rgba(10,122,95,0.06)', borderColor: wait ? 'rgba(217,119,6,0.18)' : 'rgba(10,122,95,0.18)' }}><div style={{ ...micro, color: wait ? '#B45309' : '#0A7A5F' }}>{title}</div><strong style={{ color: '#0F1419', fontSize: 13 }}>{status}</strong><span style={mutedSmall}>{source}</span></div>;
}

function MapPoint({ left, top, label, dark = false }: { left: string; top: string; label: string; dark?: boolean }) {
  return <div style={{ position: 'absolute', left, top, display: 'grid', gap: 5 }}><span style={{ width: 18, height: 18, borderRadius: 999, background: dark ? '#0F172A' : '#0A7A5F', border: '4px solid #fff', boxShadow: '0 6px 16px rgba(15,20,25,0.24)' }} /><span style={mapLabel}>{label}</span></div>;
}

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 14, boxShadow: '0 12px 28px rgba(15,20,25,0.04)' } as const;
const darkCard = { background: '#0F172A', color: '#fff', borderRadius: 24, padding: 18, display: 'grid', gap: 13, boxShadow: '0 18px 44px rgba(15,23,42,0.18)' } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px, 8vw, 44px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '5px 0 0', color: '#0F1419', fontSize: 26, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.5 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13, lineHeight: 1.45 } as const;
const mutedSmall = { color: '#64748B', fontSize: 12, lineHeight: 1.35 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const grid4 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 } as const;
const topRow = { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' } as const;
const smallCard = { border: '1px solid #E4E6EA', borderRadius: 16, padding: 12, display: 'grid', gap: 5, minWidth: 0 } as const;
const button = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const darkPill = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '8px 12px', background: '#0F1419', color: '#fff', fontSize: 13, fontWeight: 900 } as const;
const mapBox = { position: 'relative', minHeight: 330, borderRadius: 20, overflow: 'hidden', border: '1px solid #DDE5EC', background: 'linear-gradient(135deg,#DDEFD9 0%,#EAF7F1 45%,#D9EAF8 100%)' } as const;
const roadOne = { position: 'absolute', left: '-8%', top: '54%', width: '116%', height: 18, borderRadius: 999, background: '#fff', transform: 'rotate(-11deg)', boxShadow: '0 0 0 1px rgba(148,163,184,0.45)' } as const;
const roadTwo = { position: 'absolute', left: '9%', top: '26%', width: '82%', height: 14, borderRadius: 999, background: '#fff', transform: 'rotate(17deg)', boxShadow: '0 0 0 1px rgba(148,163,184,0.36)' } as const;
const driverPoint = { position: 'absolute', left: '58%', top: '45%', transform: 'translate(-50%,-50%)', width: 64, height: 64, borderRadius: 999, background: 'rgba(10,122,95,0.16)', border: '1px solid rgba(10,122,95,0.22)', display: 'grid', placeItems: 'center' } as const;
const mapStatus = { position: 'absolute', left: 12, bottom: 12, borderRadius: 999, padding: '8px 11px', background: 'rgba(15,20,25,0.88)', color: '#fff', fontSize: 13, fontWeight: 900 } as const;
const mapLabel = { display: 'inline-flex', width: 'fit-content', borderRadius: 999, padding: '6px 9px', background: 'rgba(255,255,255,0.92)', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 12, fontWeight: 850 } as const;
const notice = { background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', color: '#B45309', borderRadius: 14, padding: 12, fontSize: 13, fontWeight: 900, lineHeight: 1.4 } as const;
const stepRow = { display: 'grid', gridTemplateColumns: '34px minmax(0,1fr)', gap: 10, alignItems: 'center', background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 16, padding: 12 } as const;
const stepNo = { width: 30, height: 30, borderRadius: 999, display: 'inline-grid', placeItems: 'center', color: '#fff', fontSize: 14, fontWeight: 950 } as const;
const stepTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.2 } as const;
