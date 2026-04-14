'use client';

import * as React from 'react';
import { useToast } from '@/components/v7r/Toast';

interface Assignment {
  id: string;
  deal: string;
  cargo: string;
  location: string;
  time: string;
  status: string;
}

const ASSIGNMENTS: Assignment[] = [
  { id: 'QC-DL-9102', deal: 'DL-9102', cargo: 'Пшеница 4 кл.', location: 'Элеватор Тамбов', time: '11:00', status: 'Требует акта' },
  { id: 'QC-DL-9108', deal: 'DL-9108', cargo: 'Ячмень 3 кл.', location: 'Склад Курск', time: '14:30', status: 'Ожидает' },
];

interface ActForm {
  weightNet: string;
  weightGross: string;
  moisture: string;
  protein: string;
  impurity: string;
  seal: string;
  sealStatus: 'intact' | 'broken';
  photoUrl: string | null;
}

export default function SurveyorPage() {
  const toast = useToast();
  const [openAct, setOpenAct] = React.useState<string | null>(null);
  const [signed, setSigned] = React.useState<Set<string>>(new Set());
  const [forms, setForms] = React.useState<Record<string, ActForm>>({});

  function getForm(id: string): ActForm {
    return forms[id] ?? { weightNet: '', weightGross: '', moisture: '', protein: '', impurity: '', seal: '', sealStatus: 'intact', photoUrl: null };
  }

  function updateForm(id: string, patch: Partial<ActForm>) {
    setForms(prev => ({ ...prev, [id]: { ...getForm(id), ...patch } }));
  }

  function handleSign(assignment: Assignment) {
    setSigned(prev => new Set([...prev, assignment.id]));
    setOpenAct(null);
    toast(`Акт ${assignment.id} подписан и передан в банковый контур`, 'success');
  }

  function handlePhotoChange(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateForm(id, { photoUrl: url });
    }
  }

  const signedCount = signed.size;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 720, margin: '0 auto' }}>
      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          ['Назначений сегодня', String(ASSIGNMENTS.length)],
          ['Актов подписано', String(signedCount)],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#6B778C', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Список назначений */}
      {ASSIGNMENTS.map(a => (
        <div key={a.id} style={{ background: '#fff', border: `1px solid ${signed.has(a.id) ? '#BBF7D0' : '#E4E6EA'}`, borderRadius: 18, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 15 }}>{a.id}</div>
              <div style={{ fontSize: 13, color: '#0F1419', marginTop: 4 }}>{a.cargo} · {a.location}</div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 2 }}>Время: {a.time}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                background: signed.has(a.id) ? '#F0FDF4' : a.status === 'Требует акта' ? '#FEF2F2' : '#FFFBEB',
                color: signed.has(a.id) ? '#16A34A' : a.status === 'Требует акта' ? '#DC2626' : '#D97706',
                border: `1px solid ${signed.has(a.id) ? '#BBF7D0' : a.status === 'Требует акта' ? '#FECACA' : '#FDE68A'}`,
              }}>
                {signed.has(a.id) ? 'Подписан ✅' : a.status}
              </span>
              {!signed.has(a.id) && (
                <button
                  onClick={() => setOpenAct(openAct === a.id ? null : a.id)}
                  style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#F5F7F8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {openAct === a.id ? 'Свернуть' : 'Открыть акт'}
                </button>
              )}
            </div>
          </div>

          {openAct === a.id && !signed.has(a.id) && (
            <div style={{ borderTop: '1px solid #F1F3F5', paddingTop: 16, display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Вес нетто (кг)', 'weightNet'],
                  ['Вес брутто (кг)', 'weightGross'],
                  ['Влажность (%)', 'moisture'],
                  ['Протеин (%)', 'protein'],
                  ['Сорная примесь (%)', 'impurity'],
                  ['Номер пломбы', 'seal'],
                ].map(([label, field]) => (
                  <div key={field}>
                    <label style={{ fontSize: 11, color: '#6B778C', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                    <input
                      type="text"
                      value={(getForm(a.id) as unknown as Record<string, string>)[field] ?? ''}
                      onChange={e => updateForm(a.id, { [field]: e.target.value } as Partial<ActForm>)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4E6EA', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#6B778C', fontWeight: 600, display: 'block', marginBottom: 6 }}>Состояние пломбы</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(['intact', 'broken'] as const).map(val => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" name={`seal-${a.id}`} value={val} checked={getForm(a.id).sealStatus === val} onChange={() => updateForm(a.id, { sealStatus: val })} />
                      {val === 'intact' ? 'Целая' : 'Нарушена'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#6B778C', fontWeight: 600, display: 'block', marginBottom: 6 }}>Фото</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => handlePhotoChange(a.id, e)}
                  style={{ display: 'none' }}
                  id={`photo-${a.id}`}
                />
                <label htmlFor={`photo-${a.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px dashed #D1D5DB', background: '#F9FAFB', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  📷 Добавить фото
                </label>
                {getForm(a.id).photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getForm(a.id).photoUrl!} alt="Фото акта" style={{ marginTop: 8, width: 120, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid #E4E6EA', display: 'block' }} />
                )}
              </div>

              <button
                onClick={() => handleSign(a)}
                style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                ✅ Подписать акт {a.id}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
