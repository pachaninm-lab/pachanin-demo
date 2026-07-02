'use client';

import { useState } from 'react';

type TopicHealth = 'ok' | 'warn' | 'error';

interface KafkaTopic {
  name: string;
  partitions: number;
  replicationFactor: number;
  messagesPerSec: number;
  lag: number;
  retentionDays: number;
  health: TopicHealth;
}

interface K8sService {
  name: string;
  replicas: number;
  maxReplicas: number;
  cpuPct: number;
  memMb: number;
  status: 'running' | 'scaling' | 'degraded';
  kafkaLag: number | null;
}

const TOPICS: KafkaTopic[] = [
  { name: 'grainflow.deals.events',          partitions: 6,  replicationFactor: 3, messagesPerSec: 42,  lag: 0,   retentionDays: 30, health: 'ok' },
  { name: 'grainflow.deals.commands',        partitions: 6,  replicationFactor: 3, messagesPerSec: 18,  lag: 0,   retentionDays: 30, health: 'ok' },
  { name: 'grainflow.payments.events',       partitions: 3,  replicationFactor: 3, messagesPerSec: 8,   lag: 0,   retentionDays: 30, health: 'ok' },
  { name: 'grainflow.logistics.events',      partitions: 12, replicationFactor: 3, messagesPerSec: 187, lag: 12,  retentionDays: 14, health: 'warn' },
  { name: 'grainflow.documents.events',      partitions: 3,  replicationFactor: 3, messagesPerSec: 5,   lag: 0,   retentionDays: 30, health: 'ok' },
  { name: 'grainflow.integrations.inbound',  partitions: 6,  replicationFactor: 3, messagesPerSec: 23,  lag: 0,   retentionDays: 7,  health: 'ok' },
  { name: 'grainflow.integrations.outbound', partitions: 6,  replicationFactor: 3, messagesPerSec: 19,  lag: 0,   retentionDays: 7,  health: 'ok' },
  { name: 'grainflow.audit.events',          partitions: 3,  replicationFactor: 3, messagesPerSec: 94,  lag: 0,   retentionDays: 365, health: 'ok' },
  { name: 'grainflow.notifications',         partitions: 3,  replicationFactor: 3, messagesPerSec: 12,  lag: 0,   retentionDays: 3,  health: 'ok' },
  { name: 'grainflow.outbox.dead-letter',    partitions: 3,  replicationFactor: 3, messagesPerSec: 0,   lag: 2,   retentionDays: 30, health: 'warn' },
];

const K8S_SERVICES: K8sService[] = [
  { name: 'deal-service',        replicas: 4,  maxReplicas: 20, cpuPct: 38, memMb: 512,  status: 'running',  kafkaLag: 0 },
  { name: 'payment-service',     replicas: 2,  maxReplicas: 10, cpuPct: 22, memMb: 384,  status: 'running',  kafkaLag: 0 },
  { name: 'logistics-service',   replicas: 6,  maxReplicas: 20, cpuPct: 71, memMb: 640,  status: 'scaling',  kafkaLag: 12 },
  { name: 'document-service',    replicas: 2,  maxReplicas: 8,  cpuPct: 15, memMb: 256,  status: 'running',  kafkaLag: 0 },
  { name: 'notification-service',replicas: 2,  maxReplicas: 6,  cpuPct: 12, memMb: 192,  status: 'running',  kafkaLag: 0 },
  { name: 'saga-orchestrator',   replicas: 2,  maxReplicas: 6,  cpuPct: 18, memMb: 320,  status: 'running',  kafkaLag: 0 },
  { name: 'outbox-relay',        replicas: 1,  maxReplicas: 3,  cpuPct: 5,  memMb: 128,  status: 'running',  kafkaLag: 2 },
  { name: 'api-gateway',         replicas: 3,  maxReplicas: 12, cpuPct: 44, memMb: 448,  status: 'running',  kafkaLag: null },
];

const HEALTH_CFG: Record<TopicHealth, { bg: string; color: string }> = {
  ok:    { bg: '#D1FAE5', color: '#065F46' },
  warn:  { bg: '#FEF3C7', color: '#92400E' },
  error: { bg: '#FEE2E2', color: '#991B1B' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'kafka' | 'k8s' | 'vault';

export function KafkaInfraPanel() {
  const [tab, setTab] = useState<Tab>('kafka');

  const totalMsgSec = TOPICS.reduce((s, t) => s + t.messagesPerSec, 0);
  const warnTopics = TOPICS.filter(t => t.health !== 'ok').length;
  const scalingServices = K8S_SERVICES.filter(s => s.status === 'scaling').length;
  const totalReplicas = K8S_SERVICES.reduce((s, k) => s + k.replicas, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Топиков Kafka',  value: TOPICS.length,     color: '#0F1419' },
          { label: 'msg/сек',        value: totalMsgSec,        color: '#1E40AF' },
          { label: 'DLQ lag',        value: warnTopics > 0 ? `${warnTopics} warn` : 'OK', color: warnTopics > 0 ? '#92400E' : '#065F46' },
          { label: 'Подов (всего)',  value: totalReplicas,      color: scalingServices > 0 ? '#92400E' : '#065F46' },
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
          <div style={{ ...lbl, marginBottom: 2 }}>RF=3 · min.insync.replicas=2 · Kafka 3.7</div>
          {TOPICS.map((t) => {
            const h = HEALTH_CFG[t.health];
            return (
              <div key={t.name} style={{ padding: '6px 10px', borderRadius: 8, background: '#F8FAFB', border: `1px solid ${t.health !== 'ok' ? '#FDE68A' : '#E4E6EA'}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{ fontSize: 9, fontWeight: 700, color: '#1E40AF', flex: 1 }}>{t.name}</code>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: h.bg, color: h.color }}>{t.health.toUpperCase()}</span>
                <span style={{ fontSize: 9, color: '#374151', minWidth: 70 }}>P{t.partitions} · RF{t.replicationFactor}</span>
                <span style={{ fontSize: 9, color: '#0F1419', fontWeight: 700, minWidth: 70 }}>{t.messagesPerSec} msg/s</span>
                {t.lag > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: '#DC2626' }}>lag {t.lag}</span>}
                <span style={{ fontSize: 8, color: '#94A3B8' }}>{t.retentionDays}д</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'k8s' && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ ...lbl, marginBottom: 2 }}>HPA v2 · CPU + Kafka lag метрики · Kubernetes 1.29</div>
          {K8S_SERVICES.map((s) => {
            const isScaling = s.status === 'scaling';
            return (
              <div key={s.name} style={{ padding: '7px 10px', borderRadius: 8, background: isScaling ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${isScaling ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{s.name}</code>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: isScaling ? '#FEF3C7' : '#D1FAE5', color: isScaling ? '#92400E' : '#065F46' }}>
                    {isScaling ? 'SCALING' : 'RUNNING'}
                  </span>
                  <span style={{ fontSize: 9, color: '#374151' }}>{s.replicas}/{s.maxReplicas} pod</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 5 }}>
                  <div>
                    <div style={{ ...lbl, fontSize: 8 }}>CPU</div>
                    <div style={{ height: 4, background: '#E4E6EA', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                      <div style={{ width: `${s.cpuPct}%`, height: '100%', background: s.cpuPct > 70 ? '#D97706' : '#0A7A5F' }} />
                    </div>
                    <div style={{ fontSize: 8, color: '#374151', marginTop: 1 }}>{s.cpuPct}%</div>
                  </div>
                  <div>
                    <div style={{ ...lbl, fontSize: 8 }}>RAM</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#1E40AF', marginTop: 2 }}>{s.memMb} МБ</div>
                  </div>
                  {s.kafkaLag !== null && (
                    <div>
                      <div style={{ ...lbl, fontSize: 8 }}>Kafka lag</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: s.kafkaLag > 0 ? '#DC2626' : '#065F46', marginTop: 2 }}>{s.kafkaLag}</div>
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
            { label: 'API-ключи интеграций', value: 'ФГИС · ФНС · Диадок · КриптоПро · Банк', status: 'ok', note: 'Ротация каждые 30 дн. · Автоматически через Vault Agent' },
            { label: 'Dynamic secrets PostgreSQL', value: 'short-lived credentials (TTL 1 час)', status: 'ok', note: 'database/ secrets engine · lease renewal автоматически' },
            { label: 'PKI (mTLS между сервисами)', value: 'CA выдаёт x509 cert каждому pod', status: 'ok', note: 'cert-manager + Vault PKI · TTL 24 часа' },
            { label: 'Transit Secrets Engine', value: 'Column-level encryption ПДн (152-ФЗ)', status: 'ok', note: 'AES-256-GCM · Поля: phone, INN, passport' },
            { label: 'Vault HA', value: 'Integrated Storage (Raft) · 3 ноды', status: 'ok', note: 'Auto-unseal через KMS · Аудит-лог → syslog' },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#065F46' }}>✓</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0F1419', flex: 1 }}>{item.label}</span>
                <code style={{ fontSize: 9, color: '#1E40AF' }}>{item.value}</code>
              </div>
              <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>{item.note}</div>
            </div>
          ))}
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700 }}>
            HashiCorp Vault 1.15 · Kubernetes Auth Method · AppRole для CI/CD · Sentinel Policies · FIPS 140-2 Level 1
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Kafka 3.7 · 10 топиков · RF=3 · K8s 1.29 HPA v2 · Vault 1.15 Raft HA · mTLS · Transit Encryption ПДн · Демо-данные.
      </div>
    </div>
  );
}
