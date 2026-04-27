import Link from 'next/link';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const WARN = '#B45309';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';
const ERR = '#B91C1C';
const ERR_BG = 'rgba(220,38,38,0.08)';
const ERR_BORDER = 'rgba(220,38,38,0.18)';

type CheckStatus = 'ready' | 'partial' | 'missing';

interface CheckItem {
  label: string;
  status: CheckStatus;
  note: string;
}

interface CheckGroup {
  title: string;
  items: CheckItem[];
}

const CHECKLIST: CheckGroup[] = [
  {
    title: 'Платформа и продукт',
    items: [
      { label: 'Веб-приложение (production)', status: 'ready', note: 'https://pachanin-web.vercel.app/platform-v7/' },
      { label: 'API-сервис (production)', status: 'ready', note: 'OVDC API success' },
      { label: 'Release gate guards (блокировка несанкционированного выпуска)', status: 'ready', note: 'PRs #202–#208 смёржены' },
      { label: 'Audit view выпуска денег', status: 'ready', note: '/platform-v7/bank/release-safety — read-only' },
      { label: 'Командная палитра (навигация)', status: 'ready', note: 'sec-market-rfq, sec-release-safety' },
    ],
  },
  {
    title: 'Торговый контур',
    items: [
      { label: 'Market/RFQ — приём заявок и оферт', status: 'partial', note: 'sandbox · /platform-v7/market-rfq' },
      { label: 'Реестр сделок', status: 'ready', note: '/platform-v7/deals · controlled-pilot' },
      { label: 'Deal Workspace — вкладки и боковая панель', status: 'ready', note: 'PRs #213, #224' },
      { label: 'Управление спорами и удержаниями', status: 'partial', note: 'UI готов · ручной процесс' },
    ],
  },
  {
    title: 'Банк и деньги',
    items: [
      { label: 'Банковый контур (банк-контроль)', status: 'partial', note: 'sandbox · реальный банк не подключён' },
      { label: 'Резервирование и удержание средств', status: 'partial', note: 'controlled-pilot · нет live-банка' },
      { label: 'Финансирование покупателя', status: 'partial', note: 'sandbox · /platform-v7/buyer/financing' },
      { label: 'Live банковые платежи', status: 'missing', note: 'не заявлено · требует live-интеграции' },
    ],
  },
  {
    title: 'ФГИС / Документы',
    items: [
      { label: 'ФГИС «Зерно» — парсинг СДИЗов', status: 'partial', note: 'sandbox · live-коннектор отсутствует' },
      { label: 'ЭДО / ЭТРН', status: 'missing', note: 'не заявлено · требует live-интеграции' },
      { label: 'Документальный реестр сделки', status: 'partial', note: 'UI готов · ручная загрузка' },
    ],
  },
  {
    title: 'Логистика',
    items: [
      { label: 'GPS-трекинг транспорта', status: 'missing', note: 'sandbox · нет live carrier/GPS' },
      { label: 'Приёмка на элеваторе', status: 'partial', note: 'sandbox · ручное подтверждение' },
      { label: 'Логистическая цепочка (shipment gates)', status: 'partial', note: 'sandbox · PR #219' },
    ],
  },
  {
    title: 'Качество и лаборатория',
    items: [
      { label: 'Лабораторный протокол', status: 'partial', note: 'sandbox · нет live-лаборатории' },
      { label: 'Скоринг / кредитный риск', status: 'missing', note: 'не заявлено · требует live СПАРК / ФНС' },
    ],
  },
  {
    title: 'Открытые риски',
    items: [
      { label: 'Нет production БД — персистентность в памяти', status: 'missing', note: 'Требует migration plan' },
      { label: 'Нет live ФГИС, банка, GPS, ЭДО, скоринга', status: 'missing', note: 'Sandbox-only; real connectors needed' },
      { label: 'Нет KYC / onboarding live-процесса', status: 'partial', note: 'UI готов · без реального ЕСИА live' },
      { label: 'Нет immutable evidence archive', status: 'missing', note: 'Нет хэш-цепочки и внешнего хранилища' },
    ],
  },
];

function statusTone(s: CheckStatus) {
  if (s === 'ready') return { label: 'Готово', bg: BRAND_BG, border: BRAND_BORDER, color: BRAND };
  if (s === 'partial') return { label: 'Частично', bg: WARN_BG, border: WARN_BORDER, color: WARN };
  return { label: 'Отсутствует', bg: ERR_BG, border: ERR_BORDER, color: ERR };
}

export default function DataRoomPage() {
  const totalItems = CHECKLIST.flatMap((g) => g.items).length;
  const readyCount = CHECKLIST.flatMap((g) => g.items).filter((i) => i.status === 'ready').length;
  const partialCount = CHECKLIST.flatMap((g) => g.items).filter((i) => i.status === 'partial').length;
  const missingCount = CHECKLIST.flatMap((g) => g.items).filter((i) => i.status === 'missing').length;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data Room · controlled-pilot</div>
            <div style={{ marginTop: 6, fontSize: 26, lineHeight: 1.1, fontWeight: 900, color: T }}>Проверочный пакет для банка и инвестора</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 860 }}>
              Честная картина готовности платформы: что работает, что в sandbox, что отсутствует. Ни одна строка не завышает статус.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link href='/platform-v7/bank/release-safety' style={btn()}>Проверка выпуска</Link>
            <Link href='/platform-v7/bank' style={btn()}>Банк</Link>
            <Link href='/platform-v7/investor' style={btn()}>Инвестор</Link>
            <Link href='/platform-v7/market-rfq' style={btn()}>Market/RFQ</Link>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
        <Metric label='Всего позиций' value={String(totalItems)} tone='neutral' />
        <Metric label='Готово' value={String(readyCount)} tone='good' />
        <Metric label='Частично' value={String(partialCount)} tone='warn' />
        <Metric label='Отсутствует' value={String(missingCount)} tone='bad' />
      </div>

      <section style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Политика честности</div>
        <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.55 }}>
          Статус «Готово» означает только: функция работает на production в рамках controlled-pilot. Статус «Частично» — sandbox или ручной процесс. «Отсутствует» — интеграция не заявлена и не реализована.
        </div>
      </section>

      {CHECKLIST.map((group) => (
        <section key={group.title} style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: T, marginBottom: 12 }}>{group.title}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {group.items.map((item) => {
              const tone = statusTone(item.status);
              return (
                <div key={item.label} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T }}>{item.label}</div>
                    <div style={{ marginTop: 3, fontSize: 12, color: M }}>{item.note}</div>
                  </div>
                  <span style={{ flexShrink: 0, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>{tone.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const palette =
    tone === 'good' ? { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND } :
    tone === 'warn' ? { bg: WARN_BG, border: WARN_BORDER, color: WARN } :
    tone === 'bad' ? { bg: ERR_BG, border: ERR_BORDER, color: ERR } :
    { bg: S, border: B, color: T };
  return (
    <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: palette.color, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function btn() {
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 800 };
}
