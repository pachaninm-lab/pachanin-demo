'use client';

import * as React from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2 } from 'lucide-react';

type Payload = Record<string, unknown>;

type Props = {
  actionId: string;
  label: string;
  disabled?: boolean;
  submitting?: boolean;
  onSubmit: (payload: Payload) => Promise<void> | void;
};

type Field = {
  name: string;
  label: string;
  type?: 'text' | 'decimal' | 'datetime-local';
  required?: boolean;
  hint?: string;
};

type Step = { title: string; fields: Field[] };

const ACTION_STEPS: Record<string, Step[]> = {
  seller_sign_contract: [{ title: 'Подтверждение подписи продавца', fields: [
    { name: 'documentId', label: 'Загруженный договор', required: true },
    { name: 'signedAt', label: 'Время подписи', type: 'datetime-local', required: true },
    { name: 'signatureEvidenceRef', label: 'Подтверждение подписи', required: true },
  ] }],
  buyer_sign_contract: [{ title: 'Подтверждение подписи покупателя', fields: [
    { name: 'documentId', label: 'Договор, подписанный продавцом', required: true },
    { name: 'signedAt', label: 'Время подписи', type: 'datetime-local', required: true },
    { name: 'signatureEvidenceRef', label: 'Подтверждение подписи', required: true },
  ] }],
  assign_logistics: [
    { title: 'Перевозчик и водитель', fields: [
      { name: 'carrierOrgId', label: 'Перевозчик', required: true },
      { name: 'driverUserId', label: 'Водитель', required: true },
      { name: 'vehicleId', label: 'Машина', required: true },
    ] },
    { title: 'Маршрут', fields: [
      { name: 'routeFromFacilityId', label: 'Точка отправления', required: true },
      { name: 'routeToFacilityId', label: 'Точка назначения', required: true },
    ] },
  ],
  confirm_loading: [
    { title: 'Фактическая погрузка', fields: [
      { name: 'shipmentId', label: 'Рейс', required: true },
      { name: 'actualWeightTons', label: 'Фактическая масса, т', type: 'decimal', required: true },
      { name: 'occurredAt', label: 'Точное время', type: 'datetime-local', required: true },
    ] },
    { title: 'Основание', fields: [
      { name: 'basis', label: 'Основание операции', required: true },
      { name: 'evidenceRef', label: 'Фото или документ', required: true },
    ] },
  ],
  start_transit: [{ title: 'Начало рейса', fields: [
    { name: 'shipmentId', label: 'Рейс', required: true },
    { name: 'occurredAt', label: 'Точное время выезда', type: 'datetime-local', required: true },
    { name: 'basis', label: 'Основание', required: true },
    { name: 'evidenceRef', label: 'Подтверждение', required: true },
  ] }],
  confirm_arrival: [
    { title: 'Прибытие', fields: [
      { name: 'shipmentId', label: 'Рейс', required: true },
      { name: 'occurredAt', label: 'Точное время прибытия', type: 'datetime-local', required: true },
      { name: 'confirmationMethod', label: 'Способ подтверждения', required: true },
      { name: 'evidenceRef', label: 'Подтверждение', required: true },
    ] },
    { title: 'Координаты — только при наличии', fields: [
      { name: 'lat', label: 'Широта', type: 'decimal' },
      { name: 'lng', label: 'Долгота', type: 'decimal' },
    ] },
  ],
  confirm_weight: [
    { title: 'Показания весов', fields: [
      { name: 'shipmentId', label: 'Рейс', required: true },
      { name: 'grossTons', label: 'Брутто, т', type: 'decimal', required: true },
      { name: 'tareTons', label: 'Тара, т', type: 'decimal', required: true },
      { name: 'netTons', label: 'Нетто, т', type: 'decimal', required: true, hint: 'Сервер проверит: брутто − тара = нетто.' },
    ] },
    { title: 'Подтверждение взвешивания', fields: [
      { name: 'weighingSource', label: 'Источник взвешивания', required: true },
      { name: 'occurredAt', label: 'Точное время', type: 'datetime-local', required: true },
      { name: 'evidenceRef', label: 'Фото талона или документ', required: true },
      { name: 'equipmentId', label: 'Оборудование, если предусмотрено' },
    ] },
  ],
  confirm_inspection: [{ title: 'Независимый осмотр', fields: [
    { name: 'documentId', label: 'Проверенное заключение', required: true },
    { name: 'evidenceRef', label: 'Подтверждение осмотра', required: true },
    { name: 'inspectedAt', label: 'Время осмотра', type: 'datetime-local', required: true },
  ] }],
  accept_delivery: [{ title: 'Приёмка поставки', fields: [
    { name: 'acceptanceId', label: 'Запись приёмки', required: true },
    { name: 'acceptedAt', label: 'Время приёмки', type: 'datetime-local', required: true },
    { name: 'evidenceRef', label: 'Подписанный акт или подтверждение', required: true },
  ] }],
};

function toIso(value: string): string {
  if (!value) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function normalizedPayload(values: Record<string, string>): Payload {
  const payload: Payload = {};
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim();
    if (!value) continue;
    payload[key] = key.endsWith('At') ? toIso(value) : value;
  }
  return payload;
}

function LabForm({ disabled, submitting, onSubmit }: Pick<Props, 'disabled' | 'submitting' | 'onSubmit'>) {
  const [step, setStep] = React.useState(0);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [indicators, setIndicators] = React.useState([{ parameter: '', value: '', unit: '', normMin: '', normMax: '' }]);

  const setValue = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));
  const canContinue = step === 0
    ? ['sampleId', 'protocolNumber', 'labId', 'accreditationRef'].every((key) => values[key]?.trim())
    : step === 1
      ? indicators.every((item) => item.parameter.trim() && item.value.trim() && item.unit.trim() && (item.normMin.trim() || item.normMax.trim()))
      : ['applicableStandard', 'finalizedAt', 'signedEvidenceRef'].every((key) => values[key]?.trim());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (step < 2) {
      if (canContinue) setStep((current) => current + 1);
      return;
    }
    if (!canContinue) return;
    await onSubmit({
      ...normalizedPayload(values),
      indicators: indicators.map((item) => ({
        parameter: item.parameter.trim(),
        value: item.value.trim(),
        unit: item.unit.trim(),
        ...(item.normMin.trim() ? { normMin: item.normMin.trim() } : {}),
        ...(item.normMax.trim() ? { normMax: item.normMax.trim() } : {}),
      })),
    });
  }

  return (
    <form className='command-form' onSubmit={submit}>
      <div className='form-progress' aria-label={`Шаг ${step + 1} из 3`}><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
      {step === 0 ? (
        <fieldset><legend>Проба и лаборатория</legend>
          {[
            ['sampleId', 'Проба'], ['protocolNumber', 'Номер протокола'], ['labId', 'Лаборатория'], ['accreditationRef', 'Сведения об аккредитации'],
          ].map(([name, label]) => <label key={name}><span>{label}</span><input value={values[name] || ''} onChange={(event) => setValue(name, event.target.value)} required /></label>)}
        </fieldset>
      ) : null}
      {step === 1 ? (
        <fieldset><legend>Фактические показатели</legend>
          {indicators.map((indicator, index) => (
            <section className='indicator-card' key={index}>
              <div className='indicator-head'><strong>Показатель {index + 1}</strong>{indicators.length > 1 ? <button type='button' aria-label='Удалить показатель' onClick={() => setIndicators((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={17} /></button> : null}</div>
              {(['parameter', 'value', 'unit', 'normMin', 'normMax'] as const).map((name) => {
                const labels = { parameter: 'Наименование', value: 'Значение', unit: 'Единица', normMin: 'Норма от', normMax: 'Норма до' };
                return <label key={name}><span>{labels[name]}</span><input inputMode={name === 'value' || name.startsWith('norm') ? 'decimal' : undefined} value={indicator[name]} onChange={(event) => setIndicators((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [name]: event.target.value } : item))} required={name === 'parameter' || name === 'value' || name === 'unit'} /></label>;
              })}
            </section>
          ))}
          <button className='add-indicator' type='button' onClick={() => setIndicators((current) => [...current, { parameter: '', value: '', unit: '', normMin: '', normMax: '' }])}><Plus size={17} />Добавить показатель</button>
        </fieldset>
      ) : null}
      {step === 2 ? (
        <fieldset><legend>Норма и подписанный протокол</legend>
          {[
            ['applicableStandard', 'Применимая норма', 'text'], ['finalizedAt', 'Время завершения', 'datetime-local'], ['signedEvidenceRef', 'Подписанный протокол', 'text'],
          ].map(([name, label, type]) => <label key={name}><span>{label}</span><input type={type} value={values[name] || ''} onChange={(event) => setValue(name, event.target.value)} required /></label>)}
          <p className='form-note'>Итог PASSED/FAILED рассчитывает сервер по введённым значениям и нормам. Интерфейс не назначает результат.</p>
        </fieldset>
      ) : null}
      <div className='form-actions'>{step > 0 ? <button className='secondary' type='button' onClick={() => setStep((current) => current - 1)}><ArrowLeft size={18} />Назад</button> : <span />}
        <button className='primary' type='submit' disabled={disabled || submitting || !canContinue}>{submitting ? <Loader2 className='spin' size={18} /> : step < 2 ? <ArrowRight size={18} /> : <Check size={18} />}{submitting ? 'Подтверждаем…' : step < 2 ? 'Продолжить' : 'Подтвердить результат'}</button></div>
      <style jsx>{styles}</style>
    </form>
  );
}

export function DealCommandForm({ actionId, label, disabled, submitting, onSubmit }: Props) {
  const steps = ACTION_STEPS[actionId];
  const [step, setStep] = React.useState(0);
  const [values, setValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    setStep(0);
    setValues({});
  }, [actionId]);

  if (actionId === 'finalize_lab') return <LabForm disabled={disabled} submitting={submitting} onSubmit={onSubmit} />;

  if (!steps) {
    return (
      <div className='simple-command'>
        <p>Сервер проверит права, актуальную версию сделки и все обязательные основания до изменения состояния.</p>
        <button type='button' onClick={() => void onSubmit({})} disabled={disabled || submitting}>{submitting ? <Loader2 className='spin' size={18} /> : <Check size={18} />}{submitting ? 'Подтверждаем…' : label}</button>
        <style jsx>{styles}</style>
      </div>
    );
  }

  const current = steps[step];
  const canContinue = current.fields.filter((field) => field.required).every((field) => values[field.name]?.trim());
  const setValue = (name: string, value: string) => setValues((existing) => ({ ...existing, [name]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canContinue) return;
    if (step < steps.length - 1) {
      setStep((currentStep) => currentStep + 1);
      return;
    }
    const payload = normalizedPayload(values);
    if (actionId === 'confirm_loading') payload.unit = 'TON';
    await onSubmit(payload);
  }

  return (
    <form className='command-form' onSubmit={submit}>
      {steps.length > 1 ? <div className='form-progress' aria-label={`Шаг ${step + 1} из ${steps.length}`}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div> : null}
      <fieldset><legend>{current.title}</legend>
        {current.fields.map((field) => (
          <label key={field.name}>
            <span>{field.label}</span>
            <input
              type={field.type === 'datetime-local' ? 'datetime-local' : 'text'}
              inputMode={field.type === 'decimal' ? 'decimal' : undefined}
              value={values[field.name] || ''}
              onChange={(event) => setValue(field.name, event.target.value)}
              required={field.required}
              aria-describedby={field.hint ? `${actionId}-${field.name}-hint` : undefined}
            />
            {field.hint ? <small id={`${actionId}-${field.name}-hint`}>{field.hint}</small> : null}
          </label>
        ))}
      </fieldset>
      <div className='form-actions'>{step > 0 ? <button className='secondary' type='button' onClick={() => setStep((currentStep) => currentStep - 1)}><ArrowLeft size={18} />Назад</button> : <span />}
        <button className='primary' type='submit' disabled={disabled || submitting || !canContinue}>{submitting ? <Loader2 className='spin' size={18} /> : step < steps.length - 1 ? <ArrowRight size={18} /> : <Check size={18} />}{submitting ? 'Подтверждаем…' : step < steps.length - 1 ? 'Продолжить' : label}</button></div>
      <style jsx>{styles}</style>
    </form>
  );
}

const styles = `
  .command-form{display:grid;gap:14px}.command-form fieldset{border:0;padding:0;margin:0;display:grid;gap:12px}.command-form legend{font-size:17px;font-weight:900;margin-bottom:12px}.command-form label{display:grid;gap:6px;text-align:left}.command-form label>span{font-size:12px;font-weight:850;color:var(--pc-text-secondary)}.command-form input{width:100%;min-height:46px;border:1px solid var(--pc-border);border-radius:13px;background:var(--pc-shell-surface);color:var(--pc-text-primary);padding:10px 12px;font:inherit}.command-form input:focus{outline:3px solid var(--pc-accent-bg);border-color:var(--pc-accent)}.command-form small,.form-note{font-size:11px;color:var(--pc-text-muted);line-height:1.4;margin:0}.form-progress{height:5px;border-radius:999px;background:var(--pc-border);overflow:hidden}.form-progress span{display:block;height:100%;background:var(--pc-accent);transition:width .2s ease}.form-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}.form-actions button,.simple-command button,.add-indicator,.indicator-head button{min-height:44px;border-radius:13px;padding:0 14px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:8px}.primary,.simple-command button{border:0;background:var(--pc-accent);color:#fff}.secondary,.add-indicator{border:1px solid var(--pc-border);background:var(--pc-shell-surface);color:var(--pc-text-primary)}button:disabled{opacity:.5;cursor:not-allowed}.simple-command{display:grid;gap:13px}.simple-command p{margin:0;font-size:12px;color:var(--pc-text-secondary);line-height:1.45}.indicator-card{display:grid;gap:10px;border:1px solid var(--pc-border);border-radius:16px;padding:13px;background:var(--pc-shell-surface-soft)}.indicator-head{display:flex;justify-content:space-between;align-items:center}.indicator-head button{width:44px;padding:0;border:0;background:transparent;color:#a12a2a}.add-indicator{width:100%}.spin{animation:command-spin .8s linear infinite}@keyframes command-spin{to{transform:rotate(360deg)}}
  @media(max-width:430px){.form-actions{position:sticky;bottom:calc(var(--pc-bottom-nav-height,0px) + 8px);background:var(--pc-shell-surface);padding:8px 0;z-index:2}.form-actions .primary{flex:1}.command-form input{font-size:16px}}
  @media(prefers-reduced-motion:reduce){.form-progress span{transition:none}.spin{animation:none}}
  @media(forced-colors:active){.command-form input,.form-actions button,.simple-command button,.add-indicator,.indicator-card{border:1px solid CanvasText}}
`;
