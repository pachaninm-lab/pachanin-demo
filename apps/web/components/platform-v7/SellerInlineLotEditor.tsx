'use client';

import { useState } from 'react';

export interface LotDraft {
  id: string;
  culture: string;
  class: string;
  volumeTons: number;
  priceRubPerTon: number;
  conditions: 'EXW' | 'CPT' | 'DAP';
  region: string;
  qualityNote: string;
  status: 'active' | 'paused' | 'sold';
}

const INITIAL_LOTS: LotDraft[] = [
  { id: 'LOT-2403', culture: 'Пшеница', class: '4 кл', volumeTons: 600, priceRubPerTon: 16_800, conditions: 'EXW', region: 'Тамбовская обл.', qualityNote: 'Протеин ≥ 11%, клейковина ≥ 23%', status: 'active' },
  { id: 'LOT-2405', culture: 'Пшеница', class: '4 кл', volumeTons: 240, priceRubPerTon: 16_120, conditions: 'EXW', region: 'Тамбовская обл.', qualityNote: 'Протеин ≥ 10,5%', status: 'active' },
  { id: 'LOT-2410', culture: 'Ячмень', class: 'Кормовой', volumeTons: 350, priceRubPerTon: 14_400, conditions: 'CPT', region: 'Воронежская обл.', qualityNote: 'Натура ≥ 630 г/л', status: 'paused' },
];

const STATUS_LABEL: Record<LotDraft['status'], string> = { active: 'Активен', paused: 'Приостановлен', sold: 'Продан' };
const STATUS_COLOR: Record<LotDraft['status'], string> = {
  active: '#059669', paused: '#D97706', sold: '#6B7280',
};

const CULTURES = ['Пшеница', 'Ячмень', 'Кукуруза', 'Подсолнечник', 'Соя', 'Рожь', 'Овёс'];
const CLASSES = ['3 кл', '4 кл', '5 кл', 'Кормовой', 'Продов.', 'Масличный'];
const CONDITIONS = ['EXW', 'CPT', 'DAP'] as const;

function fmtRub(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

interface FieldProps {
  label: string;
  value: string | number;
  editMode: boolean;
  type?: 'text' | 'number' | 'select';
  options?: string[];
  onChange: (v: string) => void;
}

function InlineField({ label, value, editMode, type = 'text', options, onChange }: FieldProps) {
  const inputStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: 'var(--pc-text-primary, #0F1419)',
    background: 'var(--p7-color-surface-muted, #F1F5F9)',
    border: '1px solid var(--p7-color-border, #CBD5E1)',
    borderRadius: 6, padding: '3px 6px', width: '100%',
  };
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {editMode ? (
        type === 'select' && options ? (
          <select value={String(value)} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          />
        )
      ) : (
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pc-text-primary, #0F1419)' }}>{value}</div>
      )}
    </div>
  );
}

export function SellerInlineLotEditor() {
  const [lots, setLots] = useState<LotDraft[]>(INITIAL_LOTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LotDraft | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function startEdit(lot: LotDraft) {
    setEditingId(lot.id);
    setDraft({ ...lot });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveEdit() {
    if (!draft) return;
    setLots((prev) => prev.map((l) => l.id === draft.id ? draft : l));
    setEditingId(null);
    setSaved(draft.id);
    setDraft(null);
    setTimeout(() => setSaved(null), 2500);
  }

  function update<K extends keyof LotDraft>(key: K, val: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      if (key === 'volumeTons' || key === 'priceRubPerTon') {
        return { ...prev, [key]: Number(val) || 0 };
      }
      return { ...prev, [key]: val };
    });
  }

  const totalGmv = lots.filter((l) => l.status === 'active').reduce((s, l) => s + l.volumeTons * l.priceRubPerTon, 0);

  return (
    <div style={{ display: 'grid', gap: '0.875rem' }}>
      {/* Summary row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--pc-text-muted)', background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)', borderRadius: 999, padding: '2px 8px' }}>
            {lots.filter((l) => l.status === 'active').length} активных лотов
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 999, padding: '2px 8px' }}>
            GMV активных: {fmtRub(totalGmv)}
          </span>
        </div>
        {saved && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 999, padding: '2px 10px' }}>
            ✓ {saved} сохранён
          </span>
        )}
      </div>

      {lots.map((lot) => {
        const isEditing = editingId === lot.id;
        const current = isEditing && draft ? draft : lot;

        return (
          <div
            key={lot.id}
            style={{
              borderRadius: 12,
              border: `1px solid ${isEditing ? 'rgba(10,122,95,0.35)' : 'var(--p7-color-border, #E4E6EA)'}`,
              background: isEditing ? 'rgba(10,122,95,0.03)' : 'var(--p7-color-surface, #fff)',
              padding: '0.75rem 0.875rem',
              display: 'grid',
              gap: '0.625rem',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--p7-color-brand, #0A7A5F)', fontFamily: 'var(--font-mono)' }}>{lot.id}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: STATUS_COLOR[lot.status],
                  background: `${STATUS_COLOR[lot.status]}15`,
                  border: `1px solid ${STATUS_COLOR[lot.status]}30`,
                  borderRadius: 999, padding: '1px 6px',
                }}>
                  {STATUS_LABEL[lot.status]}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {!isEditing ? (
                  <>
                    <button
                      onClick={() => startEdit(lot)}
                      style={{ fontSize: 10, fontWeight: 700, color: '#0A7A5F', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.2)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                    >
                      Редактировать
                    </button>
                    <select
                      value={lot.status}
                      onChange={(e) => setLots((prev) => prev.map((l) => l.id === lot.id ? { ...l, status: e.target.value as LotDraft['status'] } : l))}
                      style={{ fontSize: 10, fontWeight: 700, color: 'var(--pc-text-muted)', background: 'transparent', border: '1px solid var(--p7-color-border)', borderRadius: 6, padding: '3px 6px', cursor: 'pointer' }}
                    >
                      <option value="active">Активен</option>
                      <option value="paused">Приостановить</option>
                      <option value="sold">Продан</option>
                    </select>
                  </>
                ) : (
                  <>
                    <button onClick={saveEdit} style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: '#0A7A5F', border: '1px solid #0A7A5F', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                      Сохранить
                    </button>
                    <button onClick={cancelEdit} style={{ fontSize: 10, fontWeight: 700, color: 'var(--pc-text-muted)', background: 'transparent', border: '1px solid var(--p7-color-border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                      Отмена
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
              <InlineField label="Культура" value={current.culture} editMode={isEditing} type="select" options={CULTURES} onChange={(v) => update('culture', v)} />
              <InlineField label="Класс / тип" value={current.class} editMode={isEditing} type="select" options={CLASSES} onChange={(v) => update('class', v)} />
              <InlineField label="Объём (т)" value={current.volumeTons} editMode={isEditing} type="number" onChange={(v) => update('volumeTons', v)} />
              <InlineField label="Цена (₽/т)" value={current.priceRubPerTon} editMode={isEditing} type="number" onChange={(v) => update('priceRubPerTon', v)} />
              <InlineField label="Базис" value={current.conditions} editMode={isEditing} type="select" options={[...CONDITIONS]} onChange={(v) => update('conditions', v)} />
              <InlineField label="Регион" value={current.region} editMode={isEditing} type="text" onChange={(v) => update('region', v)} />
            </div>

            {/* Quality note */}
            {isEditing ? (
              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Примечание о качестве</div>
                <input
                  type="text"
                  value={current.qualityNote}
                  onChange={(e) => update('qualityNote', e.target.value)}
                  style={{ fontSize: 12, color: 'var(--pc-text-secondary)', background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)', borderRadius: 6, padding: '3px 6px', width: '100%' }}
                />
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>
                {lot.qualityNote} · Итог: {fmtRub(lot.volumeTons * lot.priceRubPerTon)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
