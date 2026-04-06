'use client';

import { useState } from 'react';

type LabValues = {
  protein: string;
  moisture: string;
  gluten: string;
  nature: string;
  contamination: string;
  note?: string;
};

export function LabAnalysisForm({
  dealId,
  sampleId,
  initialValues,
  submitting,
  onSubmit,
}: {
  dealId: string;
  sampleId: string;
  initialValues: LabValues;
  submitting?: boolean;
  onSubmit: (values: LabValues) => Promise<void>;
}) {
  const [values, setValues] = useState<LabValues>(initialValues);
  const [dirty, setDirty] = useState(false);

  const fields: Array<{ key: keyof LabValues; label: string; suffix?: string }> = [
    { key: 'protein', label: 'Белок', suffix: '%' },
    { key: 'moisture', label: 'Влага', suffix: '%' },
    { key: 'gluten', label: 'Клейковина', suffix: '%' },
    { key: 'nature', label: 'Натура', suffix: 'г/л' },
    { key: 'contamination', label: 'Сорная примесь', suffix: '%' },
  ];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(values);
    setDirty(false);
  }

  return (
    <form onSubmit={handleSubmit} className="section-card-tight" style={{ marginTop: 24 }}>
      <div className="section-title">Лабораторный протокол</div>
      <div className="muted small" style={{ marginTop: 8 }}>Результаты должны быть привязаны к sample id, deal id и дальше влиять на settlement rail.</div>

      <div className="mobile-two-grid" style={{ marginTop: 16 }}>
        {fields.map((field) => (
          <label key={field.key} className="field-block">
            <span>{field.label}</span>
            <div className="field-input-row">
              <input
                value={values[field.key] ?? ''}
                onChange={(event) => {
                  setValues((current) => ({ ...current, [field.key]: event.target.value }));
                  setDirty(true);
                }}
                inputMode="decimal"
                placeholder="0"
              />
              {field.suffix ? <span className="mini-chip">{field.suffix}</span> : null}
            </div>
          </label>
        ))}
      </div>

      <label className="field-block" style={{ marginTop: 16 }}>
        <span>Комментарий лаборатории</span>
        <textarea
          rows={4}
          value={values.note ?? ''}
          onChange={(event) => {
            setValues((current) => ({ ...current, note: event.target.value }));
            setDirty(true);
          }}
          placeholder="Что изменилось по пробе и почему это влияет на settlement/dispute rail"
        />
      </label>

      <div className="field-block muted small" style={{ marginTop: 16 }}>
        Deal: <b>{dealId}</b> · Sample: <b>{sampleId}</b>
      </div>

      <div className="cta-stack" style={{ marginTop: 16 }}>
        <button type="submit" className="primary-link" disabled={submitting || !dirty}>
          {submitting ? 'Сохраняю…' : 'Сохранить протокол'}
        </button>
      </div>
    </form>
  );
}
