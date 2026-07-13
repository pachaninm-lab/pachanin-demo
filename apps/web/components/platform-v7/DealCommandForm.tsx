'use client';

import * as React from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Crosshair,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import styles from './DealCommandForm.module.css';

type Payload = Record<string, unknown>;

type Props = {
  actionId: string;
  label: string;
  disabled?: boolean;
  submitting?: boolean;
  initialValues?: Record<string, string>;
  onSubmit: (payload: Payload) => Promise<void> | void;
};

type FieldOption = {
  value: string;
  label: string;
};

type Field = {
  name: string;
  label: string;
  type?: 'text' | 'decimal' | 'datetime-local' | 'select';
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: FieldOption[];
  contextual?: boolean;
  reviewLabel?: string;
};

type Step = {
  title: string;
  hint?: string;
  fields: Field[];
};

const CONFIRMATION_OPTIONS: FieldOption[] = [
  { value: 'DEVICE_GPS', label: 'Геопозиция устройства' },
  { value: 'FACILITY_GEOFENCE', label: 'Геозона объекта' },
  { value: 'PHOTO_EVIDENCE', label: 'Фото на территории' },
  { value: 'DISPATCH_CONFIRMATION', label: 'Подтверждение диспетчера' },
];

const WEIGHING_OPTIONS: FieldOption[] = [
  { value: 'ELEVATOR_SCALE', label: 'Весы элеватора' },
  { value: 'MOBILE_SCALE', label: 'Мобильные весы' },
  { value: 'OTHER_VERIFIED_SCALE', label: 'Другие проверенные весы' },
];

const ACTION_STEPS: Record<string, Step[]> = {
  seller_sign_contract: [{
    title: 'Подтверди подпись продавца',
    hint: 'Договор выбирается из текущей сделки автоматически. Проверь время и подтверждение подписи.',
    fields: [
      { name: 'documentId', label: 'Договор', required: true, contextual: true, reviewLabel: 'Договор' },
      { name: 'signedAt', label: 'Когда подписан договор?', type: 'datetime-local', required: true },
      { name: 'signatureEvidenceRef', label: 'Подтверждение подписи', required: true, placeholder: 'Ссылка или номер файла', hint: 'Укажи уже загруженный файл с подтверждением подписи.' },
    ],
  }],
  buyer_sign_contract: [{
    title: 'Подтверди подпись покупателя',
    hint: 'Договор выбирается из текущей сделки автоматически. Проверь время и подтверждение подписи.',
    fields: [
      { name: 'documentId', label: 'Договор', required: true, contextual: true, reviewLabel: 'Договор' },
      { name: 'signedAt', label: 'Когда подписан договор?', type: 'datetime-local', required: true },
      { name: 'signatureEvidenceRef', label: 'Подтверждение подписи', required: true, placeholder: 'Ссылка или номер файла', hint: 'Укажи уже загруженный файл с подтверждением подписи.' },
    ],
  }],
  assign_logistics: [
    {
      title: 'Кто повезёт груз?',
      hint: 'Используй только подтверждённые записи из реестра перевозчиков. Случайные значения не пройдут серверную проверку.',
      fields: [
        { name: 'carrierOrgId', label: 'Код перевозчика', required: true, placeholder: 'Код организации из реестра' },
        { name: 'driverUserId', label: 'Код водителя', required: true, placeholder: 'Код водителя из реестра' },
        { name: 'vehicleId', label: 'Код машины', required: true, placeholder: 'Код машины из реестра' },
      ],
    },
    {
      title: 'Откуда и куда ехать?',
      fields: [
        { name: 'routeFromFacilityId', label: 'Код точки отправления', required: true, placeholder: 'Объект погрузки из реестра' },
        { name: 'routeToFacilityId', label: 'Код точки назначения', required: true, placeholder: 'Объект приёмки из реестра' },
      ],
    },
  ],
  confirm_loading: [
    {
      title: 'Что фактически погрузили?',
      hint: 'Рейс выбран автоматически. Укажи только фактический вес и время.',
      fields: [
        { name: 'shipmentId', label: 'Рейс', required: true, contextual: true },
        { name: 'actualWeightTons', label: 'Фактический вес, тонн', type: 'decimal', required: true, placeholder: 'Например, 20,5' },
        { name: 'occurredAt', label: 'Когда закончилась погрузка?', type: 'datetime-local', required: true },
      ],
    },
    {
      title: 'Чем подтверждается погрузка?',
      fields: [
        { name: 'basis', label: 'Основание', required: true, placeholder: 'Например, весовой талон № 125' },
        { name: 'evidenceRef', label: 'Фото или документ', required: true, placeholder: 'Ссылка или номер файла', hint: 'Укажи уже загруженное подтверждение.' },
      ],
    },
  ],
  start_transit: [{
    title: 'Подтверди начало рейса',
    hint: 'Рейс выбран автоматически. Проверь время выезда и приложенное подтверждение.',
    fields: [
      { name: 'shipmentId', label: 'Рейс', required: true, contextual: true },
      { name: 'occurredAt', label: 'Когда машина выехала?', type: 'datetime-local', required: true },
      { name: 'basis', label: 'Основание', required: true, placeholder: 'Например, путевой лист' },
      { name: 'evidenceRef', label: 'Подтверждение', required: true, placeholder: 'Ссылка или номер файла' },
    ],
  }],
  confirm_arrival: [
    {
      title: 'Подтверди прибытие',
      hint: 'Рейс выбран автоматически.',
      fields: [
        { name: 'shipmentId', label: 'Рейс', required: true, contextual: true },
        { name: 'occurredAt', label: 'Когда машина прибыла?', type: 'datetime-local', required: true },
        { name: 'confirmationMethod', label: 'Как подтверждено прибытие?', type: 'select', required: true, options: CONFIRMATION_OPTIONS },
        { name: 'evidenceRef', label: 'Подтверждение', required: true, placeholder: 'Ссылка или номер файла' },
      ],
    },
    {
      title: 'Геопозиция',
      hint: 'Нажми кнопку, чтобы определить координаты автоматически. Координаты можно оставить пустыми, если разрешение недоступно.',
      fields: [
        { name: 'lat', label: 'Широта', type: 'decimal', placeholder: 'Определится автоматически' },
        { name: 'lng', label: 'Долгота', type: 'decimal', placeholder: 'Определится автоматически' },
      ],
    },
  ],
  confirm_weight: [
    {
      title: 'Введи показания весов',
      hint: 'Рейс выбран автоматически. Значения можно вводить через запятую.',
      fields: [
        { name: 'shipmentId', label: 'Рейс', required: true, contextual: true },
        { name: 'grossTons', label: 'Вес машины с грузом, тонн', type: 'decimal', required: true, placeholder: 'Брутто' },
        { name: 'tareTons', label: 'Вес пустой машины, тонн', type: 'decimal', required: true, placeholder: 'Тара' },
        { name: 'netTons', label: 'Вес груза, тонн', type: 'decimal', required: true, placeholder: 'Нетто', hint: 'Сервер проверит: вес с грузом − вес пустой машины = вес груза.' },
      ],
    },
    {
      title: 'Чем подтверждается взвешивание?',
      fields: [
        { name: 'weighingSource', label: 'Где взвешивали?', type: 'select', required: true, options: WEIGHING_OPTIONS },
        { name: 'occurredAt', label: 'Когда взвешивали?', type: 'datetime-local', required: true },
        { name: 'evidenceRef', label: 'Фото талона или документ', required: true, placeholder: 'Ссылка или номер файла' },
        { name: 'equipmentId', label: 'Код весов, если предусмотрено', placeholder: 'Можно оставить пустым' },
      ],
    },
  ],
  confirm_inspection: [{
    title: 'Подтверди независимый осмотр',
    hint: 'Заключение выбирается из текущей сделки автоматически.',
    fields: [
      { name: 'documentId', label: 'Заключение', required: true, contextual: true },
      { name: 'evidenceRef', label: 'Подтверждение осмотра', required: true, placeholder: 'Ссылка или номер файла' },
      { name: 'inspectedAt', label: 'Когда проведён осмотр?', type: 'datetime-local', required: true },
    ],
  }],
  accept_delivery: [{
    title: 'Подтверди приёмку поставки',
    hint: 'Запись приёмки выбрана автоматически.',
    fields: [
      { name: 'acceptanceId', label: 'Приёмка', required: true, contextual: true },
      { name: 'acceptedAt', label: 'Когда поставка принята?', type: 'datetime-local', required: true },
      { name: 'evidenceRef', label: 'Подписанный акт или подтверждение', required: true, placeholder: 'Ссылка или номер файла' },
    ],
  }],
};

function localDateTimeValue(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function allFields(steps: Step[]): Field[] {
  return steps.flatMap((step) => step.fields);
}

function buildInitialValues(steps: Step[], supplied: Record<string, string> | undefined): Record<string, string> {
  const values = { ...(supplied || {}) };
  for (const field of allFields(steps)) {
    if (field.type === 'datetime-local' && !values[field.name]) values[field.name] = localDateTimeValue();
  }
  return values;
}

function toIso(value: string): string {
  if (!value) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function normalizeDecimal(value: string): string {
  return value.trim().replace(',', '.');
}

function normalizedPayload(values: Record<string, string>, fields: Field[]): Payload {
  const payload: Payload = {};
  const fieldByName = new Map(fields.map((field) => [field.name, field]));
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim();
    if (!value) continue;
    const field = fieldByName.get(key);
    if (field?.type === 'datetime-local' || key.endsWith('At')) payload[key] = toIso(value);
    else if (field?.type === 'decimal') payload[key] = normalizeDecimal(value);
    else payload[key] = value;
  }
  return payload;
}

function valueForReview(field: Field, value: string): string {
  if (field.contextual) return 'Выбрано автоматически из сделки';
  if (field.type === 'datetime-local') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('ru-RU');
  }
  if (field.type === 'select') return field.options?.find((option) => option.value === value)?.label || value;
  return value || 'Не указано';
}

function fieldErrorId(actionId: string, fieldName: string): string {
  return `${actionId}-${fieldName}-error`;
}

function fieldHintId(actionId: string, fieldName: string): string {
  return `${actionId}-${fieldName}-hint`;
}

function FieldControl({
  actionId,
  field,
  value,
  showError,
  onChange,
}: {
  actionId: string;
  field: Field;
  value: string;
  showError: boolean;
  onChange: (value: string) => void;
}) {
  const invalid = showError && field.required && !value.trim();
  const describedBy = [field.hint ? fieldHintId(actionId, field.name) : '', invalid ? fieldErrorId(actionId, field.name) : ''].filter(Boolean).join(' ') || undefined;

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {field.label}
        {field.required ? <span className={styles.requiredMark} aria-hidden='true'>*</span> : null}
      </span>
      {field.type === 'select' ? (
        <select
          className={`${styles.select} ${invalid ? styles.invalid : ''}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
          <option value=''>Выбери вариант</option>
          {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <input
          className={`${styles.input} ${invalid ? styles.invalid : ''}`}
          type={field.type === 'datetime-local' ? 'datetime-local' : 'text'}
          inputMode={field.type === 'decimal' ? 'decimal' : undefined}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}
      {field.hint ? <small className={styles.hint} id={fieldHintId(actionId, field.name)}>{field.hint}</small> : null}
      {invalid ? <small className={styles.fieldError} id={fieldErrorId(actionId, field.name)}>Заполни это поле.</small> : null}
    </label>
  );
}

function ReviewStep({ steps, values }: { steps: Step[]; values: Record<string, string> }) {
  return (
    <section className={styles.review} aria-labelledby='command-review-title'>
      <h3 id='command-review-title' tabIndex={-1}>Проверь перед подтверждением</h3>
      <p className={styles.reviewIntro}>Вернись назад, если что-то указано неверно. После подтверждения сервер ещё раз проверит права и состояние сделки.</p>
      <dl className={styles.reviewList}>
        {allFields(steps).map((field) => (
          <div className={styles.reviewRow} key={field.name}>
            <dt>{field.reviewLabel || field.label}</dt>
            <dd className={field.contextual ? styles.autoContext : undefined}>{valueForReview(field, values[field.name] || '')}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function LabForm({ disabled, submitting, initialValues, onSubmit }: Pick<Props, 'disabled' | 'submitting' | 'initialValues' | 'onSubmit'>) {
  const [step, setStep] = React.useState(0);
  const [showErrors, setShowErrors] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, string>>(() => ({
    finalizedAt: localDateTimeValue(),
    ...(initialValues || {}),
  }));
  const [indicators, setIndicators] = React.useState([{ parameter: '', value: '', unit: '', normMin: '', normMax: '' }]);
  const headingRef = React.useRef<HTMLLegendElement>(null);
  const totalSteps = 4;

  React.useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const setValue = (name: string, value: string) => {
    setShowErrors(false);
    setValues((current) => ({ ...current, [name]: value }));
  };

  const canContinue = step === 0
    ? ['sampleId', 'protocolNumber', 'labId', 'accreditationRef'].every((key) => values[key]?.trim())
    : step === 1
      ? indicators.every((item) => item.parameter.trim() && item.value.trim() && item.unit.trim() && (item.normMin.trim() || item.normMax.trim()))
      : step === 2
        ? ['applicableStandard', 'finalizedAt', 'signedEvidenceRef'].every((key) => values[key]?.trim())
        : true;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (step < 3 && !canContinue) {
      setShowErrors(true);
      return;
    }
    if (step < 3) {
      setStep((current) => current + 1);
      setShowErrors(false);
      return;
    }
    await onSubmit({
      ...normalizedPayload(values, [
        { name: 'finalizedAt', label: '', type: 'datetime-local' },
      ]),
      indicators: indicators.map((item) => ({
        parameter: item.parameter.trim(),
        value: normalizeDecimal(item.value),
        unit: item.unit.trim(),
        ...(item.normMin.trim() ? { normMin: normalizeDecimal(item.normMin) } : {}),
        ...(item.normMax.trim() ? { normMax: normalizeDecimal(item.normMax) } : {}),
      })),
    });
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.progressBlock}>
        <div className={styles.progressText}><span>Шаг {step + 1} из {totalSteps}</span><span>{step === 3 ? 'Проверка' : 'Заполнение'}</span></div>
        <progress className={styles.progress} value={step + 1} max={totalSteps} aria-label={`Шаг ${step + 1} из ${totalSteps}`} />
      </div>

      {showErrors ? (
        <div className={styles.errorSummary} role='alert'><AlertCircle size={20} aria-hidden='true' /><div><strong>Не всё заполнено</strong>Проверь выделенные поля.</div></div>
      ) : null}

      {step === 0 ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend} ref={headingRef} tabIndex={-1}>Проба и лаборатория</legend>
          <p className={styles.stepHint}>Перепиши данные с маркировки пробы и карточки лаборатории.</p>
          {[
            ['sampleId', 'Номер пробы'],
            ['protocolNumber', 'Номер протокола'],
            ['labId', 'Код лаборатории'],
            ['accreditationRef', 'Номер аккредитации'],
          ].map(([name, label]) => (
            <FieldControl key={name} actionId='finalize_lab' field={{ name, label, required: true }} value={values[name] || ''} showError={showErrors} onChange={(value) => setValue(name, value)} />
          ))}
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend} ref={headingRef} tabIndex={-1}>Фактические показатели</legend>
          <p className={styles.stepHint}>Добавь каждый показатель отдельно. Для нормы достаточно нижней или верхней границы.</p>
          {indicators.map((indicator, index) => (
            <section className={styles.indicatorCard} key={index}>
              <div className={styles.indicatorHead}>
                <strong>Показатель {index + 1}</strong>
                {indicators.length > 1 ? (
                  <button className={styles.iconButton} type='button' aria-label={`Удалить показатель ${index + 1}`} onClick={() => setIndicators((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 size={18} aria-hidden='true' />
                  </button>
                ) : null}
              </div>
              {(['parameter', 'value', 'unit', 'normMin', 'normMax'] as const).map((name) => {
                const labels = { parameter: 'Название', value: 'Значение', unit: 'Единица измерения', normMin: 'Норма от', normMax: 'Норма до' };
                const required = name === 'parameter' || name === 'value' || name === 'unit';
                const missingNorm = showErrors && (name === 'normMin' || name === 'normMax') && !indicator.normMin.trim() && !indicator.normMax.trim();
                return (
                  <label className={styles.field} key={name}>
                    <span className={styles.fieldLabel}>{labels[name]}{required ? <span className={styles.requiredMark} aria-hidden='true'>*</span> : null}</span>
                    <input
                      className={`${styles.input} ${(showErrors && required && !indicator[name].trim()) || missingNorm ? styles.invalid : ''}`}
                      inputMode={name === 'value' || name.startsWith('norm') ? 'decimal' : undefined}
                      value={indicator[name]}
                      onChange={(event) => {
                        setShowErrors(false);
                        setIndicators((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [name]: event.target.value } : item));
                      }}
                    />
                    {showErrors && required && !indicator[name].trim() ? <small className={styles.fieldError}>Заполни это поле.</small> : null}
                    {missingNorm && name === 'normMax' ? <small className={styles.fieldError}>Укажи хотя бы одну границу нормы.</small> : null}
                  </label>
                );
              })}
            </section>
          ))}
          <button className={styles.addButton} type='button' onClick={() => setIndicators((current) => [...current, { parameter: '', value: '', unit: '', normMin: '', normMax: '' }])}>
            <Plus size={18} aria-hidden='true' />Добавить показатель
          </button>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend} ref={headingRef} tabIndex={-1}>Норма и подписанный протокол</legend>
          <FieldControl actionId='finalize_lab' field={{ name: 'applicableStandard', label: 'Применимая норма', required: true, placeholder: 'ГОСТ, ТУ или условие договора' }} value={values.applicableStandard || ''} showError={showErrors} onChange={(value) => setValue('applicableStandard', value)} />
          <FieldControl actionId='finalize_lab' field={{ name: 'finalizedAt', label: 'Когда анализ завершён?', type: 'datetime-local', required: true }} value={values.finalizedAt || ''} showError={showErrors} onChange={(value) => setValue('finalizedAt', value)} />
          <FieldControl actionId='finalize_lab' field={{ name: 'signedEvidenceRef', label: 'Подписанный протокол', required: true, placeholder: 'Ссылка или номер файла' }} value={values.signedEvidenceRef || ''} showError={showErrors} onChange={(value) => setValue('signedEvidenceRef', value)} />
          <p className={styles.note}>Итог PASSED/FAILED рассчитывает сервер по введённым значениям и нормам. Интерфейс не назначает результат.</p>
        </fieldset>
      ) : null}

      {step === 3 ? (
        <section className={styles.review} aria-labelledby='lab-review-title'>
          <h3 id='lab-review-title' ref={headingRef as React.RefObject<HTMLHeadingElement>} tabIndex={-1}>Проверь результат</h3>
          <p className={styles.reviewIntro}>Проба: {values.sampleId}. Протокол: {values.protocolNumber}. Показателей: {indicators.length}. После подтверждения сервер рассчитает итог.</p>
        </section>
      ) : null}

      <div className={styles.actions}>
        {step > 0 ? (
          <button className={styles.secondaryButton} type='button' onClick={() => { setStep((current) => current - 1); setShowErrors(false); }}>
            <ArrowLeft size={18} aria-hidden='true' />Назад
          </button>
        ) : <span className={styles.actionsSpacer} />}
        <button className={styles.primaryButton} type='submit' disabled={disabled || submitting}>
          {submitting ? <Loader2 className={styles.spin} size={18} aria-hidden='true' /> : step < 3 ? <ArrowRight size={18} aria-hidden='true' /> : <Check size={18} aria-hidden='true' />}
          {submitting ? 'Подтверждаем…' : step < 3 ? 'Продолжить' : 'Подтвердить результат'}
        </button>
      </div>
    </form>
  );
}

export function DealCommandForm({ actionId, label, disabled, submitting, initialValues, onSubmit }: Props) {
  const steps = ACTION_STEPS[actionId];
  const initialValuesKey = JSON.stringify(initialValues || {});
  const [step, setStep] = React.useState(0);
  const [showErrors, setShowErrors] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, string>>(() => buildInitialValues(steps || [], initialValues));
  const [geoStatus, setGeoStatus] = React.useState('');
  const headingRef = React.useRef<HTMLLegendElement>(null);

  React.useEffect(() => {
    setStep(0);
    setShowErrors(false);
    setValues(buildInitialValues(steps || [], initialValues));
    setGeoStatus('');
  }, [actionId, initialValuesKey]);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  if (actionId === 'finalize_lab') return <LabForm disabled={disabled} submitting={submitting} initialValues={initialValues} onSubmit={onSubmit} />;

  if (!steps) {
    return (
      <div className={styles.simpleCommand}>
        <p>После нажатия сервер проверит твои права, актуальное состояние сделки и обязательные основания. Действие не выполнится, если условия изменились.</p>
        <button className={styles.simpleButton} type='button' onClick={() => void onSubmit({})} disabled={disabled || submitting}>
          {submitting ? <Loader2 className={styles.spin} size={18} aria-hidden='true' /> : <Check size={18} aria-hidden='true' />}
          {submitting ? 'Подтверждаем…' : label}
        </button>
      </div>
    );
  }

  const isReview = step === steps.length;
  const current = isReview ? null : steps[step];
  const currentVisibleFields = current?.fields.filter((field) => !field.contextual) || [];
  const missingContext = current?.fields.filter((field) => field.contextual && !values[field.name]?.trim()) || [];
  const missingRequired = current?.fields.filter((field) => field.required && !values[field.name]?.trim()) || [];
  const canContinue = missingContext.length === 0 && missingRequired.length === 0;
  const totalSteps = steps.length + 1;
  const hasLocationFields = Boolean(current?.fields.some((field) => field.name === 'lat') && current.fields.some((field) => field.name === 'lng'));

  const setValue = (name: string, value: string) => {
    setShowErrors(false);
    setValues((existing) => ({ ...existing, [name]: value }));
  };

  function requestLocation() {
    if (!navigator.geolocation) {
      setGeoStatus('На этом устройстве геопозиция недоступна. Поля можно оставить пустыми.');
      return;
    }
    setGeoStatus('Определяем геопозицию…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValues((existing) => ({
          ...existing,
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        }));
        setGeoStatus('Геопозиция определена. Проверь координаты.');
      },
      () => setGeoStatus('Не удалось получить геопозицию. Разреши доступ или оставь поля пустыми.'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isReview && !canContinue) {
      setShowErrors(true);
      return;
    }
    if (!isReview) {
      setStep((currentStep) => currentStep + 1);
      setShowErrors(false);
      return;
    }
    const payload = normalizedPayload(values, allFields(steps));
    if (actionId === 'confirm_loading') payload.unit = 'TON';
    await onSubmit(payload);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.progressBlock}>
        <div className={styles.progressText}><span>Шаг {step + 1} из {totalSteps}</span><span>{isReview ? 'Проверка' : 'Заполнение'}</span></div>
        <progress className={styles.progress} value={step + 1} max={totalSteps} aria-label={`Шаг ${step + 1} из ${totalSteps}`} />
      </div>

      {showErrors && missingRequired.length > 0 ? (
        <div className={styles.errorSummary} role='alert'><AlertCircle size={20} aria-hidden='true' /><div><strong>Не всё заполнено</strong>Проверь выделенные поля.</div></div>
      ) : null}

      {missingContext.length > 0 ? (
        <div className={styles.contextError} role='alert'><AlertCircle size={20} aria-hidden='true' /><div><strong>Не удалось выбрать данные сделки</strong>Обнови экран. Не вводи технические коды вручную.</div></div>
      ) : null}

      {current ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend} ref={headingRef} tabIndex={-1}>{current.title}</legend>
          {current.hint ? <p className={styles.stepHint}>{current.hint}</p> : null}
          {currentVisibleFields.map((field) => (
            <FieldControl key={field.name} actionId={actionId} field={field} value={values[field.name] || ''} showError={showErrors} onChange={(value) => setValue(field.name, value)} />
          ))}
          {hasLocationFields ? (
            <div className={styles.locationBlock}>
              <button className={styles.locationButton} type='button' onClick={requestLocation}>
                <Crosshair size={18} aria-hidden='true' />Определить координаты
              </button>
              {geoStatus ? <p className={styles.geoStatus} role='status'>{geoStatus}</p> : null}
            </div>
          ) : null}
        </fieldset>
      ) : <ReviewStep steps={steps} values={values} />}

      <div className={styles.actions}>
        {step > 0 ? (
          <button className={styles.secondaryButton} type='button' onClick={() => { setStep((currentStep) => currentStep - 1); setShowErrors(false); }}>
            <ArrowLeft size={18} aria-hidden='true' />Назад
          </button>
        ) : <span className={styles.actionsSpacer} />}
        <button className={styles.primaryButton} type='submit' disabled={disabled || submitting || missingContext.length > 0}>
          {submitting ? <Loader2 className={styles.spin} size={18} aria-hidden='true' /> : isReview ? <Check size={18} aria-hidden='true' /> : <ArrowRight size={18} aria-hidden='true' />}
          {submitting ? 'Подтверждаем…' : isReview ? label : 'Продолжить'}
        </button>
      </div>
    </form>
  );
}
