import { AppShell } from '../../components/app-shell';
import { PageAccessGuard } from '../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../lib/route-roles';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { KnowledgeWorkspace } from '../../components/knowledge-workspace';
import { readCommercialWorkspace } from '../../lib/commercial-workspace-store';

export default async function KnowledgePage() {
  const state = await readCommercialWorkspace();
  const articles = state.knowledgeArticles;
  const roleCount = new Set(articles.map((item) => item.role)).size;
  const calculators = articles.reduce((sum, item) => sum + item.calculators.length, 0);
  const lead = articles[0];

  return (
    <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Knowledge layer ограничен" subtitle="Раздел знаний и playbook-материалы открываются только после входа.">
      <AppShell title="База знаний, playbook-ы и полевые утилиты" subtitle="Не соцсеть, а прикладной слой: что делать дальше по роли, блокеру и стадии процесса.">
        <SourceNote source="commercial workspace / persisted state" warning="Knowledge layer встроен в рабочий контур: можно подобрать playbook по роли и блокеру, а затем сразу перейти в нужный модуль." compact />

        <DetailHero
          kicker="Knowledge & playbooks"
          title="Проблема не в нехватке информации, а в отсутствии следующего действия"
          description="Роль, блокер и стадия сделки должны быстро превращаться в playbook, калькулятор и рабочий модуль без хаоса и чатов ради чатов."
          chips={[`материалов ${articles.length}`, `ролей ${roleCount}`, `калькуляторов ${calculators}`, 'context-first']}
          nextStep={lead ? `Подобрать playbook и открыть ${lead.title}.` : 'Создать первый playbook по ключевому блокеру.'}
          owner="Фермер / логист / приёмка / финансы / оператор"
          blockers="Knowledge layer должен вести в расчёт и действие, а не заменять рабочий контур."
          actions={lead ? [
            { href: `/knowledge/${lead.id}`, label: 'Открыть верхний playbook' },
            { href: '/calculator', label: 'Калькулятор', variant: 'secondary' },
            { href: '/deals', label: 'Сделки', variant: 'secondary' }
          ] : [
            { href: '/calculator', label: 'Калькулятор' },
            { href: '/deals', label: 'Сделки', variant: 'secondary' }
          ]}
        />

        <section className="dashboard-grid-4">
          <div className="dashboard-card"><div className="dashboard-card-title">Материалы</div><div className="dashboard-card-value">{articles.length}</div><div className="dashboard-card-caption">Role-based playbook-материалы и инструкции.</div></div>
          <div className="dashboard-card"><div className="dashboard-card-title">Роли</div><div className="dashboard-card-value">{roleCount}</div><div className="dashboard-card-caption">Для разных ролей нужен разный следующий шаг.</div></div>
          <div className="dashboard-card"><div className="dashboard-card-title">Калькуляторы</div><div className="dashboard-card-value">{calculators}</div><div className="dashboard-card-caption">Расчёт должен быть частью knowledge layer.</div></div>
          <div className="dashboard-card"><div className="dashboard-card-title">Связанные модули</div><div className="dashboard-card-value">{articles.reduce((sum, item) => sum + item.linkedModules.length, 0)}</div><div className="dashboard-card-caption">Каждый playbook должен открывать действие.</div></div>
        </section>

        <KnowledgeWorkspace initialArticles={articles} />

        <ModuleHub
          title="Что knowledge layer должен открывать дальше"
          subtitle="Любой материал должен заканчиваться переходом в расчёт, сделку, логистику, документы или деньги."
          items={[
            { href: '/calculator', label: 'Калькуляторы', detail: 'Netback, штрафы, дедлайны и перерасчёт по качеству.', icon: '⊡', meta: 'tools', tone: 'green' },
            { href: '/deals', label: 'Сделки', detail: 'Открыть стадию процесса, где возник блокер.', icon: '≣', meta: 'workflow', tone: 'blue' },
            { href: '/receiving', label: 'Приёмка', detail: 'Что делать при задержке, no-show или споре по партии.', icon: '◫', meta: 'field', tone: 'amber' },
            { href: '/finance', label: 'Финансы', detail: 'Как двигать waterfall и не сломать money flow.', icon: '₽', meta: 'money', tone: 'green' },
            { href: '/field-mobile', label: 'Мобильные режимы', detail: 'Роли в поле должны получать playbook с телефона.', icon: '📱', meta: 'mobile', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title={lead ? 'Открыть playbook и применить его в реальном модуле' : 'Запустить первый playbook-сценарий'}
          detail={lead ? lead.summary : 'Knowledge layer должен вести в реальный процесс.'}
          primary={lead ? { href: `/knowledge/${lead.id}`, label: 'Открыть playbook' } : { href: '/calculator', label: 'К калькулятору' }}
          secondary={[{ href: '/calculator', label: 'Калькулятор' }, { href: '/deals', label: 'Сделки' }]}
        />
      </AppShell>
    </PageAccessGuard>
  );
}
