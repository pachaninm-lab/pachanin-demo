import Link from 'next/link';
import { type BypassRiskLevel } from '@/lib/platform-v7/bypass-risk-score';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';
const blue = '#2563EB';

interface RiskProfile {
  counterpartyId: string;
  alias: string;
  role: string;
  riskLevel: BypassRiskLevel;
  signalCount: number;
  lastSignalType: string;
  lastSignalAt: string;
  restrictions: string[];
  manualReviewRequired: boolean;
}

const RISK_PROFILES: RiskProfile[] = [
  {
    counterpartyId: 'BUY-003',
    alias: 'Покупатель 3 · Курская обл.',
    role: 'Покупатель',
    riskLevel: 'high',
    signalCount: 3,
    lastSignalType: 'Попытка передать телефон в чате сделки',
    lastSignalAt: '14:22 сегодня',
    restrictions: ['Только preview-режим документов', 'Без прямого контакта'],
    manualReviewRequired: true,
  },
  {
    counterpartyId: 'SEL-003',
    alias: 'ИП Воронцов А.В. · Курская обл.',
    role: 'Продавец',
    riskLevel: 'medium',
    signalCount: 1,
    lastSignalType: 'Запрос точного адреса склада до подачи оффера',
    lastSignalAt: '09:45 вчера',
    restrictions: ['Ручная проверка при следующей сделке'],
    manualReviewRequired: true,
  },
  {
    counterpartyId: 'BUY-001',
    alias: 'Покупатель 1 · Воронежская обл.',
    role: 'Покупатель',
    riskLevel: 'low',
    signalCount: 0,
    lastSignalType: 'Нет сигналов',
    lastSignalAt: '—',
    restrictions: [],
    manualReviewRequired: false,
  },
  {
    counterpartyId: 'SEL-001',
    alias: 'КФХ «Северное поле» · Тамбовская обл.',
    role: 'Продавец',
    riskLevel: 'low',
    signalCount: 0,
    lastSignalType: 'Нет сигналов',
    lastSignalAt: '—',
    restrictions: [],
    manualReviewRequired: false,
  },
];

const riskStyle: Record<BypassRiskLevel, { label: string; color: string; bg: string; borderColor: string }> = {
  low: { label: 'НИЗКИЙ', color: green, bg: 'rgba(10,122,95,0.07)', borderColor: 'rgba(10,122,95,0.18)' },
  medium: { label: 'СРЕДНИЙ', color: amber, bg: 'rgba(217,119,6,0.07)', borderColor: 'rgba(217,119,6,0.18)' },
  high: { label: 'ВЫСОКИЙ', color: red, bg: 'rgba(220,38,38,0.07)', borderColor: 'rgba(220,38,38,0.18)' },
  critical: { label: 'КРИТИЧЕСКИЙ', color: red, bg: 'rgba(220,38,38,0.12)', borderColor: 'rgba(220,38,38,0.28)' },
};

export default function ControlTowerBypassRiskPage() {
  const activeProfiles = RISK_PROFILES.filter((p) => p.riskLevel !== 'low');
  const requireReview = RISK_PROFILES.filter((p) => p.manualReviewRequired);

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Центр управления</p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>Профили риска и ограничения</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Сигналы обхода, Zero Direct Mode, ограничения доступа и очередь на ручную проверку.
            </p>
          </div>
          <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
            ← Центр управления
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Всего профилей', value: String(RISK_PROFILES.length), color: text },
            { label: 'Активных сигналов', value: String(activeProfiles.length), color: activeProfiles.length > 0 ? red : green },
            { label: 'На проверке', value: String(requireReview.length), color: requireReview.length > 0 ? amber : green },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
        {activeProfiles.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.14)', fontSize: 13, color: red, fontWeight: 700 }}>
            {activeProfiles.length} {activeProfiles.length === 1 ? 'контрагент требует' : 'контрагента требуют'} внимания
          </div>
        )}
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Профили контрагентов</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {RISK_PROFILES.map((profile) => {
            const rs = riskStyle[profile.riskLevel];
            const isElevated = profile.riskLevel === 'high' || profile.riskLevel === 'critical';
            return (
              <div key={profile.counterpartyId} style={{ border: `1px solid ${isElevated ? 'rgba(220,38,38,0.18)' : border}`, borderRadius: 14, padding: 14, background: isElevated ? 'rgba(220,38,38,0.03)' : '#F8FAFB', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: blue }}>{profile.counterpartyId}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: text, marginTop: 3 }}>{profile.alias}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{profile.role} · {profile.signalCount} {profile.signalCount === 1 ? 'сигнал' : profile.signalCount <= 4 ? 'сигнала' : 'сигналов'}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: rs.bg, border: `1px solid ${rs.borderColor}`, color: rs.color, fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>
                    {rs.label}
                  </span>
                </div>

                {profile.signalCount > 0 && (
                  <div style={{ fontSize: 12, color: isElevated ? red : amber, padding: '8px 12px', borderRadius: 10, background: isElevated ? 'rgba(220,38,38,0.05)' : 'rgba(217,119,6,0.05)', border: `1px solid ${isElevated ? 'rgba(220,38,38,0.12)' : 'rgba(217,119,6,0.12)'}` }}>
                    <span style={{ fontWeight: 700 }}>Последний сигнал:</span> {profile.lastSignalType} · {profile.lastSignalAt}
                  </div>
                )}

                {profile.restrictions.length > 0 && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {profile.restrictions.map((r) => (
                      <div key={r} style={{ fontSize: 12, color: muted, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: amber, fontWeight: 900, fontSize: 13 }}>→</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                {profile.manualReviewRequired && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link href={`/platform-v7/counterparties/${profile.counterpartyId}`} style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: isElevated ? red : amber, color: '#fff', fontSize: 12, fontWeight: 800 }}>
                      Проверить профиль
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Политика Zero Direct Contact</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { label: 'Связь только через сделку', desc: 'Телефоны, email, мессенджеры — не передаются. Всё коммуникация через платформу.' },
            { label: 'Документы по основанию', desc: 'Открытие документа фиксируется в журнале. Скачивание требует подтверждённого этапа.' },
            { label: 'Контакты перевозчика скрыты', desc: 'Водитель и экспедитор видят только адреса. ИНН и телефоны — через оператора при споре.' },
          ].map((item) => (
            <div key={item.label} style={{ padding: '10px 14px', borderRadius: 12, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: text }}>{item.label}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 4, lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Центр управления
        </Link>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Сделки
        </Link>
      </div>
    </div>
  );
}
