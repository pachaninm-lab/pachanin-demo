import type { ReactNode } from 'react';
import Link from 'next/link';
import { P7_THEME_CSS } from '@/components/platform-v7/p7Theme';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';
import { formatMoney, formatTons, maturityLabel, readableStatus, roleLabel } from '@/lib/platform-v7/grain-execution/format';
import type { NextAction, UserRole } from '@/lib/platform-v7/grain-execution/types';

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'money' | 'info';

const shellStyle = {
  display: 'grid',
  gap: PLATFORM_V7_TOKENS.spacing.md,
  color: P7_THEME_CSS.color.textPrimary,
} as const;

const cardStyle = {
  border: `1px solid ${P7_THEME_CSS.color.border}`,
  borderRadius: PLATFORM_V7_TOKENS.radius.xl,
  background: P7_THEME_CSS.surface.card,
  boxShadow: P7_THEME_CSS.shadow.soft,
  padding: PLATFORM_V7_TOKENS.spacing.md,
  minWidth: 0,
} as const;

const mutedTextStyle = {
  margin: 0,
  color: P7_THEME_CSS.color.textMuted,
  fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
  lineHeight: PLATFORM_V7_TOKENS.typography.caption.lineHeight,
} as const;

const smallLabelStyle = {
  margin: 0,
  color: P7_THEME_CSS.color.textMuted,
  fontSize: PLATFORM_V7_TOKENS.typography.micro.size,
  lineHeight: PLATFORM_V7_TOKENS.typography.micro.lineHeight,
  fontWeight: 760,
  letterSpacing: PLATFORM_V7_TOKENS.typography.micro.letterSpacing,
  textTransform: 'uppercase',
} as const;

function toneColor(tone: Tone) {
  if (tone === 'good') return 'var(--p7-color-success)';
  if (tone === 'warn') return 'var(--p7-color-warning)';
  if (tone === 'bad') return 'var(--p7-color-danger)';
  if (tone === 'money') return 'var(--p7-color-money)';
  if (tone === 'info') return P7_THEME_CSS.color.brand;
  return P7_THEME_CSS.color.textSecondary;
}

function toneBackground(tone: Tone) {
  if (tone === 'good') return 'var(--p7-color-success-soft)';
  if (tone === 'warn') return 'var(--p7-color-warning-soft)';
  if (tone === 'bad') return 'var(--p7-color-danger-soft)';
  if (tone === 'money') return 'var(--p7-color-money-soft)';
  if (tone === 'info') return P7_THEME_CSS.color.brandSoft;
  return P7_THEME_CSS.color.surfaceMuted;
}

function StatusPill({ children, tone = 'neutral' }: { readonly children: ReactNode; readonly tone?: Tone }) {
  const color = toneColor(tone);

  return (
    <span
      style={{
        display: 'inline-flex',
        width: 'fit-content',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: PLATFORM_V7_TOKENS.radius.pill,
        border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
        background: toneBackground(tone),
        color,
        padding: '5px 9px',
        fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
        fontWeight: 760,
        lineHeight: 1.2,
      }}
    >
      {children}
    </span>
  );
}

function PulseCell({ label, value, tone }: { readonly label: string; readonly value: string; readonly tone: Tone }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 6,
        minWidth: 0,
        border: `1px solid ${P7_THEME_CSS.color.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.lg,
        background: toneBackground(tone),
        padding: PLATFORM_V7_TOKENS.spacing.sm,
      }}
    >
      <p style={smallLabelStyle}>{label}</p>
      <p style={{ margin: 0, color: P7_THEME_CSS.color.textPrimary, fontSize: PLATFORM_V7_TOKENS.typography.body.size, lineHeight: 1.35, fontWeight: 800 }}>{value}</p>
    </div>
  );
}

function ActionButton({ action, primary = false }: { readonly action: NextAction; readonly primary?: boolean }) {
  return (
    <Link
      href={action.targetRoute}
      aria-disabled={action.disabled ? 'true' : undefined}
      style={{
        display: 'grid',
        minHeight: primary ? 52 : 44,
        alignContent: 'center',
        gap: 3,
        borderRadius: PLATFORM_V7_TOKENS.radius.md,
        border: `1px solid ${action.disabled ? P7_THEME_CSS.color.border : primary ? P7_THEME_CSS.color.brand : P7_THEME_CSS.color.borderStrong}`,
        background: action.disabled ? P7_THEME_CSS.color.surfaceMuted : primary ? P7_THEME_CSS.color.brand : P7_THEME_CSS.color.surface,
        color: action.disabled ? P7_THEME_CSS.color.textMuted : primary ? '#fff' : P7_THEME_CSS.color.textPrimary,
        padding: `${PLATFORM_V7_TOKENS.spacing.sm} ${PLATFORM_V7_TOKENS.spacing.md}`,
        textDecoration: 'none',
        pointerEvents: action.disabled ? 'none' : undefined,
      }}
    >
      <strong style={{ fontSize: PLATFORM_V7_TOKENS.typography.body.size }}>{action.title}</strong>
      <span style={{ ...mutedTextStyle, color: primary && !action.disabled ? 'color-mix(in srgb, #fff 78%, transparent)' : mutedTextStyle.color }}>{action.disabledReason ?? action.description ?? `Ответственный: ${roleLabel[action.role]}`}</span>
    </Link>
  );
}

function ExecutionRail() {
  const steps: ReadonlyArray<{ label: string; status: string; tone: Tone }> = [
    { label: 'Партия', status: 'готова', tone: 'good' },
    { label: 'Лот', status: 'создан', tone: 'good' },
    { label: 'Сделка', status: 'в работе', tone: 'info' },
    { label: 'Рейс', status: 'принят', tone: 'good' },
    { label: 'Приёмка', status: 'стоп', tone: 'bad' },
    { label: 'Документы', status: '3 из 5', tone: 'warn' },
    { label: 'Деньги', status: 'частично', tone: 'money' },
    { label: 'Закрытие', status: 'ждёт', tone: 'neutral' },
  ];

  return (
    <section aria-label='Линия исполнения сделки' style={{ ...cardStyle, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.sm, flexWrap: 'wrap' }}>
        <div>
          <p style={smallLabelStyle}>Execution Rail</p>
          <h2 style={{ margin: '4px 0 0', fontSize: PLATFORM_V7_TOKENS.typography.h3.size, lineHeight: 1.2 }}>Партия → деньги → закрытие</h2>
        </div>
        <StatusPill tone='warn'>активный блокер: акт расхождения</StatusPill>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
        {steps.map((step) => {
          const color = toneColor(step.tone);
          return (
            <div key={step.label} style={{ display: 'grid', gap: 8, border: `1px solid color-mix(in srgb, ${color} 28%, ${P7_THEME_CSS.color.border})`, borderRadius: PLATFORM_V7_TOKENS.radius.lg, background: toneBackground(step.tone), padding: PLATFORM_V7_TOKENS.spacing.sm, minHeight: 86 }}>
              <span aria-hidden='true' style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: `0 0 0 4px ${toneBackground(step.tone)}` }} />
              <strong>{step.label}</strong>
              <span style={mutedTextStyle}>{step.status}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MoneyGate() {
  const ctx = getGrainExecutionContext();
  const money = ctx.moneyProjection;
  const total = Math.max(money.reservedAmount.value, 1);
  const ready = Math.max(0, Math.min(100, Math.round((money.readyToReleaseAmount.value / total) * 100)));
  const held = Math.max(0, Math.min(100, Math.round((money.heldAmount.value / total) * 100)));
  const manual = Math.max(0, 100 - ready - held);

  return (
    <section style={{ ...cardStyle, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md }}>
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.sm, flexWrap: 'wrap' }}>
        <div>
          <p style={smallLabelStyle}>Money Gate</p>
          <h2 style={{ margin: '4px 0 0', fontSize: 28, lineHeight: 1.1 }}>{formatMoney(money.reservedAmount)}</h2>
          <p style={mutedTextStyle}>зарезервировано в контуре сделки</p>
        </div>
        <StatusPill tone='warn'>выпуск ждёт основание банка</StatusPill>
      </div>

      <div style={{ display: 'flex', overflow: 'hidden', height: 12, borderRadius: PLATFORM_V7_TOKENS.radius.pill, background: P7_THEME_CSS.color.surfaceMuted }} aria-label='Разбивка денег'>
        <span style={{ width: `${ready}%`, background: 'var(--p7-color-money)' }} />
        <span style={{ width: `${held}%`, background: 'var(--p7-color-warning)' }} />
        <span style={{ width: `${manual}%`, background: P7_THEME_CSS.color.borderStrong }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
        <PulseCell label='к выпуску через банк' value={formatMoney(money.readyToReleaseAmount)} tone='money' />
        <PulseCell label='удержано' value={formatMoney(money.heldAmount)} tone='warn' />
        <PulseCell label='спорная часть' value={formatMoney(money.disputedAmount)} tone='bad' />
      </div>

      <div style={{ border: `1px solid color-mix(in srgb, var(--p7-color-danger) 26%, transparent)`, borderRadius: PLATFORM_V7_TOKENS.radius.lg, background: 'var(--p7-color-danger-soft)', padding: PLATFORM_V7_TOKENS.spacing.sm }}>
        <p style={{ ...smallLabelStyle, color: 'var(--p7-color-danger)' }}>причина остановки</p>
        <p style={{ margin: '4px 0 0', fontWeight: 820 }}>Нет акта расхождения по весу и качеству. Деньги не выпускаются целиком — спорная часть удержана отдельно.</p>
      </div>
    </section>
  );
}

function DocumentControl() {
  const ctx = getGrainExecutionContext();
  const docs = ctx.documents.slice(0, 5);

  return (
    <section style={{ ...cardStyle, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
      <div>
        <p style={smallLabelStyle}>Document Control</p>
        <h2 style={{ margin: '4px 0 0', fontSize: PLATFORM_V7_TOKENS.typography.h3.size, lineHeight: 1.2 }}>Документы как допуск денег</h2>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {docs.map((doc) => {
          const ok = ['uploaded', 'signed', 'not_required'].includes(doc.status);
          const bad = doc.status === 'rejected' || doc.status === 'expired';
          return (
            <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: PLATFORM_V7_TOKENS.spacing.sm, alignItems: 'center', border: `1px solid ${P7_THEME_CSS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.md, padding: PLATFORM_V7_TOKENS.spacing.sm }}>
              <div style={{ minWidth: 0 }}>
                <strong>{readableStatus(doc.documentType)}</strong>
                <p style={mutedTextStyle}>Ответственный: {roleLabel[doc.responsibleRole]}</p>
              </div>
              <StatusPill tone={ok ? 'good' : bad ? 'bad' : 'warn'}>{readableStatus(doc.status)}</StatusPill>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SmartInspector({ role }: { readonly role: UserRole }) {
  return (
    <aside style={{ ...cardStyle, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md, alignSelf: 'start' }} aria-label='Инспектор сделки'>
      <div>
        <p style={smallLabelStyle}>Smart Inspector</p>
        <h2 style={{ margin: '4px 0 0', fontSize: PLATFORM_V7_TOKENS.typography.h3.size, lineHeight: 1.2 }}>Приёмка остановлена</h2>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <PulseCell label='объект' value='Приёмка / вес / качество' tone='info' />
        <PulseCell label='статус' value='нужен акт расхождения' tone='bad' />
        <PulseCell label='ответственный' value={role === 'bank' ? 'Элеватор + оператор' : roleLabel[role]} tone='warn' />
        <PulseCell label='влияние' value='частичный выпуск денег' tone='money' />
      </div>
      <div style={{ borderTop: `1px solid ${P7_THEME_CSS.color.border}`, paddingTop: PLATFORM_V7_TOKENS.spacing.sm }}>
        <p style={mutedTextStyle}>Следующее действие</p>
        <p style={{ margin: '4px 0 0', fontWeight: 820 }}>Передать банку только подтверждённое основание. Спорную часть оставить на удержании до решения.</p>
      </div>
    </aside>
  );
}

function ActionDock({ role }: { readonly role: UserRole }) {
  const ctx = getGrainExecutionContext();
  const summary = ctx.summaryForRole(role);
  const primaryAction = ctx.moneyProjection.nextAction ?? summary.nextActions[0];
  const secondaryActions = summary.nextActions.filter((action) => action.id !== primaryAction?.id).slice(0, 2);

  if (!primaryAction) return null;

  return (
    <section style={{ ...cardStyle, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.sm }} aria-label='Следующие действия'>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) repeat(auto-fit, minmax(180px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
        <ActionButton action={primaryAction} primary />
        {secondaryActions.map((action) => <ActionButton key={action.id} action={action} />)}
      </div>
    </section>
  );
}

function DealPulse({ role }: { readonly role: UserRole }) {
  const ctx = getGrainExecutionContext();
  const summary = ctx.summaryForRole(role);

  return (
    <section aria-label='Пульс сделки' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
      <PulseCell label='груз' value={`принято ${formatTons(ctx.primaryWeightBalance.acceptedNetTons ?? ctx.primaryWeightBalance.contractedVolumeTons)}`} tone='info' />
      <PulseCell label='деньги' value={`${formatMoney(ctx.moneyProjection.readyToReleaseAmount)} к выпуску`} tone='money' />
      <PulseCell label='документы' value={`${summary.documentSummary?.ready ?? 0}/${summary.documentSummary?.total ?? 0} готовы`} tone='warn' />
      <PulseCell label='риск' value='вес / качество' tone='bad' />
      <PulseCell label='действие' value={ctx.moneyProjection.nextAction?.title ?? summary.nextActions[0]?.title ?? 'проверить основание'} tone='warn' />
    </section>
  );
}

export function GrainReleaseCockpit({ role = 'bank' }: { readonly role?: UserRole }) {
  const ctx = getGrainExecutionContext();
  const summary = ctx.summaryForRole(role);

  return (
    <>
      <style>{`
        @media(max-width:767px){
          [data-platform-v7-grain-release-cockpit='true']{gap:10px!important}
          [data-platform-v7-grain-release-cockpit='true'] > section{padding:14px!important;border-radius:20px!important;gap:10px!important}
          [data-platform-v7-grain-release-cockpit='true'] > section:nth-of-type(1){padding:16px!important;border-radius:24px!important}
          [data-platform-v7-grain-release-cockpit='true'] h1{font-size:clamp(24px,7vw,34px)!important;line-height:1.06!important}
          [data-platform-v7-grain-release-cockpit='true'] h2{font-size:18px!important;line-height:1.12!important}
          [data-platform-v7-grain-release-cockpit='true'] > section:nth-of-type(1) > div:first-child > div:first-child > p{display:none!important}
          [data-platform-v7-grain-release-cockpit='true'] section[aria-label='Пульс сделки']{grid-template-columns:1fr 1fr!important;gap:8px!important}
          [data-platform-v7-grain-release-cockpit='true'] section[aria-label='Пульс сделки'] > div{padding:10px!important;border-radius:14px!important}
          [data-platform-v7-grain-release-cockpit='true'] section[aria-label='Пульс сделки'] > div:nth-child(n+5){display:none!important}
          [data-platform-v7-grain-release-cockpit='true'] > section:nth-of-type(2) > div:nth-child(2){grid-template-columns:1fr 1fr!important;gap:8px!important}
          [data-platform-v7-grain-release-cockpit='true'] > section:nth-of-type(2) > div:nth-child(2) > div{min-height:auto!important;padding:10px!important;border-radius:14px!important}
          [data-platform-v7-grain-release-cockpit='true'] > section:nth-of-type(2) > div:nth-child(2) > div:nth-child(n+7){display:none!important}
          [data-platform-v7-grain-release-cockpit='true'] > div{grid-template-columns:1fr!important;gap:10px!important}
          [data-platform-v7-grain-release-cockpit='true'] > div section,
          [data-platform-v7-grain-release-cockpit='true'] aside{padding:14px!important;border-radius:20px!important;gap:10px!important}
          [data-platform-v7-grain-release-cockpit='true'] > div section:first-child > div:nth-child(3){grid-template-columns:1fr 1fr!important;gap:8px!important}
          [data-platform-v7-grain-release-cockpit='true'] > div section:first-child > div:nth-child(3) > div:nth-child(3){display:none!important}
          [data-platform-v7-grain-release-cockpit='true'] > div section:nth-child(2) > div:nth-child(2) > div:nth-child(n+4){display:none!important}
          [data-platform-v7-grain-release-cockpit='true'] aside > div:nth-child(2){grid-template-columns:1fr 1fr!important;gap:8px!important}
          [data-platform-v7-grain-release-cockpit='true'] aside > div:nth-child(2) > div:nth-child(n+4){display:none!important}
          [data-platform-v7-grain-release-cockpit='true'] aside > div:nth-child(3){display:none!important}
          [data-platform-v7-grain-release-cockpit='true'] section[aria-label='Следующие действия'] > div{grid-template-columns:1fr!important}
          [data-platform-v7-grain-release-cockpit='true'] section[aria-label='Следующие действия'] a{min-height:54px!important;border-radius:16px!important}
          [data-platform-v7-grain-release-cockpit='true'] section[aria-label='Следующие действия'] a:nth-child(n+2){display:none!important}
        }
      `}</style>
      <main data-platform-v7-grain-release-cockpit='true' style={shellStyle}>
        <section style={{ ...cardStyle, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md, background: P7_THEME_CSS.surface.premium }}>
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.md, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
              <StatusPill tone='warn'>{maturityLabel[summary.maturity]}</StatusPill>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.08, letterSpacing: '-0.03em' }}>Сделка GR-2048 · выпуск и удержание денег</h1>
              <p style={{ ...mutedTextStyle, maxWidth: 720 }}>Контур показывает груз, документы, основание для банка и спорную часть без заявления о самостоятельном выпуске денег платформой.</p>
            </div>
            <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
              <p style={smallLabelStyle}>активная роль</p>
              <StatusPill tone='info'>{roleLabel[role]}</StatusPill>
            </div>
          </div>
          <DealPulse role={role} />
        </section>

        <ExecutionRail />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(300px, 0.8fr)', gap: PLATFORM_V7_TOKENS.spacing.md, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md, minWidth: 0 }}>
            <MoneyGate />
            <DocumentControl />
          </div>
          <SmartInspector role={role} />
        </div>

        <ActionDock role={role} />
      </main>
    </>
  );
}
