'use client';

import { useState } from 'react';

type DrStatus = 'ok' | 'warn' | 'untested';

interface DrScenario {
  scenario: string;
  rpo: string;
  rto: string;
  mechanism: string;
  lastTested: string | null;
  status: DrStatus;
}

interface BackupItem {
  name: string;
  storage: string;
  retention: string;
  lastBackup: string;
  sizeMb: number;
  verified: boolean;
}

const DR_SCENARIOS: DrScenario[] = [
  { scenario: 'Отказ одного Pod', rpo: '0', rto: '< 30 сек', mechanism: 'K8s PDB + HPA авторестарт', lastTested: '2024-03-01', status: 'ok' },
  { scenario: 'Отказ одной ноды', rpo: '0', rto: '< 2 мин', mechanism: 'K8s rescheduling на здоровую ноду', lastTested: '2024-03-01', status: 'ok' },
  { scenario: 'Отказ зоны доступности', rpo: '< 1 мин', rto: '< 10 мин', mechanism: 'Multi-AZ deployment + Kafka RF=3', lastTested: '2024-02-15', status: 'ok' },
  { scenario: 'Полный отказ ДЦ', rpo: '< 5 мин', rto: '< 30 мин', mechanism: 'Active-Passive failover + DNS переключение', lastTested: null, status: 'untested' },
  { scenario: 'Катастрофическая потеря данных', rpo: '< 1 час', rto: '< 4 часа', mechanism: 'S3 backup restoration + WAL replay', lastTested: null, status: 'untested' },
  { scenario: 'Компрометация секретов', rpo: '0', rto: '< 15 мин', mechanism: 'Vault emergency seal + ротация всех ключей', lastTested: '2024-01-10', status: 'ok' },
];

const BACKUPS: BackupItem[] = [
  { name: 'PostgreSQL deals_db', storage: 'S3 Yandex Cloud', retention: '30 дней', lastBackup: '2024-03-20T04:00:00Z', sizeMb: 2840, verified: true },
  { name: 'PostgreSQL audit_db', storage: 'S3 Yandex Cloud', retention: '5 лет', lastBackup: '2024-03-20T04:15:00Z', sizeMb: 18200, verified: true },
  { name: 'ClickHouse deals_fact', storage: 'S3 Yandex Cloud', retention: '1 год', lastBackup: '2024-03-20T03:30:00Z', sizeMb: 45600, verified: true },
  { name: 'Kafka topics snapshot', storage: 'S3 Yandex Cloud', retention: '7 дней', lastBackup: '2024-03-20T05:00:00Z', sizeMb: 8900, verified: false },
  { name: 'Vault snapshot', storage: 'S3 Yandex Cloud', retention: '90 дней', lastBackup: '2024-03-20T04:45:00Z', sizeMb: 12, verified: true },
  { name: 'MinIO documents', storage: 'S3 Cross-region', retention: 'Бессрочно', lastBackup: '2024-03-20T02:00:00Z', sizeMb: 128000, verified: true },
];

const STATUS_CFG: Record<DrStatus, { label: string; bg: string; color: string; icon: string }> = {
  ok:       { label: 'Протестирован', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  warn:     { label: 'Требует теста', bg: '#FEF3C7', color: '#92400E', icon: '⚠' },
  untested: { label: 'Не тестировался', bg: '#F5F3FF', color: '#5B21B6', icon: '○' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'scenarios' | 'backups' | 'runbook';

export function DisasterRecoveryPanel() {
  const [tab, setTab] = useState<Tab>('scenarios');

  const tested = DR_SCENARIOS.filter(s => s.status === 'ok').length;
  const untested = DR_SCENARIOS.filter(s => s.status === 'untested').length;
  const totalBackupGb = (BACKUPS.reduce((s, b) => s + b.sizeMb, 0) / 1024).toFixed(0);
  const verifiedBackups = BACKUPS.filter(b => b.verified).length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Сценариев',       value: DR_SCENARIOS.length, color: '#0F1419' },
          { label: 'Протестировано',  value: tested,              color: '#065F46' },
          { label: 'Не тестировались', value: untested,           color: untested > 0 ? '#5B21B6' : '#065F46' },
          { label: 'Бэкапов (ГБ)',    value: totalBackupGb,       color: '#1E40AF' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {untested > 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F5F3FF', border: '1px solid #DDD6FE', fontSize: 10, color: '#5B21B6', fontWeight: 700 }}>
          ⚠ {untested} DR-сценария не прошли тренировочное восстановление — запланировать на апрель 2024
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5 }}>
        {([['scenarios', 'DR Сценарии'], ['backups', 'Резервные копии'], ['runbook', 'Runbook']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'scenarios' && (
        <div style={{ display: 'grid', gap: 6 }}>
          {DR_SCENARIOS.map((s) => {
            const st = STATUS_CFG[s.status];
            return (
              <div key={s.scenario} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${s.status === 'untested' ? '#DDD6FE' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0F1419', flex: 1 }}>{s.scenario}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 6, marginTop: 5, fontSize: 9, color: '#374151' }}>
                  <div><span style={lbl}>RPO: </span><span style={{ fontWeight: 700 }}>{s.rpo}</span></div>
                  <div><span style={lbl}>RTO: </span><span style={{ fontWeight: 700 }}>{s.rto}</span></div>
                  <div style={{ gridColumn: '1/-1' }}><span style={lbl}>Механизм: </span>{s.mechanism}</div>
                  {s.lastTested && <div><span style={lbl}>Тест: </span>{s.lastTested}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'backups' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#065F46', fontWeight: 700 }}>Верифицировано: {verifiedBackups}/{BACKUPS.length}</span>
            <span style={{ fontSize: 10, color: '#64748B' }}>Следующая проверка восстановления: 01 апреля 2024</span>
          </div>
          {BACKUPS.map((b) => (
            <div key={b.name} style={{ padding: '7px 10px', borderRadius: 8, background: b.verified ? '#F8FAFB' : '#FFFBEB', border: `1px solid ${b.verified ? '#E4E6EA' : '#FDE68A'}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: b.verified ? '#065F46' : '#92400E' }}>{b.verified ? '✓' : '○'}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{b.name}</span>
              <span style={{ fontSize: 9, color: '#64748B' }}>{b.storage}</span>
              <span style={{ fontSize: 9, color: '#374151', fontWeight: 700 }}>{(b.sizeMb / 1024).toFixed(1)} ГБ</span>
              <span style={{ fontSize: 8, color: '#94A3B8' }}>Retention: {b.retention}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'runbook' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={lbl}>Runbook — порядок действий при инциденте</div>
          {[
            { step: '1', title: 'Обнаружение', desc: 'Alertmanager → PagerDuty → on-call инженер (SLA 5 мин)' },
            { step: '2', title: 'Оценка', desc: 'Определить масштаб: один Pod / нода / зона / ДЦ. Открыть incident канал в Slack #incidents' },
            { step: '3', title: 'Изоляция', desc: 'kubectl cordon <node> или failover DNS → резервный ДЦ. Vault emergency seal если компрометация' },
            { step: '4', title: 'Восстановление', desc: 'kubectl apply -f dr-manifests/ или restore_from_s3.sh <backup_id>. Проверить WAL replay PostgreSQL' },
            { step: '5', title: 'Верификация', desc: 'Запустить smoke-tests, проверить health endpoints, убедиться что Kafka lag = 0' },
            { step: '6', title: 'Post-mortem', desc: 'Документ за 24 часа: таймлайн, root cause, action items. Обновить DR runbook' },
          ].map((item) => (
            <div key={item.step} style={{ display: 'flex', gap: 10, padding: '7px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#0A7A5F', flexShrink: 0, minWidth: 18 }}>{item.step}.</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0F1419' }}>{item.title}</div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700 }}>
            DR-тренировка: раз в квартал — полное восстановление из S3 бэкапа на изолированном стенде. RPO/RTO валидируются автоматически.
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        DR · Multi-AZ · Active-Passive failover · S3 бэкапы · WAL replay · Vault seal · Quarterly DR drill · Демо-данные.
      </div>
    </div>
  );
}
