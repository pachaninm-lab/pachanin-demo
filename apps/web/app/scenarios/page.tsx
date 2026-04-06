import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { RuntimeSourceBanner } from '../../components/runtime-source-banner';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { getRuntimeSnapshot } from '../../lib/runtime-server';
import { INTERNAL_ONLY_ROLES } from '../../lib/route-roles';

function scenarioTarget(trigger: string) {
  const value = trigger.toLowerCase();
  if (value.includes('route')) return { href: '/logistics', label: 'Логистика', detail: 'Открыть рейсы, отклонения и сценарий поддержки' };
  if (value.includes('evidence') || value.includes('loading')) return { href: '/deals', label: 'Сделки', detail: 'Проверить blockers и пакет доказательств' };
  if (value.includes('quality')) return { href: '/disputes', label: 'Споры', detail: 'Открыть удержание по спору и маршрут повторного теста' };
  if (value.includes('connector')) return { href: '/connectors', label: 'Коннекторы', detail: 'Понять degraded provider и допустимый fallback' };
  return { href: '/control', label: 'Контроль', detail: 'Открыть operator-контур и принять решение' };
}

export default async function ScenariosPage() {
  const snapshot = await getRuntimeSnapshot();
  const items = snapshot.playbooks || [];

  return (
    <AppShell
      title="Сценарии и инструкции"
      subtitle="Не каталог ради каталога, а карта операторских решений: триггер, ответственный, первая реакция, эскалация и критерий закрытия."
      breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/control', label: 'Контроль' }, { label: 'Сценарии' }]} />}
    >
      <PageAccessGuard allowedRoles={[...INTERNAL_ONLY_ROLES]} internal>
        <RuntimeSourceBanner snapshot={snapshot} />
        <SourceNote source={snapshot.meta?.source || 'runtime.playbooks'} updatedAt={snapshot.meta?.lastSimulatedAt || null} warning="Сценарий нужен только если оператор понимает: где триггер появился, в какой модуль идти и кто владеет следующим действием."
          compact />

        <DetailHero
          kicker="Операторские инструкции"
          title="Каждый сценарий должен переводить тревогу в последовательность действий"
          description="Ниже собраны канонические инструкции: что делать первым, куда эскалировать, что замораживается и по какому признаку кейс считается закрытым."
          chips={[
            <span key="count">Сценариев {items.length}</span>,
            <span key="ops">Только для оператора</span>
          ]}
          nextStep="Открыть нужный сценарий и сразу перейти в связанный рабочий модуль"
          owner="оператор / администратор"
          blockers="без инструкции оператор начинает действовать вручную и создаёт неравномерное качество решений"
          actions={[
            { href: '/control', label: 'Панель контроля' },
            { href: '/support', label: 'Поддержка', variant: 'secondary' },
            { href: '/audit', label: 'Аудит', variant: 'secondary' }
          ]}
        />

        <div className="stack-sm">
          {items.map((item: any) => {
            const target = scenarioTarget(item.trigger);
            return (
              <Link key={item.id} href={`/scenarios/${item.id}`} className="mobile-list-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div className="dashboard-list-title">{item.trigger}</div>
                    <div className="dashboard-list-subtitle">Ответственный: {item.owner}</div>
                  </div>
                  <span className="status-pill amber">инструкция</span>
                </div>
                <div className="muted small" style={{ marginTop: 10 }}>Первая реакция: {item.firstResponse}</div>
                <div className="muted small" style={{ marginTop: 6 }}>Ведёт в модуль: {target.label} · {target.detail}</div>
              </Link>
            );
          })}
        </div>

        <ModuleHub
          title="Связанные модули"
          subtitle="Сценарий бесполезен без прямого перехода в контур, где оператор должен действовать."
          items={items.map((item: any) => {
            const target = scenarioTarget(item.trigger);
            return {
              href: target.href,
              label: item.trigger,
              detail: target.detail,
              meta: target.label,
              tone: 'blue',
              icon: '↗'
            };
          })}
        />

        <NextStepBar
          title="Открыть инструкцию и перейти в связанный модуль, где возник триггер"
          detail="Сценарий должен завершаться закрытием конкретного блокера, а не просто прочтением инструкции."
          primary={{ href: '/control', label: 'Контроль' }}
          secondary={[
            { href: '/support', label: 'Поддержка' },
            { href: '/audit', label: 'Аудит' }
          ]}
        />
      </PageAccessGuard>
    </AppShell>
  );
}
