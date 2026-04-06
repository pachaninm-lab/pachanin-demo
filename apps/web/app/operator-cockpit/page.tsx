import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { getRuntimeOperatorCockpit } from '../../lib/runtime-server';
import { OperatorEscalationBoard } from '../../components/operator-escalation-board';
import { buildOperatorEscalationDeck } from '../../lib/closure-readiness-engine';
import { OperatorCaseCenterPanel } from '../../components/operator-case-center-panel';
import { buildOperatorCaseCenter } from '../../../../packages/domain-core/src';

function amount(value?: number | null) {
  if (!value) return '—';
  return `${Number(value).toLocaleString('ru-RU')} ₽`;
}

const TITLES: Record<string, string> = {
  moneyAtRisk: 'Деньги под риском',
  closeToFinish: 'Сделки близко к завершению',
  blockedByDocsLabReceiving: 'Блокеры по документам, лаборатории и приёмке',
  bypassAndFraud: 'Риск обхода и подозрительные сигналы',
  escalations: 'Эскалации и споры'
};

const SECTION_LINKS: Record<string, string> = {
  moneyAtRisk: '#queue-moneyAtRisk',
  closeToFinish: '#queue-closeToFinish',
  blockedByDocsLabReceiving: '#queue-blockedByDocsLabReceiving',
  bypassAndFraud: '#queue-bypassAndFraud',
  escalations: '#queue-escalations'
};

export default async function OperatorCockpitPage() {
  const data = await getRuntimeOperatorCockpit();
  const cockpit = data.cockpit;
  const sections = Object.entries(cockpit?.queues || {});
  const escalationDeck = buildOperatorEscalationDeck(cockpit);
  const caseCenter = buildOperatorCaseCenter({
    disputes: cockpit?.queues?.escalations || [],
    documents: cockpit?.queues?.blockedByDocsLabReceiving || [],
    shipments: cockpit?.queues?.blockedByDocsLabReceiving || [],
    payments: cockpit?.queues?.moneyAtRisk || [],
    onboarding: cockpit?.queues?.closeToFinish || [],
    connectors: cockpit?.queues?.bypassAndFraud || [],
    support: cockpit?.queues?.escalations || []
  });
  const summaryCards = [
    {
      title: 'Деньги под риском',
      value: cockpit?.summary?.moneyAtRisk || 0,
      caption: amount(cockpit?.summary?.moneyAtRiskAmountRub || 0),
      href: SECTION_LINKS.moneyAtRisk,
    },
    {
      title: 'Почти закрыты',
      value: cockpit?.summary?.closeToFinish || 0,
      caption: 'Сделки, где остался один дорогой шаг.',
      href: SECTION_LINKS.closeToFinish,
    },
    {
      title: 'Заблокированы',
      value: cockpit?.summary?.blocked || 0,
      caption: 'Документы, лаборатория или приёмка держат контур.',
      href: SECTION_LINKS.blockedByDocsLabReceiving,
    },
    {
      title: 'Риск обхода',
      value: cockpit?.summary?.bypass || 0,
      caption: 'Подозрительные сигналы, требующие решения оператора.',
      href: SECTION_LINKS.bypassAndFraud,
    },
    {
      title: 'Эскалации',
      value: cockpit?.summary?.escalations || 0,
      caption: `Открытых споров: ${cockpit?.summary?.openDisputes || 0}`,
      href: SECTION_LINKS.escalations,
    },
  ];

  const nextQueue = sections.find(([, items]: any) => (items || []).length)?.[0] as string | undefined;

  return (
    <PageAccessGuard allowedRoles={['ADMIN', 'SUPPORT_MANAGER']} internal title="Центр оператора ограничен" subtitle="Экран нужен оператору, risk и admin как единый рабочий стол прибыли и риска.">
      <AppShell title="Центр оператора" subtitle="Один экран: где зависли деньги, где сделка почти закрыта, где риск обхода и где нужна эскалация.">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/control', label: 'Контроль' }, { label: 'Центр оператора' }]} />
          <SourceNote source={data.meta?.source || 'runtime.operator-cockpit'} warning="Любая красная карточка должна вести не в модуль вообще, а в конкретную очередь, сделку или тикет." compact />

          <section className="dashboard-grid-5">
            {summaryCards.map((card) => (
              <Link key={card.title} href={card.href} className="dashboard-card">
                <div className="dashboard-card-title">{card.title}</div>
                <div className="dashboard-card-value">{card.value}</div>
                <div className="dashboard-card-caption">{card.caption}</div>
              </Link>
            ))}
          </section>

          <OperatorEscalationBoard items={escalationDeck} />

          <OperatorCaseCenterPanel rows={caseCenter.cases.slice(0, 12)} />

          <section className="dashboard-grid-3">
            <div className="section-card-tight">
              <div className="eyebrow">Safe Deals / bank rail</div>
              <div className="detail-title" style={{ fontSize: 20, marginTop: 8 }}>{amount(cockpit?.summary?.moneyAtRiskAmountRub || 0)}</div>
              <div className="muted" style={{ marginTop: 10 }}>Operator должен видеть не только hold, но и риск по callback, reserve и Safe Deals release.</div>
              <div className="cta-stack" style={{ marginTop: 12 }}><Link href="/payments" className="secondary-link">Открыть bank rail</Link></div>
            </div>
            <Link href={SECTION_LINKS.moneyAtRisk} className="section-card-tight" style={{ display: 'block' }}>
              <div className="eyebrow">Главная сумма под риском</div>
              <div className="detail-title" style={{ fontSize: 20, marginTop: 8 }}>{amount(cockpit?.summary?.moneyAtRiskAmountRub || 0)}</div>
              <div className="muted" style={{ marginTop: 10 }}>Сумма, которая сейчас зависит от спора, документов, приёмки или готовности финансирования.</div>
            </Link>
            <Link href="/support" className="section-card-tight" style={{ display: 'block' }}>
              <div className="eyebrow">Просроченная поддержка</div>
              <div className="detail-title" style={{ fontSize: 20, marginTop: 8 }}>{cockpit?.summary?.staleSupport || 0}</div>
              <div className="muted" style={{ marginTop: 10 }}>Тикеты и эскалации, которые оператор уже должен разбирать вручную.</div>
            </Link>
            <Link href={nextQueue ? SECTION_LINKS[nextQueue] : '/control'} className="section-card-tight" style={{ display: 'block' }}>
              <div className="eyebrow">Следующий фокус</div>
              <div className="detail-title" style={{ fontSize: 20, marginTop: 8 }}>{(nextQueue && TITLES[nextQueue]) || 'Очереди пусты'}</div>
              <div className="muted" style={{ marginTop: 10 }}>Оператор должен начинать не с меню, а с самой дорогой очереди.</div>
            </Link>
          </section>

          {sections.map(([key, items]: any) => (
            <section key={key} id={`queue-${key}`} className="section-card">
              <div className="dashboard-section-title">{TITLES[key] || key}</div>
              <div className="section-stack" style={{ marginTop: 16 }}>
                {!items?.length ? <div className="empty-state">Очередь пуста.</div> : null}
                {(items || []).map((item: any) => (
                  <Link key={item.id} href={item.href} className="list-row linkable" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <b>{item.title}</b>
                      <div className="muted small">{item.reason}</div>
                      <div className="muted tiny" style={{ marginTop: 4 }}>владелец {item.owner} · следующий шаг {item.nextAction}</div>
                      <div className="muted tiny" style={{ marginTop: 4 }}>коды причин {(item.reasonCodes || []).join(' · ') || '—'} · доказательства {item.evidenceScore ?? '—'}/100</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className={`mini-chip ${String(item.severity || '').toLowerCase()}`}>{item.severity}</div>
                      <div className="muted tiny" style={{ marginTop: 4 }}>{amount(item.amountRub || 0)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <div className="cta-stack" style={{ marginTop: 16 }}><Link href="/sber" className="secondary-link">Открыть Sber bank desks</Link></div>

          <section className="dashboard-grid-4">
            <Link href="/control" className="dashboard-card"><div className="dashboard-card-title">Панель контроля</div><div className="dashboard-card-caption">Общий экран очередей, поддержки и деградаций.</div></Link>
            <Link href="/readiness-center" className="dashboard-card"><div className="dashboard-card-title">Центр готовности</div><div className="dashboard-card-caption">Где контур ещё опасен и какие хвосты самые дорогие.</div></Link>
            <Link href="/runtime-ops" className="dashboard-card"><div className="dashboard-card-title">Инженерный контур</div><div className="dashboard-card-caption">Outbox, locks, health и зависшие воркеры.</div></Link>
            <Link href="/export-packs" className="dashboard-card"><div className="dashboard-card-title">Пакеты выгрузки</div><div className="dashboard-card-caption">Пакеты для банка, инвестора и комплаенса.</div></Link>
          </section>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
