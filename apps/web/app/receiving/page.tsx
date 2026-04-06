import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { PageAccessGuard } from '../../components/page-access-guard';
import { RECEIVING_ROLES } from '../../lib/route-roles';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { DetailHero } from '../../components/detail-hero';
import { SourceNote } from '../../components/source-note';
import { readCommercialWorkspace } from '../../lib/commercial-workspace-store';
import { ReceivingQueueConsole } from '../../components/receiving-queue-console';
import { ServiceProviderSelectionPanel } from '../../components/service-provider-selection-panel';
import { ServiceProviderAssignmentConsole } from '../../components/service-provider-assignment-console';
import { buildProviderStagePlan } from '../../../../packages/domain-core/src';
import { buildProviderContextFromWorkspace } from '../../lib/provider-stage-context';

export default async function ReceivingPage() {
  const state = await readCommercialWorkspace();
  const slots = state.queueSlots;
  const etaRisk = slots.filter((item) => item.status === 'ETA_RISK' || item.status === 'NO_SHOW_RISK').length;
  const activeSlots = slots.filter((item) => !['COMPLETED'].includes(item.status)).length;
  const unloading = slots.filter((item) => item.status === 'UNLOADING').length;
  const leadSlot = slots[0];
  const etaLead = slots.find((item) => item.status === 'ETA_RISK' || item.status === 'NO_SHOW_RISK');
  const unloadingLead = slots.find((item) => item.status === 'UNLOADING');
  const receivingAmount = state.financeApplications.filter((item) => item.dealId === leadSlot?.linkedDealId).reduce((sum, item) => sum + Number(item.amount || 0), 0) || null;
  const receivingContext = buildProviderContextFromWorkspace('RECEIVING', state, { needRailLink: true, needPortLink: true, exportFlow: true, urgency: etaRisk ? 'HIGH' : 'MEDIUM', amountRub: receivingAmount });
  const receivingPlan = buildProviderStagePlan('RECEIVING', receivingContext);
  const elevatorPolicy = receivingPlan.items.find((item) => item.category === 'ELEVATOR')!;
  const portPolicy = receivingPlan.items.find((item) => item.category === 'PORT')!;

  return (
    <PageAccessGuard allowedRoles={[...RECEIVING_ROLES]} title="Приёмка ограничена" subtitle="Экран нужен приёмке, оператору и администратору.">
      <AppShell title="Очередь, слоты и приёмка" subtitle="От слота и въезда на территорию до весовой, выгрузки и перехода в склад и финконтур.">
        <SourceNote source="commercial workspace / persisted state" warning="Очередь — отдельный рабочий контур. Любая карточка сверху должна вести в живой слот, а не просто показывать число." compact />

        <DetailHero
          kicker="Очередь приёмки"
          title="Очередь — это отдельный продукт, а не просто список машин"
          description="Контур управляет слотами, ETA, no-show, въездом, весовой и выгрузкой. Иначе логистика и деньги застревают между рейсом и складом."
          chips={[`слотов ${slots.length}`, `риск ETA ${etaRisk}`, `в выгрузке ${unloading}`, `событий ${state.slotEvents.length}`]}
          nextStep={leadSlot ? `Открыть ${leadSlot.vehicle} и решить: подтверждать слот, переносить или переводить в живую очередь.` : 'Создать слот и привязать его к рейсу.'}
          owner="Элеватор / окно приёмки"
          blockers={etaRisk ? `${etaRisk} слота под риском ETA/no-show` : 'критичных рисков очереди не видно'}
          actions={leadSlot ? [
            { href: `/receiving/${leadSlot.linkedDealId}`, label: 'Открыть верхний слот' },
            { href: '/dispatch', label: 'Рейсы', variant: 'secondary' },
            { href: '/lab', label: 'Лаборатория', variant: 'secondary' }
          ] : [
            { href: '/dispatch', label: 'Рейсы' },
            { href: '/lab', label: 'Лаборатория', variant: 'secondary' }
          ]}
        />


        <ServiceProviderSelectionPanel
          title="Рекомендуемый элеватор / хранение"
          subtitle="Система оценивает культуру, очередь, скорость handoff и пригодность к storage/dispute trail."
          selection={elevatorPolicy.selection}
          policy={elevatorPolicy}
          primaryHref="/service-providers"
          primaryLabel="Все исполнители"
        />
        <ServiceProviderAssignmentConsole stage="RECEIVING" category="ELEVATOR" linkedObjectType="SLOT" linkedObjectId={leadSlot?.id || 'RECEIVING-PRESET'} linkedDealId={leadSlot?.linkedDealId || null} context={receivingContext} policy={elevatorPolicy} />

        <ServiceProviderSelectionPanel
          title="Рекомендуемый порт / терминал для экспортного плеча"
          subtitle="Если партия идёт дальше в экспорт, система заранее подбирает портовый контур с лучшим handoff."
          selection={portPolicy.selection}
          policy={portPolicy}
          primaryHref="/service-providers"
          primaryLabel="Сравнить терминалы"
        />
        <ServiceProviderAssignmentConsole stage="RECEIVING" category="PORT" linkedObjectType="SLOT" linkedObjectId={leadSlot?.id || 'PORT-PRESET'} linkedDealId={leadSlot?.linkedDealId || null} context={receivingContext} policy={portPolicy} />

        <section className="dashboard-grid-4">
          <Link href={leadSlot ? `/receiving/${leadSlot.linkedDealId}` : '/dispatch'} className="dashboard-card"><div className="dashboard-card-title">Активные слоты</div><div className="dashboard-card-value">{activeSlots}</div><div className="dashboard-card-caption">Открыть главный живой слот и продолжить очередь.</div></Link>
          <Link href={etaLead ? `/receiving/${etaLead.linkedDealId}` : '#receiving-console'} className="dashboard-card"><div className="dashboard-card-title">Риск ETA / no-show</div><div className="dashboard-card-value">{etaRisk}</div><div className="dashboard-card-caption">Машины, которые нужно перепланировать до того, как они убьют очередь.</div></Link>
          <Link href={unloadingLead ? `/receiving/${unloadingLead.linkedDealId}` : '/inventory'} className="dashboard-card"><div className="dashboard-card-title">В выгрузке</div><div className="dashboard-card-value">{unloading}</div><div className="dashboard-card-caption">Партии, которые скоро уйдут в склад и деньги.</div></Link>
          <Link href="#receiving-console" className="dashboard-card"><div className="dashboard-card-title">Журнал событий</div><div className="dashboard-card-value">{state.slotEvents.length}</div><div className="dashboard-card-caption">Каждое действие по слоту фиксируется и должно быть открываемым ниже.</div></Link>
        </section>

        <div id="receiving-console">
          <ReceivingQueueConsole initialSlots={slots} />
        </div>

        <ModuleHub title="Что должно быть рядом с приёмкой" subtitle="Очередь, рейсы, лаборатория, акты и деньги должны быть связаны между собой." items={[
          { href: '/dispatch', label: 'Рейсы', detail: 'Откуда едет партия и где её ждать.', icon: '→', meta: 'dispatch', tone: 'blue' },
          { href: '/logistics', label: 'Карта', detail: 'Визуальный контроль маршрутов и ETA.', icon: '◎', meta: 'live', tone: 'green' },
          { href: '/lab', label: 'Лаборатория', detail: 'Протокол качества и влияние на цену.', icon: '∴', meta: 'quality', tone: 'amber' },
          { href: '/survey', label: 'Сюрвей', detail: 'Независимый контроль quantity/quality для спорных и экспортных партий.', icon: '⚖', meta: 'survey', tone: 'amber' },
          { href: '/documents', label: 'Документы', detail: 'Весовые билеты, акты и архив слота.', icon: '⌁', meta: 'archive', tone: 'green' },
          { href: '/payments', label: 'Финансы', detail: 'После решения по партии открыть финконтур.', icon: '₽', meta: 'after receive', tone: 'gray' },
          { href: '/field-mobile', label: 'Мобильные режимы', detail: 'Водитель, лаборатория и приёмка должны работать с телефона.', icon: '📱', meta: 'mobile', tone: 'gray' }
        ] as any} />

        <NextStepBar
          title={leadSlot ? 'Открыть верхний слот и довести машину до решения по приёмке' : 'Связать очередь с рейсом'}
          detail={leadSlot ? `${leadSlot.vehicle} · ${leadSlot.slot} · ${leadSlot.status}` : 'В очереди пока нет активных слотов.'}
          primary={leadSlot ? { href: `/receiving/${leadSlot.linkedDealId}`, label: 'Открыть слот / приёмку' } : { href: '/dispatch', label: 'Открыть рейсы' }}
          secondary={[{ href: '/dispatch', label: 'Рейсы' }, { href: '/inventory', label: 'Склад / batch' }]}
        />
      </AppShell>
    </PageAccessGuard>
  );
}
