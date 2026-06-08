import Link from 'next/link';
import { DEAL360_SCENARIOS } from '@/lib/platform-v7/deal360-source-of-truth';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const blue = '#2563EB';

const scenarios = Object.values(DEAL360_SCENARIOS);

const FLOW_STEPS = [
  { step: 1, role: 'Продавец', action: 'Создаёт лот на основе ФГИС-партии', status: 'done', href: '/platform-v7/seller/lots/new' },
  { step: 2, role: 'Покупатель', action: 'Подаёт закупочный запрос (RFQ)', status: 'done', href: '/platform-v7/buyer/rfq/new' },
  { step: 3, role: 'Платформа', action: 'Матчинг: культура, объём, регион, риск', status: 'done', href: '/platform-v7/buyer/matches' },
  { step: 4, role: 'Покупатель', action: 'Подтверждает условия, банк резервирует средства', status: 'done', href: '/platform-v7/buyer/offers' },
  { step: 5, role: 'Продавец', action: 'Принимает оффер, создаёт рейс', status: 'active', href: '/platform-v7/seller/deals' },
  { step: 6, role: 'Водитель', action: 'Рейс по ЭТрН — элеватор принимает груз', status: 'pending', href: '/platform-v7/elevator/terminal' },
  { step: 7, role: 'Лаборатория', action: 'Протокол качества и акт приёмки', status: 'pending', href: '/platform-v7/deals/grain-quality' },
  { step: 8, role: 'Банк', action: 'Проверяет документы и выпускает деньги', status: 'pending', href: '/platform-v7/bank' },
];

const stepStyle = {
  done: { color: green, bg: 'rgba(10,122,95,0.07)', borderColor: 'rgba(10,122,95,0.18)', label: '✓' },
  active: { color: amber, bg: 'rgba(217,119,6,0.07)', borderColor: 'rgba(217,119,6,0.18)', label: '→' },
  pending: { color: muted, bg: 'rgba(107,114,128,0.07)', borderColor: 'rgba(107,114,128,0.18)', label: '○' },
};

export default function PlatformV7GrainExecutionDemoPage() {
  const activeDeal = scenarios[0];

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Оператор · Контур исполнения</p>
          <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>Исполнение зерновой сделки</h1>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
            Полный цикл: от партии до выплаты. Каждый этап верифицирован, документы связаны, деньги под контролем.
          </p>
        </div>
        {activeDeal && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(10,122,95,0.05)', border: '1px solid rgba(10,122,95,0.14)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: green, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Активная сделка</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 3 }}>{activeDeal.dealId} · {activeDeal.cockpit.currentStage}</div>
            </div>
            <Link href={`/platform-v7/deals/${activeDeal.dealId}/clean`} style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: green, color: '#fff', fontSize: 12, fontWeight: 800 }}>
              Открыть сделку
            </Link>
          </div>
        )}
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Этапы исполнения</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {FLOW_STEPS.map((step) => {
            const ss = stepStyle[step.status as keyof typeof stepStyle];
            return (
              <Link key={step.step} href={step.href} style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '32px minmax(0,1fr) 100px', gap: 12, border: `1px solid ${step.status === 'active' ? ss.borderColor : border}`, borderRadius: 14, padding: 14, background: step.status === 'active' ? ss.bg : '#F8FAFB', alignItems: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: ss.bg, border: `1px solid ${ss.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: ss.color, flexShrink: 0 }}>
                  {ss.label}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: ss.color, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{step.role}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 2 }}>{step.action}</div>
                </div>
                <div style={{ fontSize: 11, color: blue, fontWeight: 700, textAlign: 'right' }}>→</div>
              </Link>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Все сделки
        </Link>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Центр управления
        </Link>
        <Link href='/platform-v7' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Главная
        </Link>
      </div>
    </div>
  );
}
