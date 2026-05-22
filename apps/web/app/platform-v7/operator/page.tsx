import Link from 'next/link';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';
import { OperatorExecutionQueue } from '../../../components/platform-v7/OperatorExecutionQueue';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputes, disputeTotalHeldRub, openDisputeCount } from '@/lib/disputes-server';
import { getShipments, activeShipmentCount, shipmentsWithBlockers } from '@/lib/logistics-server';
import { getOutboxStatus } from '@/lib/outbox-server';

const deal9106 = getDeal360Scenario('DL-9106');
const deal9102 = getDeal360Scenario('DL-9102');

const STATIC_BLOCKERS = [
  { deal: 'DL-9106', lot: 'LOT-2403', reason: 'СДИЗ не подтверждён', source: 'ФГИС «Зерно»', amount: '9,65 млн ₽', owner: 'продавец', next: 'отправить СДИЗ и дождаться подтверждения', href: '/platform-v7/deals/DL-9106/clean', severity: 'stop' as const },
  { deal: 'DL-9106', lot: 'LOT-2403', reason: 'ЭТрН ждёт подписи грузополучателя', source: 'СБИС / Saby ЭТрН', amount: '9,65 млн ₽', owner: 'грузополучатель', next: 'закрыть подпись ЭТрН и передачу в ГИС ЭПД', href: '/platform-v7/logistics', severity: 'stop' as const },
  { deal: 'DL-9106', lot: 'LOT-2403', reason: 'Протокол качества ожидается', source: 'ФГБУ ЦОК АПК', amount: '9,65 млн ₽', owner: 'лаборатория', next: 'получить протокол качества', href: '/platform-v7/elevator', severity: 'wait' as const },
  { deal: 'DL-9102', lot: 'LOT-2402', reason: 'Отклонение веса', source: 'приёмка', amount: '624 тыс. ₽', owner: 'оператор', next: deal9102.nextAction, href: '/platform-v7/deals/DL-9102/clean', severity: 'stop' as const },
];

const quickLinks = [
  { title: 'Проверка выплаты', href: '/platform-v7/bank/release-safety', note: 'условия выпуска денег' },
  { title: 'Документы', href: '/platform-v7/documents', note: 'УПД, ЭТрН, СДИЗ, акт, протокол' },
  { title: 'Логистика', href: '/platform-v7/logistics', note: 'водители, ЭТрН, ГИС ЭПД' },
  { title: 'Приёмка', href: '/platform-v7/elevator', note: 'вес, качество, акт' },
  { title: 'Споры', href: '/platform-v7/disputes', note: 'удержания и доказательства' },
] as const;

function formatMoney(rub: number): string {
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  if (rub >= 1_000) return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
  return `${rub} ₽`;
}

export default async function PlatformV7OperatorPage() {
  const [deals, disputes, shipments, outbox] = await Promise.all([
    getDealsCanonical(),
    getDisputes(),
    getShipments(),
    getOutboxStatus(),
  ]);

  const apiOnline = outbox.isApiAvailable;
  const blockers = STATIC_BLOCKERS;
  const stopCount = blockers.filter((item) => item.severity === 'stop').length;

  const heldRub = disputeTotalHeldRub(disputes);
  const disputeCount = openDisputeCount(disputes);
  const shipmentCount = activeShipmentCount(shipments);
  const blockedShipments = shipmentsWithBlockers(shipments);

  const liveBlockers = [
    ...disputes
      .filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW')
      .map((d) => ({
        id: d.id,
        label: `Спор ${d.id}: ${d.description.slice(0, 60)}`,
        severity: 'stop' as const,
        responsibleRole: 'SUPPORT_MANAGER',
        nextAction: d.status === 'OPEN' ? 'Взять в работу (triage)' : 'Продолжить расследование',
      })),
    ...blockedShipments.map((s) => ({
      id: s.id,
      label: `Рейс ${s.id}: ${(s.blockers ?? [])[0] ?? 'блокер'}`,
      severity: 'warn' as const,
      responsibleRole: 'LOGISTICIAN',
      nextAction: s.nextAction ?? 'Устранить блокер рейса',
    })),
    ...(outbox.totalPending > 0
      ? [{ id: 'bank-ops', label: `${outbox.totalPending} банковских операций в ожидании`, severity: 'warn' as const, responsibleRole: 'ACCOUNTING', nextAction: 'Проверить статус в bank-workspace' }]
      : []),
    ...(outbox.hasManualReview
      ? [{ id: 'manual-review', label: 'Есть операции требующие ручной проверки', severity: 'stop' as const, responsibleRole: 'OPERATOR', nextAction: 'Открыть outbox ручной проверки' }]
      : []),
  ];

  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <LiveApiStatusBar
        apiOnline={apiOnline}
        blockers={liveBlockers}
        pendingBankOps={outbox.totalPending}
        openDisputes={disputeCount}
        activeShipments={shipmentCount}
        role="SUPPORT_MANAGER · Центр управления"
        summary={
          apiOnline
            ? `${deals.length} сделок · ${disputeCount} открытых споров · ${formatMoney(heldRub)} удержано · ${shipmentCount} активных рейсов`
            : 'Данные статичные — API недоступен'
        }
      />

      <QuietIntelligenceHint
        problem={`${stopCount} стоп-блокера держат 15,89 млн ₽ — СДИЗ, ЭТрН и отклонение веса.`}
        action='Устранить блокеры по очереди: СДИЗ → ЭТрН → акт расхождения.'
        outcome='После закрытия всех блокеров деньги продолжат движение к выплате.'
      />
      <section style={hero}>
        <div style={badge}>Центр управления оператора</div>
        <h1 style={h1}>Блокеры, деньги и следующий ответственный</h1>
        <p style={lead}>Оператор видит не технические интеграции, а сделки, которые остановили деньги: причина, источник, сумма влияния, ответственный и следующее действие.</p>
        <div style={actions}>
          <Link href={`/platform-v7/deals/${deal9106.dealId}/clean`} style={primaryBtn}>Открыть сделку</Link>
          <Link href='/platform-v7/documents' style={ghostBtn}>Матрица документов</Link>
        </div>
      </section>

      <section style={metricsGrid}>
        <Metric label='Сделок под контролем' value={apiOnline ? String(deals.length) : '2'} />
        <Metric label='Стоп-блокеров' value={String(apiOnline ? liveBlockers.filter((b) => b.severity === 'stop').length : stopCount)} danger />
        <Metric label='Удержано по спорам' value={apiOnline ? formatMoney(heldRub) : '15,89 млн ₽'} danger={heldRub > 0} />
        <Metric label='Банк-операций в очереди' value={apiOnline ? String(outbox.totalPending) : '—'} danger={outbox.totalPending > 0} />
      </section>

      <section style={card}>
        <div style={micro}>Очередь блокеров</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {blockers.map((item) => <BlockerRow key={`${item.deal}-${item.reason}`} item={item} />)}
        </div>
      </section>

      <CauseLine
        cause={{ text: 'СДИЗ не подтверждён ФГИС «Зерно»', tone: 'blocked' }}
        relation='blocks'
        effect={{ text: 'Движение денег остановлено', tone: 'blocked' }}
        moneyAmount='9,65 млн ₽'
        moneyTone='hold'
      />
      <CauseLine
        cause={{ text: 'Отклонение веса · акт расхождения не закрыт', tone: 'blocked' }}
        relation='blocks'
        effect={{ text: 'Удержание не снимается', tone: 'blocked' }}
        moneyAmount='624 тыс. ₽'
        moneyTone='hold'
      />

      <SmartSectionSummary
        label='Сводка по блокерам'
        items={[
          { text: 'DL-9106 · 3 стоп-блокера · СДИЗ, ЭТрН, протокол качества · 9,65 млн ₽ заблокировано', tone: 'block' },
          { text: 'DL-9102 · Удержание 624 тыс. ₽ · Акт расхождения не подписан', tone: 'block' },
        ]}
      />
      <TrustDot state='test' size='sm' label='Тестовый контур · Реальные интеграции требуют договоров' />

      <OperatorExecutionQueue />

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

function BlockerRow({ item }: { item: typeof STATIC_BLOCKERS[number] }) {
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
