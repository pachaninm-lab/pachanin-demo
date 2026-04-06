import { DRIVER_ROLES } from '../../lib/route-roles';
import { DriverMobileHub } from '../../components/driver-mobile-hub';
import { PageAccessGuard } from '../../components/page-access-guard';
import { AppShell } from '../../components/app-shell';
import { DriverVerificationPanel } from '../../components/driver-verification-panel';
import { BrowserAccessPanel } from '../../components/browser-access-panel';
import { NextStepBar } from '../../components/next-step-bar';
import { ModuleHub } from '../../components/module-hub';
import { OperationBlueprint } from '../../components/operation-blueprint';
import { readCommercialWorkspace, buildDispatchView } from '../../lib/commercial-workspace-store';
import { buildFieldOfflineLanes, buildOfflineConflictCases } from '../../lib/closure-readiness-engine';
import { FieldOfflineHardeningPanel } from '../../components/field-offline-hardening-panel';

function detectMobileBrowserMode() {
  return {
    webkitGpsTrusted: false,
    pwaReady: false,
    needsNativeGpsFallback: true,
  };
}

export default async function DriverMobilePage() {
  const state = await readCommercialWorkspace();
  const dispatchView = buildDispatchView(state);
  const currentAssignment = dispatchView.routes.find((item) => item.status === 'ASSIGNED' || item.status === 'EN_ROUTE') || dispatchView.routes[0];
  const browserMode = detectMobileBrowserMode();
  const offlineCases = buildOfflineConflictCases();
  const offlineLanes = buildFieldOfflineLanes({
    stage: 'driver',
    liveMode: false,
    pendingActions: offlineCases.length,
    needsGpsEvidence: true,
    canQueueOffline: true,
    hasBrowserConstraint: true,
  });

  return (
    <PageAccessGuard allowedRoles={[...DRIVER_ROLES]} title="Мобильный маршрут ограничен" subtitle="Экран нужен водителю, диспетчеру и операционной роли, которая ведёт рейс.">
      <AppShell title="Driver mobile" subtitle="Единый rail для водителя: назначение, маршрут, события и handoff в dispatch / receiving.">
        <div className="page-surface">
          <DriverVerificationPanel requirePin={true} requireGeo={true} assignment={currentAssignment ? {
            tripId: currentAssignment.id,
            driverName: currentAssignment.driverName,
            truckNumber: currentAssignment.truckNumber,
            routeSummary: `${currentAssignment.originLabel} → ${currentAssignment.destinationLabel}`,
            etaLabel: currentAssignment.etaLabel,
          } : null} />

          <BrowserAccessPanel surface="driver" />

          <FieldOfflineHardeningPanel lanes={[{
            stage: 'DRIVER_MOBILE',
            status: browserMode.needsNativeGpsFallback ? 'BROWSER_GAP' : 'READY',
            reason: browserMode.needsNativeGpsFallback ? 'GPS и background follow в браузере не покрывают полный mobile rail, нужен native fallback.' : 'Mobile rail готов в браузере.',
            owner: 'mobile',
            actions: browserMode.needsNativeGpsFallback ? ['native gps handoff', 'offline proof queue'] : ['monitor route'],
          }, ...offlineLanes]} cases={offlineCases} />

          <ModuleHub
            title="Что должен видеть водительский контур"
            subtitle="Экран водителя — не тупик. Из него должны быть понятны следующий rail, ETA, инциденты и handoff в dispatch/receiving."
            items={[
              { href: '/dispatch', label: 'Dispatch rail', detail: 'Связать мобильное назначение с owner action диспетчера.', icon: '🧭', meta: currentAssignment?.id || 'assignment', tone: 'blue' },
              { href: '/logistics', label: 'Логистика', detail: 'Проверить ETA, маршрут и инциденты по рейсу.', icon: '🚚', meta: currentAssignment?.status || 'route', tone: 'green' },
              { href: '/receiving', label: 'Приёмка', detail: 'Подготовить handoff в слот, очередь и weighbridge.', icon: '🏁', meta: currentAssignment?.destinationLabel || 'slot', tone: 'amber' },
              { href: '/weighbridge', label: 'Весовая', detail: 'После прибытия перевести рейс в weight / unload rail.', icon: '⚖️', meta: 'evidence', tone: 'gray' },
            ]}
          />

          <OperationBlueprint
            title="Как должен заканчиваться mobile rail"
            subtitle="После назначения водитель должен последовательно проходить dispatch → route → receiving/weight. Экран не должен быть отдельным мобильным островом."
            stages={[
              { title: 'Driver verification', detail: 'Пин, гео и привязка водителя к assignment.', state: currentAssignment ? 'active' : 'pending', href: '/driver-mobile' },
              { title: 'Route follow-up', detail: 'Маршрут, ETA и incident trail должны уходить в dispatch/logistics.', state: currentAssignment ? 'active' : 'pending', href: '/logistics' },
              { title: 'Receiving handoff', detail: 'Прибытие должно открывать receiving rail и слот, а не зависать в mobile.', state: currentAssignment ? 'pending' : 'blocked', href: '/receiving' },
              { title: 'Weight / unload evidence', detail: 'Финал mobile rail — перевод в weighbridge / unload proof.', state: browserMode.needsNativeGpsFallback ? 'risk' : 'pending', href: '/weighbridge' },
            ]}
            outcomes={[
              { href: '/dispatch', label: 'Dispatch owner action', detail: 'Диспетчер должен видеть, что driver mobile живой и связанный с assignment.', meta: currentAssignment?.id || 'assignment' },
              { href: '/receiving', label: 'Receiving rail', detail: 'Следующий шаг после прибытия — очередь/слот, а не чат или звонок.', meta: currentAssignment?.destinationLabel || 'receiving' },
              { href: '/weighbridge', label: 'Weight rail', detail: 'Mobile должен подвести рейс к weighbridge и unload evidence.', meta: browserMode.needsNativeGpsFallback ? 'native fallback' : 'ready' },
            ]}
            rules={[
              'Mobile rail должен быть связан с dispatch/logistics и не жить отдельно от основного execution контура.',
              'После route follow-up следующий rail обязан быть receiving/weight, иначе водительский контур превращается в тупик.',
              'Если браузер не тянет GPS/background proof, это должно быть явно помечено и переведено в native fallback.'
            ]}
          />

          <DriverMobileHub />

          <NextStepBar
            title={currentAssignment ? `Открыть следующий rail для ${currentAssignment.driverName}` : 'Создать assignment для водителя'}
            detail={currentAssignment ? `${currentAssignment.originLabel} → ${currentAssignment.destinationLabel}` : 'Без назначения mobile rail будет пустым.'}
            primary={currentAssignment ? { href: '/dispatch', label: 'Открыть dispatch' } : { href: '/logistics', label: 'Открыть логистику' }}
            secondary={[{ href: '/receiving', label: 'Приёмка' }, { href: '/weighbridge', label: 'Весовая' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
