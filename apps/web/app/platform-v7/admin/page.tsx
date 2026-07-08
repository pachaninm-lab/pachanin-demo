import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { IntegrationEventLog } from '@/components/platform-v7/IntegrationEventLog';
import { BankReconciliationPanel } from '@/components/platform-v7/BankReconciliationPanel';
import { SloSlaPanel } from '@/components/platform-v7/SloSlaPanel';
import { EvidenceBundlePanel } from '@/components/platform-v7/EvidenceBundlePanel';
import { TelegramBotPanel } from '@/components/platform-v7/TelegramBotPanel';
import { ObservabilityPanel } from '@/components/platform-v7/ObservabilityPanel';
import { FeatureFlagsPanel } from '@/components/platform-v7/FeatureFlagsPanel';
import { HealthStatusPanel } from '@/components/platform-v7/HealthStatusPanel';
import { LoadTestingPanel } from '@/components/platform-v7/LoadTestingPanel';
import { SupportOpsPanel } from '@/components/platform-v7/SupportOpsPanel';
import { SagaOrchestratorPanel } from '@/components/platform-v7/SagaOrchestratorPanel';
import { ProductionReadinessPanel } from '@/components/platform-v7/ProductionReadinessPanel';
import { AirflowDagPanel } from '@/components/platform-v7/AirflowDagPanel';
import { B2BPartnerApiPanel } from '@/components/platform-v7/B2BPartnerApiPanel';
import { KafkaInfraPanel } from '@/components/platform-v7/KafkaInfraPanel';
import { DisasterRecoveryPanel } from '@/components/platform-v7/DisasterRecoveryPanel';
import { CiCdPipelinePanel } from '@/components/platform-v7/CiCdPipelinePanel';
import { WebhookSecurityPanel } from '@/components/platform-v7/WebhookSecurityPanel';
import { CoreWebVitalsPanel } from '@/components/platform-v7/CoreWebVitalsPanel';
import { PostgresMigrationPanel } from '@/components/platform-v7/PostgresMigrationPanel';
import { QualityGatePanel } from '@/components/platform-v7/QualityGatePanel';
import { SyntheticMonitoringPanel } from '@/components/platform-v7/SyntheticMonitoringPanel';
import { AcceptanceCriteriaPanel } from '@/components/platform-v7/AcceptanceCriteriaPanel';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputes, openDisputeCount, disputeTotalHeldRub } from '@/lib/disputes-server';
import { getShipments, activeShipmentCount } from '@/lib/logistics-server';
import { getOutboxStatus } from '@/lib/outbox-server';
import { getLabSamples, pendingProtocols } from '@/lib/labs-server';

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

  const liveBlockers = [
    ...(manualReview > 0 ? [{ id: 'manual', label: `${manualReview} outbox-записей требуют ручного разбора`, severity: 'stop' as const }] : []),
    ...(disputeCount > 0 ? [{ id: 'disp', label: `${disputeCount} споров — ${formatMoney(heldRub)} заморожено`, severity: 'warn' as const }] : []),
  ];

  const systemHealth = [
    { name: 'API', status: apiOnline ? 'OK' : 'DEGRADED', detail: apiOnline ? 'отвечает' : 'не отвечает — static fallback' },
    { name: 'Deals', status: 'OK', detail: `${dealList.length} сделок` },
    { name: 'Shipments', status: 'OK', detail: `${shipmentCount} активных рейсов` },
    { name: 'Disputes', status: disputeCount > 0 ? 'WARN' : 'OK', detail: `${disputeCount} открытых` },
    { name: 'Outbox (Bank)', status: pendingBank > 0 ? 'WARN' : 'OK', detail: `${pendingBank} pending, ${manualReview} manual_review` },
    { name: 'Lab', status: pendingLab > 0 ? 'WARN' : 'OK', detail: `${pendingLab} протоколов ожидают` },
  ];

  const statusColor: Record<string, string> = {
    OK: '#16a34a',
    WARN: '#d97706',
    DEGRADED: '#dc2626',
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Административная панель</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>Системный статус, проверочные контуры и readiness без подмены production-факта</p>

      <LiveApiStatusBar
        apiOnline={apiOnline}
        blockers={liveBlockers}
        pendingBankOps={pendingBank}
        openDisputes={disputeCount}
        activeShipments={shipmentCount}
      />

      <div style={{ marginTop: 24, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Статус системы</div>
        {systemHealth.map((item) => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor[item.status] ?? '#6b7280', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 13, width: 120, flexShrink: 0 }}>{item.name}</span>
            <span style={{ fontSize: 12, color: statusColor[item.status], fontWeight: 500, width: 80 }}>{item.status}</span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{item.detail}</span>
          </div>
        ))}
      </div>

      {manualReview > 0 && (
        <div style={{ marginTop: 20, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 4, fontSize: 14 }}>Требуется ручной разбор</div>
          <div style={{ fontSize: 13, color: '#7f1d1d' }}>
            {manualReview} outbox-записей перешли в MANUAL_REVIEW — банк не подтвердил операцию.
            Свяжитесь с банком и обновите статус вручную через POST /settlement-engine/bank-callback.
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
        <CollapsibleSection title='Журнал интеграционных событий' summary='ФГИС · Диадок · Банк · КЭП · GPS · проверочный слой' defaultOpen={false}>
          <IntegrationEventLog />
        </CollapsibleSection>
        <CollapsibleSection title='Сверка банковской выписки' summary='МТ940 · правила сопоставления · ручная очередь · требует live-банка' defaultOpen={false}>
          <BankReconciliationPanel />
        </CollapsibleSection>
        <CollapsibleSection title='SLO/SLA дашборд · целевые метрики' summary='uptime · error budget · latency · контрольные пороги без production SLA' defaultOpen={false}>
          <SloSlaPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Evidence Bundle · Доказательный пакет' summary='хэш-цепочка · УКЭП · PDF/ZIP экспорт · аудит-лог · арбитраж' defaultOpen={false}>
          <EvidenceBundlePanel />
        </CollapsibleSection>
        <CollapsibleSection title='Telegram Bot · проект уведомлений' summary='deal_status · payment · dispute · price_alert · вагон · требует подключения бота' defaultOpen={false}>
          <TelegramBotPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Observability · проект метрик и алертов' summary='Prometheus/Grafana контур · p95/p99 · error rate · GMV · без промышленного SLA' defaultOpen={false}>
          <ObservabilityPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Synthetic Monitoring · сценарии проверки' summary='критические пути · интервальные проверки · P1-алерты · требует внешнего мониторинга' defaultOpen={false}>
          <SyntheticMonitoringPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Feature Flags · проект управления флагами' summary='canary · kill switch · A/B · prod/staging/dev · требует выбранного провайдера' defaultOpen={false}>
          <FeatureFlagsPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Health Status · /health /ready /metrics' summary='liveness/readiness модель · DR RPO/RTO · целевой контур сервисных проб' defaultOpen={false}>
          <HealthStatusPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Load Testing · план нагрузочных проверок' summary='baseline · peak · stress · p95/p99 · SLO thresholds · результаты требуют отдельного прогона' defaultOpen={false}>
          <LoadTestingPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Support Ops Queue · Тикеты' summary='P1/P2/P3/P4 · KYC/финансы/доступ · просмотр сделки · эскалация · SLA' defaultOpen={false}>
          <SupportOpsPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Saga Orchestrator · целевой контур транзакций' summary='retry · DLQ · ФГИС Зерно · aflatoxin · ручное вмешательство · pre-integration' defaultOpen={false}>
          <SagaOrchestratorPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Production Readiness · промышленный чеклист' summary='инфраструктура · безопасность · качество · мониторинг · compliance · без production proof' defaultOpen={false}>
          <ProductionReadinessPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Airflow DAG · проект регуляторных пайплайнов' summary='Росстат · ФГИС · ЭДО · GMV · ML retraining · bank outbox · требует runtime-интеграции' defaultOpen={false}>
          <AirflowDagPanel />
        </CollapsibleSection>
        <CollapsibleSection title='B2B Partner API · ключи и webhooks' summary='API keys · scope-based · rotation · HMAC webhook · pre-integration security model' defaultOpen={false}>
          <B2BPartnerApiPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Webhook Security · HMAC верификация' summary='HMAC-SHA256 · replay protection · idempotency · secrets · требует live-секретов' defaultOpen={false}>
          <WebhookSecurityPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Core Web Vitals · контроль производительности UI' summary='LCP · INP · CLS · bundle · Lighthouse/Faro как целевой мониторинг' defaultOpen={false}>
          <CoreWebVitalsPanel />
        </CollapsibleSection>
        <CollapsibleSection title='PostgreSQL Migration · SQLite → PG 16' summary='RLS · read-replicas · SERIALIZABLE · dual-write · индексы · миграционный план' defaultOpen={false}>
          <PostgresMigrationPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Quality Gate · CI/CD ворота качества' summary='coverage · Trivy · Playwright · k6 · GitLeaks · проверочные гейты' defaultOpen={false}>
          <QualityGatePanel />
        </CollapsibleSection>
        <CollapsibleSection title='Критерии приёмки · промышленная готовность' summary='7 групп · договорные блокеры · автономный контур отдельно от внешних live-интеграций' defaultOpen={false}>
          <AcceptanceCriteriaPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Kafka · K8s HPA · Vault · целевая инфраструктура' summary='topics · HPA · dynamic secrets · encryption · архитектурная модель без подтверждённого live-cluster' defaultOpen={false}>
          <KafkaInfraPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Disaster Recovery · план бэкапов и runbook' summary='сценарии · RPO/RTO · S3/WAL · DR-тренировка · требует промышленного окружения' defaultOpen={false}>
          <DisasterRecoveryPanel />
        </CollapsibleSection>
        <CollapsibleSection title='CI/CD Pipeline · целевая поставка' summary='SAST · Trivy · Playwright · perf gate · canary · требует закреплённого deploy-контура' defaultOpen={false}>
          <CiCdPipelinePanel />
        </CollapsibleSection>
      </div>

      <div style={{ marginTop: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 14 }}>
          Быстрые ссылки
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1, background: '#e5e7eb' }}>
          {[
            { label: 'Audit Log', href: '/platform-v7/audit-log' },
            { label: 'Disputes', href: '/platform-v7/disputes' },
            { label: 'Outbox / Bank', href: '/platform-v7/bank' },
            { label: 'Evidence Pack', href: '/platform-v7/deals/DL-9106/evidence-pack' },
            { label: 'Connectors', href: '/platform-v7/connectors' },
            { label: 'Logistics', href: '/platform-v7/logistics' },
          ].map((link) => (
            <a key={link.href} href={link.href} style={{ display: 'block', padding: '14px 16px', background: '#fff', color: '#374151', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
