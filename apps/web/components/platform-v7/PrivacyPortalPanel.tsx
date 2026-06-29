'use client';

import { useState } from 'react';

interface ConsentRecord {
  id: string;
  type: string;
  policyVersion: string;
  grantedAt: string;
  status: 'active' | 'withdrawn';
  channel: string;
}

interface DataOperation {
  id: string;
  category: string;
  purpose: string;
  basis: string;
  retention: string;
  processors: string[];
}

const CONSENTS: ConsentRecord[] = [
  { id: 'c-001', type: 'Обработка персональных данных (ПДн)', policyVersion: '3.2', grantedAt: '2024-01-10T09:15:00Z', status: 'active', channel: 'Онбординг · веб-форма' },
  { id: 'c-002', type: 'Передача ПДн третьим лицам (банк, ФГИС)', policyVersion: '3.2', grantedAt: '2024-01-10T09:15:00Z', status: 'active', channel: 'Онбординг · веб-форма' },
  { id: 'c-003', type: 'Маркетинговые коммуникации', policyVersion: '2.8', grantedAt: '2023-09-01T10:00:00Z', status: 'withdrawn', channel: 'Email-форма' },
  { id: 'c-004', type: 'Сбор данных телематики (GPS-трекинг)', policyVersion: '3.2', grantedAt: '2024-02-01T08:00:00Z', status: 'active', channel: 'Мобильное приложение водителя' },
];

const DATA_OPERATIONS: DataOperation[] = [
  { id: 'op-001', category: 'Идентификационные данные', purpose: 'Верификация KYC/AML, ЕГРЮЛ', basis: 'Договор (ст. 6 ФЗ-152)', retention: '5 лет', processors: ['ФНС', 'СПАРК'] },
  { id: 'op-002', category: 'Банковские реквизиты', purpose: 'Расчёты по сделке (эскроу)', basis: 'Договор', retention: '5 лет', processors: ['Сбер · Безопасные сделки'] },
  { id: 'op-003', category: 'Документы сделки', purpose: 'Исполнение договора, СДИЗ, ЭТрН', basis: 'Договор + законодательная обязанность', retention: '5 лет', processors: ['ФГИС Зерно', 'Диадок', 'СБИС'] },
  { id: 'op-004', category: 'GPS-данные водителя', purpose: 'Трекинг доставки', basis: 'Согласие', retention: '1 год', processors: ['Wialon'] },
  { id: 'op-005', category: 'Логи действий', purpose: 'Безопасность, аудит (append-only)', basis: 'Законодательная обязанность', retention: '5 лет', processors: ['Платформа (внутренний лог)'] },
];

const RIGHTS = [
  { id: 'r-access',  icon: '📂', title: 'Право на доступ', desc: 'Получить копию всех ваших данных в JSON/CSV', action: 'Запросить выгрузку' },
  { id: 'r-correct', icon: '✏️', title: 'Право на исправление', desc: 'Исправить неточные персональные данные', action: 'Подать запрос' },
  { id: 'r-erase',   icon: '🗑️', title: 'Право на удаление', desc: 'Анонимизация данных (soft-delete, без физического удаления из аудит-лога)', action: 'Запросить удаление' },
  { id: 'r-port',    icon: '📦', title: 'Право на переносимость', desc: 'Экспорт всех данных профиля в машиночитаемом формате', action: 'Скачать JSON' },
  { id: 'r-object',  icon: '🚫', title: 'Право на возражение', desc: 'Возразить против обработки (кроме законодательных оснований)', action: 'Подать возражение' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function PrivacyPortalPanel() {
  const [tab, setTab] = useState<'consents' | 'operations' | 'rights' | 'incident'>('consents');
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [consents, setConsents] = useState(CONSENTS);
  const [incidentSent, setIncidentSent] = useState(false);

  function handleAction(id: string, label: string) {
    setActionStatus((prev) => ({ ...prev, [id]: `✓ ${label} — запрос принят` }));
  }

  function withdrawConsent(id: string) {
    setConsents((prev) => prev.map((c) => c.id === id ? { ...c, status: 'withdrawn' } : c));
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* 152-ФЗ banner */}
      <div style={{ padding: '12px 16px', borderRadius: 12, background: '#F0F9FF', border: '1px solid #BAE6FD', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 22 }}>🛡️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0C4A6E' }}>Портал субъекта данных · 152-ФЗ</div>
          <div style={{ fontSize: 11, color: '#0369A1', lineHeight: 1.6, marginTop: 2 }}>
            Реализовано в соответствии с Федеральным законом № 152-ФЗ «О персональных данных». Все данные хранятся на серверах в РФ (Yandex Cloud / Selectel). Ответственный за обработку: ООО «ГрейнФлоу».
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {(['consents', 'operations', 'rights', 'incident'] as const).map((t) => {
          const labels: Record<string, string> = { consents: 'Согласия', operations: 'Реестр операций', rights: 'Мои права', incident: 'Уведомление РКН' };
          return (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 14px', borderRadius: 8, border: tab === t ? 'none' : '1px solid #E4E6EA', background: tab === t ? '#0F1419' : '#F8FAFB', color: tab === t ? '#fff' : '#64748B', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* Consents tab */}
      {tab === 'consents' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {consents.map((c) => (
            <div key={c.id} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${c.status === 'active' ? '#BBF7D0' : '#E4E6EA'}`, background: c.status === 'active' ? '#F0FDF4' : '#F8FAFB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{c.type}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                    Политика v{c.policyVersion} · {new Date(c.grantedAt).toLocaleDateString('ru-RU')} · {c.channel}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: c.status === 'active' ? '#D1FAE5' : '#F1F5F9', color: c.status === 'active' ? '#065F46' : '#94A3B8' }}>
                    {c.status === 'active' ? '✓ Активно' : 'Отозвано'}
                  </span>
                  {c.status === 'active' && (
                    <button onClick={() => withdrawConsent(c.id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid #FECACA', background: '#FFF1F1', cursor: 'pointer', color: '#DC2626', fontWeight: 700 }}>
                      Отозвать
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#94A3B8', padding: '8px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            ⚠ Отзыв согласия на обработку ПДн, необходимых для исполнения договора, может привести к невозможности проведения сделок на платформе.
          </div>
        </div>
      )}

      {/* Data operations tab */}
      {tab === 'operations' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {DATA_OPERATIONS.map((op) => (
            <div key={op.id} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{op.category}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 8 }}>
                <div><div style={lbl}>Цель</div><div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{op.purpose}</div></div>
                <div><div style={lbl}>Правовое основание</div><div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{op.basis}</div></div>
                <div><div style={lbl}>Срок хранения</div><div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{op.retention}</div></div>
              </div>
              <div style={{ marginTop: 6 }}>
                <div style={lbl}>Обработчики</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {op.processors.map((p) => (
                    <span key={p} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: '#EDE9FE', color: '#5B21B6', fontWeight: 700 }}>{p}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rights tab */}
      {tab === 'rights' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {RIGHTS.map((r) => (
            <div key={r.id} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{r.title}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{r.desc}</div>
                {actionStatus[r.id] && (
                  <div style={{ fontSize: 10, color: '#0A7A5F', fontWeight: 700, marginTop: 4 }}>{actionStatus[r.id]}</div>
                )}
              </div>
              {!actionStatus[r.id] && (
                <button onClick={() => handleAction(r.id, r.action)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#0A7A5F', fontWeight: 700, flexShrink: 0 }}>
                  {r.action}
                </button>
              )}
            </div>
          ))}
          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA', fontSize: 10, color: '#64748B', lineHeight: 1.6 }}>
            Срок ответа: 30 дней (ст. 21 ФЗ-152). Данные хранятся на серверах в РФ. Column-level шифрование (Vault Transit) паспортных данных и банковских реквизитов. Маскирование в логах.
          </div>
        </div>
      )}

      {/* Incident / RKN tab */}
      {tab === 'incident' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ padding: '12px 14px', borderRadius: 12, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>Уведомление РКН об инциденте (ч. 3.1 ст. 21 ФЗ-152)</div>
            <div style={{ fontSize: 11, color: '#78350F', marginTop: 4, lineHeight: 1.6 }}>
              При выявлении инцидента оператор обязан уведомить Роскомнадзор в течение 24 часов (первичное) и 72 часов (итоговое). Шаблон генерируется автоматически.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
            {[
              { label: 'Инцидентов за 12 мес.', value: '0', color: '#059669' },
              { label: 'ДПО назначен', value: 'Да', color: '#059669' },
              { label: 'Уведомление в РКН', value: 'Подано', color: '#059669' },
              { label: 'Срок ответа РКН', value: '— ожидается', color: '#D97706' },
            ].map((s) => (
              <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                <div style={lbl}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0F1419', marginBottom: 8 }}>Шаблон первичного уведомления (24 ч)</div>
            <pre style={{ fontSize: 10, color: '#475569', background: '#fff', padding: '10px', borderRadius: 8, border: '1px solid #E4E6EA', overflow: 'auto', lineHeight: 1.7, margin: 0 }}>
{`Оператор: ООО «ГрейнФлоу», ОГРН 1217700000001
Дата/время инцидента: [YYYY-MM-DD HH:MM UTC+3]
Описание: [краткое описание]
Категории ПДн: [список]
Примерное число субъектов: [N]
Принятые меры: [блокировка доступа, логирование, уведомление субъектов]
Контакт ДПО: dpo [at] grainflow [dot] ru`}
            </pre>
          </div>

          {!incidentSent ? (
            <button onClick={() => setIncidentSent(true)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#DC2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>
              Сформировать уведомление РКН (демо)
            </button>
          ) : (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 12, fontWeight: 700, color: '#065F46' }}>
              ✓ Шаблон уведомления сформирован · Отправка через ГосСОПКА (демо)
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        152-ФЗ · Политика конфиденциальности v3.2 · Данные: серверы РФ · Vault Transit шифрование · Soft-delete (anonymization) · Аудит-лог 5 лет. Демо-превью.
      </div>
    </div>
  );
}
