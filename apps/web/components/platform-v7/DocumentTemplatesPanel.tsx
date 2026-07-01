'use client';

import { useState } from 'react';

type DocType = 'CONTRACT' | 'ACT' | 'UPD' | 'ETRN' | 'SDIZ' | 'QUALITY' | 'INVOICE';

interface DocTemplate {
  id: string;
  type: DocType;
  name: string;
  format: string;
  signingRequired: boolean;
  signingType: string;
  legalBase: string;
  usedCount: number;
  lastUsed: string;
}

const TYPE_CONFIG: Record<DocType, { label: string; bg: string; color: string }> = {
  CONTRACT: { label: 'Договор',      bg: '#DBEAFE', color: '#1E40AF' },
  ACT:      { label: 'Акт',          bg: '#D1FAE5', color: '#065F46' },
  UPD:      { label: 'УПД',          bg: '#EDE9FE', color: '#5B21B6' },
  ETRN:     { label: 'ЭТрН',         bg: '#FEF3C7', color: '#92400E' },
  SDIZ:     { label: 'СДИЗ',         bg: '#F0FDF4', color: '#0A7A5F' },
  QUALITY:  { label: 'Протокол',     bg: '#F3E8FF', color: '#7C3AED' },
  INVOICE:  { label: 'Счёт',         bg: '#F1F5F9', color: '#475569' },
};

const DEMO_TEMPLATES: DocTemplate[] = [
  { id: 'tpl-001', type: 'CONTRACT', name: 'Договор поставки зерна (ГОСТ Р 51582)',          format: 'DOCX + PDF',  signingRequired: true,  signingType: 'УКЭП КриптоПро', legalBase: 'ГК РФ ст. 506-524',        usedCount: 312, lastUsed: '2024-03-20' },
  { id: 'tpl-002', type: 'ACT',      name: 'Акт приёмки-передачи зерна',                   format: 'PDF',         signingRequired: true,  signingType: 'УКЭП (обе стороны)', legalBase: 'ФЗ-29 «О зерне»',          usedCount: 298, lastUsed: '2024-03-19' },
  { id: 'tpl-003', type: 'UPD',      name: 'УПД (универсальный передаточный документ)',     format: 'XML (ФНС)',   signingRequired: true,  signingType: 'УКЭП продавца',      legalBase: 'НК РФ, Приказ ФНС ММВ-7', usedCount: 287, lastUsed: '2024-03-19' },
  { id: 'tpl-004', type: 'ETRN',     name: 'Электронная транспортная накладная (ЭТрН)',     format: 'XML (СБИС)',  signingRequired: true,  signingType: 'УКЭП перевозчика',   legalBase: 'ФЗ-259, Пост. РФ №2200',  usedCount: 156, lastUsed: '2024-03-18' },
  { id: 'tpl-005', type: 'SDIZ',     name: 'СДИЗ (сопроводительный документ зерна)',       format: 'XML (ФГИС)',  signingRequired: true,  signingType: 'УКЭП продавца',      legalBase: 'ФЗ-29, Прик. МСХ №543',  usedCount: 142, lastUsed: '2024-03-20' },
  { id: 'tpl-006', type: 'QUALITY',  name: 'Протокол испытаний качества зерна',            format: 'PDF',         signingRequired: true,  signingType: 'УКЭП лаборатории',   legalBase: 'ГОСТ Р 52554, ФЗ-29',     usedCount: 134, lastUsed: '2024-03-17' },
  { id: 'tpl-007', type: 'INVOICE',  name: 'Счёт на оплату (аванс / финальный)',           format: 'PDF + DOCX',  signingRequired: false, signingType: 'Печать организации', legalBase: 'ГК РФ ст. 487',           usedCount: 198, lastUsed: '2024-03-20' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function DocumentTemplatesPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<DocType | 'ALL'>('ALL');

  const visible = filter === 'ALL' ? DEMO_TEMPLATES : DEMO_TEMPLATES.filter(t => t.type === filter);
  const types: Array<DocType | 'ALL'> = ['ALL', ...Object.keys(TYPE_CONFIG) as DocType[]];

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {[
          { label: 'Шаблонов',  value: DEMO_TEMPLATES.length, color: '#0F1419' },
          { label: 'С подписью', value: DEMO_TEMPLATES.filter(t => t.signingRequired).length, color: '#1E40AF' },
          { label: 'Применений', value: DEMO_TEMPLATES.reduce((s, t) => s + t.usedCount, 0), color: '#0A7A5F' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {types.map((t) => (
          <button key={t} onClick={() => setFilter(t)} style={{ padding: '4px 10px', borderRadius: 6, border: filter === t ? 'none' : '1px solid #E4E6EA', background: filter === t ? '#0F1419' : '#F8FAFB', color: filter === t ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {t === 'ALL' ? 'Все' : TYPE_CONFIG[t].label}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div style={{ display: 'grid', gap: 5 }}>
        {visible.map((tpl) => {
          const cfg = TYPE_CONFIG[tpl.type];
          const isOpen = selected === tpl.id;
          return (
            <div key={tpl.id} style={{ borderRadius: 10, border: `1px solid ${isOpen ? '#0A7A5F' : '#E4E6EA'}`, overflow: 'hidden' }}>
              <button onClick={() => setSelected(isOpen ? null : tpl.id)} style={{ width: '100%', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', background: isOpen ? '#F0FDF4' : '#F8FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>{cfg.label}</span>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{tpl.name}</span>
                <span style={{ fontSize: 9, color: '#94A3B8', flexShrink: 0 }}>{tpl.format}</span>
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '8px 12px', background: '#fff', display: 'grid', gap: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 6 }}>
                    {[
                      { label: 'Формат',       value: tpl.format },
                      { label: 'Подпись',      value: tpl.signingRequired ? tpl.signingType : 'Не требуется' },
                      { label: 'Нормативная база', value: tpl.legalBase },
                      { label: 'Применений',   value: tpl.usedCount },
                    ].map((s) => (
                      <div key={s.label}>
                        <div style={lbl}>{s.label}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', marginTop: 2 }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>Предпросмотр</button>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>Скачать шаблон</button>
                    {tpl.signingRequired && (
                      <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#F0FDF4', cursor: 'pointer', fontWeight: 700, color: '#065F46' }}>Создать и подписать</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Шаблоны документов: договор · акт · УПД · ЭТрН · СДИЗ · протокол качества · счёт · УКЭП КриптоПро · Диадок ЭДО · Демо-данные.
      </div>
    </div>
  );
}
