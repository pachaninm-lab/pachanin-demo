import { countPhraseRu, countRu } from '@/lib/format/plural';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { ConsolePage, Section, Banner, StatGrid, Stat, StatusRow, LinkGrid, type Tone } from '@/components/platform-v7/console/ConsoleKit';
import { AdminRuntimeControls } from '@/components/platform-v7/AdminRuntimeControls';
import { AuditLogPanel } from '@/components/platform-v7/AuditLogPanel';
import { IntegrationEventLog } from '@/components/platform-v7/IntegrationEventLog';
import { FeatureFlagsPanel } from '@/components/platform-v7/FeatureFlagsPanel';
import { SupportOpsPanel } from '@/components/platform-v7/SupportOpsPanel';
import { BankReconciliationPanel } from '@/components/platform-v7/BankReconciliationPanel';
import { SloSlaPanel } from '@/components/platform-v7/SloSlaPanel';
import { ObservabilityPanel } from '@/components/platform-v7/ObservabilityPanel';
import { HealthStatusPanel } from '@/components/platform-v7/HealthStatusPanel';
import { SagaOrchestratorPanel } from '@/components/platform-v7/SagaOrchestratorPanel';
import { ProductionReadinessPanel } from '@/components/platform-v7/ProductionReadinessPanel';
import { PostgresMigrationPanel } from '@/components/platform-v7/PostgresMigrationPanel';
import { KafkaInfraPanel } from '@/components/platform-v7/KafkaInfraPanel';
import { DisasterRecoveryPanel } from '@/components/platform-v7/DisasterRecoveryPanel';
import { CiCdPipelinePanel } from '@/components/platform-v7/CiCdPipelinePanel';
import { LoadTestingPanel } from '@/components/platform-v7/LoadTestingPanel';
import { AcceptanceCriteriaPanel } from '@/components/platform-v7/AcceptanceCriteriaPanel';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputes, openDisputeCount, disputeTotalHeldRub } from '@/lib/disputes-server';
import { getShipments, activeShipmentCount } from '@/lib/logistics-server';
import { getOutboxStatus } from '@/lib/outbox-server';
import { getLabSamples, pendingProtocols } from '@/lib/labs-server';

export const metadata = { title: 'Административная консоль' };

function formatMoney(rub: number): string {
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  if (rub >= 1_000) return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
  return `${rub} ₽`;
}

export default async function AdminPage() {
  const [deals, disputes, shipments, outbox, samples] = await Promise.all([
    getDealsCanonical(),
    getDisputes(),
    getShipments(),
    getOutboxStatus(),
    getLabSamples(),
  ]);

  const apiOnline = outbox.isApiAvailable;
  const dealList: any[] = Array.isArray(deals) ? deals : [];
  const disputeCount = openDisputeCount(disputes);
  const heldRub = disputeTotalHeldRub(disputes);
  const shipmentCount = activeShipmentCount(shipments);
  const pendingBank = outbox.totalPending ?? 0;
  const pendingLab = pendingProtocols(samples).length;
  const manualReview = outbox.manualReview?.length ?? 0;

  const systemHealth: Array<{ name: string; tone: Tone; detail: string }> = [
    { name: 'Источник данных', tone: apiOnline ? 'ok' : 'warn', detail: apiOnline ? 'сервер отвечает' : 'демонстрационные данные — сервер недоступен' },
    { name: 'Сделки', tone: 'ok', detail: countPhraseRu(dealList.length, 'deals') },
    { name: 'Рейсы', tone: 'ok', detail: countPhraseRu(shipmentCount, 'activeShipments') },
    { name: 'Споры', tone: disputeCount > 0 ? 'warn' : 'ok', detail: `${countPhraseRu(disputeCount, 'openDisputes')} · ${formatMoney(heldRub)} удержано` },
    { name: 'Очередь банка', tone: manualReview > 0 ? 'danger' : pendingBank > 0 ? 'warn' : 'ok', detail: `${pendingBank} в ожидании · ${manualReview} на ручном разборе` },
    { name: 'Лаборатория', tone: pendingLab > 0 ? 'warn' : 'ok', detail: countRu(pendingLab, 'протокол ожидает', 'протокола ожидают', 'протоколов ожидают') },
  ];

  const openIssues = [manualReview > 0, disputeCount > 0, pendingLab > 0].filter(Boolean).length;

  return (
    <ConsolePage
      title="Административная консоль"
      subtitle="Управление платформой, наблюдение за исполнением сделок и контроль готовности контура. Данные показываются в демонстрационном режиме, пока серверный контур не развёрнут."
    >
      {!apiOnline && (
        <Banner tone="warn" title="Демонстрационные данные — сервер недоступен">
          Панель работает на встроенных данных сценария. Управляющие действия применяются к локальному
          состоянию браузера; серверные операции станут доступны после развёртывания API-контура.
        </Banner>
      )}

      <Section title="Живой статус" hint="считается из текущих данных">
        <StatGrid>
          <Stat label="Сделки" value={String(dealList.length)} foot="под контролем" />
          <Stat label="Открытые споры" value={String(disputeCount)} tone={disputeCount > 0 ? 'warn' : 'ok'} foot={formatMoney(heldRub) + ' удержано'} />
          <Stat label="Ручной разбор" value={String(manualReview)} tone={manualReview > 0 ? 'danger' : 'ok'} foot="очередь банка" />
          <Stat label="Активные рейсы" value={String(shipmentCount)} foot="в логистике" />
        </StatGrid>
        <div style={{ display: 'grid', gap: 'var(--pc-space-2)' }}>
          {systemHealth.map((s) => (
            <StatusRow key={s.name} name={s.name} tone={s.tone} detail={s.detail} />
          ))}
        </div>
      </Section>

      {manualReview > 0 && (
        <Banner tone="danger" title={`${manualReview} операций требуют ручного разбора`}>
          Банк не подтвердил операцию — записи перешли в ручную очередь. Свяжитесь с банком и обновите
          статус через контур сверки.
        </Banner>
      )}

      <Section title="Управление" hint="действия применяются немедленно">
        <AdminRuntimeControls />
        <CollapsibleSection title="Флаги функциональности" summary="canary · kill switch · A/B · окружения" defaultOpen={false}>
          <FeatureFlagsPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Очередь поддержки" summary="тикеты P1–P4 · KYC · доступ · эскалация" defaultOpen={false}>
          <SupportOpsPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Сверка банковской выписки" summary="автосопоставление · ручная очередь" defaultOpen={false}>
          <BankReconciliationPanel />
        </CollapsibleSection>
      </Section>

      <Section title="Наблюдение" hint="журналы и метрики">
        <CollapsibleSection title="Журнал аудита" summary="кто · что · когда · над каким объектом" defaultOpen={false}>
          <AuditLogPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Журнал интеграционных событий" summary="ФГИС · ЭДО · банк · КЭП · GPS" defaultOpen={false}>
          <IntegrationEventLog />
        </CollapsibleSection>
        <CollapsibleSection title="Показатели сервиса (SLO/SLA)" summary="доступность · бюджет ошибок · задержки" defaultOpen={false}>
          <SloSlaPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Наблюдаемость · метрики и алерты" summary="Prometheus · Grafana · Alertmanager" defaultOpen={false}>
          <ObservabilityPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Проверки живости · /health /ready" summary="liveness · readiness · пробы" defaultOpen={false}>
          <HealthStatusPanel />
        </CollapsibleSection>
      </Section>

      <Section title="Проектный контур" hint="требует развёртывания — не подключено">
        <Banner tone="info" title="Дорожная карта, а не текущее состояние">
          Ниже — целевая инфраструктура из плана перехода к боевому контуру. Показатели носят проектный
          характер и станут живыми после развёртывания. Порядок и статус — в docs/PATH_TO_PRODUCTION.md.
        </Banner>
        <CollapsibleSection title="Готовность к прод-контуру · чеклист" summary="инфраструктура · безопасность · мониторинг" defaultOpen={false}>
          <ProductionReadinessPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Критерии приёмки" summary="группы критериев · статус готовности" defaultOpen={false}>
          <AcceptanceCriteriaPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Миграция на PostgreSQL" summary="RLS · реплики · индексы · dual-write" defaultOpen={false}>
          <PostgresMigrationPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Оркестрация саг · распределённые транзакции" summary="очередь · DLQ · retry · ручное вмешательство" defaultOpen={false}>
          <SagaOrchestratorPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Нагрузочное тестирование" summary="k6 · baseline / peak / stress · пороги SLO" defaultOpen={false}>
          <LoadTestingPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Очереди и инфраструктура" summary="брокер · автоскейл · секреты" defaultOpen={false}>
          <KafkaInfraPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Аварийное восстановление" summary="RPO/RTO · бэкапы · runbook" defaultOpen={false}>
          <DisasterRecoveryPanel />
        </CollapsibleSection>
        <CollapsibleSection title="Конвейер CI/CD" summary="сборка · проверки · canary-выкатка" defaultOpen={false}>
          <CiCdPipelinePanel />
        </CollapsibleSection>
      </Section>

      <Section title="Быстрые переходы" hint={openIssues > 0 ? `${openIssues} зон требуют внимания` : 'всё спокойно'}>
        <LinkGrid
          links={[
            { label: 'Журнал аудита', href: '/platform-v7/audit-log', note: 'полная история действий' },
            { label: 'Споры', href: '/platform-v7/disputes', note: 'удержания и доказательства' },
            { label: 'Банк / очередь', href: '/platform-v7/bank', note: 'основания и сверка' },
            { label: 'Логистика', href: '/platform-v7/logistics', note: 'рейсы и ЭТрН' },
            { label: 'Разъёмы', href: '/platform-v7/connectors', note: 'внешние интеграции' },
            { label: 'Центр управления', href: '/platform-v7/control-tower', note: 'оперативный пульт' },
          ]}
        />
      </Section>
    </ConsolePage>
  );
}
