import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { PageAccessGuard } from '../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../lib/route-roles';
import { buildSurveyView, readCommercialWorkspace } from '../../lib/commercial-workspace-store';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SurveyTaskConsole } from '../../components/survey-task-console';

export default async function SurveyPage() {
  const state = await readCommercialWorkspace();
  const view = buildSurveyView(state);
  const lead = view.tasks[0] || null;
  const reportReady = view.tasks.filter((item) => item.status === 'REPORT_READY').length;
  const attached = view.tasks.filter((item) => item.status === 'ATTACHED_TO_DISPUTE').length;
  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]} title="Сюрвей ограничен" subtitle="Сюрвейный контур нужен лаборатории, оператору и участникам экспортно-спорных сценариев.">
      <AppShell title="Сюрвей и независимая инспекция" subtitle="Тип сюрвея, owner, SLA и готовность отчёта к dispute/evidence pack.">
        <section className="dashboard-grid-4">
          <div className="dashboard-card"><div className="dashboard-card-title">Всего задач</div><div className="dashboard-card-value">{view.tasks.length}</div><div className="dashboard-card-caption">Сюрвей не должен жить в ручных договорённостях и звонках.</div></div>
          <div className="dashboard-card"><div className="dashboard-card-title">Обязательных</div><div className="dashboard-card-value">{view.required}</div><div className="dashboard-card-caption">Экспортные и спорные кейсы, где сюрвей обязателен.</div></div>
          <div className="dashboard-card"><div className="dashboard-card-title">Dispute ready</div><div className="dashboard-card-value">{view.disputeReady}</div><div className="dashboard-card-caption">Отчёты, которые можно прямо прикладывать в спорный пакет.</div></div>
          <div className="dashboard-card"><div className="dashboard-card-title">Report ready</div><div className="dashboard-card-value">{reportReady + attached}</div><div className="dashboard-card-caption">Готовые и уже приложенные отчёты сюрвея.</div></div>
          <Link href="/lab" className="dashboard-card"><div className="dashboard-card-title">К лаборатории</div><div className="dashboard-card-value">→</div><div className="dashboard-card-caption">Сюрвей должен усиливать quality trail, а не дублировать его хаотично.</div></Link>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-list" style={{ marginTop: 16 }}>
            {view.tasks.map((item) => (
              <div key={item.id} className="dashboard-list-card">
                <div className="dashboard-list-main">
                  <div className="dashboard-list-icon">∴</div>
                  <div>
                    <div className="dashboard-list-title">{item.providerName || 'Сюрвейер не назначен'} · {item.surveyType}</div>
                    <div className="dashboard-list-subtitle">{item.reason}</div>
                    <div className="muted tiny" style={{ marginTop: 4 }}>SLA {item.slaHours} ч · owner {item.owner}</div>
                    <div className="muted tiny" style={{ marginTop: 4 }}>{item.reportAttached ? 'report pack приложен' : 'report pack ещё не приложен'} · {item.linkedDisputeId ? `спор ${item.linkedDisputeId}` : 'спор не привязан'}</div>
                  </div>
                </div>
                <div className="dashboard-list-meta">
                  <span className={`status-pill ${item.status === 'ASSIGNED' || item.status === 'REPORT_READY' ? 'green' : item.required ? 'amber' : 'gray'}`}>{item.status}</span>
                  <div className="muted tiny">{item.required ? 'обязательно' : 'по решению'} · {item.disputeReady ? 'готов к спору' : 'нужен report pack'}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <SurveyTaskConsole initial={view.tasks as any} />

        <ModuleHub title="Что рядом с сюрвеем" subtitle="Сюрвей должен жить в quality/dispute rail, а не в отрыве от сделки." items={[
          { href: '/lab', label: 'Лаборатория', detail: 'Quality, custody и retest.', icon: '∴', meta: 'quality', tone: 'amber' },
          { href: '/disputes', label: 'Споры', detail: 'Сюрвейный отчёт должен легко прикладываться в претензию.', icon: '!', meta: 'claim', tone: 'red' },
          { href: '/documents', label: 'Документы', detail: 'Report pack и audit trail.', icon: '⌁', meta: 'evidence', tone: 'green' },
          { href: '/receiving', label: 'Приёмка', detail: 'Связь с unloading, quantity и gate events.', icon: '◌', meta: 'handoff', tone: 'blue' },
        ] as any} />

        <NextStepBar
          title={lead ? 'Открыть верхний сюрвейный кейс и убедиться, что report pack готов к спору' : 'Сюрвейных задач пока нет'}
          detail={lead ? `${lead.providerName || 'без провайдера'} · ${lead.surveyType} · ${lead.status}` : 'Сначала назначь сюрвей в лабораторном или экспортном сценарии.'}
          primary={{ href: '/lab', label: 'Открыть лабораторию' }}
          secondary={[{ href: '/documents', label: 'Документы' }, { href: '/disputes', label: 'Споры' }]}
        />
      </AppShell>
    </PageAccessGuard>
  );
}
