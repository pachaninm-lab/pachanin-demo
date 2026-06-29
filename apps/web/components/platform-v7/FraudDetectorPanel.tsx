'use client';

import { useState } from 'react';

type SignalType = 'doc_mismatch' | 'role_abuse' | 'bypass_pattern' | 'volume_spike' | 'ip_anomaly' | 'sanction_match';
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type Status = 'open' | 'investigating' | 'dismissed' | 'escalated';

interface FraudAlert {
  id: string;
  dealId: string | null;
  orgName: string;
  signal: SignalType;
  severity: Severity;
  status: Status;
  description: string;
  detectedAt: string;
  score: number;
}

const SIGNAL_LABELS: Record<SignalType, string> = {
  doc_mismatch: 'Несоответствие документов',
  role_abuse: 'Злоупотребление ролью',
  bypass_pattern: 'Обход платформы',
  volume_spike: 'Аномальный объём',
  ip_anomaly: 'IP-аномалия',
  sanction_match: 'Совпадение санкций',
};

const SEVERITY_CONFIG: Record<Severity, { label: string; bg: string; color: string }> = {
  CRITICAL: { label: 'Критично',  bg: '#FFF1F1', color: '#DC2626' },
  HIGH:     { label: 'Высокий',   bg: '#FFF7ED', color: '#EA580C' },
  MEDIUM:   { label: 'Средний',   bg: '#FFFBEB', color: '#D97706' },
  LOW:      { label: 'Низкий',    bg: '#F0FDF4', color: '#059669' },
};

const STATUS_LABELS: Record<Status, string> = {
  open: 'Открыт', investigating: 'Расследуется', dismissed: 'Закрыт', escalated: 'Эскалирован',
};

const DEMO_ALERTS: FraudAlert[] = [
  {
    id: 'fa-001',
    dealId: 'DL-9106',
    orgName: 'ООО «АгроТрейд Юг»',
    signal: 'doc_mismatch',
    severity: 'HIGH',
    status: 'investigating',
    description: 'Данные СДИЗ (объём 120 т) расходятся с товарной накладной (115 т). Разрыв 4.2%. Автоматически заморожена выплата.',
    detectedAt: '2024-03-14T16:32:00Z',
    score: 78,
  },
  {
    id: 'fa-002',
    dealId: 'DL-9102',
    orgName: 'ИП Ковалёв С.А.',
    signal: 'bypass_pattern',
    severity: 'CRITICAL',
    status: 'escalated',
    description: 'Обнаружены признаки внеплатформенного расчёта: встречные платежи на ИП через третье лицо в течение 24 ч после создания сделки. Помечено anti-bypass маркером.',
    detectedAt: '2024-03-12T08:15:00Z',
    score: 94,
  },
  {
    id: 'fa-003',
    dealId: null,
    orgName: 'ООО «МаслоПресс»',
    signal: 'sanction_match',
    severity: 'CRITICAL',
    status: 'open',
    description: 'Частичное совпадение с персоной из санкционного листа OFAC SDN. Уверенность: 71%. Требует ручной проверки по ФИО учредителей.',
    detectedAt: '2024-03-15T11:00:00Z',
    score: 88,
  },
  {
    id: 'fa-004',
    dealId: 'DL-9095',
    orgName: 'Элеватор ТМБ-03',
    signal: 'role_abuse',
    severity: 'MEDIUM',
    status: 'dismissed',
    description: 'Пользователь роли «Элеватор» произвёл действие в разделе «Трейдер» (3 нетипичных события). Сессия проверена — ошибочный ввод роли.',
    detectedAt: '2024-03-10T14:20:00Z',
    score: 42,
  },
  {
    id: 'fa-005',
    dealId: 'DL-9110',
    orgName: 'ЗАО «ЗернэкспортТрейд»',
    signal: 'volume_spike',
    severity: 'MEDIUM',
    status: 'open',
    description: 'Объём сделки 1 850 т превышает типовой профиль контрагента (ср. 230 т) в 8× раз. Возможен сдвиг в профиле или тест-операция.',
    detectedAt: '2024-03-15T09:45:00Z',
    score: 55,
  },
];

const MODEL_STATS = [
  { label: 'Precision', value: '91%', note: 'среди помеченных' },
  { label: 'Recall',    value: '87%', note: 'из реальных случаев' },
  { label: 'F1-Score',  value: '0.89', note: 'на тесте Этапа 1–2' },
  { label: 'Задержка',  value: '< 2 с', note: 'с момента события' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function FraudDetectorPanel() {
  const [alerts, setAlerts] = useState<FraudAlert[]>(DEMO_ALERTS);
  const [filter, setFilter] = useState<Severity | 'ALL'>('ALL');

  const filtered = filter === 'ALL' ? alerts : alerts.filter((a) => a.severity === filter);
  const openCount = alerts.filter((a) => a.status === 'open' || a.status === 'escalated').length;

  function updateStatus(id: string, status: Status) {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
        {[
          { label: 'Открытых сигналов', value: openCount, color: '#DC2626', bg: '#FFF1F1' },
          { label: 'Критичных', value: alerts.filter((a) => a.severity === 'CRITICAL').length, color: '#DC2626', bg: '#FFF1F1' },
          { label: 'Расследуется', value: alerts.filter((a) => a.status === 'investigating').length, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Закрыто (демо)', value: alerts.filter((a) => a.status === 'dismissed').length, color: '#059669', bg: '#F0FDF4' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 12, background: s.bg, border: `1px solid ${s.color}22` }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Model stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 6 }}>
        {MODEL_STATS.map((s) => (
          <div key={s.label} style={{ padding: '8px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', textAlign: 'center' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0F1419', marginTop: 2 }}>{s.value}</div>
            <div style={{ fontSize: 9, color: '#94A3B8' }}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((f) => {
          const cfg = f !== 'ALL' ? SEVERITY_CONFIG[f] : null;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ padding: '4px 12px', borderRadius: 999, fontSize: 10, fontWeight: 800, cursor: 'pointer', border: 'none', background: active ? (cfg?.color ?? '#0F1419') : '#F1F5F9', color: active ? '#fff' : '#64748B' }}
            >
              {f === 'ALL' ? 'Все' : cfg!.label}
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.map((alert) => {
          const sev = SEVERITY_CONFIG[alert.severity];
          return (
            <div key={alert.id} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${sev.color}33`, background: sev.bg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 900, padding: '2px 7px', borderRadius: 999, background: sev.color + '20', color: sev.color }}>{sev.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1E293B' }}>{SIGNAL_LABELS[alert.signal]}</span>
                    {alert.dealId && (
                      <a href={`/platform-v7/deals/${alert.dealId}/clean`} style={{ fontSize: 9, fontFamily: 'monospace', color: '#2563EB', textDecoration: 'none', fontWeight: 700 }}>{alert.dealId}</a>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', marginTop: 4 }}>{alert.orgName}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: sev.color }}>{alert.score}</div>
                  <div style={{ fontSize: 8, color: '#94A3B8', lineHeight: 1.2 }}>Fraud<br />Score</div>
                </div>
              </div>

              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#334155', lineHeight: 1.6 }}>{alert.description}</p>

              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 9, color: '#94A3B8', fontFamily: 'monospace' }}>
                  {new Date(alert.detectedAt).toLocaleString('ru-RU')} · {alert.id}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {alert.status === 'open' && (
                    <>
                      <button onClick={() => updateStatus(alert.id, 'investigating')} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '1px solid #FCD34D', background: '#FFFBEB', cursor: 'pointer', color: '#92400E', fontWeight: 700 }}>
                        Расследовать
                      </button>
                      <button onClick={() => updateStatus(alert.id, 'escalated')} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#FFF1F1', cursor: 'pointer', color: '#DC2626', fontWeight: 700 }}>
                        Эскалировать
                      </button>
                    </>
                  )}
                  {alert.status === 'investigating' && (
                    <button onClick={() => updateStatus(alert.id, 'dismissed')} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#F0FDF4', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>
                      Закрыть
                    </button>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#E4E6EA', color: '#475569' }}>
                    {STATUS_LABELS[alert.status]}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', fontSize: 9, color: '#94A3B8' }}>
        Модель: LightGBM + правила · Сигналы: document_mismatch, role_abuse, bypass_pattern, volume_spike, ip_anomaly, sanction_match · Обновление: real-time (Kafka) · Демо-данные.
      </div>
    </div>
  );
}
