import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ExecutionReadinessPanel } from '../../components/execution-readiness-panel';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { PageAccessGuard } from '../../components/page-access-guard';
import { SourceNote } from '../../components/source-note';
import { buildExecutionReadiness } from '../../lib/execution-readiness';
import { getIndustrializationData } from '../../lib/industrialization-server';
import { getRuntimeExportPack, getRuntimeSnapshot, getRuntimeOperatorCockpit } from '../../lib/runtime-server';
import { OperatorEscalationBoard } from '../../components/operator-escalation-board';
import { buildOperatorEscalationDeck } from '../../lib/closure-readiness-engine';

export default async function ReadinessCenterPage() {
  const [snapshot, industrial, pilotPack, operatorData] = await Promise.all([
    getRuntimeSnapshot(),
    getIndustrializationData(),
    getRuntimeExportPack('pilot_kpi'),
    getRuntimeOperatorCockpit(),
  ]);

  const readiness = buildExecutionReadiness({
    snapshot,
    trustGraph: industrial.trustGraph,
    pilotMetrics: pilotPack.pack?.pilotKpis,
  });

  const escalationDeck = buildOperatorEscalationDeck(operatorData.cockpit, readiness);

  return (
    <PageAccessGuard allowedRoles={['EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN']} title="Центр готовности ограничен" subtitle="Экран нужен руководителю и оператору как сводка зрелости rail, а не как витрина для всех ролей.">
      <AppShell title="Центр готовности" subtitle="Жёсткий экран зрелости продукта: что уже можно пилотировать, что ещё опасно и при каком условии перестаём активно дорабатывать код.">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/control', label: 'Контроль' }, { label: 'Центр готовности' }]} />
          <SourceNote source={[snapshot.meta?.source, pilotPack.meta?.source].filter(Boolean).join(' + ') || 'runtime'} warning="Этот экран не подменяет живой пилот. Он показывает, насколько rail уже собран и где ещё опасно масштабироваться." compact />

          <DetailHero
            kicker="Дисциплина запуска"
            title="Переставать писать код можно не по ощущению, а по gates"
            description="Сейчас продукт надо добивать не фичами, а зрелостью rail: одна сделка, один money contour, один evidence flow, один operator path, один controlled pilot. Этот экран собирает именно это."
            chips={[
              `rail ${readiness.summary.railScore}/100`,
              `${readiness.summary.blockedDeals} сделок заблокировано`,
              `${readiness.summary.activeDisputes} активных споров`,
              `${readiness.summary.trustedBuyers} допущенных покупателей`,
            ]}
            nextStep="Закрыть самые дорогие хвосты и запускать controlled pilot вместо бесконечного расширения интерфейса."
            owner="владелец продукта / операторский центр"
            blockers={readiness.bottlenecks.map((item) => item.title).slice(0, 3).join(' · ') || 'критичных хвостов не видно'}
            actions={[
              { href: '/pilot-mode', label: 'Режим пилота' },
              { href: '/operator-cockpit', label: 'Центр оператора', variant: 'secondary' },
              { href: '/runtime-ops', label: 'Инженерный контур', variant: 'secondary' },
            ]}
          />

          <ExecutionReadinessPanel data={readiness} />

          <OperatorEscalationBoard items={escalationDeck} title="Самые дорогие operator-эскалации сейчас" />

          <section className="workspace-grid">
            <div className="section-card">
              <div className="dashboard-section-title">Правила продукта, которые нельзя ломать</div>
              <div className="section-stack" style={{ marginTop: 16 }}>
                {readiness.productRules.map((rule) => (
                  <div key={rule} className="soft-box">{rule}</div>
                ))}
              </div>
            </div>
            <div className="section-card">
              <div className="dashboard-section-title">Допустимые ручные fallback-режимы</div>
              <div className="section-stack" style={{ marginTop: 16 }}>
                {readiness.manualFallbacks.map((item) => (
                  <div key={item.id} className="soft-box">
                    <b>{item.lane}</b>
                    <div className="muted small" style={{ marginTop: 6 }}>Разрешено: {item.allowed}</div>
                    <div className="muted tiny" style={{ marginTop: 6 }}>владелец {item.owner} · доказательства {item.evidence}</div>
                    <div className="muted tiny" style={{ marginTop: 4 }}>back to rail: {item.backToRail}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="section-card">
            <div className="dashboard-section-title">Когда реально можно перестать активно дорабатывать код</div>
            <div className="section-stack" style={{ marginTop: 16 }}>
              {readiness.stopCodingGates.map((item) => (
                <div key={item.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <b>{item.title}</b>
                    <div className="muted small" style={{ marginTop: 4 }}>{item.liveGate}</div>
                  </div>
                  <div className={`mini-chip ${String(item.status).toLowerCase()}`}>{item.status}</div>
                </div>
              ))}
            </div>
          </section>

          <ModuleHub title="Куда давить дальше" subtitle="Только те поверхности, которые напрямую закрывают хвост по сделке, деньгам, доверию и пилоту." items={[
            { href: '/deals', label: 'Ядро сделки', detail: 'Единый объект сделки и ближайший блокер.', icon: '≣', meta: 'core', tone: 'green' },
            { href: '/payments', label: 'Денежный контур', detail: 'Одна причина hold/release и связка со спором.', icon: '₽', meta: 'cash', tone: 'amber' },
            { href: '/trust-center', label: 'Доверие и допуск', detail: 'Допуск, скорость выплат и приватные режимы.', icon: '✓', meta: 'trust', tone: 'blue' },
            { href: '/liquidity-layer', label: 'Управляемая ликвидность', detail: 'Target order, private buyer network, rescue flow.', icon: '≈', meta: 'market', tone: 'green' },
            { href: '/partner-rail', label: 'Партнёрский контур', detail: 'Внешний лид садится на твой execution rail.', icon: '⇆', meta: 'embed', tone: 'blue' },
            { href: '/pilot-mode', label: 'Контролируемый пилот', detail: 'Freeze scope и прогон реальных сценариев.', icon: '◎', meta: 'pilot', tone: 'amber' },
          ] as any} />

          <NextStepBar
            title="Зафиксировать freeze scope и бить только в P0-хвосты"
            detail="Дальше не расширяем продукт. Закрываем blockers, money contour, field/offline, trust/admission и controlled pilot."
            primary={{ href: '/operator-cockpit', label: 'Открыть центр оператора' }}
            secondary={[
              { href: '/pilot-mode', label: 'Режим пилота' },
              { href: '/trust-center', label: 'Trust center' },
            ]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
