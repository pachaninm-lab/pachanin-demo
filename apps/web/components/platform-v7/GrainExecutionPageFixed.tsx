import type { ReactNode } from 'react';
import Link from 'next/link';
import { P7Section } from '@/components/platform-v7/P7Section';
import { P7_THEME_CSS } from '@/components/platform-v7/p7Theme';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';
import {
  formatMoney,
  formatMoneyPerTon,
  formatPercent,
  formatTons,
  maturityLabel,
  readableStatus,
  roleLabel,
} from '@/lib/platform-v7/grain-execution/format';
import type { NextAction, UserRole } from '@/lib/platform-v7/grain-execution/types';

export type GrainExecutionPageMode =
  | 'batches'
  | 'batch-detail'
  | 'quick-sale'
  | 'rfq-list'
  | 'rfq-new'
  | 'rfq-detail'
  | 'elevator-terminal'
  | 'elevator-operation'
  | 'deal-quality'
  | 'deal-weight'
  | 'deal-sdiz'
  | 'deal-release'
  | 'demo-flow';

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'money';
type GrainContext = ReturnType<typeof getGrainExecutionContext>;

const cardStyle = {
  border: `1px solid ${P7_THEME_CSS.color.border}`,
  borderRadius: PLATFORM_V7_TOKENS.radius.lg,
  background: P7_THEME_CSS.surface.card,
  padding: PLATFORM_V7_TOKENS.spacing.md,
  display: 'grid',
  gap: PLATFORM_V7_TOKENS.spacing.sm,
  minWidth: 0,
} as const;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: PLATFORM_V7_TOKENS.spacing.md,
} as const;

const textSmall = {
  margin: 0,
  color: P7_THEME_CSS.color.textMuted,
  fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
  lineHeight: PLATFORM_V7_TOKENS.typography.caption.lineHeight,
} as const;

const textStrong = {
  margin: 0,
  color: P7_THEME_CSS.color.textPrimary,
  fontSize: PLATFORM_V7_TOKENS.typography.h3.size,
  lineHeight: PLATFORM_V7_TOKENS.typography.h3.lineHeight,
  fontWeight: PLATFORM_V7_TOKENS.typography.h3.weight,
} as const;

const docLabels: Record<string, string> = {
  contract: 'Договор',
  specification: 'Спецификация',
  upd: 'УПД',
  transport_waybill: 'Транспортная накладная',
  etrn: 'ЭТрН',
  sdiz_realization: 'СДИЗ реализация',
  sdiz_transportation: 'СДИЗ перевозка',
  quality_protocol: 'Протокол качества',
  weight_certificate: 'Весовые документы',
  bank_confirmation: 'Подтверждение банка',
};

function toneColor(tone: Tone) {
  if (tone === 'good') return 'var(--p7-color-success)';
  if (tone === 'warn') return 'var(--p7-color-warning)';
  if (tone === 'bad') return 'var(--p7-color-danger)';
  if (tone === 'money') return 'var(--p7-color-money)';
  return P7_THEME_CSS.color.textSecondary;
}

function toneBg(tone: Tone) {
  if (tone === 'good') return 'var(--p7-color-success-soft)';
  if (tone === 'warn') return 'var(--p7-color-warning-soft)';
  if (tone === 'bad') return 'var(--p7-color-danger-soft)';
  if (tone === 'money') return 'var(--p7-color-money-soft)';
  return P7_THEME_CSS.color.surfaceMuted;
}

function Pill({ children, tone = 'neutral' }: { readonly children: ReactNode; readonly tone?: Tone }) {
  const color = toneColor(tone);
  return (
    <span
      style={{
        display: 'inline-flex',
        width: 'fit-content',
        alignItems: 'center',
        borderRadius: PLATFORM_V7_TOKENS.radius.pill,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        background: toneBg(tone),
        color,
        padding: '5px 9px',
        fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function Metric({ label, value, note, tone = 'neutral' }: { readonly label: string; readonly value: string; readonly note?: string; readonly tone?: Tone }) {
  return (
    <div style={cardStyle}>
      <Pill tone={tone}>{label}</Pill>
      <p style={{ margin: 0, color: P7_THEME_CSS.color.textPrimary, fontSize: 26, lineHeight: 1.1, fontWeight: 800 }}>{value}</p>
      {note ? <p style={textSmall}>{note}</p> : null}
    </div>
  );
}

function safeRoute(route: string) {
  if (route.includes('/platform-v7/deals/') && route.endsWith('/release')) return '/platform-v7/deals/grain-release';
  if (route.includes('/platform-v7/buyer/rfq/')) return '/platform-v7/buyer/rfq/detail';
  if (route.includes('/platform-v7/batches/') && !route.endsWith('/new')) return '/platform-v7/batches/view';
  return route;
}

function ActionLink({ action }: { readonly action: NextAction }) {
  return (
    <Link
      href={safeRoute(action.targetRoute)}
      aria-disabled={action.disabled ? 'true' : undefined}
      style={{
        display: 'grid',
        gap: 4,
        minHeight: 44,
        borderRadius: PLATFORM_V7_TOKENS.radius.md,
        border: `1px solid ${action.disabled ? P7_THEME_CSS.color.border : P7_THEME_CSS.color.brand}`,
        background: action.disabled ? P7_THEME_CSS.color.surfaceMuted : P7_THEME_CSS.color.brandSoft,
        color: action.disabled ? P7_THEME_CSS.color.textMuted : P7_THEME_CSS.color.textPrimary,
        padding: PLATFORM_V7_TOKENS.spacing.sm,
        textDecoration: 'none',
        pointerEvents: action.disabled ? 'none' : undefined,
      }}
    >
      <strong>{action.title}</strong>
      <span style={textSmall}>{action.disabledReason ?? action.description ?? `Ответственный: ${roleLabel[action.role]}`}</span>
    </Link>
  );
}

function TitleForMode({ mode }: { readonly mode: GrainExecutionPageMode }) {
  const titles: Record<GrainExecutionPageMode, string> = {
    batches: 'Партии зерна',
    'batch-detail': 'Карточка партии',
    'quick-sale': 'Продать зерно за 5 минут',
    'rfq-list': 'Закупочные запросы',
    'rfq-new': 'Новый закупочный запрос',
    'rfq-detail': 'Карточка RFQ',
    'elevator-terminal': 'Элеваторный терминал',
    'elevator-operation': 'Операция элеватора',
    'deal-quality': 'Качество и удержания',
    'deal-weight': 'Весовой баланс',
    'deal-sdiz': 'СДИЗ и ФГИС',
    'deal-release': 'Выпуск и удержание денег',
    'demo-flow': 'Сквозной демо-сценарий',
  };
  return <>{titles[mode]}</>;
}

function Summary({ ctx, role }: { readonly ctx: GrainContext; readonly role: UserRole }) {
  const summary = ctx.summaryForRole(role);
  return (
    <P7Section surface='card' eyebrow='Операционный статус' title='Цепочка партии до денег' subtitle={summary.currentState}>
      <div style={gridStyle}>
        <Metric label='к выпуску через банк' value={summary.moneySummary ? formatMoney(summary.moneySummary.readyToReleaseAmount) : '—'} note='После закрытия документов, СДИЗ и ручных проверок.' tone='money' />
        <Metric label='под удержанием' value={summary.moneySummary ? formatMoney(summary.moneySummary.heldAmount) : '—'} note='Удерживается только спорная часть.' tone='warn' />
        <Metric label='документы' value={summary.documentSummary ? `${summary.documentSummary.ready}/${summary.documentSummary.total}` : '—'} note='Документы являются допуском действий и денег.' />
        <Metric label='support cases' value={summary.supportSummary ? String(summary.supportSummary.openCases) : '—'} note={summary.supportSummary?.nextActionTitle ?? 'Создаются из причин остановки.'} tone={summary.supportSummary?.criticalCases ? 'bad' : 'neutral'} />
      </div>
    </P7Section>
  );
}

function Readiness({ ctx }: { readonly ctx: GrainContext }) {
  return (
    <P7Section surface='card' eyebrow='Партия зерна' title={`${ctx.primaryBatch.crop} ${ctx.primaryBatch.gostClass}`} subtitle='Партия стала исходной точкой продажи: из неё создаются лот, документы, СДИЗ, логистика, деньги и доказательства.'>
      <div style={gridStyle}>
        <Metric label='готовность к продаже' value={formatPercent(ctx.readiness.score)} note={readableStatus(ctx.readiness.status)} tone={ctx.readiness.status === 'ready_for_sale' ? 'good' : ctx.readiness.status === 'blocked' ? 'bad' : 'warn'} />
        <Metric label='доступный объём' value={formatTons(ctx.primaryBatch.availableVolumeTons)} note={`${formatTons(ctx.primaryBatch.reservedVolumeTons)} уже зарезервировано`} />
        <Metric label='место хранения' value={ctx.primaryBatch.region} note={ctx.primaryBatch.storageLocationName} />
      </div>
      <div style={gridStyle}>{ctx.readiness.nextActions.map((action) => <ActionLink key={action.id} action={action} />)}</div>
    </P7Section>
  );
}

function Rfq({ ctx }: { readonly ctx: GrainContext }) {
  return (
    <P7Section surface='card' eyebrow='Закупочный запрос' title={`${ctx.primaryRfq.crop} ${ctx.primaryRfq.gostClass ?? ''} — ${formatTons(ctx.primaryRfq.volumeTons)}`} subtitle='Сделка создаётся только после подтверждения сторон.'>
      <div style={gridStyle}>
        {ctx.rfqMatches.map((match) => (
          <div key={match.batch.id} style={cardStyle}>
            <Pill tone={match.riskLevel === 'low' ? 'good' : match.riskLevel === 'medium' ? 'warn' : 'bad'}>риск: {match.riskLevel}</Pill>
            <p style={textStrong}>{match.batch.crop} {match.batch.gostClass}</p>
            <p style={textSmall}>{match.batch.ownerName}. Доступно: {formatTons(match.batch.availableVolumeTons)}.</p>
            <p style={textSmall}>Цена до точки: {formatMoneyPerTon(match.deliveredPricePerTon)}</p>
            <ActionLink action={match.nextAction} />
          </div>
        ))}
      </div>
    </P7Section>
  );
}

function Netback({ ctx }: { readonly ctx: GrainContext }) {
  return (
    <P7Section surface='card' eyebrow='Чистая цена' title='Сравнение офферов по реальным деньгам' subtitle='Система сравнивает не только цену за тонну, а чистую сумму после логистики, качества, срока оплаты и риска.'>
      <div style={gridStyle}>
        {ctx.netbacks.map((item) => (
          <div key={item.id} style={cardStyle}>
            <Pill tone={item.riskLevel === 'low' ? 'good' : item.riskLevel === 'medium' ? 'warn' : 'bad'}>{item.basis}</Pill>
            <p style={textStrong}>{formatMoneyPerTon(item.netPricePerTon)} чистыми</p>
            <p style={textSmall}>Цена: {formatMoneyPerTon(item.grossPricePerTon)}. Логистика: {formatMoney(item.logisticsCost)}. Риск: {formatMoney(item.riskReserve)}.</p>
          </div>
        ))}
      </div>
    </P7Section>
  );
}

function WeightQuality({ ctx, mode }: { readonly ctx: GrainContext; readonly mode: 'quality' | 'weight' | 'both' }) {
  return (
    <>
      {mode !== 'weight' ? (
        <P7Section surface='card' eyebrow='Качество и удержания' title='Денежная дельта по лаборатории' subtitle={`Под удержанием по качеству: ${formatMoney(ctx.primaryQualityDelta.totalHoldAmount)}.`}>
          <div style={gridStyle}>{ctx.primaryQualityDelta.items.map((item) => <div key={item.metric} style={cardStyle}><Pill tone='warn'>{item.metric}</Pill><p style={textStrong}>{formatMoney(item.moneyImpact)}</p><p style={textSmall}>По договору: {item.agreedValue}. По приёмке: {item.actualValue}. Отклонение: {item.deviationText}.</p></div>)}</div>
        </P7Section>
      ) : null}
      {mode !== 'quality' ? (
        <P7Section surface='card' eyebrow='Весовой баланс' title='Расхождение веса и денежный эффект' subtitle='Деньги пересчитываются по зачётному весу, а не блокируются целиком.'>
          <div style={gridStyle}>
            <Metric label='по договору' value={formatTons(ctx.primaryWeightBalance.contractedVolumeTons)} />
            <Metric label='принято нетто' value={ctx.primaryWeightBalance.receivedNetTons ? formatTons(ctx.primaryWeightBalance.receivedNetTons) : '—'} />
            <Metric label='зачётный вес' value={ctx.primaryWeightBalance.acceptedNetTons ? formatTons(ctx.primaryWeightBalance.acceptedNetTons) : '—'} />
            <Metric label='денежный эффект' value={formatMoney(ctx.primaryWeightBalance.weightDeviationMoneyImpact)} tone='warn' />
          </div>
        </P7Section>
      ) : null}
    </>
  );
}

function SdizDocs({ ctx }: { readonly ctx: GrainContext }) {
  return (
    <P7Section surface='card' eyebrow='СДИЗ и документы' title='Допуски действий и денег' subtitle='Статусы показаны честно: тестовый контур, ручная проверка или требует боевого подключения.'>
      <div style={gridStyle}>
        {ctx.sdizGates.map((gate) => <div key={gate.id} style={cardStyle}><Pill tone={['signed', 'sent', 'redeemed'].includes(gate.status) ? 'good' : 'warn'}>{maturityLabel[gate.maturity]}</Pill><p style={textStrong}>{readableStatus(gate.operationType)}</p><p style={textSmall}>Ответственный: {roleLabel[gate.responsibleRole]}. Статус: {readableStatus(gate.status)}.</p></div>)}
        {ctx.documents.map((doc) => <div key={doc.id} style={cardStyle}><Pill tone={['uploaded', 'signed', 'not_required'].includes(doc.status) ? 'good' : 'warn'}>{readableStatus(doc.status)}</Pill><p style={textStrong}>{docLabels[doc.documentType] ?? doc.documentType}</p><p style={textSmall}>Ответственный: {roleLabel[doc.responsibleRole]}. Блокирует деньги: {doc.blocksMoneyRelease ? 'да' : 'нет'}.</p></div>)}
      </div>
    </P7Section>
  );
}

function Money({ ctx }: { readonly ctx: GrainContext }) {
  return (
    <P7Section surface='card' eyebrow='Деньги' title='Частичный выпуск и удержание спорной части' subtitle='Платформа не заявляет самостоятельный выпуск денег. Показано основание для банковского подтверждения.'>
      <div style={gridStyle}>
        <Metric label='сумма сделки' value={formatMoney(ctx.moneyProjection.grossDealAmount)} />
        <Metric label='зарезервировано' value={formatMoney(ctx.moneyProjection.reservedAmount)} tone='money' />
        <Metric label='к выпуску через банк' value={formatMoney(ctx.moneyProjection.readyToReleaseAmount)} tone='money' />
        <Metric label='под удержанием' value={formatMoney(ctx.moneyProjection.heldAmount)} tone='warn' />
        <Metric label='спорная часть' value={formatMoney(ctx.moneyProjection.disputedAmount)} tone='bad' />
      </div>
      {ctx.moneyProjection.nextAction ? <ActionLink action={ctx.moneyProjection.nextAction} /> : null}
    </P7Section>
  );
}

function Elevator({ ctx }: { readonly ctx: GrainContext }) {
  return (
    <P7Section surface='card' eyebrow='Элеваторный терминал' title={ctx.primaryElevatorOperation.elevatorName} subtitle='Элеватор видит машину, вес, пробу, лабораторию, СДИЗ и документы приёмки. Банковый и коммерческий контур скрыт.'>
      <div style={gridStyle}>
        <Metric label='машина' value={ctx.primaryElevatorOperation.vehiclePlate} note={ctx.primaryElevatorOperation.driverName} />
        <Metric label='очередь' value={ctx.primaryElevatorOperation.queueNumber ? `№ ${ctx.primaryElevatorOperation.queueNumber}` : '—'} />
        <Metric label='статус' value={readableStatus(ctx.primaryElevatorOperation.status)} />
        <Metric label='нетто' value={ctx.primaryElevatorOperation.netWeightTons ? formatTons(ctx.primaryElevatorOperation.netWeightTons) : '—'} />
      </div>
      <WeightQuality ctx={ctx} mode='both' />
    </P7Section>
  );
}

function Demo({ ctx }: { readonly ctx: GrainContext }) {
  const steps = ['Партия создана', 'Готовность рассчитана', 'Лот создан из партии', 'RFQ подобрал партию', 'Оффер принят', 'Деньги зарезервированы в тестовом статусе', 'СДИЗ поставлен как допуск', 'Логистика назначена', 'Водитель прибыл', 'Элеватор зафиксировал вес', 'Проба передана в лабораторию', 'Качество создало удержание', 'Спор открыт на конкретную сумму', 'Доказательства собраны', 'Банк видит основание частичного выпуска'];
  return <P7Section surface='card' eyebrow='Демо 3–5 минут' title='Сквозной сценарий от партии до денег' subtitle={`Активная партия: ${ctx.primaryBatch.id}. Интеграции показаны как тестовый или ручной контур.`}><div style={gridStyle}>{steps.map((step, index) => <div key={step} style={cardStyle}><Pill>{String(index + 1).padStart(2, '0')}</Pill><p style={textStrong}>{step}</p></div>)}</div></P7Section>;
}

function SupportAudit({ ctx }: { readonly ctx: GrainContext }) {
  return (
    <P7Section surface='card' eyebrow='Поддержка и аудит' title='Автообращения из причин остановки' subtitle='Каждое критическое действие связано с журналом и следующим шагом.'>
      <div style={gridStyle}>{ctx.supportCases.slice(0, 4).map((item) => <div key={item.id} style={cardStyle}><Pill tone={item.priority === 'critical' ? 'bad' : 'warn'}>{item.category}</Pill><p style={textStrong}>{item.title}</p><p style={textSmall}>{item.suggestedResolution}</p></div>)}</div>
    </P7Section>
  );
}

function ModeContent({ mode, ctx }: { readonly mode: GrainExecutionPageMode; readonly ctx: GrainContext }) {
  if (mode === 'rfq-list' || mode === 'rfq-new' || mode === 'rfq-detail') return <><Rfq ctx={ctx} /><Netback ctx={ctx} /></>;
  if (mode === 'elevator-terminal' || mode === 'elevator-operation') return <Elevator ctx={ctx} />;
  if (mode === 'deal-quality') return <WeightQuality ctx={ctx} mode='quality' />;
  if (mode === 'deal-weight') return <WeightQuality ctx={ctx} mode='weight' />;
  if (mode === 'deal-sdiz') return <SdizDocs ctx={ctx} />;
  if (mode === 'deal-release') return <><Money ctx={ctx} /><SdizDocs ctx={ctx} /></>;
  if (mode === 'demo-flow') return <><Demo ctx={ctx} /><Readiness ctx={ctx} /><Rfq ctx={ctx} /><Money ctx={ctx} /></>;
  return <><Readiness ctx={ctx} /><Netback ctx={ctx} /></>;
}

export function GrainExecutionPage({ mode, role = 'operator' }: { readonly mode: GrainExecutionPageMode; readonly role?: UserRole }) {
  const ctx = getGrainExecutionContext();
  const summary = ctx.summaryForRole(role);

  return (
    <main style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.section, color: P7_THEME_CSS.color.textPrimary }} data-platform-v7-grain-execution='true'>
      <P7Section surface='card' eyebrow='Цифровой контур исполнения зерновой сделки' title={<TitleForMode mode={mode} />} subtitle='Партия зерна → готовность → лот / RFQ → оффер → сделка → деньги → СДИЗ → логистика → водитель → элеватор → вес → проба → лаборатория → документы → удержание → спор → доказательства → решение.' actions={<Pill tone='warn'>{maturityLabel[summary.maturity]}</Pill>}>
        <div style={gridStyle}>
          <Metric label='активная партия' value={ctx.primaryBatch.id} note={`${ctx.primaryBatch.crop} ${ctx.primaryBatch.gostClass ?? ''}`} />
          <Metric label='роль' value={roleLabel[role]} note='Проекция данных ограничена ролью.' />
          <Metric label='следующее действие' value={summary.nextActions[0]?.title ?? '—'} note={summary.nextActions[0]?.description} tone='warn' />
        </div>
      </P7Section>
      <Summary ctx={ctx} role={role} />
      <ModeContent mode={mode} ctx={ctx} />
      <SupportAudit ctx={ctx} />
    </main>
  );
}
