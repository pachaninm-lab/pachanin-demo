import Link from 'next/link';
import { OperatorQueuesPage } from '@/components/v7r/EsiaFgisRuntime';
import {
  PLATFORM_V7_EXECUTION_SOURCE,
  canRequestMoneyRelease,
  executionBlockers,
  executionReadinessScore,
  formatRub,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

const links = [
  { title: 'Проверка выпуска денег', href: '/platform-v7/bank/release-safety', note: 'Блокеры, удержания и кандидаты к выпуску' },
  { title: 'Готовность сделки', href: '/platform-v7/readiness', note: 'ФГИС, документы, логистика, банк и спор' },
  { title: 'Журнал торгов', href: '/platform-v7/offer-log', note: 'История ставок, изменений и выбора предложения' },
  { title: 'Антиобход', href: '/platform-v7/anti-bypass', note: 'Правила раскрытия сторон и контактов' },
  { title: 'Логистика', href: '/platform-v7/logistics', note: 'Маршруты, сроки прибытия и отклонения' },
];

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const WARN = '#B45309';
const ERR = '#B91C1C';

export default function PlatformV7OperatorAliasPage() {
  const { deal, money } = PLATFORM_V7_EXECUTION_SOURCE;
  const score = executionReadinessScore();
  const blockers = executionBlockers();
  const canRelease = canRequestMoneyRelease();

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: S, border: `1px solid ${BRAND}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Текущая сделка под контролем · {deal.maturity}</div>
        <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: T }}>{deal.id} · {deal.lotId} · {deal.crop}</div>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          {[
            { label: 'Готовность', value: `${score}%`, tone: score === 100 ? BRAND : WARN },
            { label: 'Блокеров', value: String(blockers.length), tone: blockers.length > 0 ? ERR : BRAND },
            { label: 'Удержано', value: formatRub(money.holdRub), tone: money.holdRub > 0 ? ERR : BRAND },
            { label: 'Выпуск денег', value: canRelease ? 'возможен' : 'заблокирован', tone: canRelease ? BRAND : ERR },
          ].map(({ label, value, tone }) => (
            <div key={label} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ marginTop: 5, fontSize: 15, fontWeight: 900, color: tone }}>{value}</div>
            </div>
          ))}
        </div>
        {blockers.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: WARN }}>Блокеры: {blockers.join(' · ')}</div>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: 'grid',
              gap: 6,
              textDecoration: 'none',
              border: '1px solid rgba(10,122,95,0.18)',
              borderRadius: 18,
              padding: 16,
              background: 'rgba(10,122,95,0.08)',
              color: '#0A7A5F',
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            <span>{link.title} →</span>
            <span style={{ color: '#475569', fontSize: 12, fontWeight: 700, lineHeight: 1.45 }}>{link.note}</span>
          </Link>
        ))}
      </section>
      <OperatorQueuesPage />
    </div>
  );
}
