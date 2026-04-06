import { INTERNAL_ONLY_ROLES, OPERATOR_ROLES } from '../../lib/route-roles';
import { FieldMobileHub } from '../../components/field-mobile-hub';
import { BrowserAccessPanel } from '../../components/browser-access-panel';
import { FieldOfflineHardeningPanel } from '../../components/field-offline-hardening-panel';
import { PageAccessGuard } from '../../components/page-access-guard';
import { AppShell } from '../../components/app-shell';
import { ModuleHub } from '../../components/module-hub';
import { OperationBlueprint } from '../../components/operation-blueprint';
import { NextStepBar } from '../../components/next-step-bar';
import { buildFieldOfflineLanes, buildOfflineConflictCases } from '../../lib/closure-readiness-engine';
import { readCommercialWorkspace, buildSurveyView, buildInsuranceView } from '../../lib/commercial-workspace-store';

function detectBrowserFieldMode() {
  return {
    backgroundSyncReliable: false,
    needsQueueFallback: true,
    geolocationSigned: false,
  };
}

export default async function FieldMobilePage() {
  const browserMode = detectBrowserFieldMode();
  const offlineCases = buildOfflineConflictCases();
  const offlineLanes = buildFieldOfflineLanes({
    stage: 'field',
    liveMode: false,
    pendingActions: offlineCases.length,
    needsGpsEvidence: true,
    canQueueOffline: true,
    hasBrowserConstraint: true,
  });
  const state = await readCommercialWorkspace();
  const surveyView = buildSurveyView(state);
  const insuranceView = buildInsuranceView(state);
  const leadTask = surveyView.tasks[0];
  const incidentCases = insuranceView.cases.filter((item) => item.status !== 'POLICY_DRAFT').length;

  return (
    <PageAccessGuard allowedRoles={[...INTERNAL_ONLY_ROLES, ...OPERATOR_ROLES]} title="Field mobile ограничен" subtitle="Экран нужен сюрвею, приёмке, оператору и другим полевым ролям.">
      <AppShell title="Field mobile" subtitle="Единый мобильный rail для сюрвея, фотофиксации, incident trail и handoff в claims/disputes.">
        <div className="page-surface">
          <BrowserAccessPanel surface="field" />

          <FieldOfflineHardeningPanel lanes={[{
            stage: 'FIELD_MOBILE',
            status: browserMode.needsQueueFallback ? 'BROWSER_GAP' : 'READY',
            reason: browserMode.needsQueueFallback ? 'Полевой контур требует offline queue и signed evidence, браузер не закрывает всё стабильно.' : 'Field rail готов в браузере.',
            owner: 'mobile',
            actions: browserMode.needsQueueFallback ? ['queue fallback', 'signed evidence sync'] : ['monitor field tasks'],
          }, ...offlineLanes]} cases={offlineCases} />

          <ModuleHub
            title="Что должно связывать field mobile"
            subtitle="Полевой экран должен продолжать survey/insurance/dispute контур и не быть отдельным оффлайн-блокнотом."
            items={[
              { href: '/surveyor', label: 'Survey rail', detail: 'Открыть задачи, привязанные к cargo / route / claim.', icon: '🧪', meta: `${surveyView.tasks.length} задач`, tone: 'blue' },
              { href: '/insurance', label: 'Insurance rail', detail: 'Инциденты и claim path должны быть рядом с полевыми событиями.', icon: '🛡', meta: `${incidentCases} кейсов`, tone: incidentCases ? 'red' : 'gray' },
              { href: '/disputes', label: 'Dispute rail', detail: 'Полевое evidence должно уходить в спорный контур без ручной пересборки.', icon: '⚠️', meta: leadTask?.status || 'no lead', tone: 'amber' },
              { href: '/documents', label: 'Documents', detail: 'Фото и отчёты должны попадать в document/evidence rail.', icon: '⌁', meta: 'evidence', tone: 'green' },
            ]}
          />

          <OperationBlueprint
            title="Как должен заканчиваться field rail"
            subtitle="После полевого действия контур должен уходить в survey/insurance/dispute/documents, а не оставаться только на телефоне."
            stages={[
              { title: 'Task / inspection open', detail: 'Открыть полевую задачу и понять, к какому cargo/deal она привязана.', state: leadTask ? 'active' : 'pending', href: '/surveyor' },
              { title: 'Evidence capture', detail: 'Фото, координаты и observations должны собраться в signed evidence.', state: browserMode.needsQueueFallback ? 'risk' : 'active', href: '/field-mobile' },
              { title: 'Insurance / dispute handoff', detail: 'При инциденте следующий rail — claim или dispute.', state: incidentCases ? 'active' : 'pending', href: '/insurance' },
              { title: 'Document archive', detail: 'Полевой результат должен завершаться попаданием в documents/evidence rail.', state: 'pending', href: '/documents' },
            ]}
            outcomes={[
              { href: '/surveyor', label: 'Survey rail', detail: 'Вернуться к задачам и понять статус linked inspection.', meta: leadTask?.id || 'survey' },
              { href: '/insurance', label: 'Insurance rail', detail: 'Если полевая проверка выявила риск, сразу открыть claim path.', meta: `${incidentCases} cases` },
              { href: '/documents', label: 'Documents / evidence', detail: 'Завершить mobile rail только после попадания evidence в архив.', meta: browserMode.needsQueueFallback ? 'queued sync' : 'direct sync' },
            ]}
            rules={[
              'Field rail не должен заканчиваться внутри мобильного экрана — evidence обязан перейти в documents/dispute/insurance.',
              'Если браузер не даёт надёжный background sync, это должно быть явно отражено как queue fallback, а не скрытый риск.',
              'Любая полевая задача должна быть привязана к cargo/deal/route, иначе она не влияет на execution truth.'
            ]}
          />

          <FieldMobileHub />

          <NextStepBar
            title={leadTask ? `Открыть rail для задачи ${leadTask.id}` : 'Открыть survey rail'}
            detail={leadTask ? `${leadTask.title} · ${leadTask.status}` : 'Полевые задачи начинаются в survey rail.'}
            primary={{ href: '/surveyor', label: 'Открыть survey rail' }}
            secondary={[{ href: '/insurance', label: 'Insurance rail' }, { href: '/documents', label: 'Documents' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
