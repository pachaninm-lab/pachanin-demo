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
  const balanceLabel = isMoneyBalanced(deal.money) ? 'сходится' : 'требует сверки';
  return (
    <section className={styles.statusBar} aria-label="Состояние сделки">
      <div className={styles.statusTitle}><div className={styles.eyebrow}>{roleLabels[role]} · {limitPremiumText(deal.stageLabel, 48)}</div><h1>{limitPremiumText(deal.title, premiumTextLimits.title)}</h1><p>{limitPremiumText(deal.currentState, premiumTextLimits.description)}</p></div>
      <div className={styles.fact}><span>Сделка</span><strong>{deal.id}</strong></div>
      <div className={styles.fact}><span>Базис</span><strong>{limitPremiumText(deal.basisLabel, 52)}</strong></div>
      <div className={styles.fact}><span>Резерв</span><strong>{formatPremiumRubCompact(deal.money.reservedRub)}</strong></div>
      <div className={styles.fact}><span>Деньги</span><strong>{balanceLabel}</strong></div>
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
        <span>Действие</span>
        <strong>{limitPremiumText(deal.nextAction.label, premiumTextLimits.cta)}</strong>
        <em>{limitPremiumText(deal.nextAction.responsible ?? deal.nextAction.reason ?? 'ответственный указан в действии', 72)}</em>
      </article>
    </section>
  );
}

function Blocker({ item }: { item: BlockingReasonModel }) {
  return (
    <article className={cx(styles.blocker, styles[`tone_${item.tone ?? 'warning'}`])}>
      <header><strong>{limitPremiumText(item.title, premiumTextLimits.title)}</strong><Badge tone={item.tone ?? 'warning'}>Причина остановки</Badge></header>
      <p>{limitPremiumText(item.reason, premiumTextLimits.description)}</p>
      <dl className={styles.compactFacts}><div><dt>Влияние</dt><dd>{limitPremiumText(item.impact, 96)}</dd></div><div><dt>Ответственный</dt><dd>{limitPremiumText(item.responsible, 64)}</dd></div></dl>
      <div className={styles.inlineAction}>Действие: {limitPremiumText(item.nextAction, premiumTextLimits.cta)}</div>
    </article>
  );
}

function NextAction({ action }: { action: NextActionModel }) {
  return <aside className={styles.nextAction} aria-label="Следующее действие"><div className={styles.eyebrow}>следующее действие</div><h2 className={styles.cardTitle}>{limitPremiumText(action.label, premiumTextLimits.title)}</h2>{action.reason ? <p>{limitPremiumText(action.reason, premiumTextLimits.description)}</p> : null}{action.responsible ? <Badge tone="info">{limitPremiumText(action.responsible, 48)}</Badge> : null}<button className={styles.primaryButton} type="button" disabled={Boolean(action.disabledReason)}>{limitPremiumText(action.label, premiumTextLimits.cta)}</button>{action.disabledReason ? <p>{limitPremiumText(action.disabledReason, premiumTextLimits.description)}</p> : null}</aside>;
}

function MoneyRail({ deal }: { deal: DealViewModel }) {
  const parts = [['К выпуску', deal.money.readyToReleaseRub], ['Удержано', deal.money.heldRub], ['Ждёт документы', deal.money.awaitingDocsRub], ['В споре', deal.money.disputedRub], ['Выпущено', deal.money.releasedRub]] as const;
  return <section className={cx(styles.rail, styles.span12)} aria-label="Деньги по сделке"><div className={styles.railTop}><div className={styles.eyebrow}>деньги</div><strong>{formatPremiumRub(deal.money.reservedRub)}</strong><span>{isMoneyBalanced(deal.money) ? 'Резерв разложен без расхождений.' : 'Есть расхождение. Нужна сверка с основанием.'}</span></div><div className={styles.moneyParts}>{parts.map(([label, value]) => <div key={label} className={styles.moneyPart}><span>{label}</span><strong>{formatPremiumRubCompact(value)}</strong></div>)}</div></section>;
}

function DocumentMatrix({ documents }: { documents: DealDocumentModel[] }) {
  return <Card title="Матрица документов" eyebrow="документы" className={styles.span6}><div className={styles.list}>{documents.map((doc) => <article key={doc.id} className={styles.row}><strong>{limitPremiumText(doc.title, 70)}</strong><Badge tone={doc.status === 'ready' ? 'success' : doc.status === 'blocked' ? 'danger' : 'warning'}>{doc.status === 'ready' ? 'готово' : doc.status === 'blocked' ? 'стоп' : 'проверить'}</Badge><span>{limitPremiumText(doc.responsible, 52)}</span><span>{limitPremiumText(doc.blocks, 74)}</span></article>)}</div></Card>;
}

function ExecutionChain({ steps }: { steps: ExecutionStepModel[] }) {
  return <Card title="Цепочка исполнения" eyebrow="событие → статус → действие" className={styles.span6}><div className={styles.list}>{steps.map((step) => <article key={step.id} className={styles.step}><div className={styles.stepTop}><strong>{limitPremiumText(step.label, 68)}</strong><Badge tone={step.status === 'done' ? 'success' : step.status === 'blocked' ? 'danger' : step.status === 'active' ? 'info' : 'warning'}>{stepLabels[step.status]}</Badge></div><p>Ответственный: {limitPremiumText(step.responsible, 56)}</p>{step.blocks ? <p>Блокирует: {limitPremiumText(step.blocks, 76)}</p> : null}{step.moneyImpactRub ? <p>Влияние на деньги: {formatPremiumRubCompact(step.moneyImpactRub)}</p> : null}</article>)}</div></Card>;
}

function EvidencePack({ evidence }: { evidence: EvidenceModel[] }) {
  return <Card title="Пакет доказательств" eyebrow="фото · вес · время · документы" className={styles.span6}><div className={styles.list}>{evidence.map((item) => <article key={item.id} className={styles.row}><strong>{limitPremiumText(item.title, 70)}</strong><Badge tone={item.status === 'done' ? 'success' : item.status === 'blocked' ? 'danger' : 'warning'}>{stepLabels[item.status]}</Badge><span>{limitPremiumText(item.source, 52)}</span><span>{item.time}</span></article>)}</div></Card>;
}

function RiskHeatline({ risks }: { risks: RiskItemModel[] }) {
  if (risks.length === 0) return null;
  return <Card title="Риски исполнения" eyebrow="что может остановить сделку" className={styles.span6}><div className={styles.list}>{risks.map((risk) => <article key={risk.id} className={styles.step}><div className={styles.stepTop}><strong>{limitPremiumText(risk.label, 64)}</strong><Badge tone={risk.tone}>риск</Badge></div><p>{limitPremiumText(risk.detail, premiumTextLimits.description)}</p></article>)}</div></Card>;
}

function Timeline({ events }: { events: TimelineEventModel[] }) {
  return <Card title="Журнал сделки" eyebrow="кто · что · когда" className={styles.span6}><div className={styles.timeline}>{events.map((event) => <article key={event.id} className={styles.timelineItem}><time>{event.time}</time><div><strong>{limitPremiumText(event.title, 80)}</strong>{event.impact ? <p>{limitPremiumText(event.impact, 100)}</p> : null}</div></article>)}</div></Card>;
}

export function DriverFieldShell({ task, theme = 'dark' }: { task: DriverTaskModel; theme?: 'dark' | 'light' }) {
  return <main className={styles.driverRoot} data-theme={theme}><header className={styles.driverHeader}><div className={styles.eyebrow}>Прозрачная Цена · водитель</div><strong>Рейс {limitPremiumText(task.tripId, 32)}</strong><span>Следующее действие: {limitPremiumText(task.nextAction, premiumTextLimits.cta)}</span></header><section className={styles.driverPanel} aria-label="Текущий рейс"><p>{limitPremiumText(task.routeLabel, 96)}</p>{task.etaLabel ? <Badge tone="info">{limitPremiumText(task.etaLabel, 56)}</Badge> : null}<button className={styles.driverPrimaryButton} type="button">{limitPremiumText(task.nextAction, premiumTextLimits.cta)}</button><div className={styles.driverActions}>{task.secondaryActions.map((action) => <button key={action.id} className={styles.driverSecondaryButton} type="button">{limitPremiumText(action.label, premiumTextLimits.cta)}</button>)}</div><div className={styles.offlineQueue}>Офлайн-очередь: {task.offlineQueueCount}</div></section></main>;
}

export function PremiumDealShell({ deal, initialRole = 'buyer', roles = ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'arbiter', 'compliance', 'operator', 'executive'], theme = 'dark', onRoleChange }: { deal: DealViewModel; initialRole?: DealRole; roles?: DealRole[]; theme?: 'dark' | 'light'; onRoleChange?: (role: DealRole) => void }) {
  const [activeRole, setActiveRole] = useState<DealRole>(initialRole);
  const visibleSections = useMemo(() => roleSections[activeRole], [activeRole]);
  const topBlockers = deal.blockers.slice(0, 2);

  useEffect(() => setActiveRole(initialRole), [initialRole]);

  if (activeRole === 'driver' && deal.driverTask) return <DriverFieldShell task={deal.driverTask} theme={theme} />;

  return <main className={styles.root} data-role={activeRole} data-theme={theme}><div className={styles.shell}><div className={styles.topChrome}><nav className={styles.mainNav} aria-label="Основная навигация"><strong>Прозрачная Цена</strong><a href="/platform-v7">Сделки</a><a href="/platform-v7/lots">Лоты и запросы</a><a href="/platform-v7/logistics">Логистика</a><a href="/platform-v7/documents">Документы</a><a href="/platform-v7/bank">Деньги</a><a href="/platform-v7/disputes">Споры</a><a href="/platform-v7/support">Поддержка</a></nav><select className={styles.roleSelect} value={activeRole} aria-label="Активная роль" onChange={(event) => { const nextRole = event.target.value as DealRole; setActiveRole(nextRole); onRoleChange?.(nextRole); }}>{roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></div><StatusBar deal={deal} role={activeRole} /><DealCoreSnapshot deal={deal} /><section className={styles.aboveFold} aria-label="Главный контекст сделки"><div className={styles.blockerGrid}>{topBlockers.length > 0 ? topBlockers.map((item) => <Blocker key={item.id} item={item} />) : <Card title="Сделка идёт по условиям" eyebrow="активных остановок нет"><p>Следующее действие видно справа. Деньги, документы и груз сверяются по цепочке исполнения.</p></Card>}</div><NextAction action={deal.nextAction} /></section><section className={styles.contentGrid} aria-label="Рабочие блоки сделки">{visibleSections.includes('money') ? <MoneyRail deal={deal} /> : null}{visibleSections.includes('documents') ? <DocumentMatrix documents={deal.documents} /> : null}{visibleSections.includes('execution') ? <ExecutionChain steps={deal.execution} /> : null}{visibleSections.includes('evidence') ? <EvidencePack evidence={deal.evidence} /> : null}{visibleSections.includes('risk') ? <RiskHeatline risks={deal.risks} /> : null}{visibleSections.includes('timeline') ? <Timeline events={deal.timeline} /> : null}</section></div></main>;
}
