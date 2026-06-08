'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

type CompanyData = {
  inn: string;
  ogrn: string;
  name: string;
  region: string;
  contact: string;
  phone: string;
};

type RoleData = {
  selected: string[];
};

type RequisiteData = {
  account: string;
  bank: string;
  bic: string;
  signer: string;
};

type DocumentData = {
  charter: boolean;
  proxy: boolean;
  certs: boolean;
  crops: string;
};

type BankConnectionData = {
  sberId: string;
  safeMode: boolean;
  escrow: boolean;
  factoring: boolean;
};

type LotData = {
  crop: string;
  volume: string;
  price: string;
  basis: string;
};

type FormState = {
  company: CompanyData;
  role: RoleData;
  requisites: RequisiteData;
  documents: DocumentData;
  bankConn: BankConnectionData;
  lot: LotData;
};

const EMPTY: FormState = {
  company: { inn: '', ogrn: '', name: '', region: '', contact: '', phone: '' },
  role: { selected: [] },
  requisites: { account: '', bank: '', bic: '', signer: '' },
  documents: { charter: false, proxy: false, certs: false, crops: '' },
  bankConn: { sberId: '', safeMode: false, escrow: false, factoring: false },
  lot: { crop: '', volume: '', price: '', basis: '' },
};

const ROLE_OPTIONS = [
  { value: 'seller', label: 'Продавец' },
  { value: 'buyer', label: 'Покупатель' },
  { value: 'logistics', label: 'Логистика' },
  { value: 'lab', label: 'Лаборатория' },
  { value: 'bank', label: 'Банк / финпартнёр' },
];

const CROP_OPTIONS = ['Пшеница', 'Ячмень', 'Кукуруза', 'Подсолнечник', 'Рапс', 'Соя', 'Горох'];

const BASIS_OPTIONS = ['CPT элеватор', 'FCA склад', 'EXW поле', 'DAP порт'];

const STEPS = ['Компания', 'Роль', 'Реквизиты', 'Документы', 'Банк', 'Первый лот'];

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--p7-color-border, #E4E6EA)',
  background: 'var(--p7-color-surface, #fff)',
  color: 'var(--p7-color-text-primary, #0F1419)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--p7-color-text-muted, #6B778C)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: 6,
  display: 'block',
};

function Field({ id, labelText, children }: { id?: string; labelText: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <label htmlFor={id} style={label}>{labelText}</label>
      {children}
    </div>
  );
}

function StepCompany({ data, onChange }: { data: CompanyData; onChange: (d: CompanyData) => void }) {
  const set = (k: keyof CompanyData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...data, [k]: e.target.value });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field id='inn' labelText='ИНН'>
          <input id='inn' style={input} value={data.inn} onChange={set('inn')} placeholder='7701234567' maxLength={12} />
        </Field>
        <Field id='ogrn' labelText='ОГРН'>
          <input id='ogrn' style={input} value={data.ogrn} onChange={set('ogrn')} placeholder='1027700000000' maxLength={15} />
        </Field>
      </div>
      <Field id='name' labelText='Полное наименование компании'>
        <input id='name' style={input} value={data.name} onChange={set('name')} placeholder='ООО «Агро-Центр»' />
      </Field>
      <Field id='region' labelText='Регион'>
        <input id='region' style={input} value={data.region} onChange={set('region')} placeholder='Ростовская область' />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field id='contact' labelText='Контактное лицо'>
          <input id='contact' style={input} value={data.contact} onChange={set('contact')} placeholder='Иванов Иван' />
        </Field>
        <Field id='phone' labelText='Телефон'>
          <input id='phone' style={input} value={data.phone} onChange={set('phone')} placeholder='+7 900 000 00 00' type='tel' />
        </Field>
      </div>
    </div>
  );
}

function StepRole({ data, onChange }: { data: RoleData; onChange: (d: RoleData) => void }) {
  const toggle = (value: string) => {
    const next = data.selected.includes(value)
      ? data.selected.filter((v) => v !== value)
      : [...data.selected, value];
    onChange({ selected: next });
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--p7-color-text-muted, #6B778C)', lineHeight: 1.6 }}>
        Выберите одну или несколько ролей. Права доступа определяются на основе активных ролей компании.
      </p>
      {ROLE_OPTIONS.map((opt) => {
        const checked = data.selected.includes(opt.value);
        return (
          <label
            key={opt.value}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 12,
              border: `1px solid ${checked ? 'var(--p7-color-brand, #0A7A5F)' : 'var(--p7-color-border, #E4E6EA)'}`,
              background: checked ? 'var(--p7-color-brand-soft, rgba(10,122,95,0.06))' : 'var(--p7-color-surface, #fff)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <input
              type='checkbox'
              checked={checked}
              onChange={() => toggle(opt.value)}
              style={{ width: 16, height: 16, accentColor: 'var(--p7-color-brand, #0A7A5F)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--p7-color-text-primary, #0F1419)' }}>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function StepRequisites({ data, onChange }: { data: RequisiteData; onChange: (d: RequisiteData) => void }) {
  const set = (k: keyof RequisiteData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [k]: e.target.value });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Field id='account' labelText='Расчётный счёт'>
        <input id='account' style={input} value={data.account} onChange={set('account')} placeholder='40702810000000000000' maxLength={20} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field id='bankName' labelText='Банк'>
          <input id='bankName' style={input} value={data.bank} onChange={set('bank')} placeholder='ПАО Сбербанк' />
        </Field>
        <Field id='bic' labelText='БИК'>
          <input id='bic' style={input} value={data.bic} onChange={set('bic')} placeholder='044525225' maxLength={9} />
        </Field>
      </div>
      <Field id='signer' labelText='Подписант'>
        <input id='signer' style={input} value={data.signer} onChange={set('signer')} placeholder='Иванов Иван Иванович (директор)' />
      </Field>
    </div>
  );
}

function StepDocuments({ data, onChange }: { data: DocumentData; onChange: (d: DocumentData) => void }) {
  const setCheck = (k: 'charter' | 'proxy' | 'certs') => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [k]: e.target.checked });

  const DOC_FIELDS: { key: 'charter' | 'proxy' | 'certs'; label: string; note: string }[] = [
    { key: 'charter', label: 'Устав / ЕГРЮЛ', note: 'Актуальная редакция, подписанная ЭЦП директора' },
    { key: 'proxy', label: 'Доверенности', note: 'На подписанта и представителей' },
    { key: 'certs', label: 'Сертификаты и допуски', note: 'Разрешения на работу с культурами и элеваторами' },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--p7-color-text-muted, #6B778C)', lineHeight: 1.6 }}>
        Отметьте документы, которые готовы к загрузке. Загрузка выполняется после создания учётной записи.
      </p>
      {DOC_FIELDS.map((f) => (
        <label
          key={f.key}
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${data[f.key] ? 'var(--p7-color-brand, #0A7A5F)' : 'var(--p7-color-border, #E4E6EA)'}`,
            background: data[f.key] ? 'var(--p7-color-brand-soft, rgba(10,122,95,0.06))' : 'var(--p7-color-surface, #fff)',
            cursor: 'pointer',
          }}
        >
          <input
            type='checkbox'
            checked={data[f.key]}
            onChange={setCheck(f.key)}
            style={{ width: 16, height: 16, accentColor: 'var(--p7-color-brand, #0A7A5F)', cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--p7-color-text-primary, #0F1419)' }}>{f.label}</span>
            <span style={{ fontSize: 12, color: 'var(--p7-color-text-muted, #6B778C)' }}>{f.note}</span>
          </div>
        </label>
      ))}
      <Field id='crops' labelText='Культуры и склады'>
        <input
          id='crops'
          style={input}
          value={data.crops}
          onChange={(e) => onChange({ ...data, crops: e.target.value })}
          placeholder='Пшеница 3 класс, элеватор в Аксае'
        />
      </Field>
    </div>
  );
}

function StepBank({ data, onChange }: { data: BankConnectionData; onChange: (d: BankConnectionData) => void }) {
  const setCheck = (k: 'safeMode' | 'escrow' | 'factoring') => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [k]: e.target.checked });

  const TOGGLES: { key: 'safeMode' | 'escrow' | 'factoring'; label: string; note: string }[] = [
    { key: 'safeMode', label: 'Режим безопасной сделки', note: 'Деньги резервируются до выполнения всех условий' },
    { key: 'escrow', label: 'Эскроу', note: 'Трёхсторонний счёт: продавец, покупатель, банк' },
    { key: 'factoring', label: 'Факторинг', note: 'Авансовое финансирование поставки' },
  ];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Field id='sberId' labelText='СберБизнес ID (если есть)'>
        <input
          id='sberId'
          style={input}
          value={data.sberId}
          onChange={(e) => onChange({ ...data, sberId: e.target.value })}
          placeholder='SB-00000000'
        />
      </Field>
      <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
        <span style={label}>Финансовые режимы</span>
        {TOGGLES.map((t) => (
          <label
            key={t.key}
            style={{
              display: 'flex',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 12,
              border: `1px solid ${data[t.key] ? 'var(--p7-color-brand, #0A7A5F)' : 'var(--p7-color-border, #E4E6EA)'}`,
              background: data[t.key] ? 'var(--p7-color-brand-soft, rgba(10,122,95,0.06))' : 'var(--p7-color-surface, #fff)',
              cursor: 'pointer',
            }}
          >
            <input
              type='checkbox'
              checked={data[t.key]}
              onChange={setCheck(t.key)}
              style={{ width: 16, height: 16, accentColor: 'var(--p7-color-brand, #0A7A5F)', cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
            />
            <div style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--p7-color-text-primary, #0F1419)' }}>{t.label}</span>
              <span style={{ fontSize: 12, color: 'var(--p7-color-text-muted, #6B778C)' }}>{t.note}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function StepLot({ data, onChange }: { data: LotData; onChange: (d: LotData) => void }) {
  const set = (k: keyof LotData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...data, [k]: e.target.value });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--p7-color-text-muted, #6B778C)', lineHeight: 1.6 }}>
        Первый лот можно завести сразу или пропустить — он доступен после входа в контур.
      </p>
      <Field id='crop' labelText='Культура'>
        <select id='crop' style={{ ...input, cursor: 'pointer' }} value={data.crop} onChange={set('crop')}>
          <option value=''>— выберите культуру —</option>
          {CROP_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field id='volume' labelText='Объём (тонн)'>
          <input id='volume' style={input} value={data.volume} onChange={set('volume')} placeholder='500' type='number' min='1' />
        </Field>
        <Field id='price' labelText='Цена (₽/т)'>
          <input id='price' style={input} value={data.price} onChange={set('price')} placeholder='14500' type='number' min='1' />
        </Field>
      </div>
      <Field id='basis' labelText='Базис поставки'>
        <select id='basis' style={{ ...input, cursor: 'pointer' }} value={data.basis} onChange={set('basis')}>
          <option value=''>— выберите базис —</option>
          {BASIS_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </Field>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 4,
            flex: 1,
            borderRadius: 999,
            background: i < current
              ? 'var(--p7-color-brand, #0A7A5F)'
              : i === current
              ? 'var(--p7-color-brand, #0A7A5F)'
              : 'var(--p7-color-border, #E4E6EA)',
            opacity: i === current ? 0.4 : undefined,
          }}
        />
      ))}
    </div>
  );
}

function isStepValid(step: number, form: FormState): boolean {
  if (step === 0) return form.company.inn.length >= 10 && form.company.name.length > 0;
  if (step === 1) return form.role.selected.length > 0;
  if (step === 2) return form.requisites.account.length >= 18 && form.requisites.bank.length > 0 && form.requisites.bic.length === 9;
  return true;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const setCompany = useCallback((d: CompanyData) => setForm((f) => ({ ...f, company: d })), []);
  const setRole = useCallback((d: RoleData) => setForm((f) => ({ ...f, role: d })), []);
  const setRequisites = useCallback((d: RequisiteData) => setForm((f) => ({ ...f, requisites: d })), []);
  const setDocuments = useCallback((d: DocumentData) => setForm((f) => ({ ...f, documents: d })), []);
  const setBankConn = useCallback((d: BankConnectionData) => setForm((f) => ({ ...f, bankConn: d })), []);
  const setLot = useCallback((d: LotData) => setForm((f) => ({ ...f, lot: d })), []);

  const canNext = isStepValid(step, form);
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setSubmitted(true);
    } else {
      setStep((s) => s + 1);
    }
  };

  const panel: React.CSSProperties = {
    background: 'var(--p7-color-surface, #fff)',
    border: '1px solid var(--p7-color-border, #E4E6EA)',
    borderRadius: 18,
    padding: 20,
  };

  if (submitted) {
    return (
      <div style={{ display: 'grid', gap: 18, maxWidth: 640 }}>
        <div style={{ ...panel, textAlign: 'center', padding: 32, display: 'grid', gap: 16 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>✓</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--p7-color-text-primary, #0F1419)', letterSpacing: '-0.03em' }}>
            Данные приняты
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--p7-color-text-muted, #6B778C)', lineHeight: 1.6 }}>
            Учётная запись передана на проверку. После подтверждения вы получите доступ в рабочий контур своей роли.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <Link
              href='/platform-v7/roles'
              style={{ textDecoration: 'none', borderRadius: 12, padding: '11px 18px', background: 'var(--p7-color-brand, #0A7A5F)', color: '#fff', fontSize: 14, fontWeight: 800 }}
            >
              Посмотреть роли
            </Link>
            <Link
              href='/platform-v7'
              style={{ textDecoration: 'none', borderRadius: 12, padding: '11px 18px', background: 'var(--p7-color-surface-muted, #F8FAFB)', border: '1px solid var(--p7-color-border, #E4E6EA)', color: 'var(--p7-color-text-primary, #0F1419)', fontSize: 14, fontWeight: 800 }}
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 640 }}>
      <section style={panel}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--p7-color-text-primary, #0F1419)', letterSpacing: '-0.03em' }}>
              Онбординг компании
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--p7-color-text-muted, #6B778C)' }}>
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <ProgressBar current={step} total={STEPS.length} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STEPS.map((s, i) => (
              <span
                key={s}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: i === step ? 'var(--p7-color-brand, #0A7A5F)' : i < step ? 'var(--p7-color-brand-soft, rgba(10,122,95,0.10))' : 'transparent',
                  color: i === step ? '#fff' : i < step ? 'var(--p7-color-brand, #0A7A5F)' : 'var(--p7-color-text-muted, #6B778C)',
                  border: i > step ? '1px solid var(--p7-color-border, #E4E6EA)' : '1px solid transparent',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ ...panel, minHeight: 320 }}>
        <h2 style={{ margin: '0 0 18px', fontSize: 20, fontWeight: 800, color: 'var(--p7-color-text-primary, #0F1419)', letterSpacing: '-0.02em' }}>
          {step + 1}. {STEPS[step]}
        </h2>
        {step === 0 && <StepCompany data={form.company} onChange={setCompany} />}
        {step === 1 && <StepRole data={form.role} onChange={setRole} />}
        {step === 2 && <StepRequisites data={form.requisites} onChange={setRequisites} />}
        {step === 3 && <StepDocuments data={form.documents} onChange={setDocuments} />}
        {step === 4 && <StepBank data={form.bankConn} onChange={setBankConn} />}
        {step === 5 && <StepLot data={form.lot} onChange={setLot} />}
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        {step > 0 ? (
          <button
            onClick={() => setStep((s) => s - 1)}
            style={{ padding: '11px 18px', borderRadius: 12, border: '1px solid var(--p7-color-border, #E4E6EA)', background: 'var(--p7-color-surface, #fff)', color: 'var(--p7-color-text-primary, #0F1419)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
          >
            Назад
          </button>
        ) : (
          <div />
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {step === STEPS.length - 1 && (
            <button
              onClick={handleNext}
              style={{ padding: '11px 18px', borderRadius: 12, border: '1px solid var(--p7-color-border, #E4E6EA)', background: 'var(--p7-color-surface, #fff)', color: 'var(--p7-color-text-muted, #6B778C)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
            >
              Пропустить
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canNext && step < 2}
            style={{
              padding: '11px 20px',
              borderRadius: 12,
              border: 'none',
              background: (!canNext && step < 2) ? 'var(--p7-color-border, #E4E6EA)' : 'var(--p7-color-brand, #0A7A5F)',
              color: (!canNext && step < 2) ? 'var(--p7-color-text-muted, #6B778C)' : '#fff',
              fontSize: 14,
              fontWeight: 800,
              cursor: (!canNext && step < 2) ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {isLast ? 'Создать аккаунт' : 'Далее'}
          </button>
        </div>
      </div>
    </div>
  );
}
