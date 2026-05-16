'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { limitPremiumText, premiumTextLimits } from '@/lib/platform-v7/premium/copy';
import { formatPremiumRub, formatPremiumRubCompact, isMoneyBalanced } from '@/lib/platform-v7/premium/money';
import type {
  BlockingReasonModel,
  DealDocumentModel,
  DealRole,
  DealStepStatus,
  DealTone,
  DealViewModel,
  DriverTaskModel,
  EvidenceModel,
  ExecutionStepModel,
  NextActionModel,
  RiskItemModel,
  TimelineEventModel,
} from '@/lib/platform-v7/premium/types';
import styles from './ExecutionUi.module.css';

const roleLabels: Record<DealRole, string> = {
  seller: 'Продавец', buyer: 'Покупатель', logistics: 'Логистика', driver: 'Водитель', elevator: 'Элеватор', lab: 'Лаборатория', surveyor: 'Сюрвейер', bank: 'Банк', arbiter: 'Арбитр', compliance: 'Комплаенс', operator: 'Оператор', executive: 'Руководитель',
};

const roleFocusLabels: Record<DealRole, string> = {
  seller: 'получение денег и документы',
  buyer: 'резерв, качество и приёмка',
  logistics: 'рейс, сроки и доказательства',
  driver: 'текущий рейс',
  elevator: 'вес, приёмка и акт',
  lab: 'качество и протокол',
  surveyor: 'доказательства и расхождения',
  bank: 'основания для банковского подтверждения',
  arbiter: 'спор и доказательства',
  compliance: 'документы и риск допуска',
  operator: 'снятие блокеров сделки',
  executive: 'деньги под риском и контроль',
};

const stepLabels: Record<DealStepStatus, string> = { done: 'Выполнено', active: 'В работе', pending: 'Ожидает', blocked: 'Остановлено', review: 'Проверка' };

const roleSections: Record<DealRole, Array<'money' | 'documents' | 'execution' | 'evidence' | 'timeline' | 'risk'>> = {
  seller: ['money', 'documents', 'execution', 'risk', 'timeline'],
  buyer: ['money', 'documents', 'execution', 'evidence', 'risk'],
  logistics: ['execution', 'documents', 'evidence', 'timeline'],
  driver: ['execution'],
  elevator: ['execution', 'documents', 'evidence', 'risk'],
  lab: ['execution', 'documents', 'evidence', 'risk'],
  surveyor: ['execution', 'documents', 'evidence', 'timeline'],
  bank: ['money', 'documents', 'evidence', 'risk', 'timeline'],
  arbiter: ['money', 'documents', 'evidence', 'timeline'],
  compliance: ['documents', 'evidence', 'risk', 'timeline'],
  operator: ['money', 'documents', 'execution', 'risk', 'timeline'],
  executive: ['money', 'risk', 'timeline'],
};

function cx(...classes: Array<string | false | undefined>): string { return classes.filter(Boolean).join(' '); }

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: DealTone }) {
  return <span className={cx(styles.badge, styles[`tone_${tone}`])}>{children}</span>;
}

function Card({ title, eyebrow, children, className }: { title: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return <section className={cx(styles.card, className)}>{eyebrow ? <div className={styles.eyebrow}>{limitPremiumText(eyebrow, premiumTextLimits.description)}</div> : null}<h2 className={styles.cardTitle}>{limitPremiumText(title, premiumTextLimits.title)}</h2>{children}</section>;
}

function StatusBar({ deal, role }: { deal: DealViewModel; role: DealRole }) {
  const balanceLabel = isMoneyBalanced(deal.money) ? 'деньги сходятся' : 'нужна сверка денег';
  const mainDocument = deal.documents.find((doc) => doc.status !== 'ready');
  return (
    <section className={styles.statusBar} aria-label="Состояние сделки">
      <div className={styles.statusTitle}><div className={styles.eyebrow}>{roleLabels[role]} · {roleFocusLabels[role]} · {balanceLabel}</div><h1>{limitPremiumText(deal.title, premiumTextLimits.title)}</h1><p>{limitPremiumText(deal.currentState, premiumTextLimits.description)}</p></div>
      <div className={styles.fact}><span>Сделка</span><strong>{deal.id}</strong></div>
      <div className={styles.fact}><span>Документ</span><strong>{limitPremiumText(mainDocument?.title ?? 'основания готовы', 52)}</strong></div>
      <div className={styles.fact}><span>Резерв</span><strong>{formatPremiumRubCompact(deal.money.reservedRub)}</strong></div>
      <div className={styles.fact}><span>Действие</span><strong>{limitPremiumText(deal.nextAction.label, 52)}</strong></div>
    </section>
  );
}

function DealCoreSnapshot({ deal }: { deal: DealViewModel }) {
  const readyDocuments = deal.documents.filter((doc) => doc.status === 'ready').length;
  const mainBlocker = deal.blockers[0];
  const documentsLabel = `${readyDocuments}/${deal.documents.length} готовы`;
  const moneyLabel = `${formatPremiumRubCompact(deal.money.reservedRub)} резерв`;
  const blockerLabel = mainBlocker ? mainBlocker.title : 'Остановок нет';
  const blockerMeta = mainBlocker ? `${mainBlocker.responsible} · ${mainBlocker.impact}` : 'деньги, документы и груз идут по условиям';

  return (
    <section className={styles.dealCore} aria-label="Главное по сделке">
      <article className={styles.coreCell}>
        <span>Деньги</span>
        <strong>{limitPremiumText(moneyLabel, 40)}</strong>
        <em>{isMoneyBalanced(deal.money) ? 'резерв разложен' : 'нужна сверка'}</em>
      </article>
      <article className={styles.coreCell}>
        <span>Документы</span>
        <strong>{documentsLabel}</strong>
        <em>{limitPremiumText(deal.documents.find((doc) => doc.status !== 'ready')?.title ?? 'нет блокера', 56)}</em>
      </article>
      <article className={styles.coreCell}>
        <span>Главный блокер</span>
        <strong>{limitPremiumText(blockerLabel, 56)}</strong>
        <em>{limitPremiumText(blockerMeta, 84)}</em>
      </article>
      <article className={cx(styles.coreCell, styles.coreActionCell)}>
        <span>Следующий шаг</span>
        <strong>{limitPremiumText(deal.nextAction.label, premiumTextLimits.cta)}</strong>
        <em>{limitPremiumText(deal.nextAction.responsible ?? deal.nextAction.reason ?? 'ответственный указан в действии', 72)}</em>
      </article>
    </section>
  );
}

function Blocker({ item }: { item: BlockingReasonModel }) {
  return (
    <article className={cx(styles.blocker, styles[`tone_${item.tone ?? 'warning'}`])}>
      <header><div><span className={styles.eyebrow}>причина остановки</span><strong>{limitPremiumText(item.title, premiumTextLimits.title)}</strong></div><Badge tone={item.tone ?? 'warning'}>стоп</Badge></header>
      <p>{limitPremiumText(item.reason, premiumTextLimits.description)}</p>
      <dl className={styles.compactFacts}><div><dt>Влияние</dt><dd>{limitPremiumText(item.impact, 96)}</dd></div><div><dt>Ответственный</dt><dd>{limitPremiumText(item.responsible, 64)}</dd></div></dl>
      <div className={styles.inlineAction}>Действие: {limitPremiumText(item.nextAction, premiumTextLimits.cta)}</div>
    </article>
  );
}

function NextAction({ action }: { action: NextActionModel }) {
  return <aside className={styles.nextAction} aria-label="Следующее действие"><div className={styles.eyebrow}>следующее действие</div><h2 className={styles.cardTitle}>{limitPremiumText(action.label, premiumTextLimits.title)}</h2>{action.reason ? <p>Почему сейчас: {limitPremiumText(action.reason, premiumTextLimits.description)}</p> : null}{action.responsible ? <Badge tone="info">{limitPremiumText(action.responsible, 48)}</Badge> : null}<button className={styles.primaryButton} type="button" disabled={Boolean(action.disabledReason)}>{limitPremiumText(action.label, premiumTextLimits.cta)}</button>{action.disabledReason ? <p>Почему недоступно: {limitPremiumText(action.disabledReason, premiumTextLimits.description)}</p> : null}</aside>;
}

function MoneyRail({ deal }: { deal: DealViewModel }) {
  const blockedRub = deal.money.heldRub + deal.money.awaitingDocsRub + deal.money.disputedRub;
  const parts = [
    { label: 'К подтверждению', value: deal.money.readyToReleaseRub, tone: 'success' as DealTone },
    { label: 'Удержано', value: deal.money.heldRub, tone: 'warning' as DealTone },
    { label: 'Ждёт документы', value: deal.money.awaitingDocsRub, tone: 'info' as DealTone },
    { label: 'В споре', value: deal.money.disputedRub, tone: 'dispute' as DealTone },
    { label: 'Подтверждено', value: deal.money.releasedRub, tone: 'neutral' as DealTone },
  ];
  return (
    <section className={cx(styles.rail, styles.span12)} aria-label="Деньги по сделке">
      <div className={styles.railTop}>
        <div className={styles.moneyHeader}>
          <div><div className={styles.eyebrow}>деньги</div><strong>{formatPremiumRub(deal.money.reservedRub)}</strong></div>
          <Badge tone={isMoneyBalanced(deal.money) ? 'success' : 'warning'}>{isMoneyBalanced(deal.money) ? 'сходится' : 'сверить'}</Badge>
        </div>
        <div className={styles.moneySummary}>
          <span>К подтверждению: {formatPremiumRubCompact(deal.money.readyToReleaseRub)}</span>
          <span>Остановлено: {formatPremiumRubCompact(blockedRub)}</span>
          <span>Банк подтвердил: {formatPremiumRubCompact(deal.money.releasedRub)}</span>
        </div>
      </div>
      <div className={styles.moneyParts}>{parts.map((part) => <div key={part.label} className={cx(styles.moneyPart, styles[`tone_${part.tone}`])}><span>{part.label}</span><strong>{formatPremiumRubCompact(part.value)}</strong></div>)}</div>
    </section>
  );
}

function DocumentMatrix({ documents }: { documents: DealDocumentModel[] }) {
  const readyCount = documents.filter((doc) => doc.status === 'ready').length;
  const blockedCount = documents.filter((doc) => doc.status === 'blocked').length;
  const reviewCount = documents.length - readyCount - blockedCount;
  return <Card title="Матрица документов" eyebrow="документы" className={styles.span6}><div className={styles.docSummary} aria-label="Сводка документов"><span>{readyCount}/{documents.length} готовы</span><span>{reviewCount} проверить</span><span>{blockedCount} стоп</span></div><div className={styles.docMatrix}>{documents.map((doc) => <article key={doc.id} className={styles.docRow} data-status={doc.status}><div className={styles.docMain}><strong>{limitPremiumText(doc.title, 70)}</strong><span>{limitPremiumText(doc.blocks, 74)}</span></div><Badge tone={doc.status === 'ready' ? 'success' : doc.status === 'blocked' ? 'danger' : 'warning'}>{doc.status === 'ready' ? 'готово' : doc.status === 'blocked' ? 'стоп' : 'проверить'}</Badge><span className={styles.docOwner}>{limitPremiumText(doc.responsible, 52)}</span></article>)}</div></Card>;
}

function ExecutionChain({ steps }: { steps: ExecutionStepModel[] }) {
  return <Card title="Цепочка исполнения" eyebrow="этап · ответственный · влияние" className={styles.span6}><div className={styles.executionList}>{steps.map((step) => <article key={step.id} className={styles.executionStep} data-status={step.status}><div className={styles.executionMain}><strong>{limitPremiumText(step.label, 68)}</strong><span>{limitPremiumText(step.nextAction ?? step.blocks ?? 'следить за этапом', 76)}</span></div><Badge tone={step.status === 'done' ? 'success' : step.status === 'blocked' ? 'danger' : step.status === 'active' ? 'info' : 'warning'}>{stepLabels[step.status]}</Badge><div className={styles.executionMeta}><span>{limitPremiumText(step.responsible, 56)}</span>{step.moneyImpactRub ? <span>{formatPremiumRubCompact(step.moneyImpactRub)}</span> : null}</div></article>)}</div></Card>;
}

function EvidencePack({ evidence }: { evidence: EvidenceModel[] }) {
  const checkedCount = evidence.filter((item) => item.status === 'done').length;
  const impactRub = evidence.reduce((sum, item) => sum + (item.moneyImpactRub ?? 0), 0);
  return <Card title="Пакет доказательств" eyebrow="источник · роль · влияние" className={styles.span6}><div className={styles.evidenceSummary}><span>{checkedCount}/{evidence.length} проверены</span><span>Влияние: {formatPremiumRubCompact(impactRub)}</span></div><div className={styles.evidenceGrid}>{evidence.map((item) => <article key={item.id} className={styles.evidenceItem} data-status={item.status}><div className={styles.evidenceMain}><strong>{limitPremiumText(item.title, 70)}</strong><span>{limitPremiumText(item.relatedDocument ?? item.relatedTrip ?? item.type, 64)}</span></div><Badge tone={item.status === 'done' ? 'success' : item.status === 'blocked' ? 'danger' : 'warning'}>{stepLabels[item.status]}</Badge><div className={styles.evidenceMeta}><span>{limitPremiumText(item.source, 52)}</span><span>{limitPremiumText(item.role, 48)}</span><time>{item.time}</time></div></article>)}</div></Card>;
}

function RiskHeatline({ risks }: { risks: RiskItemModel[] }) {
  if (risks.length === 0) return null;
  return <Card title="Риски исполнения" eyebrow="что может остановить сделку" className={styles.span6}><div className={styles.list}>{risks.map((risk) => <article key={risk.id} className={styles.step}><div className={styles.stepTop}><strong>{limitPremiumText(risk.label, 64)}</strong><Badge tone={risk.tone}>риск</Badge></div><p>{limitPremiumText(risk.detail, premiumTextLimits.description)}</p></article>)}</div></Card>;
}

function DealEventLog({ items }: { items: TimelineEventModel[] }) {
  return <Card title="Журнал сделки" eyebrow="последовательность событий" className={styles.span6}><div className={styles.timeline}>{items.map((event) => <article key={event.id} className={styles.timelineItem}><time>{event.time}</time><div><strong>{limitPremiumText(event.title, 80)}</strong><p>{limitPremiumText(event.actor ?? event.impact ?? 'событие сделки', 100)}</p></div></article>)}</div></Card>;
}

function PremiumTopChrome({ activeRole, roles, onSelectRole }: { activeRole: DealRole; roles: DealRole[]; onSelectRole: (role: DealRole) => void }) {
  return (
    <div className={styles.topChrome}>
      <nav className={styles.mainNav} aria-label="Основная навигация">
        <strong>Прозрачная Цена</strong>
        <a href="/platform-v7">Сделки</a>
        <a href="/platform-v7/lots">Лоты</a>
        <a href="/platform-v7/bank">Деньги</a>
      </nav>
      <select className={styles.roleSelect} value={activeRole} aria-label="Активная роль" onChange={(event) => onSelectRole(event.target.value as DealRole)}>
        {roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
      </select>
    </div>
  );
}

export function DriverFieldShell({ task, theme = 'dark' }: { task: DriverTaskModel; theme?: 'dark' | 'light' }) {
  return <main className={styles.driverRoot} data-theme={theme}><header className={styles.driverHeader}><div className={styles.eyebrow}>Прозрачная Цена · водитель</div><strong>Рейс {limitPremiumText(task.tripId, 32)}</strong><span>Следующее действие: {limitPremiumText(task.nextAction, premiumTextLimits.cta)}</span></header><section className={styles.driverPanel} aria-label="Текущий рейс"><p>{limitPremiumText(task.routeLabel, 96)}</p>{task.etaLabel ? <Badge tone="info">{limitPremiumText(task.etaLabel, 56)}</Badge> : null}<button className={styles.driverPrimaryButton} type="button">{limitPremiumText(task.nextAction, premiumTextLimits.cta)}</button><div className={styles.driverActions}>{task.secondaryActions.map((action) => <button key={action.id} className={styles.driverSecondaryButton} type="button">{limitPremiumText(action.label, premiumTextLimits.cta)}</button>)}</div><div className={styles.offlineQueue}>Офлайн-очередь: {task.offlineQueueCount}</div></section></main>;
}

export function PremiumDealShell({ deal, initialRole = 'buyer', roles = ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'arbiter', 'compliance', 'operator', 'executive'], theme = 'light', onRoleChange }: { deal: DealViewModel; initialRole?: DealRole; roles?: DealRole[]; theme?: 'dark' | 'light'; onRoleChange?: (role: DealRole) => void }) {
  const [activeRole, setActiveRole] = useState<DealRole>(initialRole);
  const visibleSections = useMemo(() => roleSections[activeRole], [activeRole]);
  const topBlockers = deal.blockers.slice(0, 2);
  const handleRoleChange = (nextRole: DealRole) => { setActiveRole(nextRole); onRoleChange?.(nextRole); };

  useEffect(() => setActiveRole(initialRole), [initialRole]);

  if (activeRole === 'driver' && deal.driverTask) return <DriverFieldShell task={deal.driverTask} theme={theme} />;

  return <main className={styles.root} data-role={activeRole} data-theme={theme}><div className={styles.shell}><PremiumTopChrome activeRole={activeRole} roles={roles} onSelectRole={handleRoleChange} /><StatusBar deal={deal} role={activeRole} /><DealCoreSnapshot deal={deal} /><section className={styles.aboveFold} aria-label="Главный контекст сделки"><div className={styles.blockerGrid}>{topBlockers.length > 0 ? topBlockers.map((item) => <Blocker key={item.id} item={item} />) : <Card title="Сделка идёт по условиям" eyebrow="активных остановок нет"><p>Следующее действие видно справа. Деньги, документы и груз сверяются по цепочке исполнения.</p></Card>}</div><NextAction action={deal.nextAction} /></section><section className={styles.contentGrid} aria-label="Рабочие блоки сделки">{visibleSections.includes('money') ? <MoneyRail deal={deal} /> : null}{visibleSections.includes('documents') ? <DocumentMatrix documents={deal.documents} /> : null}{visibleSections.includes('execution') ? <ExecutionChain steps={deal.execution} /> : null}{visibleSections.includes('evidence') ? <EvidencePack evidence={deal.evidence} /> : null}{visibleSections.includes('risk') ? <RiskHeatline risks={deal.risks} /> : null}{visibleSections.includes('timeline') ? <DealEventLog items={deal.timeline} /> : null}</section></div></main>;
}
