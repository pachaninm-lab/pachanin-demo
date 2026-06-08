import Link from 'next/link';
import { ratingAdmission } from '@/lib/platform-v7/reputation';
import { federalCompanyProfiles } from '@/lib/federal-counterparty-directory';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';
const blue = '#2563EB';

const COUNTERPARTY_SCORES: Record<string, {
  totalScore: number;
  paymentDiscipline: number;
  documentDiscipline: number;
  disputeScore: number;
  role: 'buyer' | 'seller';
  dealCount: number;
  openDisputes: number;
  riskFlags: string[];
}> = {
  'BUY-001': { totalScore: 92, paymentDiscipline: 96, documentDiscipline: 90, disputeScore: 95, role: 'buyer', dealCount: 14, openDisputes: 0, riskFlags: [] },
  'SEL-001': { totalScore: 91, paymentDiscipline: 94, documentDiscipline: 90, disputeScore: 92, role: 'seller', dealCount: 18, openDisputes: 0, riskFlags: [] },
  'BUY-002': { totalScore: 74, paymentDiscipline: 78, documentDiscipline: 70, disputeScore: 75, role: 'buyer', dealCount: 5, openDisputes: 1, riskFlags: ['Задержка резерва в 1 сделке'] },
  'SEL-002': { totalScore: 88, paymentDiscipline: 89, documentDiscipline: 88, disputeScore: 88, role: 'seller', dealCount: 11, openDisputes: 0, riskFlags: [] },
};

const DEFAULT_SCORE = { totalScore: 82, paymentDiscipline: 85, documentDiscipline: 80, disputeScore: 83, role: 'buyer' as const, dealCount: 6, openDisputes: 0, riskFlags: [] };

function scoreColor(score: number) {
  if (score >= 85) return green;
  if (score >= 70) return amber;
  return red;
}

function roleName(role: 'buyer' | 'seller') {
  return role === 'buyer' ? 'Покупатель' : 'Продавец';
}

export default function CounterpartyPage({ params }: { params: { counterpartyId: string } }) {
  const { counterpartyId } = params;
  const scores = COUNTERPARTY_SCORES[counterpartyId] ?? DEFAULT_SCORE;
  const federal = federalCompanyProfiles.find((p) => p.id === counterpartyId);
  const admission = ratingAdmission(scores.totalScore);
  const mainColor = scoreColor(scores.totalScore);
  const hasRiskFlags = scores.riskFlags.length > 0;
  const hasOpenDisputes = scores.openDisputes > 0;

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Контрагент · {counterpartyId}
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>
              {federal?.name ?? `Контрагент ${counterpartyId}`}
            </h1>
            {federal && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: muted }}>{federal.segment}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '7px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
              {roleName(scores.role)}
            </span>
            <span style={{ padding: '7px 12px', borderRadius: 10, background: admission.automaticAdmission ? 'rgba(10,122,95,0.07)' : 'rgba(217,119,6,0.07)', border: `1px solid ${admission.automaticAdmission ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, color: admission.automaticAdmission ? green : amber, fontSize: 12, fontWeight: 800 }}>
              {admission.label}
            </span>
          </div>
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Рейтинг надёжности</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: mainColor }}>
            {scores.totalScore}<span style={{ fontSize: 16, color: muted, fontWeight: 400 }}>/100</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {[
            { label: 'Оплата', score: scores.paymentDiscipline },
            { label: 'Документы', score: scores.documentDiscipline },
            { label: 'Споры', score: scores.disputeScore },
          ].map((item) => (
            <div key={item.label} style={{ padding: '10px 14px', borderRadius: 12, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor(item.score), marginTop: 4 }}>{item.score}</div>
            </div>
          ))}
          <div style={{ padding: '10px 14px', borderRadius: 12, background: '#F8FAFB', border: `1px solid ${border}` }}>
            <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Сделок</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: text, marginTop: 4 }}>{scores.dealCount}</div>
          </div>
        </div>
      </section>

      {federal && (
        <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Профиль компании</div>
          <div style={{ fontSize: 13, color: muted, lineHeight: 1.7 }}>{federal.value}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {federal.regions.map((r) => (
              <span key={r} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#F8FAFB', border: `1px solid ${border}`, color: muted }}>{r}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {federal.strengths.map((s) => (
              <div key={s} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: green, fontSize: 14, lineHeight: 1.4 }}>+</span>
                <span style={{ fontSize: 13, color: text }}>{s}</span>
              </div>
            ))}
            {federal.risks.map((r) => (
              <div key={r} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: amber, fontSize: 14, lineHeight: 1.4 }}>!</span>
                <span style={{ fontSize: 13, color: muted }}>{r}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: muted, padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
            Платёжная дисциплина: {federal.paymentDiscipline}
          </div>
        </section>
      )}

      {(hasRiskFlags || hasOpenDisputes) && (
        <section style={{ border: '1px solid rgba(220,38,38,0.18)', borderRadius: 18, padding: 18, background: 'rgba(220,38,38,0.03)', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: red }}>Сигналы риска</div>
          {hasOpenDisputes && (
            <div style={{ fontSize: 13, color: red, fontWeight: 700 }}>
              Открытых споров: {scores.openDisputes}
            </div>
          )}
          {scores.riskFlags.map((flag) => (
            <div key={flag} style={{ fontSize: 13, color: amber, padding: '8px 12px', borderRadius: 10, background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.14)' }}>
              {flag}
            </div>
          ))}
          {!admission.automaticAdmission && (
            <div style={{ fontSize: 13, color: red, padding: '8px 12px', borderRadius: 10, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.12)' }}>
              Допуск к сделке требует ручной проверки оператора
            </div>
          )}
        </section>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Центр управления
        </Link>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Сделки
        </Link>
        <Link href='/platform-v7/control-tower/bypass-risk' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Профили риска
        </Link>
      </div>
    </div>
  );
}
