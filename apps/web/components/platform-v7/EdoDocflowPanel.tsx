'use client';

import { useState } from 'react';

type EdoStatus = 'sent' | 'delivered' | 'signed' | 'rejected' | 'pending';
type EdoOperator = 'diadok' | 'taxcom' | 'sbis' | 'mock';
type DocType = 'upd' | 'act' | 'invoice' | 'contract' | 'ettn';

interface EdoDocument {
  id: string;
  dealId: string;
  type: DocType;
  title: string;
  operator: EdoOperator;
  direction: 'inbound' | 'outbound';
  status: EdoStatus;
  counterparty: string;
  amount: number | null;
  sentAt: string;
  signedAt: string | null;
  externalId: string;
  autoMatched: boolean;
}

const DOCS: EdoDocument[] = [
  { id: 'edo-001', dealId: 'DL-9095', type: 'upd', title: 'УПД №95/03-20 (АгроХолдинг Черноземье)', operator: 'diadok', direction: 'outbound', status: 'signed', counterparty: 'АгроХолдинг «Черноземье»', amount: 62640000, sentAt: '2024-03-20T09:00:00Z', signedAt: '2024-03-20T11:30:00Z', externalId: 'DIA-2024-000441892', autoMatched: true },
  { id: 'edo-002', dealId: 'DL-9095', type: 'act', title: 'Акт приёмки №95/03-20', operator: 'diadok', direction: 'outbound', status: 'signed', counterparty: 'АгроХолдинг «Черноземье»', amount: null, sentAt: '2024-03-20T09:05:00Z', signedAt: '2024-03-20T10:45:00Z', externalId: 'DIA-2024-000441895', autoMatched: true },
  { id: 'edo-003', dealId: 'DL-9110', type: 'upd', title: 'УПД №110/03-18 (Транзит-Зерно)', operator: 'taxcom', direction: 'outbound', status: 'delivered', counterparty: 'Транзит-Зерно АО', amount: 23550000, sentAt: '2024-03-18T14:00:00Z', signedAt: null, externalId: 'TAX-2024-C-88712', autoMatched: false },
  { id: 'edo-004', dealId: 'DL-9095', type: 'invoice', title: 'Счёт-фактура №42 от 20.03.2024', operator: 'diadok', direction: 'outbound', status: 'sent', counterparty: 'АгроХолдинг «Черноземье»', amount: 62640000, sentAt: '2024-03-20T09:30:00Z', signedAt: null, externalId: 'DIA-2024-000441900', autoMatched: true },
  { id: 'edo-005', dealId: 'DL-8901', type: 'upd', title: 'УПД №8901/02-15 входящий', operator: 'sbis', direction: 'inbound', status: 'signed', counterparty: 'ФермерОпт ООО', amount: 18900000, sentAt: '2024-02-15T10:00:00Z', signedAt: '2024-02-15T13:20:00Z', externalId: 'SBIS-2024-I-229811', autoMatched: true },
  { id: 'edo-006', dealId: 'DL-9110', type: 'contract', title: 'Договор поставки №DL-9110', operator: 'diadok', direction: 'outbound', status: 'rejected', counterparty: 'Транзит-Зерно АО', amount: null, sentAt: '2024-03-17T11:00:00Z', signedAt: null, externalId: 'DIA-2024-000439100', autoMatched: false },
];

const OPERATORS: Record<EdoOperator, { name: string; color: string; bg: string }> = {
  diadok: { name: 'Контур.Диадок', color: '#1E40AF', bg: '#EFF6FF' },
  taxcom: { name: 'Такском',       color: '#065F46', bg: '#F0FDF4' },
  sbis:   { name: 'СБИС',          color: '#5B21B6', bg: '#F5F3FF' },
  mock:   { name: 'Mock',          color: '#64748B', bg: '#F1F5F9' },
};

const STATUS_CFG: Record<EdoStatus, { label: string; bg: string; color: string }> = {
  sent:      { label: 'Отправлен',    bg: '#EFF6FF', color: '#1E40AF' },
  delivered: { label: 'Доставлен',    bg: '#FEF3C7', color: '#92400E' },
  signed:    { label: 'Подписан',     bg: '#D1FAE5', color: '#065F46' },
  rejected:  { label: 'Отклонён',     bg: '#FEE2E2', color: '#991B1B' },
  pending:   { label: 'Ожидание',     bg: '#F1F5F9', color: '#64748B' },
};

const DOC_TYPE_LABEL: Record<DocType, string> = {
  upd:      'УПД',
  act:      'Акт',
  invoice:  'Счёт',
  contract: 'Договор',
  ettn:     'ЭТрН',
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function fmtMoney(rub: number) {
  return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
}

type Filter = 'all' | 'inbound' | 'outbound';

export function EdoDocflowPanel() {
  const [filter, setFilter] = useState<Filter>('all');
  const [operatorFilter, setOperatorFilter] = useState<EdoOperator | 'all'>('all');

  const filtered = DOCS
    .filter(d => filter === 'all' || d.direction === filter)
    .filter(d => operatorFilter === 'all' || d.operator === operatorFilter);

  const signed = DOCS.filter(d => d.status === 'signed').length;
  const pending = DOCS.filter(d => d.status === 'sent' || d.status === 'delivered').length;
  const rejected = DOCS.filter(d => d.status === 'rejected').length;
  const autoMatchedCount = DOCS.filter(d => d.autoMatched).length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Документов',    value: DOCS.length,      color: '#0F1419' },
          { label: 'Подписано',     value: signed,           color: '#065F46' },
          { label: 'В обработке',   value: pending,          color: '#92400E' },
          { label: 'Автосопоставлено', value: `${autoMatchedCount}/${DOCS.length}`, color: '#1E40AF' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        ЭДО: Контур.Диадок (MVP) · Такском · СБИС · Adapter Pattern · Автосопоставление входящего УПД по ИНН+сумме+дате · Статусы → уведомление в чат сделки · Архив SHA-256 5 лет
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {(['all', 'outbound', 'inbound'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 10px', borderRadius: 6, border: filter === f ? 'none' : '1px solid #E4E6EA', background: filter === f ? '#0F1419' : '#F8FAFB', color: filter === f ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {f === 'all' ? 'Все' : f === 'outbound' ? 'Исходящие' : 'Входящие'}
          </button>
        ))}
        <div style={{ width: 1, background: '#E4E6EA', margin: '0 4px' }} />
        {(['all', 'diadok', 'taxcom', 'sbis'] as const).map((op) => (
          <button key={op} onClick={() => setOperatorFilter(op)} style={{ padding: '4px 10px', borderRadius: 6, border: operatorFilter === op ? 'none' : '1px solid #E4E6EA', background: operatorFilter === op ? '#374151' : '#F8FAFB', color: operatorFilter === op ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {op === 'all' ? 'Все операторы' : OPERATORS[op].name}
          </button>
        ))}
      </div>

      {/* Document list */}
      <div style={{ display: 'grid', gap: 5 }}>
        {filtered.map((doc) => {
          const st = STATUS_CFG[doc.status];
          const op = OPERATORS[doc.operator];
          return (
            <div key={doc.id} style={{ padding: '8px 12px', borderRadius: 10, background: doc.status === 'rejected' ? '#FEF2F2' : '#F8FAFB', border: `1px solid ${doc.status === 'rejected' ? '#FECACA' : '#E4E6EA'}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: '#E4E6EA', color: '#374151' }}>{DOC_TYPE_LABEL[doc.type]}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{doc.title}</span>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
                <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: op.bg, color: op.color, fontWeight: 700 }}>{op.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#64748B' }}>{doc.direction === 'outbound' ? '→' : '←'} {doc.counterparty}</span>
                {doc.amount && <span style={{ fontSize: 9, fontWeight: 700, color: '#0F1419' }}>{fmtMoney(doc.amount)}</span>}
                <span style={{ fontSize: 8, color: '#94A3B8' }}>{doc.dealId}</span>
                {doc.autoMatched && <span style={{ fontSize: 8, color: '#065F46', fontWeight: 700 }}>✓ автосопоставлено</span>}
                <code style={{ fontSize: 8, color: '#64748B' }}>{doc.externalId}</code>
              </div>
            </div>
          );
        })}
      </div>

      {rejected > 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 10, color: '#991B1B', fontWeight: 700 }}>
          ⚠ {rejected} документ(а) отклонены контрагентом — требуют исправления и повторной отправки
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        ЭДО: Диадок · Такском · СБИС · 1С-ЭДО · Adapter Pattern · Автосопоставление · SHA-256 архив · 5 лет · Демо-данные.
      </div>
    </div>
  );
}
