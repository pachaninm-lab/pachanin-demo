import Link from 'next/link';
import { ratingAdmission } from '@/lib/platform-v7/reputation';
import { DEAL360_SCENARIOS } from '@/lib/platform-v7/deal360-source-of-truth';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

interface BuyerProfile {
  id: string;
  alias: string;
  region: string;
  totalScore: number;
  paymentDiscipline: number;
  documentDiscipline: number;
  disputeScore: number;
  dealCount: number;
  openDisputes: number;
  paymentNote: string;
}

const BUYER_PROFILES: BuyerProfile[] = [
  {
    id: 'BUY-001',
    alias: 'Покупатель 1',
    region: 'Воронежская обл.',
    totalScore: 92,
    paymentDiscipline: 96,
    documentDiscipline: 90,
    disputeScore: 95,
    dealCount: 14,
    openDisputes: 0,
    paymentNote: 'Резерв подтверждался в срок в 100% сделок',
  },
  {
    id: 'BUY-002',
    alias: 'Покупатель 2',
    region: 'Краснодарский кр.',
    totalScore: 88,
    paymentDiscipline: 91,
    documentDiscipline: 85,
    disputeScore: 88,
    dealCount: 9,
    openDisputes: 0,
    paymentNote: 'Одна задержка резерва за историю',
  },
  {
    id: 'BUY-003',
    alias: 'Покупатель 3',
    region: 'Курская обл.',
    totalScore: 74,
    paymentDiscipline: 78,
    documentDiscipline: 70,
    disputeScore: 75,
    dealCount: 5,
    openDisputes: 1,
    paymentNote: 'Средняя скорость резервирования',
  },
  {
    id: 'BUY-004',
    alias: 'Покупатель 4',
    region: 'Липецкая обл.',
    totalScore: 95,
    paymentDiscipline: 97,
    documentDiscipline: 94,
    disputeScore: 96,
    dealCount: 22,
    openDisputes: 0,
    paymentNote: 'Высокая надёжность по резерву и документам',
  },
];

function scoreColor(score: number) {
  if (score >= 85) return green;
  if (score >= 70) return amber;
  return red;
}

export default function SellerReputationPage() {
  const dealScenarios = Object.values(DEAL360_SCENARIOS);
  const withDisputes = dealScenarios.filter((s) => s.cockpit.disputeStatus.state !== 'ok').length;

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: green, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Продавец</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: text }}>Надёжность покупателей</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              История оплаты, документы, споры, дисциплина. Рейтинг влияет на условия и приоритет в сделке.
            </p>
          </div>
          <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
            Центр управления
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Контрагентов', value: String(BUYER_PROFILES.length), color: text },
            { label: 'Высокая надёжность', value: String(BUYER_PROFILES.filter((b) => b.totalScore >= 85).length), color: green },
            { label: 'Активных споров', value: String(BUYER_PROFILES.reduce((s, b) => s + b.openDisputes, 0)), color: withDisputes > 0 ? red : green },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Покупатели по сделкам</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {BUYER_PROFILES.map((buyer) => {
            const admission = ratingAdmission(buyer.totalScore);
            const color = scoreColor(buyer.totalScore);
            const hasDisputes = buyer.openDisputes > 0;
            return (
              <div key={buyer.id} style={{ border: `1px solid ${hasDisputes ? 'rgba(220,38,38,0.16)' : border}`, borderRadius: 14, padding: 14, background: hasDisputes ? 'rgba(220,38,38,0.03)' : '#F8FAFB', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: text }}>{buyer.alias}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{buyer.region} · {buyer.dealCount} {buyer.dealCount === 1 ? 'сделка' : buyer.dealCount <= 4 ? 'сделки' : 'сделок'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color }}>{buyer.totalScore}<span style={{ fontSize: 13, color: muted, fontWeight: 400 }}>/100</span></div>
                    <div style={{ fontSize: 11, color, fontWeight: 700, marginTop: 1 }}>{admission.label}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Оплата', score: buyer.paymentDiscipline },
                    { label: 'Документы', score: buyer.documentDiscipline },
                    { label: 'Споры', score: buyer.disputeScore },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: '8px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${border}` }}>
                      <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: scoreColor(item.score), marginTop: 3 }}>{item.score}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: muted, lineHeight: 1.55 }}>{buyer.paymentNote}</div>
                {hasDisputes && (
                  <div style={{ fontSize: 12, color: red, fontWeight: 700, padding: '6px 10px', borderRadius: 8, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.12)' }}>
                    Открытых споров: {buyer.openDisputes}
                  </div>
                )}
                {!admission.automaticAdmission && (
                  <div style={{ fontSize: 12, color: amber, padding: '6px 10px', borderRadius: 8, background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.14)' }}>
                    Требуется ручная проверка перед допуском к сделке
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/seller/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Мои сделки
        </Link>
        <Link href='/platform-v7/seller/rfq' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Запросы покупателей
        </Link>
        <Link href='/platform-v7/seller' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Кокпит продавца
        </Link>
      </div>
    </div>
  );
}
