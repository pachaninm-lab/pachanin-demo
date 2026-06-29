'use client';

import { useState } from 'react';

type KycStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'sanction_alert';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface KycEntry {
  id: string;
  orgName: string;
  inn: string;
  ogrn: string;
  director: string;
  type: 'new_org' | 'periodic' | 'aml_trigger';
  status: KycStatus;
  risk: RiskLevel;
  submitted: string;
  dealVolume?: string;
  alerts: string[];
}

const QUEUE: KycEntry[] = [
  {
    id: 'KYC-1041',
    orgName: 'ООО «АгроТамбов»',
    inn: '6829012345',
    ogrn: '1176820012345',
    director: 'Смирнов А.В.',
    type: 'new_org',
    status: 'pending',
    risk: 'low',
    submitted: '27.06.2026',
    dealVolume: '12,5 млн ₽',
    alerts: [],
  },
  {
    id: 'KYC-1042',
    orgName: 'ООО «ЗернаТрейд»',
    inn: '3664567890',
    ogrn: '1193660012345',
    director: 'Петров С.И.',
    type: 'aml_trigger',
    status: 'sanction_alert',
    risk: 'critical',
    submitted: '26.06.2026',
    dealVolume: '48,3 млн ₽',
    alerts: ['Совпадение по санкционному списку ЕС', 'Транзакция > 600 000 ₽ — требует AML-проверки по 115-ФЗ'],
  },
  {
    id: 'KYC-1043',
    orgName: 'АО «МаслоПресс»',
    inn: '7701234567',
    ogrn: '1077758123456',
    director: 'Иванова О.П.',
    type: 'periodic',
    status: 'in_review',
    risk: 'medium',
    submitted: '25.06.2026',
    dealVolume: '8,6 млн ₽',
    alerts: ['Директор сменился 3 месяца назад'],
  },
  {
    id: 'KYC-1044',
    orgName: 'ИП Соловьёв А.К.',
    inn: '616805123456',
    ogrn: '319619600123456',
    director: 'Соловьёв А.К.',
    type: 'new_org',
    status: 'approved',
    risk: 'low',
    submitted: '24.06.2026',
    dealVolume: '2,1 млн ₽',
    alerts: [],
  },
];

const STATUS_CONFIG: Record<KycStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'Ожидает', bg: '#F8FAFB', color: '#64748B' },
  in_review: { label: 'На проверке', bg: '#FFFBEB', color: '#D97706' },
  approved: { label: 'Допущен', bg: '#F0FDF4', color: '#0A7A5F' },
  rejected: { label: 'Отказ', bg: '#FFF1F1', color: '#DC2626' },
  sanction_alert: { label: '⚠ Санкции', bg: '#FFF1F1', color: '#DC2626' },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: 'Низкий', color: '#0A7A5F' },
  medium: { label: 'Средний', color: '#D97706' },
  high: { label: 'Высокий', color: '#EA580C' },
  critical: { label: 'Критический', color: '#DC2626' },
};

const TYPE_LABEL: Record<KycEntry['type'], string> = {
  new_org: 'Новая организация',
  periodic: 'Периодическая',
  aml_trigger: 'AML-триггер',
};

export function KycQueuePanel() {
  const [filterStatus, setFilterStatus] = useState<KycStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});

  const filtered = QUEUE.filter((e) => filterStatus === 'all' || e.status === filterStatus);

  function decide(id: string, decision: 'approved' | 'rejected') {
    setDecisions((prev) => ({ ...prev, [id]: decision }));
  }

  const label: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

  const pendingCount = QUEUE.filter((e) => ['pending', 'in_review', 'sanction_alert'].includes(e.status)).length;
  const sanctionCount = QUEUE.filter((e) => e.status === 'sanction_alert').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Alert */}
      {sanctionCount > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 14, background: '#FFF1F1', border: '1px solid #FECACA', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>🚨</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#DC2626' }}>{sanctionCount} санкционное совпадение</div>
            <div style={{ fontSize: 11, color: '#DC2626' }}>Требует немедленного решения и уведомления Росфинмониторинга</div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
        {[
          { label: 'Всего в очереди', value: QUEUE.length, color: '#0F1419' },
          { label: 'Ожидают решения', value: pendingCount, color: '#D97706' },
          { label: 'Допущено', value: QUEUE.filter((e) => e.status === 'approved').length, color: '#0A7A5F' },
          { label: 'Санкции', value: sanctionCount, color: '#DC2626' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
            <div style={label}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['all', 'pending', 'in_review', 'sanction_alert', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: filterStatus === s ? 'none' : '1px solid #E4E6EA',
              background: filterStatus === s ? '#0F1419' : 'transparent',
              color: filterStatus === s ? '#fff' : '#64748B',
            }}
          >
            {s === 'all' ? 'Все' : STATUS_CONFIG[s as KycStatus]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Queue entries */}
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map((entry) => {
          const sc = STATUS_CONFIG[decisions[entry.id] ? (decisions[entry.id] as KycStatus) : entry.status];
          const rc = RISK_CONFIG[entry.risk];
          const isExp = expanded === entry.id;
          const decided = !!decisions[entry.id];

          return (
            <div
              key={entry.id}
              style={{
                borderRadius: 16, border: `1px solid ${entry.status === 'sanction_alert' && !decided ? '#FECACA' : '#E4E6EA'}`,
                background: entry.status === 'sanction_alert' && !decided ? '#FFF8F8' : '#fff',
                overflow: 'hidden',
              }}
            >
              <div
                onClick={() => setExpanded(isExp ? null : entry.id)}
                style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 90px', gap: 12, padding: '12px 16px', cursor: 'pointer', alignItems: 'center' }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>{entry.id}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{entry.orgName}</div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>ИНН {entry.inn} · {TYPE_LABEL[entry.type]}</div>
                  {entry.alerts.length > 0 && (
                    <div style={{ fontSize: 10, color: '#DC2626', marginTop: 2 }}>⚠ {entry.alerts[0]}</div>
                  )}
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: rc.color, background: `${rc.color}18`, padding: '3px 7px', borderRadius: 6 }}>
                    {rc.label} риск
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 8, background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                </div>
              </div>

              {isExp && (
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid #F1F5F9', display: 'grid', gap: 12, marginTop: 4 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8, marginTop: 8 }}>
                    {[
                      { label: 'ОГРН', value: entry.ogrn },
                      { label: 'Директор', value: entry.director },
                      { label: 'Подано', value: entry.submitted },
                      { label: 'Объём сделок', value: entry.dealVolume ?? '—' },
                    ].map((f) => (
                      <div key={f.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                        <div style={label}>{f.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', marginTop: 4 }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {entry.alerts.length > 1 && (
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FFF1F1', border: '1px solid #FECACA' }}>
                      <div style={label}>Все флаги</div>
                      {entry.alerts.map((a, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>• {a}</div>
                      ))}
                    </div>
                  )}

                  {!decided && ['pending', 'in_review', 'sanction_alert'].includes(entry.status) && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => decide(entry.id, 'approved')}
                        style={{ flex: 1, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#0A7A5F', color: '#fff', fontSize: 12, fontWeight: 800 }}
                      >
                        Допустить
                      </button>
                      <button
                        onClick={() => decide(entry.id, 'rejected')}
                        style={{ flex: 1, padding: '8px 16px', borderRadius: 10, border: '1px solid #FECACA', cursor: 'pointer', background: '#fff', color: '#DC2626', fontSize: 12, fontWeight: 800 }}
                      >
                        Отказать
                      </button>
                    </div>
                  )}
                  {decided && (
                    <div style={{ padding: '8px 12px', borderRadius: 10, background: decisions[entry.id] === 'approved' ? '#F0FDF4' : '#FFF1F1', border: `1px solid ${decisions[entry.id] === 'approved' ? '#BBF7D0' : '#FECACA'}` }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: decisions[entry.id] === 'approved' ? '#0A7A5F' : '#DC2626' }}>
                        ✓ Решение зафиксировано: {decisions[entry.id] === 'approved' ? 'Допущен' : 'Отказ'} · Запись в аудит-логе
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Демо-превью. В боевом контуре — ФНС API верификация ИНН/ОГРН, санкционный скрининг (OFAC/ЕС/Росфинмониторинг), AML-проверка по 115-ФЗ. Все решения фиксируются в append-only audit log.
      </div>
    </div>
  );
}
