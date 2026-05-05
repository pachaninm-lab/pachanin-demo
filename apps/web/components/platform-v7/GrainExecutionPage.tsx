import Link from 'next/link';
import { P7Section } from '@/components/platform-v7/P7Section';
import { P7_THEME_CSS } from '@/components/platform-v7/p7Theme';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';
import {
  basisLabel,
  formatMoney,
  formatMoneyPerTon,
  formatPercent,
  formatTons,
  maturityLabel,
  readableStatus,
  roleLabel,
} from '@/lib/platform-v7/grain-execution/format';
import type { ExecutionBlocker, GrainBatch, NextAction, UserRole } from '@/lib/platform-v7/grain-execution/types';

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
  alignItems: 'stretch',
} as const;

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: PLATFORM_V7_TOKENS.spacing.sm,
} as const;

const microStyle = {
  margin: 0,
  color: P7_THEME_CSS.color.textMuted,
  fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
  lineHeight: PLATFORM_V7_TOKENS.typography.caption.lineHeight,
} as const;

const strongStyle = {
  margin: 0,
  color: P7_THEME_CSS.color.textPrimary,
  fontSize: PLATFORM_V7_TOKENS.typography.h3.size,
  lineHeight: PLATFORM_V7_TOKENS.typography.h3.lineHeight,
  fontWeight: PLATFORM_V7_TOKENS.typography.h3.weight,
} as const;

const documentLabels: Record<string, string> = {
  contract: 'Договор',
  specification: 'Спецификация',
  invoice: 'Счёт',
  upd: 'УПД',
  transport_waybill: 'Транспортная накладная',
  etrn: 'ЭТрН',
  sdiz_realization: 'СДИЗ реализация',
  sdiz_transportation: 'СДИЗ перевозка',
  sdiz_acceptance: 'СДИЗ приёмка',
  quality_protocol: 'Протокол качества',
  weight_certificate: 'Весовые документы',
  discrepancy_act: 'Акт расхождения',
  edo_signature: 'Подпись ЭДО',
  bank_confirmation: 'Подтверждение банка',
};

function Pill({ children, tone = 'neutral' }: { readonly children: string; readonly tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'money' }) {
  const color =
    tone === 'good'
      ? 'var(--p7-color-success)'
      : tone === 'warn'
        ? 'var(--p7-color-warning)'
        : tone === 'bad'
          ? 'var(--p7-color-danger)'
          : tone === 'money'
            ? 'var(--p7-color-money)'
            : P7_THEME_CSS.color.textSecondary;
  const bg =
    tone === 'good'
      ? 'var(--p7-color-success-soft)'
      : tone === 'warn'
        ? 'var(--p7-color-warning-soft)'
        : tone === 'bad'
          ? 'var(--p7-color-danger-soft)'
          : tone === 'money'
            ? 'var(--p7-color-money-soft)'
            : P7_THEME_CSS.color.surfaceMuted;

  return (
    <span
      style={{
        display: 'inline-flex',
        width: 'fit-content',
        alignItems: 'center',
        borderRadius: PLATFORM_V7_TOKENS.radius.pill,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        background: bg,
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

function MetricCard({ label, value, note, tone }: { readonly label: string; readonly value: string; readonly note?: string; readonly tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'money' }) {
  return (
    <div style={cardStyle}>
      <Pill tone={tone}>{label}</Pill>
      <p style={{ margin: 0, color: P7_THEME_CSS.color.textPrimary, fontSize: 26, lineHeight: 1.1, fontWeight: 800 }}>{value}</p>
      {note ? <p style={microStyle}>{note}</p> : null}
    </div>
  );
}

function ActionLink({ action }: { readonly action: NextAction }) {
  return (
    <Link
      href={action.targetRoute}
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
      <span style={microStyle}>{action.disabledReason ?? action.description ?? `Ответственный: ${roleLabel[action.role]}`}</span>
    </Link>
  );
}

function BlockerCard({ blocker }: { readonly blocker: ExecutionBlocker }) {
  return (
    <div style={cardStyle}>
      <Pill tone={blocker.severity === 'critical' ? 'bad' : blocker.severity === 'warning' ? 'warn' : 'neutral'}>
        {blocker.severity === 'critical' ? 'критично' : blocker.severity === 'warning' ? 'внимание' : 'инфо'}
      </Pill>
      <p style={strongStyle}>{blocker.title}</p>
      <p style={microStyle}>{blocker.description}</p>
      <p style={microStyle}>Ответственный: {roleLabel[blocker.responsibleRole]}</p>
      {blocker.moneyImpact ? <p style={microStyle}>Денежный эффект: {formatMoney(blocker.moneyImpact)}</p> : null}
    </div>
  );
}

function BatchCard({ batch }: { readonly batch: GrainBatch }) {
  return (
    <Link href={`/platform-v7/batches/${batch.id}`} style={{ ...cardStyle, textDecoration: 'none' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Pill tone={batch.readinessScore >= 80 ? 'good' : batch.readinessScore >= 60 ? 'warn' : 'bad'}>готовность {formatPercent(batch.readinessScore)}</Pill>
        <Pill>{maturityLabel[batch.maturity]}</Pill>
      </div>
      <p style={strongStyle}>{batch.crop} {batch.gostClass ?? ''}</p>
      <p style={microStyle}>{formatTons(batch.totalVolumeTons)} всего / {formatTons(batch.availableVolumeTons)} доступно</p>
      <p style={microStyle}>{batch.region}, {batch.storageLocationName}</p>
      <div style={rowStyle}>
        <Pill tone={batch.fgisStatus === 'linked' ? 'good' : batch.fgisStatus === 'sync_error' ? 'bad' : 'warn'}>
          ФГИС: {batch.fgisStatus === 'linked' ? 'связан' : batch.fgisStatus === 'sync_error' ? 'ошибка' : 'проверка'}
        </Pill>
        <Pill tone={batch.qualityProfileId ? 'good' : 'warn'}>качество: {batch.qualityProfileId ? 'есть' : 'нужно добавить'}</Pill>
      </div>
    </Link>
  );
}

function SummaryStrip({ role }: { readonly role: UserRole }) {
  const ctx = getGrainExecutionContext();
  const summary = ctx.summaryForRole(role);
  return (
    <P7Section surface='card' eyebrow='Операционный статус' title='Цепочка партии до денег' subtitle={summary.currentState}>
      <div style={gridStyle}>
        <MetricCard label='к выпуску через банк' value={summary.moneySummary ? formatMoney(summary.moneySummary.readyToReleaseAmount) : '—'} note='Только после закрытия документов, СДИЗ и ручных проверок.' tone='money' />
        <MetricCard label='под удержанием' value={summary.moneySummary ? formatMoney(summary.moneySummary.heldAmount) : '—'} note='Удерживается только спорная часть.' tone='warn' />
        <MetricCard label='документы' value={summary.documentSummary ? `${summary.documentSummary.ready}/${summary.documentSummary.total}` : '—'} note='Документы являются допуском действий и денег.' />
        <MetricCard label='поддержка' value={summary.supportSummary ? String(summary.supportSummary.openCases) : '—'} note={summary.supportSummary?.nextActionTitle ?? 'Автообращения создаются из причин остановки.'} tone={summary.supportSummary?.criticalCases ? 'bad' : 'neutral'} />
      </div>
    </P7Section>
  );
}

function ReadinessPanel() {
  const ctx = getGrainExecutionContext();
  return (
    <P7Section surface='card' eyebrow='Партия зерна' title={`${ctx.primaryBatch.crop} ${ctx.primaryBatch.gostClass}`} subtitle='Партия стала исходной точкой продажи: из неё создаются лот, документы, СДИЗ, логистика, деньги и доказательства.'>
      <div style={gridStyle}>
        <MetricCard label='готовность к продаже' value={formatPercent(ctx.readiness.score)} note={readableStatus(ctx.readiness.status)} tone={ctx.readiness.status === 'ready_for_sale' ? 'good' : ctx.readiness.status === 'blocked' ? 'bad' : 'warn'} />
        <MetricCard label='доступный объём' value={formatTons(ctx.primaryBatch.availableVolumeTons)} note={`${formatTons(ctx.primaryBatch.reservedVolumeTons)} уже зарезервировано`} />
        <MetricCard label='место хранения' value={ctx.primaryBatch.region} note={ctx.primaryBatch.storageLocationName} />
      </div>
      <div style={gridStyle}>{ctx.readiness.blockers.map((blocker) => <div key={blocker.id} style={cardStyle}><Pill tone={blocker.severity === 'critical' ? 'bad' : 'warn'}>{blocker.title}</Pill><p style={microStyle}>{blocker.description}</p></div>)}</div>
      <div style={gridStyle}>{ctx.readiness.nextActions.map((action) => <ActionLink key={action.id} action={action} />)}</div>
    </P7Section>
  );
}

function QuickSalePanel() {
  return (
    <P7Section surface='card' eyebrow='Быстрый режим фермера' title='Продать зерно за 5 минут' subtitle='Форма не требует знания ФГИС, СДИЗ и документов. Ответ “не знаю” создаёт черновик и список следующих действий.'>
      <div style={gridStyle}>
        <div style={cardStyle}><Pill>1 шаг</Pill><p style={strongStyle}>Что продаёте</p><p style={microStyle}>Культура, класс, объём, год урожая, место хранения, анализ качества.</p></div>
        <div style={cardStyle}><Pill>2 шаг</Pill><p style={strongStyle}>Как хотите продать</p><p style={microStyle}>Самовывоз, доставка, помощь с логистикой, быстрые деньги или только проверка цены.</p></div>
        <div style={cardStyle}><Pill>3 шаг</Pill><p style={strongStyle}>Что уже готово</p><p style={microStyle}>ФГИС, СДИЗ, анализ, ЭДО, НДС, перевозка. Незнание не блокирует старт.</p></div>
      </div>
      <ReadinessPanel />
    </P7Section>
  );
}

function RfqPanel() {
  const ctx = getGrainExecutionContext();
  return (
    <P7Section surface='card' eyebrow='Закупочный запрос' title={`${ctx.primaryRfq.crop} ${ctx.primaryRfq.gostClass ?? ''} — ${formatTons(ctx.primaryRfq.volumeTons)}`} subtitle={`${basisLabel[ctx.primaryRfq.basis]}. Поставка: ${ctx.primaryRfq.deliveryRegion}. Сделка создаётся только после подтверждения сторон.`}>
      <div style={gridStyle}>
        <MetricCard label='максимальная цена' value={ctx.primaryRfq.maxPricePerTon ? formatMoneyPerTon(ctx.primaryRfq.maxPricePerTon) : '—'} note='Покупатель задаёт предел до расчёта логистики и риска.' />
        <MetricCard label='условие оплаты' value={readableStatus(ctx.primaryRfq.paymentTerms)} note={`${ctx.primaryRfq.paymentDelayDays ?? 0} дн. после события`} />
        <MetricCard label='требования' value={ctx.primaryRfq.documentRequirements.length.toString()} note='Документы, качество, резерв и логистика.' />
      </div>
      <div style={gridStyle}>
        {ctx.rfqMatches.map((match) => (
          <div key={match.batch.id} style={cardStyle}>
            <Pill tone={match.riskLevel === 'low' ? 'good' : match.riskLevel === 'medium' ? 'warn' : 'bad'}>риск: {match.riskLevel === 'low' ? 'низкий' : match.riskLevel === 'medium' ? 'средний' : 'высокий'}</Pill>
            <p style={strongStyle}>{match.batch.crop} {match.batch.gostClass}</p>
            <p style={microStyle}>{match.batch.ownerName}. {formatTons(match.batch.availableVolumeTons)} доступно.</p>
            <p style={microStyle}>Итоговая цена до точки: {formatMoneyPerTon(match.deliveredPricePerTon)}</p>
            <p style={microStyle}>{match.reasons.slice(0, 3).join(' ')}</p>
            <ActionLink action={match.nextAction} />
          </div>
        ))}
      </div>
    </P7Section>
  );
}

function NetbackPanel() {
  const ctx = getGrainExecutionContext();
  const best = ctx.netbacks[0];
  return (
    <P7Section surface='card' eyebrow='Чистая цена' title='Сравнение офферов по реальным деньгам' subtitle={best ? `Лучший оффер даёт ${formatMoneyPerTon(best.netPricePerTon)} чистыми после логистики, качества, срока оплаты и риска.` : undefined}>
      <div style={gridStyle}>
        {ctx.netbacks.map((item) => (
          <div key={item.id} style={cardStyle}>
            <Pill tone={item.riskLevel === 'low' ? 'good' : item.riskLevel === 'medium' ? 'warn' : 'bad'}>{item.basis}</Pill>
            <p style={strongStyle}>{formatMoneyPerTon(item.netPricePerTon)} чистыми</p>
            <p style={microStyle}>Цена: {formatMoneyPerTon(item.grossPricePerTon)}. Логистика: {formatMoney(item.logisticsCost)}. Риск: {formatMoney(item.riskReserve)}.</p>
            <p style={microStyle}>{item.explanation.join(' ')}</p>
          </div>
        ))}
      </div>
    </P7Section>
  );
}

function SdizPanel() {
  const ctx = getGrainExecutionContext();
  return (
    <P7Section surface='card' eyebrow='СДИЗ и ФГИС' title='СДИЗ как допуск действий' subtitle='Статусы показаны честно: тестовый контур или ручная проверка. Реального внешнего подключения не заявлено.'>
      <div style={gridStyle}>
        {ctx.sdizGates.map((gate) => (
          <div key={gate.id} style={cardStyle}>
            <Pill tone={['signed', 'sent', 'redeemed'].includes(gate.status) ? 'good' : gate.status === 'error' ? 'bad' : 'warn'}>{maturityLabel[gate.maturity]}</Pill>
            <p style={strongStyle}>{readableStatus(gate.operationType)}</p>
            <p style={microStyle}>Ответственный: {roleLabel[gate.responsibleRole]}. Статус: {readableStatus(gate.status)}.</p>
            <p style={microStyle}>Блокирует: {gate.blockingShipment ? 'отгрузку, ' : ''}{gate.blockingAcceptance ? 'приёмку, ' : ''}{gate.blockingMoneyRelease ? 'выпуск денег' : 'нет критичной остановки'}.</p>
          </div>
        ))}
      </div>
    </P7Section>
  );
}

function DocumentsPanel() {
  const ctx = getGrainExecutionContext();
  return (
    <P7Section surface='card' eyebrow='Документы' title='Документы как система допуска' subtitle='Каждый документ связан с действием, ответственным и тем, что он блокирует.'>
      <div style={gridStyle}>
        {ctx.documents.map((doc) => (
          <div key={doc.id} style={cardStyle}>
            <Pill tone={['uploaded', 'signed', 'not_required'].includes(doc.status) ? 'good' : doc.status === 'expired' || doc.status === 'rejected' ? 'bad' : 'warn'}>{readableStatus(doc.status)}</Pill>
            <p style={strongStyle}>{documentLabels[doc.documentType] ?? doc.documentType}</p>
            <p style={microStyle}>Ответственный: {roleLabel[doc.responsibleRole]}. Внешний статус: {doc.externalStatus ?? 'ручная проверка'}.</p>
            <p style={microStyle}>Блокирует: {doc.blocksShipment ? 'отгрузку, ' : ''}{doc.blocksAcceptance ? 'приёмку, ' : ''}{doc.blocksMoneyRelease ? 'деньги' : 'нет'}.</p>
          </div>
        ))}
      </div>
    </P7Section>
  );
}

function WeightQualityPanel({ mode }: { readonly mode: 'quality' | 'weight' | 'both' }) {
  const ctx = getGrainExecutionContext();
  return (
    <>
      {mode !== 'weight' ? (
        <P7Section surface='card' eyebrow='Качество и удержания' title='Денежная дельта по лаборатории' subtitle={`Под удержанием по качеству: ${formatMoney(ctx.primaryQualityDelta.totalHoldAmount)}.`}>
          <div style={gridStyle}>
            {ctx.primaryQualityDelta.items.map((item) => (
              <div key={item.metric} style={cardStyle}>
                <Pill tone={item.requiresDispute ? 'warn' : 'neutral'}>{item.metric}</Pill>
                <p style={strongStyle}>{formatMoney(item.moneyImpact)}</p>
                <p style={microStyle}>По договору: {item.agreedValue}. По приёмке: {item.actualValue}. Отклонение: {item.deviationText}.</p>
              </div>
            ))}
          </div>
        </P7Section>
      ) : null}
      {mode !== 'quality' ? (
        <P7Section surface='card' eyebrow='Весовой баланс' title='Расхождение веса и денежный эффект' subtitle='Деньги пересчитываются по зачётному весу, а не блокируются целиком.'>
          <div style={gridStyle}>
            <MetricCard label='по договору' value={formatTons(ctx.primaryWeightBalance.contractedVolumeTons)} />
            <MetricCard label='принято нетто' value={ctx.primaryWeightBalance.receivedNetTons ? formatTons(ctx.primaryWeightBalance.receivedNetTons) : '—'} />
            <MetricCard label='зачётный вес' value={ctx.primaryWeightBalance.acceptedNetTons ? formatTons(ctx.primaryWeightBalance.acceptedNetTons) : '—'} />
            <MetricCard label='денежный эффект' value={formatMoney(ctx.primaryWeightBalance.weightDeviationMoneyImpact)} tone={ctx.primaryWeightBalance.weightDeviationMoneyImpact.value > 0 ? 'warn' : 'good'} />
          </div>
        </P7Section>
      ) : null}
    </>
  );
}

function MoneyPanel() {
  const ctx = getGrainExecutionContext();
  return (
    <P7Section surface='card' eyebrow='Деньги' title='Частичный выпуск и удержание только спорной части' subtitle='Платформа не заявляет самостоятельный выпуск денег. Показано основание для банковского подтверждения.'>
      <div style={gridStyle}>
        <MetricCard label='сумма сделки' value={formatMoney(ctx.moneyProjection.grossDealAmount)} />
        <MetricCard label='зарезервировано' value={formatMoney(ctx.moneyProjection.reservedAmount)} tone='money' />
        <MetricCard label='к выпуску через банк' value={formatMoney(ctx.moneyProjection.readyToReleaseAmount)} tone='money' />
        <MetricCard label='под удержанием' value={formatMoney(ctx.moneyProjection.heldAmount)} tone='warn' />
        <MetricCard label='спорная часть' value={formatMoney(ctx.moneyProjection.disputedAmount)} tone='bad' />
      </div>
      <div style={gridStyle}>{ctx.moneyProjection.adjustments.map((adjustment) => <div key={adjustment.id} style={cardStyle}><Pill tone={adjustment.status === 'disputed' ? 'bad' : 'warn'}>{readableStatus(adjustment.status)}</Pill><p style={strongStyle}>{adjustment.title}</p><p style={microStyle}>{formatMoney(adjustment.amount)}. Частичный выпуск: {adjustment.allowsPartialRelease ? 'доступен' : 'нет'}.</p></div>)}</div>
      {ctx.moneyProjection.nextAction ? <ActionLink action={ctx.moneyProjection.nextAction} /> : null}
    </P7Section>
  );
}

function ElevatorPanel() {
  const ctx = getGrainExecutionContext();
  return (
    <P7Section surface='card' eyebrow='Элеваторный терминал' title={ctx.primaryElevatorOperation.elevatorName} subtitle='Элеватор видит машину, вес, пробу, лабораторию, СДИЗ и документы приёмки. Коммерческая маржа и банковые данные скрыты.'>
      <div style={gridStyle}>
        <MetricCard label='машина' value={ctx.primaryElevatorOperation.vehiclePlate} note={ctx.primaryElevatorOperation.driverName} />
        <MetricCard label='очередь' value={ctx.primaryElevatorOperation.queueNumber ? `№ ${ctx.primaryElevatorOperation.queueNumber}` : '—'} />
        <MetricCard label='статус' value={readableStatus(ctx.primaryElevatorOperation.status)} />
        <MetricCard label='нетто' value={ctx.primaryElevatorOperation.netWeightTons ? formatTons(ctx.primaryElevatorOperation.netWeightTons) : '—'} />
      </div>
      <WeightQualityPanel mode='both' />
    </P7Section>
  );
}

function SupportAndAuditPanel() {
  const ctx = getGrainExecutionContext();
  return (
    <P7Section surface='card' eyebrow='Поддержка и аудит' title='Автообращения из причин остановки' subtitle='Поддержка работает как центр устранения проблем сделки, а не как обычный чат.'>
      <div style={gridStyle}>
        {ctx.supportCases.slice(0, 6).map((supportCase) => (
          <div key={supportCase.id} style={cardStyle}>
            <Pill tone={supportCase.priority === 'critical' ? 'bad' : supportCase.priority === 'high' ? 'warn' : 'neutral'}>{supportCase.category}</Pill>
            <p style={strongStyle}>{supportCase.title}</p>
            <p style={microStyle}>{supportCase.suggestedResolution}</p>
          </div>
        ))}
      </div>
      <div style={gridStyle}>
        {ctx.auditEvents.slice(0, 6).map((event) => (
          <div key={event.id} style={cardStyle}>
            <Pill>{roleLabel[event.actorRole]}</Pill>
            <p style={strongStyle}>{event.action}</p>
            <p style={microStyle}>{event.reason ?? 'Событие записано в журнал.'}</p>
          </div>
        ))}
      </div>
    </P7Section>
  );
}

function DemoFlowPanel() {
  const steps = ['Партия создана', 'Готовность рассчитана', 'Лот создан из партии', 'RFQ подобрал партию', 'Оффер принят', 'Деньги зарезервированы в тестовом статусе', 'СДИЗ поставлен как допуск', 'Логистика назначена', 'Водитель прибыл', 'Элеватор зафиксировал вес', 'Проба передана в лабораторию', 'Качество создало удержание', 'Спор открыт на конкретную сумму', 'Доказательства собраны', 'Банк видит основание частичного выпуска'];
  return (
    <P7Section surface='card' eyebrow='Демо 3–5 минут' title='Сквозной сценарий от партии до денег' subtitle='Показывает controlled-pilot логику без заявлений о боевых интеграциях.'>
      <div style={gridStyle}>{steps.map((step, index) => <div key={step} style={cardStyle}><Pill>{String(index + 1).padStart(2, '0')}</Pill><p style={strongStyle}>{step}</p></div>)}</div>
    </P7Section>
  );
}

function renderMode(mode: GrainExecutionPageMode) {
  if (mode === 'batches') return <><ReadinessPanel /><NetbackPanel /></>;
  if (mode === 'batch-detail' || mode === 'quick-sale') return <><QuickSalePanel /><NetbackPanel /></>;
  if (mode === 'rfq-list' || mode === 'rfq-new' || mode === 'rfq-detail') return <><RfqPanel /><NetbackPanel /></>;
  if (mode === 'elevator-terminal' || mode === 'elevator-operation') return <ElevatorPanel />;
  if (mode === 'deal-quality') return <><WeightQualityPanel mode='quality' /><SupportAndAuditPanel /></>;
  if (mode === 'deal-weight') return <><WeightQualityPanel mode='weight' /><SupportAndAuditPanel /></>;
  if (mode === 'deal-sdiz') return <><SdizPanel /><DocumentsPanel /></>;
  if (mode === 'deal-release') return <><MoneyPanel /><DocumentsPanel /><SdizPanel /></>;
  return <><DemoFlowPanel /><ReadinessPanel /><RfqPanel /><MoneyPanel /></>;
}

function pageTitle(mode: GrainExecutionPageMode): string {
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
  return titles[mode];
}

export function GrainExecutionPage({ mode, role = 'operator' }: { readonly mode: GrainExecutionPageMode; readonly role?: UserRole }) {
  const ctx = getGrainExecutionContext();
  const summary = ctx.summaryForRole(role);

  return (
    <main style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.section, color: P7_THEME_CSS.color.textPrimary }} data-platform-v7-grain-execution='true'>
      <P7Section
        surface='card'
        eyebrow='Цифровой контур исполнения зерновой сделки'
        title={pageTitle(mode)}
        subtitle='Партия зерна → готовность → лот / RFQ → оффер → сделка → деньги → СДИЗ → логистика → водитель → элеватор → вес → проба → лаборатория → документы → удержание → спор → доказательства → решение.'
        actions={<Pill tone='warn'>{maturityLabel[summary.maturity]}</Pill>}
      >
        <div style={gridStyle}>
          <MetricCard label='активная партия' value={ctx.primaryBatch.id} note={`${ctx.primaryBatch.crop} ${ctx.primaryBatch.gostClass ?? ''}`} />
          <MetricCard label='роль' value={roleLabel[role]} note='Проекция данных ограничена ролью.' />
          <MetricCard label='следующее действие' value={summary.nextActions[0]?.title ?? '—'} note={summary.nextActions[0]?.description} tone='warn' />
        </div>
      </P7Section>

      <SummaryStrip role={role} />

      {summary.blockers.length > 0 ? (
        <P7Section surface='card' eyebrow='Причины остановки' title='Что мешает исполнению' subtitle='Каждая причина связана с ответственным, действием, документом, СДИЗ или деньгами.'>
          <div style={gridStyle}>{summary.blockers.map((blocker) => <BlockerCard key={blocker.id} blocker={blocker} />)}</div>
        </P7Section>
      ) : null}

      {renderMode(mode)}

      <SupportAndAuditPanel />
    </main>
  );
}
