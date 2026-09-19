'use client';

import { useState } from 'react';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';

interface ExecutionCheckStep {
  id: string;
  title: string;
  requires: string[];
  disabledReason: string;
  result: {
    message: string;
    auditId: string;
    externalStatus: string;
  };
}

const EXECUTION_CHECK_STEPS: ExecutionCheckStep[] = [
  {
    id: 'createLot',
    title: '1. Создать лот',
    requires: [],
    disabledReason: '',
    result: { message: 'Лот создан во внутреннем контуре исполнения', auditId: 'DL-9113 · createLot', externalStatus: 'Лот создан' },
  },
  {
    id: 'openDeal',
    title: '2. Открыть сделку',
    requires: ['createLot'],
    disabledReason: 'Сначала создай лот',
    result: { message: 'Сделка открыта во внутреннем контуре исполнения', auditId: 'DL-9113 · openDeal', externalStatus: 'Сделка открыта' },
  },
  {
    id: 'assignRoute',
    title: '3. Назначить рейс',
    requires: ['openDeal'],
    disabledReason: 'Требуется открытая сделка',
    result: { message: 'Рейс назначен во внутреннем контуре исполнения', auditId: 'DL-9113 · assignRoute', externalStatus: 'Рейс назначен' },
  },
  {
    id: 'recordWeight',
    title: '4. Зафиксировать вес',
    requires: ['assignRoute'],
    disabledReason: 'Требуется активный рейс',
    result: { message: 'Вес зафиксирован во внутреннем контуре исполнения', auditId: 'DL-9113 · recordWeight', externalStatus: 'Вес зафиксирован' },
  },
  {
    id: 'requestReserve',
    title: '5. Запросить резерв',
    requires: [],
    disabledReason: '',
    result: { message: 'Запрос резерва подготовлен во внутреннем контуре исполнения', auditId: 'DL-9113 · requestReserve', externalStatus: 'Запрос резерва подготовлен' },
  },
  {
    id: 'confirmReserve',
    title: '6. Подтвердить резерв',
    requires: ['requestReserve'],
    disabledReason: 'Банк подтверждает только запрошенный резерв',
    result: { message: 'Резерв отражён как банковское основание для проверки', auditId: 'DL-9113 · confirmReserve', externalStatus: 'Банковское основание отражено' },
  },
  {
    id: 'uploadLab',
    title: '7. Загрузить лабораторный протокол',
    requires: ['recordWeight'],
    disabledReason: 'Лаборатория доступна после подтверждения веса',
    result: { message: 'Лабораторный протокол загружен', auditId: 'DL-9113 · uploadLab', externalStatus: 'Протокол загружен' },
  },
  {
    id: 'acceptance',
    title: '8. Подтвердить приёмку',
    requires: ['uploadLab'],
    disabledReason: 'Требуется лабораторный протокол',
    result: { message: 'Приёмка подтверждена', auditId: 'DL-9113 · acceptance', externalStatus: 'Приёмка подтверждена' },
  },
  {
    id: 'bankBasis',
    title: '9. Передать основание банку',
    requires: ['confirmReserve', 'acceptance'],
    disabledReason: 'Требуется подтверждение резерва и приёмки',
    result: { message: 'Основание передано банку на проверку', auditId: 'DL-9113 · bankBasis', externalStatus: 'Основание передано банку' },
  },
  {
    id: 'openDispute',
    title: '10. Открыть спор',
    requires: ['uploadLab', 'acceptance'],
    disabledReason: 'Спор открывается после лаборатории или приёмки',
    result: { message: 'Спор открыт', auditId: 'DL-9113 · openDispute', externalStatus: 'Спор открыт' },
  },
];

interface AuditEvent {
  stepTitle: string;
  message: string;
  auditId: string;
  externalStatus: string;
}

export function ExecutionSimulationActionPanel() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<AuditEvent[]>([]);

  function handleAction(step: ExecutionCheckStep) {
    setCompleted((prev) => new Set([...prev, step.id]));
    setResults((prev) => ({ ...prev, [step.id]: step.result.message }));
    setAudit((prev) => [
      { stepTitle: step.title, message: step.result.message, auditId: step.result.auditId, externalStatus: step.result.externalStatus },
      ...prev,
    ]);
  }

  const reservedRub = 9_648_000;
  const formatRub = (n: number) => `${(n / 1_000_000).toFixed(1)} млн ₽`;

  return (
    <div data-testid='execution-simulation-action-panel' style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <Kpi label='Оборот проверки' value={formatRub(reservedRub)} />
        <Kpi label='К банковскому основанию' value={completed.has('confirmReserve') ? formatRub(reservedRub) : '—'} />
        <Kpi label='Открытых споров' value={completed.has('openDispute') ? '1' : '0'} />
        <Kpi label='Текущий статус' value={completed.size === 0 ? 'Старт' : `Шаг ${completed.size}`} />
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {EXECUTION_CHECK_STEPS.map((step) => {
          const isDisabled = step.requires.some((req) => !completed.has(req));
          const resultMsg = results[step.id];
          return (
            <div
              key={step.id}
              style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: 14, padding: 14, background: '#fff', display: 'grid', gap: 8 }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: PLATFORM_V7_TOKENS.color.textPrimary }}>{step.title}</span>
              {isDisabled && step.disabledReason ? (
                <span style={{ fontSize: 12, color: '#B45309' }}>{step.disabledReason}</span>
              ) : null}
              {resultMsg ? (
                <span style={{ fontSize: 12, color: '#0A7A5F' }}>{resultMsg}</span>
              ) : null}
              <button
                type='button'
                disabled={isDisabled}
                onClick={() => !isDisabled && handleAction(step)}
                style={{ minHeight: 36, borderRadius: 10, border: '1px solid var(--pc-border)', background: isDisabled ? '#f3f4f6' : '#0A7A5F', color: isDisabled ? '#9ca3af' : '#fff', fontSize: 13, fontWeight: 800, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
              >
                Проверить шаг
              </button>
            </div>
          );
        })}
      </div>

      {audit.length > 0 && (
        <section style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
          <strong style={{ fontSize: 14, fontWeight: 800, color: PLATFORM_V7_TOKENS.color.textPrimary }}>Журнал проверки</strong>
          {audit.map((ev, i) => (
            <div key={i} style={{ display: 'grid', gap: 4, padding: 10, borderRadius: 10, background: '#f8f9fa', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 13, color: '#0A7A5F', fontWeight: 800 }}>{ev.stepTitle}: {ev.message}</div>
              <div style={{ fontSize: 12, color: '#475569' }}>{ev.auditId}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{ev.externalStatus}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6B7280' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: '#0F1419' }}>{value}</div>
    </div>
  );
}
