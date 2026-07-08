'use client';

import { useState } from 'react';

type ReadinessStatus = 'ready' | 'planned' | 'external';

interface WebhookControl {
  id: string;
  area: string;
  title: string;
  status: ReadinessStatus;
  requirement: string;
  acceptance: string;
}

interface PartnerFlow {
  id: string;
  name: string;
  direction: string;
  events: string[];
  status: ReadinessStatus;
  note: string;
}

const CONTROLS: WebhookControl[] = [
  {
    id: 'whc-01',
    area: 'Inbound',
    title: 'Проверка источника события',
    status: 'planned',
    requirement: 'каждое входящее событие должно иметь проверяемый источник и журнал обработки',
    acceptance: 'подтверждается интеграционным тестом и audit trail',
  },
  {
    id: 'whc-02',
    area: 'Inbound',
    title: 'Защита от повторной обработки',
    status: 'planned',
    requirement: 'повторное событие не должно создавать дубль сделки, документа или финансового основания',
    acceptance: 'подтверждается тестом идемпотентности',
  },
  {
    id: 'whc-03',
    area: 'Outbound',
    title: 'Очередь исходящих событий',
    status: 'planned',
    requirement: 'исходящие уведомления должны проходить через очередь, повтор и ручную проверку ошибок',
    acceptance: 'подтверждается outbox-отчётом',
  },
  {
    id: 'whc-04',
    area: 'Partners',
    title: 'Партнёрские подключения',
    status: 'external',
    requirement: 'ERP, банк, ЭДО, ФГИС и ГИС ЭПД подключаются только после договоров, доступов и регламента',
    acceptance: 'не считать live до подтверждённого партнёрского теста',
  },
  {
    id: 'whc-05',
    area: 'Audit',
    title: 'Журнал входящих и исходящих событий',
    status: 'ready',
    requirement: 'каждое событие должно быть связано со сделкой, actor, временем, результатом и причиной отказа',
    acceptance: 'проверяется через карточку сделки и evidence trail',
  },
  {
    id: 'whc-06',
    area: 'Operations',
    title: 'Safe degradation',
    status: 'planned',
    requirement: 'при недоступности внешнего контура сделка не теряется и переводится в понятный статус',
    acceptance: 'подтверждается smoke-тестом критического пути',
  },
];

const FLOWS: PartnerFlow[] = [
  {
    id: 'flow-01',
    name: 'Bank release basis',
    direction: 'platform → bank / bank → platform',
    events: ['reserve_requested', 'release_basis_ready', 'reconciliation_result'],
    status: 'external',
    note: 'требует банкового договора, callback, reconciliation и регламента споров',
  },
  {
    id: 'flow-02',
    name: 'FGIS / SDIZ contour',
    direction: 'platform ↔ state contour',
    events: ['lot_reference', 'sdiz_status', 'restriction_update'],
    status: 'external',
    note: 'требует доступа к API, регламента и подтверждённых операций',
  },
  {
    id: 'flow-03',
    name: 'EDO / signing contour',
    direction: 'platform ↔ document provider',
    events: ['document_sent', 'document_signed', 'document_rejected'],
    status: 'external',
    note: 'требует договора с провайдером, сертификатов и проверенного signing-flow',
  },
  {
    id: 'flow-04',
    name: 'ERP / CRM partner events',
    direction: 'platform → partner systems',
    events: ['deal_created', 'shipment_updated', 'document_ready'],
    status: 'planned',
    note: 'должно быть вторичным контуром, не заменяющим объект Сделка',
  },
];

const STATUS_CFG: Record<ReadinessStatus, { label: string; bg: string; color: string; icon: string }> = {
  ready: { label: 'READY', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  planned: { label: 'PLANNED', bg: '#DBEAFE', color: '#1E40AF', icon: '◌' },
  external: { label: 'EXTERNAL', bg: '#FEF3C7', color: '#92400E', icon: '!' },
};

const AREA_COLOR: Record<string, string> = {
  Inbound: '#0EA5E9', Outbound: '#10B981', Partners: '#F59E0B', Audit: '#0F1419', Operations: '#8B5CF6',
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'controls' | 'flows' | 'rules';

export function WebhookSecurityPanel() {
  const [tab, setTab] = useState<Tab>('controls');

  const ready = CONTROLS.filter(c => c.status === 'ready').length;
  const planned = CONTROLS.filter(c => c.status === 'planned').length;
  const external = CONTROLS.filter(c => c.status === 'external').length + FLOWS.filter(f => f.status === 'external').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Контролей', value: CONTROLS.length, color: '#0F1419' },
          { label: 'READY', value: ready, color: '#065F46' },
          { label: 'PLANNED', value: planned, color: '#1E40AF' },
          { label: 'EXTERNAL', value: external, color: external > 0 ? '#92400E' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        Webhook readiness · входящие и исходящие события проектируются вокруг сделки. Live-доставка, партнёрские URL, ключи, статистика и callback не заявляются без подтверждённых подключений.
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['controls', 'Контроли'], ['flows', 'Потоки'], ['rules', 'Правила']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'controls' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Webhook controls · readiness</div>
          {CONTROLS.map((control) => {
            const st = STATUS_CFG[control.status];
            return (
              <div key={control.id} style={{ padding: '8px 12px', borderRadius: 10, background: control.status === 'external' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${control.status === 'external' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, color: AREA_COLOR[control.area] ?? '#374151' }}>[{control.area}]</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{control.title}</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{control.requirement}</div>
                <div style={{ fontSize: 8, color: '#94A3B8', marginTop: 1 }}>Acceptance: {control.acceptance}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'flows' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Партнёрские webhook-потоки</div>
          {FLOWS.map((flow) => {
            const st = STATUS_CFG[flow.status];
            return (
              <div key={flow.id} style={{ padding: '8px 12px', borderRadius: 10, background: flow.status === 'external' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${flow.status === 'external' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                  <code style={{ fontSize: 9, fontWeight: 700, color: '#0F1419', flex: 1 }}>{flow.name}</code>
                  <span style={{ fontSize: 8, color: '#94A3B8' }}>{flow.direction}</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>Events: {flow.events.join(', ')}</div>
                <div style={{ fontSize: 8, color: '#94A3B8', marginTop: 1 }}>{flow.note}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'rules' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={lbl}>Правила промышленной приёмки webhook-контура</div>
          {[
            { key: 'Нет fake-live', value: 'не показывать доставленные события, URL партнёров и статистику без реального подключения' },
            { key: 'Связь со сделкой', value: 'каждое событие должно быть привязано к dealId или к проверяемому внешнему основанию' },
            { key: 'Идемпотентность', value: 'повтор события не должен менять деньги, документы или статус сделки дважды' },
            { key: 'Audit trail', value: 'принятие, отказ и ручная проверка события фиксируются в журнале' },
            { key: 'Safe degradation', value: 'недоступность партнёра не должна ломать интерфейс и критический путь сделки' },
          ].map((row) => (
            <div key={row.key} style={{ display: 'flex', gap: 12, padding: '6px 10px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#374151', width: 150, flexShrink: 0 }}>{row.key}</span>
              <span style={{ fontSize: 10, color: '#64748B' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Webhook readiness · внешние события усиливают исполнение сделки, но не считаются live до договоров, доступов, callback, сверки и отчёта приёмки.
      </div>
    </div>
  );
}
