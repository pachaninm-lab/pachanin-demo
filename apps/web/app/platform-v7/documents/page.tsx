import type { Metadata } from 'next';
import Link from 'next/link';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';

export const metadata: Metadata = {
  title: 'Документы',
  description: 'Документный слой сделки: документы, подписи, споры и влияние на выпуск денег.',
};

const scenario = getDeal360Scenario('DL-9106');

const controlCards = [
  { label: 'Сделка', value: scenario.dealId, href: `/platform-v7/deals/${scenario.dealId}/clean` },
  { label: 'Лот', value: scenario.lotId, href: `/platform-v7/lots/${scenario.lotId}` },
  { label: 'ЭТрН', value: 'ждёт подписи', href: `/platform-v7/deals/${scenario.dealId}/clean` },
  { label: 'Выплата', value: 'остановлена', href: '/platform-v7/bank/release-safety' },
] as const;

const documentSummary = [
  { label: 'Что сейчас', value: 'DL-9106 · неполный пакет', note: 'Документы показаны как условия выплаты, а не как архив файлов.' },
  { label: 'Что блокирует', value: 'СДИЗ, ЭТрН, УПД, акт, качество', note: 'Без полного пакета выпуск денег продавцу закрыт.' },
  { label: 'Источник', value: 'ФГИС · ЭДО · ГИС ЭПД · КЭП · лаборатория', note: 'Внутренняя карточка не подменяет внешний контур.' },
  { label: 'Ответственный', value: 'продавец · логист · элеватор · подписант · оператор', note: 'У каждого документа должен быть владелец шага.' },
  { label: 'Деньги', value: 'к выплате 0 ₽', note: 'Влияние документа на деньги видно в каждой строке.' },
  { label: 'Следующий шаг', value: 'закрыть СДИЗ и транспортный пакет', note: 'Действие должно попасть в Deal 360 и журнал.' },
] as const;

const requiredDocuments = [
  { title: 'СДИЗ', source: 'ФГИС «Зерно»', responsible: 'продавец + оператор', status: 'не оформлен', impact: 'останавливает финальный выпуск денег' },
  { title: 'ЭТрН', source: 'СБИС / Saby ЭТрН', responsible: 'логист + перевозчик', status: 'ждёт подписи', impact: 'останавливает закрытие рейса' },
  { title: 'ГИС ЭПД', source: 'государственный контур ЭПД', responsible: 'логист + перевозчик', status: 'ожидает ЭТрН', impact: 'останавливает транспортное основание' },
  { title: 'УПД', source: 'Контур.Диадок', responsible: 'продавец + покупатель', status: 'не запущен', impact: 'останавливает расчётное закрытие' },
  { title: 'КЭП / МЧД', source: 'КриптоПро DSS', responsible: 'уполномоченный подписант', status: 'не подписано', impact: 'останавливает юридически значимое подписание' },
  { title: 'Акт приёмки', source: 'элеватор / точка приёмки', responsible: 'элеватор', status: 'готовится', impact: 'подтверждает факт исполнения и вес' },
  { title: 'Акт расхождения', source: 'элеватор + стороны сделки', responsible: 'элеватор + оператор', status: 'требуется', impact: 'создаёт удержание до согласования' },
  { title: 'Протокол качества', source: 'ФГБУ ЦОК АПК / лаборатория', responsible: 'лаборатория', status: 'ожидается', impact: 'меняет расчётную базу и может открыть спор' },
] as const;

const history = [
  { id: 'DL-9102', status: 'спор по весу', href: '/platform-v7/deals/DL-9102/clean' },
  { id: 'DL-9106', status: 'неполный пакет', href: '/platform-v7/deals/DL-9106/clean' },
] as const;

function badgeTone(state: string, blocks = false) {
  if (blocks || state.includes('не') || state.includes('ждёт') || state.includes('ожида') || state.includes('треб')) return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  if (state.includes('готов') || state.includes('подписан')) return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
}

export default function PlatformV7DocumentsPage() {
  return (
    <main style={{ display: 'grid', gap: 14, maxWidth: 1120, margin: '0 auto' }}>
      <section style={hero}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 9, maxWidth: 760 }}>
            <div style={badge}>Документы как условие выплаты</div>
            <h1 style={h1}>Матрица документов сделки</h1>
            <p style={lead}>Документы показаны не как архив файлов, а как условия сделки: кто должен закрыть документ, какой источник используется и блокирует ли документ выплату продавцу.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/platform-v7/deals/${scenario.dealId}/clean`} style={primary}>Открыть Deal 360</Link>
            <Link href='/platform-v7/bank/release-safety' style={secondary}>Проверка выплаты</Link>
          </div>
        </div>

        <div style={cardsGrid}>
          {controlCards.map((item) => (
            <Link key={item.label} href={item.href} style={controlCard}>
              <span style={micro}>{item.label}</span>
              <strong style={{ color: '#0F1419', fontSize: 15 }}>{item.value}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section style={darkCard}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ ...micro, color: '#A7F3D0' }}>документный контроль</div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(24px,6vw,36px)', lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950 }}>Что должно быть понятно за 5 секунд</h2>
          <p style={{ margin: 0, color: '#D1FAE5', fontSize: 14, lineHeight: 1.55 }}>Документ — это не вложение. Это источник, ответственный, статус и прямое влияние на деньги.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          {documentSummary.map((item) => <SummaryCard key={item.label} item={item} />)}
        </div>
      </section>

      <section style={card}>
        <div style={micro}>DL-9106 · документы, источники и влияние на деньги</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {requiredDocuments.map((doc) => {
            const tone = badgeTone(doc.status, true);
            return (
              <article key={`${doc.title}-${doc.source}`} style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.16)', borderRadius: 16, padding: 13, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={h2}>{doc.title}</h2>
                    <p style={muted}>{doc.source} · ответственный: {doc.responsible}</p>
                  </div>
                  <span style={{ ...pill, background: tone.bg, borderColor: tone.border, color: tone.color }}>{doc.status}</span>
                </div>
                <div style={rowGrid}>
                  <Cell label='Источник' value={doc.source} />
                  <Cell label='Ответственный' value={doc.responsible} />
                  <Cell label='Статус' value={doc.status} danger />
                  <Cell label='Влияние на деньги' value={doc.impact} danger />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section style={card}>
        <div style={micro}>Именные контуры документов</div>
        <div style={cardsGrid}>
          <ProviderCard title='ФГИС «Зерно»' text='СДИЗ партии зерна и статус прослеживаемости.' />
          <ProviderCard title='СБИС / Saby ЭТрН' text='Электронная транспортная накладная и подписи по перевозке.' />
          <ProviderCard title='ГИС ЭПД' text='Государственный контур электронных перевозочных документов.' />
          <ProviderCard title='Контур.Диадок' text='Договор, УПД, акт, подписи сторон.' />
          <ProviderCard title='КриптоПро DSS' text='КЭП, сертификат и полномочия подписанта.' />
          <ProviderCard title='ФГБУ ЦОК АПК' text='Протокол качества и основание для приёмки.' />
        </div>
      </section>

      <section style={card}>
        <div style={micro}>Связанные сделки</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {history.map((item) => (
            <Link key={item.id} href={item.href} style={historyRow}>
              <strong style={{ color: '#0F1419' }}>{item.id}</strong>
              <span style={{ color: '#64748B', fontSize: 13 }}>{item.status}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ item }: { item: typeof documentSummary[number] }) {
  return <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18, padding: 13, display: 'grid', gap: 7 }}><div style={{ ...micro, color: '#A7F3D0' }}>{item.label}</div><strong style={{ color: '#fff', fontSize: 14, lineHeight: 1.4 }}>{item.value}</strong><p style={{ margin: 0, color: '#D1FAE5', fontSize: 12, lineHeight: 1.45 }}>{item.note}</p></div>;
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, fontWeight: 900, lineHeight: 1.25 }}>{value}</div></div>;
}

function ProviderCard({ title, text }: { title: string; text: string }) {
  return <div style={controlCard}><strong style={{ color: '#0F1419', fontSize: 15 }}>{title}</strong><span style={{ color: '#64748B', fontSize: 12, lineHeight: 1.35 }}>{text}</span><span style={{ ...pill, background: 'rgba(217,119,6,0.08)', borderColor: 'rgba(217,119,6,0.18)', color: '#B45309' }}>controlled-pilot</span></div>;
}

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 62%,#EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 16 } as const;
const darkCard = { background: '#064E3B', color: '#fff', borderRadius: 24, padding: 18, display: 'grid', gap: 13, boxShadow: '0 18px 44px rgba(6,78,59,0.16)' } as const;
const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, fontSize: 'clamp(30px, 4.8vw, 52px)', lineHeight: 1.04, letterSpacing: '-0.045em', color: '#0F1419', fontWeight: 950 } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 18, lineHeight: 1.1, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.65 } as const;
const muted = { margin: '5px 0 0', color: '#64748B', fontSize: 13 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const primary = { textDecoration: 'none', padding: '10px 14px', minHeight: 44, display: 'inline-flex', alignItems: 'center', borderRadius: 12, background: '#0F172A', border: '1px solid #0F172A', color: '#fff', fontSize: 13, fontWeight: 850 } as const;
const secondary = { ...primary, background: '#fff', color: '#0F1419', border: '1px solid #E4E6EA' } as const;
const cardsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 } as const;
const rowGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 } as const;
const controlCard = { textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 7 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, minWidth: 0 } as const;
const pill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '5px 9px', borderRadius: 999, border: '1px solid #E4E6EA', fontSize: 11, fontWeight: 900 } as const;
const historyRow = { textDecoration: 'none', color: 'inherit', background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 14, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
