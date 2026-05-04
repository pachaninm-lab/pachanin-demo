import Link from 'next/link';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';

const deal9106 = getDeal360Scenario('DL-9106');
const deal9102 = getDeal360Scenario('DL-9102');

const blockers = [
  { deal: 'DL-9106', lot: 'LOT-2403', reason: 'СДИЗ не подтверждён', source: 'ФГИС «Зерно»', amount: '9,65 млн ₽', owner: 'продавец', next: 'отправить СДИЗ и дождаться подтверждения', href: '/platform-v7/deals/DL-9106/clean', severity: 'stop' },
  { deal: 'DL-9106', lot: 'LOT-2403', reason: 'ЭТрН ждёт подписи грузополучателя', source: 'СБИС / Saby ЭТрН', amount: '9,65 млн ₽', owner: 'грузополучатель', next: 'закрыть подпись ЭТрН и передачу в ГИС ЭПД', href: '/platform-v7/logistics', severity: 'stop' },
  { deal: 'DL-9106', lot: 'LOT-2403', reason: 'Протокол качества ожидается', source: 'ФГБУ ЦОК АПК', amount: '9,65 млн ₽', owner: 'лаборатория', next: 'получить протокол качества', href: '/platform-v7/elevator', severity: 'wait' },
  { deal: 'DL-9102', lot: 'LOT-2402', reason: 'Отклонение веса', source: 'приёмка', amount: '624 тыс. ₽', owner: 'оператор', next: deal9102.nextAction, href: '/platform-v7/deals/DL-9102/clean', severity: 'stop' },
] as const;

const quickLinks = [
  { title: 'Проверка выплаты', href: '/platform-v7/bank/release-safety', note: 'условия выпуска денег' },
  { title: 'Документы', href: '/platform-v7/documents', note: 'УПД, ЭТрН, СДИЗ, акт, протокол' },
  { title: 'Логистика', href: '/platform-v7/logistics', note: 'водители, ЭТрН, ГИС ЭПД' },
  { title: 'Приёмка', href: '/platform-v7/elevator', note: 'вес, качество, акт' },
  { title: 'Споры', href: '/platform-v7/disputes', note: 'удержания и доказательства' },
] as const;

export default function PlatformV7OperatorAliasPage() {
  const stopCount = blockers.filter((item) => item.severity === 'stop').length;

  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={hero}>
        <div style={badge}>Центр управления оператора</div>
        <h1 style={h1}>Блокеры, деньги и следующий ответственный</h1>
        <p style={lead}>Оператор видит не технические интеграции, а сделки, которые остановили деньги: причина, источник, сумма влияния, ответственный и следующее действие.</p>
        <div style={actions}>
          <Link href={`/platform-v7/deals/${deal9106.dealId}/clean`} style={primaryBtn}>Открыть Deal 360</Link>
          <Link href='/platform-v7/documents' style={ghostBtn}>Матрица документов</Link>
        </div>
      </section>

      <section style={metricsGrid}>
        <Metric label='Сделок под контролем' value='2' />
        <Metric label='Стоп-блокеров' value={String(stopCount)} danger />
        <Metric label='Деньги под влиянием' value='15,89 млн ₽' danger />
        <Metric label='К выплате сейчас' value='0 ₽' danger />
      </section>

      <section style={card}>
        <div style={micro}>Очередь блокеров</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {blockers.map((item) => <BlockerRow key={`${item.deal}-${item.reason}`} item={item} />)}
        </div>
      </section>

      <section style={card}>
        <div style={micro}>Сквозные действия</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} style={quickLink}>
              <strong style={{ color: '#0F1419', fontSize: 15 }}>{link.title}</strong>
              <span style={{ color: '#64748B', fontSize: 12, lineHeight: 1.35 }}>{link.note}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function BlockerRow({ item }: { item: typeof blockers[number] }) {
  const stop = item.severity === 'stop';
  return (
    <Link href={item.href} style={{ textDecoration: 'none', color: 'inherit', background: stop ? 'rgba(220,38,38,0.06)' : 'rgba(217,119,6,0.06)', border: `1px solid ${stop ? 'rgba(220,38,38,0.18)' : 'rgba(217,119,6,0.18)'}`, borderRadius: 18, padding: 14, display: 'grid', gap: 10 }}>
      <div style={rowHead}>
        <div>
          <div style={idText}>{item.deal} · {item.lot}</div>
          <h2 style={h2}>{item.reason}</h2>
          <p style={muted}>{item.source}</p>
        </div>
        <span style={{ ...pill, color: stop ? '#B91C1C' : '#B45309', borderColor: stop ? 'rgba(220,38,38,0.18)' : 'rgba(217,119,6,0.18)', background: '#fff' }}>{stop ? 'останавливает деньги' : 'ждёт подтверждения'}</span>
      </div>
      <div style={grid2}>
        <Cell label='Сумма влияния' value={item.amount} danger={stop} />
        <Cell label='Ответственный' value={item.owner} />
        <Cell label='Источник' value={item.source} />
        <Cell label='Следующее действие' value={item.next} strong />
      </div>
    </Link>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={metric}><div style={micro}>{label}</div><div style={{ marginTop: 8, color: danger ? '#B91C1C' : '#0F1419', fontSize: 28, lineHeight: 1, fontWeight: 950 }}>{value}</div></div>;
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.25, fontWeight: 900 }}>{value}</div></div>;
}

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 62%,#EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 12 } as const;
const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const metric = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 20, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const idText = { color: '#0A7A5F', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, minWidth: 0 } as const;
const pill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, border: '1px solid #E4E6EA', fontSize: 12, fontWeight: 900 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const quickLink = { textDecoration: 'none', background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 6 } as const;
