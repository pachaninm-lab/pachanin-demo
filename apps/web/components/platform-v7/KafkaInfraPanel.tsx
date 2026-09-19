'use client';

import { useState } from 'react';

type TopicHealth = 'ready' | 'planned' | 'required';

interface KafkaTopic {
  name: string;
  partitions: number;
  replicationFactor: number;
  targetThroughput: string;
  lagPolicy: string;
  retentionDays: number;
  health: TopicHealth;
}

interface K8sService {
  name: string;
  targetReplicas: string;
  maxReplicas: number;
  scalingSignal: string;
  resourceProfile: string;
  status: 'ready' | 'planned' | 'required';
  kafkaLagPolicy: string | null;
}

const TOPICS: KafkaTopic[] = [
  { name: 'grainflow.deals.events',          partitions: 6,  replicationFactor: 3, targetThroughput: 'события сделки',       lagPolicy: 'P1 при задержке state machine', retentionDays: 30,  health: 'ready' },
  { name: 'grainflow.deals.commands',        partitions: 6,  replicationFactor: 3, targetThroughput: 'команды workflow',     lagPolicy: 'идемпотентная обработка', retentionDays: 30,  health: 'ready' },
  { name: 'grainflow.payments.events',       partitions: 3,  replicationFactor: 3, targetThroughput: 'bank/outbox events',    lagPolicy: 'P1 для stuck payout/reconcile', retentionDays: 30,  health: 'planned' },
  { name: 'grainflow.logistics.events',      partitions: 12, replicationFactor: 3, targetThroughput: 'GPS/рейсы/очереди',     lagPolicy: 'P2 при росте lag', retentionDays: 14,  health: 'planned' },
  { name: 'grainflow.documents.events',      partitions: 3,  replicationFactor: 3, targetThroughput: 'документы/evidence',    lagPolicy: 'P2 при блокировке банковской проверки', retentionDays: 30,  health: 'planned' },
  { name: 'grainflow.integrations.inbound',  partitions: 6,  replicationFactor: 3, targetThroughput: 'ФГИС/ЭДО/банк вход',    lagPolicy: 'требует live-интеграций', retentionDays: 7,   health: 'required' },
  { name: 'grainflow.integrations.outbound', partitions: 6,  replicationFactor: 3, targetThroughput: 'ФГИС/ЭДО/банк выход',   lagPolicy: 'требует live-интеграций', retentionDays: 7,   health: 'required' },
  { name: 'grainflow.audit.events',          partitions: 3,  replicationFactor: 3, targetThroughput: 'audit trail',           lagPolicy: 'нельзя терять события', retentionDays: 365, health: 'ready' },
  { name: 'grainflow.notifications',         partitions: 3,  replicationFactor: 3, targetThroughput: 'уведомления',           lagPolicy: 'retry + DLQ', retentionDays: 3,   health: 'planned' },
  { name: 'grainflow.outbox.dead-letter',    partitions: 3,  replicationFactor: 3, targetThroughput: 'ручной разбор',         lagPolicy: 'операционный контроль', retentionDays: 30,  health: 'planned' },
];

const K8S_SERVICES: K8sService[] = [
  { name: 'deal-service',         targetReplicas: '2+', maxReplicas: 20, scalingSignal: 'RPS + state transitions', resourceProfile: 'CPU/RAM по нагрузочному профилю', status: 'ready',    kafkaLagPolicy: 'deal events lag' },
  { name: 'payment-service',      targetReplicas: '2+', maxReplicas: 10, scalingSignal: 'outbox pending/manual_review', resourceProfile: 'низкая задержка + строгая идемпотентность', status: 'planned',  kafkaLagPolicy: 'payment events lag' },
  { name: 'logistics-service',    targetReplicas: '2+', maxReplicas: 20, scalingSignal: 'GPS events + elevator queue', resourceProfile: 'burst traffic from field clients', status: 'planned', kafkaLagPolicy: 'logistics events lag' },
  { name: 'document-service',     targetReplicas: '2+', maxReplicas: 8,  scalingSignal: 'document generation/signing', resourceProfile: 'IO + storage throughput', status: 'planned', kafkaLagPolicy: 'documents events lag' },
  { name: 'notification-service', targetReplicas: '2+', maxReplicas: 6,  scalingSignal: 'delivery retries', resourceProfile: 'queue workers', status: 'planned', kafkaLagPolicy: 'notification lag' },
  { name: 'saga-orchestrator',    targetReplicas: '2+', maxReplicas: 6,  scalingSignal: 'saga retries + DLQ', resourceProfile: 'exactly-once semantics by idempotency', status: 'ready', kafkaLagPolicy: 'commands lag' },
  { name: 'outbox-relay',         targetReplicas: '1+', maxReplicas: 3,  scalingSignal: 'outbox pending', resourceProfile: 'safe retry worker', status: 'planned', kafkaLagPolicy: 'DLQ policy' },
  { name: 'api-gateway',          targetReplicas: '2+', maxReplicas: 12, scalingSignal: 'RPS + latency', resourceProfile: 'edge/API traffic', status: 'planned', kafkaLagPolicy: null },
];

const HEALTH_CFG: Record<TopicHealth, { bg: string; color: string; label: string }> = {
  ready:    { bg: '#D1FAE5', color: '#065F46', label: 'READY' },
  planned:  { bg: '#FEF3C7', color: '#92400E', label: 'PLANNED' },
  required: { bg: '#FEE2E2', color: '#991B1B', label: 'REQUIRED' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'kafka' | 'k8s' | 'vault';

export function KafkaInfraPanel() {
  const [tab, setTab] = useState<Tab>('kafka');

  const requiredTopics = TOPICS.filter(t => t.health === 'required').length;
  const plannedTopics = TOPICS.filter(t => t.health === 'planned').length;
  const requiredServices = K8S_SERVICES.filter(s => s.status === 'required').length;
  const plannedServices = K8S_SERVICES.filter(s => s.status === 'planned').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Топиков Kafka', value: TOPICS.length, color: '#0F1419' },
          { label: 'Required', value: requiredTopics + requiredServices, color: requiredTopics + requiredServices > 0 ? '#991B1B' : '#065F46' },
          { label: 'Planned', value: plannedTopics + plannedServices, color: plannedTopics + plannedServices > 0 ? '#92400E' : '#065F46' },
          { label: 'K8s services', value: K8S_SERVICES.length, color: '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['kafka', 'Kafka Topics'], ['k8s', 'Kubernetes HPA'], ['vault', 'Vault / Secrets']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'kafka' && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ ...lbl, marginBottom: 2 }}>Целевая модель: RF=3 · min.insync.replicas=2 · Kafka-compatible event backbone</div>
          {TOPICS.map((t) => {
            const h = HEALTH_CFG[t.health];
            return (
              <div key={t.name} style={{ padding: '6px 10px', borderRadius: 8, background: '#F8FAFB', border: `1px solid ${t.health === 'required' ? '#FCA5A5' : t.health === 'planned' ? '#FDE68A' : '#E4E6EA'}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{ fontSize: 9, fontWeight: 700, color: '#1E40AF', flex: 1 }}>{t.name}</code>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: h.bg, color: h.color }}>{h.label}</span>
                <span style={{ fontSize: 9, color: '#374151', minWidth: 70 }}>P{t.partitions} · RF{t.replicationFactor}</span>
                <span style={{ fontSize: 9, color: '#0F1419', fontWeight: 700, minWidth: 110 }}>{t.targetThroughput}</span>
                <span style={{ fontSize: 8, color: '#94A3B8' }}>{t.retentionDays}д</span>
                <span style={{ fontSize: 9, color: '#64748B', flexBasis: '100%' }}>{t.lagPolicy}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'k8s' && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ ...lbl, marginBottom: 2 }}>Целевая модель: HPA v2 · CPU + queue lag + latency · требует подтверждённого live-cluster</div>
          {K8S_SERVICES.map((s) => {
            const cfg = HEALTH_CFG[s.status];
            return (
              <div key={s.name} style={{ padding: '7px 10px', borderRadius: 8, background: s.status === 'required' ? '#FEF2F2' : s.status === 'planned' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${s.status === 'required' ? '#FCA5A5' : s.status === 'planned' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{s.name}</code>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize: 9, color: '#374151' }}>{s.targetReplicas}/{s.maxReplicas} target pods</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginTop: 5 }}>
                  <div>
                    <div style={{ ...lbl, fontSize: 8 }}>Scaling signal</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#1E40AF', marginTop: 2 }}>{s.scalingSignal}</div>
                  </div>
                  <div>
                    <div style={{ ...lbl, fontSize: 8 }}>Resource profile</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginTop: 2 }}>{s.resourceProfile}</div>
                  </div>
                  {s.kafkaLagPolicy !== null && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ ...lbl, fontSize: 8 }}>Kafka lag policy</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', marginTop: 2 }}>{s.kafkaLagPolicy}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'vault' && (
        <div style={{ display: 'grid', gap: 6 }}>
          {[
            { label: 'API-ключи интеграций', value: 'ФГИС · ФНС · ЭДО · КЭП · Банк', note: 'Требует договоров, боевых ключей, ротации и audit trail. Не считать интеграции подключёнными.' },
            { label: 'Dynamic secrets PostgreSQL', value: 'short-lived credentials', note: 'Целевая модель для промышленной БД; требует выбранного secret-store и проверенного lease lifecycle.' },
            { label: 'PKI / mTLS между сервисами', value: 'service certificates', note: 'Целевой контур. Не писать, что CA уже выдаёт сертификаты pod-ам без live-cluster.' },
            { label: 'Transit encryption', value: 'ПДн / bank-sensitive fields', note: 'Требует утверждённой схемы шифрования, KMS/secret-store и регламента доступа.' },
            { label: 'Vault HA / secret-store HA', value: 'Raft/KMS/audit log', note: 'Архитектурное требование. Не считать HashiCorp Vault подключённым без промышленного стенда.' },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#92400E' }}>!</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0F1419', flex: 1 }}>{item.label}</span>
                <code style={{ fontSize: 9, color: '#1E40AF' }}>{item.value}</code>
              </div>
              <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>{item.note}</div>
            </div>
          ))}
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700 }}>
            Secret-store readiness · Kubernetes Auth/AppRole/PKI/Transit/FIPS — целевые требования, не подтверждённый live-факт.
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Kafka/K8s/Vault readiness · целевая инфраструктурная модель для промышленной эксплуатации; throughput, pod count, lag, mTLS и секреты требуют подтверждённого live-cluster и эксплуатационных отчётов.
      </div>
    </div>
  );
}
