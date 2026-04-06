import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { NextStepBar } from '../../components/next-step-bar';
import { PageAccessGuard } from '../../components/page-access-guard';
import { ServiceProviderSelectionPanel } from '../../components/service-provider-selection-panel';
import { TRANSACTIONAL_ROLES } from '../../lib/route-roles';
import { buildProviderCategorySummary, buildProviderStagePlan } from '../../../../packages/domain-core/src';
import { buildProviderContextFromWorkspace, describeProviderContext } from '../../lib/provider-stage-context';
import { readCommercialWorkspace } from '../../lib/commercial-workspace-store';

export default async function ServiceProvidersPage() {
  const state = await readCommercialWorkspace();
  const dispatchContext = buildProviderContextFromWorkspace('DISPATCH', state, { requiresEpd: true, requiresGpsEvidence: true, urgency: state.transportRuns.some((item) => Number(item.etaHours) <= 8) ? 'HIGH' : 'MEDIUM' });
  const labContext = buildProviderContextFromWorkspace('LAB', state, { disputeSensitive: true, targetHours: 24 });
  const receivingContext = buildProviderContextFromWorkspace('RECEIVING', state, { exportFlow: true, needRailLink: true, needPortLink: true });
  const exportContext = buildProviderContextFromWorkspace('EXPORT', state, { exportFlow: true, needRailLink: true, needPortLink: true });
  const paymentContext = buildProviderContextFromWorkspace('PAYMENT', state, { docsReady: true });
  const dispatchPlan = buildProviderStagePlan('DISPATCH', dispatchContext);
  const labPlan = buildProviderStagePlan('LAB', labContext);
  const receivingPlan = buildProviderStagePlan('RECEIVING', receivingContext);
  const exportPlan = buildProviderStagePlan('EXPORT', exportContext);
  const paymentPlan = buildProviderStagePlan('PAYMENT', paymentContext);
  const logistics = dispatchPlan.items.find((item) => item.category === 'LOGISTICS')!;
  const insurance = dispatchPlan.items.find((item) => item.category === 'INSURANCE')!;
  const lab = labPlan.items.find((item) => item.category === 'LAB')!;
  const survey = labPlan.items.find((item) => item.category === 'SURVEY')!;
  const elevator = receivingPlan.items.find((item) => item.category === 'ELEVATOR')!;
  const port = exportPlan.items.find((item) => item.category === 'PORT')!;
  const rail = exportPlan.items.find((item) => item.category === 'RAIL')!;
  const bank = paymentPlan.items.find((item) => item.category === 'BANK')!;
  const exportSurvey = exportPlan.items.find((item) => item.category === 'SURVEY')!;
  const exportInsurance = exportPlan.items.find((item) => item.category === 'INSURANCE')!;
  const summary = buildProviderCategorySummary();

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]} title="Реестр исполнителей ограничен" subtitle="Выбор исполнителей сделки доступен только участникам пилота и операционным ролям.">
      <AppShell title="Исполнители сделки" subtitle="Не справочник компаний, а контур назначения логистики, лаборатории, элеватора, сюрвея, страхования, порта, ЖД и банка.">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Исполнители сделки' }]} />
          <DetailHero
            kicker="Selection engine"
            title="Система сама выбирает лучшего исполнителя и показывает почему"
            description="Автовыбор построен по fit, надёжности, скорости, комплаенсу, интеграции и риску. Контекст больше не захардкожен: он собирается из живого persisted workspace по рейсам, слотам, финансам и документам."
            chips={summary.map((item) => `${item.category.toLowerCase()} ${item.count}`)}
            nextStep={`Открыть рекомендованный контур: ${logistics.selection.recommended?.name || '—'} → ${lab.selection.recommended?.name || '—'} → ${elevator.selection.recommended?.name || '—'}`}
            owner="ops / product / risk"
            blockers="Запрещено назначать неподходящих исполнителей без логики, рейтинга и условий"
            actions={[{ href: '/dispatch', label: 'Диспетчеризация' }, { href: '/survey', label: 'Сюрвей', variant: 'secondary' }, { href: '/insurance', label: 'Страхование', variant: 'secondary' }]}
          />

          <ServiceProviderSelectionPanel title="Автовыбор логистики" subtitle={describeProviderContext(dispatchContext) || 'логистический контур из рабочего состояния'} selection={logistics.selection}
            policy={logistics} primaryHref="/dispatch" primaryLabel="Открыть dispatch" />
          <ServiceProviderSelectionPanel title="Автовыбор лаборатории" subtitle={describeProviderContext(labContext) || 'quality-sensitive кейс'} selection={lab.selection}
            policy={lab} primaryHref="/lab" primaryLabel="Открыть лабораторию" />
          <ServiceProviderSelectionPanel title="Автовыбор элеватора / хранения" subtitle={describeProviderContext(receivingContext) || 'контур приёмки и хранения'} selection={elevator.selection}
            policy={elevator} primaryHref="/receiving" primaryLabel="Открыть приёмку" />
          <ServiceProviderSelectionPanel title="Автовыбор сюрвея / инспекции" subtitle={describeProviderContext(labContext) || 'спорный / экспортный контур'} selection={survey.selection}
            policy={survey} primaryHref="/disputes" primaryLabel="Открыть споры" />
          <ServiceProviderSelectionPanel title="Автовыбор страхования" subtitle={describeProviderContext(dispatchContext) || 'страховой контур рейса'} selection={insurance.selection}
            policy={insurance} primaryHref="/payments" primaryLabel="Открыть платежи" />
          <ServiceProviderSelectionPanel title="Автовыбор порта / терминала" subtitle={describeProviderContext(exportContext) || 'экспортное плечо'} selection={port.selection}
            policy={port} primaryHref="/logistics" primaryLabel="Открыть логистику" />
          <ServiceProviderSelectionPanel title="Автовыбор ЖД-оператора" subtitle={describeProviderContext(exportContext) || 'rail / port handoff'} selection={rail.selection}
            policy={rail} primaryHref="/railway" primaryLabel="Открыть ЖД-контур" />
          <ServiceProviderSelectionPanel title="Экспортный сюрвей" subtitle={describeProviderContext(exportContext) || 'экспортный сюрвей'} selection={exportSurvey.selection} policy={exportSurvey} primaryHref="/railway" primaryLabel="Открыть экспортный контур" />
          <ServiceProviderSelectionPanel title="Экспортное страхование" subtitle={describeProviderContext(exportContext) || 'экспортное страхование'} selection={exportInsurance.selection} policy={exportInsurance} primaryHref="/railway" primaryLabel="Открыть rail / port" />
          <ServiceProviderSelectionPanel title="Банк по умолчанию" subtitle={describeProviderContext(paymentContext) || 'денежный контур'} selection={bank.selection}
            policy={bank} primaryHref="/payments" primaryLabel="Открыть money rail" />

          <NextStepBar
            title="Дальше выбор исполнителя должен происходить прямо внутри рабочего шага"
            detail="Dispatch, lab, receiving, rail и payments уже должны открывать рекомендованный вариант первым и давать controlled override вместо хаотичного списка."
            primary={{ href: '/dispatch', label: 'Открыть dispatch' }}
            secondary={[{ href: '/lab', label: 'Лаборатория' }, { href: '/railway', label: 'ЖД-контур' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
