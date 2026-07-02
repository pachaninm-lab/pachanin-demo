'use client';

import { useState, useCallback, useId } from 'react';
import Link from 'next/link';

/* ─── Types ─── */
type AppStatus = 'draft' | 'submitted' | 'review' | 'clarification' | 'approved' | 'rejected';
type FieldErrors = Record<string, string>;
type PwdStrength = { score: 0 | 1 | 2 | 3 | 4 | 5; label: string; color: string };

/* ─── Validation helpers ─── */
function innChecksum10(d: number[]): boolean {
  const w = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  const sum = w.reduce((s, w, i) => s + w * d[i], 0);
  return (sum % 11) % 10 === d[9];
}
function innChecksum12(d: number[]): boolean {
  const w1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const w2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const c1 = (w1.reduce((s, w, i) => s + w * d[i], 0) % 11) % 10;
  const c2 = (w2.reduce((s, w, i) => s + w * d[i], 0) % 11) % 10;
  return c1 === d[10] && c2 === d[11];
}

function validateInn(v: string): string | null {
  if (!v) return 'Обязательное поле';
  if (!/^\d+$/.test(v)) return 'Только цифры';
  const d = v.split('').map(Number);
  if (d.length === 10) return innChecksum10(d) ? null : 'Неверная контрольная сумма ИНН';
  if (d.length === 12) return innChecksum12(d) ? null : 'Неверная контрольная сумма ИНН';
  return '10 цифр (юр. лицо) или 12 (ИП/физ. лицо)';
}

function validateOgrn(v: string): string | null {
  if (!v) return 'Обязательное поле';
  if (!/^\d+$/.test(v)) return 'Только цифры';
  if (v.length === 13) {
    const check = Number(BigInt(v.slice(0, 12)) % 11n) % 10;
    return check === Number(v[12]) ? null : 'Неверная контрольная сумма ОГРН';
  }
  if (v.length === 15) {
    const check = Number(BigInt(v.slice(0, 14)) % 13n) % 10;
    return check === Number(v[14]) ? null : 'Неверная контрольная сумма ОГРНИП';
  }
  return '13 цифр (ОГРН) или 15 (ОГРНИП)';
}

function validatePhone(v: string): string | null {
  if (!v) return 'Обязательное поле';
  const clean = v.replace(/\D/g, '');
  if (clean.length !== 11) return 'Формат: +7 XXX XXX-XX-XX';
  if (clean[0] !== '7' && clean[0] !== '8') return 'Начинайте с +7 или 8';
  return null;
}

function validateEmail(v: string): string | null {
  if (!v) return 'Обязательное поле';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Укажите корпоративный email';
  return null;
}

function validateRequired(v: string, label = 'Поле'): string | null {
  return v.trim() ? null : `${label}: обязательное поле`;
}

function passwordStrength(pwd: string): PwdStrength {
  if (!pwd) return { score: 0, label: '', color: '#E4E6EA' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-ZА-Я]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-zА-Яа-я0-9]/.test(pwd)) score++;
  const levels: PwdStrength[] = [
    { score: 0, label: '', color: '#E4E6EA' },
    { score: 1, label: 'Очень слабый', color: '#DC2626' },
    { score: 2, label: 'Слабый',       color: '#EF4444' },
    { score: 3, label: 'Средний',      color: '#D97706' },
    { score: 4, label: 'Хороший',      color: '#059669' },
    { score: 5, label: 'Надёжный',     color: '#0A7A5F' },
  ];
  return levels[Math.min(score, 5) as 0 | 1 | 2 | 3 | 4 | 5];
}

/* ─── Application status config ─── */
const STATUS_INFO: Record<AppStatus, { label: string; color: string; bg: string; icon: string; desc: string }> = {
  draft:         { label: 'Черновик',          color: '#64748B', bg: '#F1F5F9', icon: '○', desc: 'Заявка не отправлена' },
  submitted:     { label: 'Отправлена',         color: '#0369A1', bg: '#E0F2FE', icon: '→', desc: 'Получена оператором платформы' },
  review:        { label: 'На проверке',        color: '#7C3AED', bg: '#EDE9FE', icon: '⊙', desc: 'Проверка реквизитов и документов — до 2 рабочих дней' },
  clarification: { label: 'Требует уточнения',  color: '#B45309', bg: '#FEF3C7', icon: '⚡', desc: 'Оператор запросил уточнение — проверьте email' },
  approved:      { label: 'Допущен',            color: '#065F46', bg: '#D1FAE5', icon: '✓', desc: 'Кабинет открыт. Войдите через форму входа.' },
  rejected:      { label: 'Отклонён',           color: '#991B1B', bg: '#FEE2E2', icon: '✗', desc: 'Причина указана в уведомлении на email' },
};

const APP_JOURNEY: AppStatus[] = ['draft', 'submitted', 'review', 'approved'];

function genAppNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `ЗАЯ-${ymd}-${rnd}`;
}

/* ─── Styles ─── */
const S = {
  field: {
    minHeight: 46, borderRadius: 15, border: '1px solid rgba(15,23,42,.12)',
    background: 'rgba(255,255,255,.96)', padding: '0 14px', fontSize: 15,
    color: '#111827', width: '100%', outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(15,23,42,.03)', transition: 'border-color .15s, box-shadow .15s',
  } as React.CSSProperties,
  fieldError: {
    minHeight: 46, borderRadius: 15, border: '1.5px solid #DC2626',
    background: '#FFF5F5', padding: '0 14px', fontSize: 15,
    color: '#111827', width: '100%', outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(220,38,38,.06)', transition: 'border-color .15s',
  } as React.CSSProperties,
  label: { fontSize: 12.5, fontWeight: 800, color: '#66758A' } as React.CSSProperties,
  errMsg: { fontSize: 11.5, color: '#DC2626', fontWeight: 700, marginTop: 2 } as React.CSSProperties,
  card: {
    background: 'rgba(255,255,255,.93)', border: '1px solid rgba(15,23,42,.08)',
    borderRadius: 26, padding: 18, display: 'grid', gap: 13,
    boxShadow: '0 16px 38px rgba(15,23,42,.055)',
  } as React.CSSProperties,
  micro: {
    fontSize: 10, fontWeight: 900, letterSpacing: '0.08em',
    textTransform: 'uppercase' as const, color: '#66758A',
  } as React.CSSProperties,
  submitBtn: {
    minHeight: 52, borderRadius: 16, border: 'none', background: '#087a3b',
    color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer',
    boxShadow: '0 14px 28px rgba(8,122,59,.25)', width: '100%',
    transition: 'opacity .15s, transform .1s',
  } as React.CSSProperties,
};

/* ─── Field component ─── */
function Field({
  label, type = 'text', value, placeholder, error, onChange, suffix, autoComplete,
}: {
  label: string; type?: string; value: string; placeholder?: string; error?: string;
  onChange: (v: string) => void; suffix?: React.ReactNode; autoComplete?: string;
}) {
  const id = useId();
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <label htmlFor={id} style={S.label}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          style={error ? S.fieldError : S.field}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>{suffix}</span>
        )}
      </div>
      {error && <span style={S.errMsg} role="alert">{error}</span>}
    </div>
  );
}

/* ─── Password field ─── */
function PasswordField({ value, error, onChange }: { value: string; error?: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const strength = passwordStrength(value);
  const id = useId();
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <label htmlFor={id} style={S.label}>Пароль</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          autoComplete="new-password"
          placeholder="Минимум 8 символов"
          onChange={(e) => onChange(e.target.value)}
          style={{ ...(error ? S.fieldError : S.field), paddingRight: 46 }}
        />
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 13, fontWeight: 700, padding: '2px 4px' }}
          aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
        >
          {show ? '○' : '●'}
        </button>
      </div>
      {value && (
        <div style={{ display: 'grid', gap: 3 }}>
          <div style={{ display: 'flex', gap: 3, height: 3 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ flex: 1, borderRadius: 2, background: i <= strength.score ? strength.color : '#E4E6EA', transition: 'background .2s' }} />
            ))}
          </div>
          {strength.label && <span style={{ fontSize: 10.5, color: strength.color, fontWeight: 700 }}>{strength.label}</span>}
        </div>
      )}
      {error && <span style={S.errMsg} role="alert">{error}</span>}
    </div>
  );
}

/* ─── Application status tracker ─── */
function AppStatusTracker({ status, appNumber, submittedAt }: { status: AppStatus; appNumber: string; submittedAt: string }) {
  const info = STATUS_INFO[status];
  const journeyIdx = APP_JOURNEY.indexOf(status);
  return (
    <div style={{ ...S.card, background: info.bg, borderColor: info.color + '30' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20, color: info.color }}>{info.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: info.color }}>{info.label}</div>
          <div style={{ fontSize: 11.5, color: '#66758A', marginTop: 1 }}>{info.desc}</div>
        </div>
        <code style={{ fontSize: 11, fontWeight: 700, color: '#0F1419', background: 'rgba(255,255,255,.7)', padding: '3px 8px', borderRadius: 6 }}>{appNumber}</code>
      </div>

      {/* Journey progress */}
      {journeyIdx >= 0 && (
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          {APP_JOURNEY.map((s, i) => {
            const sInfo = STATUS_INFO[s];
            const done = i <= journeyIdx;
            const active = i === journeyIdx;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < APP_JOURNEY.length - 1 ? 1 : undefined }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? sInfo.color : '#E4E6EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: done ? '#fff' : '#94A3B8', fontWeight: 900, flexShrink: 0, boxShadow: active ? `0 0 0 3px ${sInfo.color}30` : 'none', transition: 'all .3s' }}>
                  {done ? (active ? '●' : '✓') : '○'}
                </div>
                {i < APP_JOURNEY.length - 1 && <div style={{ flex: 1, height: 2, background: i < journeyIdx ? '#0A7A5F' : '#E4E6EA', transition: 'background .3s' }} />}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 11, color: '#66758A' }}>
        Отправлено: {new Date(submittedAt).toLocaleString('ru-RU')} · Уведомления на указанный email
      </div>
    </div>
  );
}

/* ─── Main component ─── */
const ROLE_OPTIONS = [
  { value: 'seller',    label: 'Продавец' },
  { value: 'buyer',     label: 'Покупатель' },
  { value: 'logistics', label: 'Логистика / Перевозчик' },
  { value: 'elevator',  label: 'Элеватор / Хранилище' },
  { value: 'lab',       label: 'Лаборатория' },
  { value: 'surveyor',  label: 'Сюрвейер' },
  { value: 'bank',      label: 'Банк / Финансовый партнёр' },
  { value: 'arbitrator',label: 'Арбитр' },
  { value: 'operator',  label: 'Оператор платформы' },
] as const;

const ORG_TYPE_OPTIONS = ['ООО', 'АО', 'ПАО', 'ИП', 'КФХ', 'ФГУП', 'МУП'];

interface FormState {
  role: string; orgType: string; orgName: string; region: string;
  inn: string; kpp: string; ogrn: string; fullName: string;
  position: string; phone: string; email: string; password: string;
  consentRules: boolean; consentPd: boolean;
}

const INITIAL: FormState = {
  role: 'seller', orgType: 'ООО', orgName: '', region: '',
  inn: '', kpp: '', ogrn: '', fullName: '', position: '',
  phone: '', email: '', password: '',
  consentRules: false, consentPd: false,
};

export function RegisterForm({ initialRole }: { initialRole?: string }) {
  const [form, setForm] = useState<FormState>({ ...INITIAL, role: initialRole ?? 'seller' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [appStatus, setAppStatus] = useState<AppStatus>('draft');
  const [appNumber, setAppNumber] = useState('');
  const [submittedAt, setSubmittedAt] = useState('');

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  }, []);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    const r = (k: string, msg: string | null) => { if (msg) e[k] = msg; };
    r('orgName',  validateRequired(form.orgName, 'Название организации'));
    r('region',   validateRequired(form.region, 'Регион'));
    r('inn',      validateInn(form.inn));
    r('ogrn',     validateOgrn(form.ogrn));
    r('fullName', validateRequired(form.fullName, 'ФИО'));
    r('position', validateRequired(form.position, 'Должность'));
    r('phone',    validatePhone(form.phone));
    r('email',    validateEmail(form.email));
    if (!form.password) e.password = 'Введите пароль';
    else if (form.password.length < 8) e.password = 'Минимум 8 символов';
    else if (passwordStrength(form.password).score < 2) e.password = 'Пароль слишком простой';
    if (!form.consentRules) e.consentRules = 'Необходимо согласие с правилами';
    if (!form.consentPd)    e.consentPd    = 'Необходимо согласие на обработку ПД';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      document.getElementById(`rf-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    const num = genAppNumber();
    const now = new Date().toISOString();
    setAppNumber(num);
    setSubmittedAt(now);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 900));
    setAppStatus('submitted');
    // Simulate moving to review after brief delay
    setTimeout(() => setAppStatus('review'), 2800);
    setSubmitting(false);
  }

  const fieldStyle = (key: string) => errors[key] ? S.fieldError : S.field;

  /* ─── Success state ─── */
  if (appStatus !== 'draft') {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <AppStatusTracker status={appStatus} appNumber={appNumber} submittedAt={submittedAt} />

        <div style={S.card}>
          <span style={S.micro}>Следующие шаги</span>
          <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'grid', gap: 8 }}>
            {[
              'Оператор платформы проверяет реквизиты и ИНН в реестрах (до 2 рабочих дней)',
              'При необходимости оператор запросит дополнительные документы по email',
              'После допуска вы получите уведомление и сможете войти в рабочий кабинет',
              'Первая сделка проходит с сопровождением оператора',
            ].map((s, i) => (
              <li key={i} style={{ fontSize: 13, color: '#374151', lineHeight: 1.45, fontWeight: 600 }}>{s}</li>
            ))}
          </ol>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Link href="/platform-v7/login" style={{ ...S.submitBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: '#087a3b' }}>
            Войти в кабинет
          </Link>
          <Link href="/platform-v7" style={{ ...S.submitBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'transparent', color: '#087a3b', border: '1.5px solid rgba(8,122,59,.3)', boxShadow: 'none' }}>
            На главную
          </Link>
        </div>
      </div>
    );
  }

  /* ─── Form state ─── */
  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: 14 }}>

      {/* Role */}
      <section style={S.card} aria-label="Роль участника">
        <span style={S.micro}>Роль участника</span>
        <div style={{ display: 'grid', gap: 5 }}>
          <label style={S.label}>Заявляемая роль</label>
          <select
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            style={{ ...S.field, appearance: 'none' }}
          >
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: '#66758A', lineHeight: 1.45 }}>
          Роль указывается в заявке. Выбор роли здесь не обходит role-lock — доступ в рабочий кабинет открывается только после проверки и допуска участника оператором платформы.
        </p>
      </section>

      {/* Participant */}
      <section style={S.card} aria-label="Участник">
        <span style={S.micro}>Участник</span>
        <div className="p7-register-field-grid">
          <div style={{ display: 'grid', gap: 5 }}>
            <label style={S.label}>Тип организации</label>
            <select value={form.orgType} onChange={(e) => set('orgType', e.target.value)} style={{ ...S.field, appearance: 'none' }}>
              {ORG_TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <Field label="Название организации" value={form.orgName} placeholder={`${form.orgType} «АгроГрейн»`} error={errors.orgName} onChange={(v) => set('orgName', v)} />
          <Field label="Регион присутствия" value={form.region} placeholder="Тамбовская область" error={errors.region} onChange={(v) => set('region', v)} />
        </div>
      </section>

      {/* Requisites */}
      <section style={S.card} aria-label="Реквизиты и ответственный">
        <span style={S.micro}>Реквизиты и ответственный</span>
        <div className="p7-register-field-grid">
          <Field label="ИНН" value={form.inn} placeholder="10 или 12 цифр" error={errors.inn} onChange={(v) => set('inn', v.replace(/\D/g, '').slice(0, 12))} autoComplete="off" />
          <Field label="КПП" value={form.kpp} placeholder="9 цифр (для юр. лица)" error={errors.kpp} onChange={(v) => set('kpp', v.replace(/\D/g, '').slice(0, 9))} autoComplete="off" />
          <Field label="ОГРН / ОГРНИП" value={form.ogrn} placeholder="13 или 15 цифр" error={errors.ogrn} onChange={(v) => set('ogrn', v.replace(/\D/g, '').slice(0, 15))} autoComplete="off" />
          <Field label="ФИО ответственного" value={form.fullName} placeholder="Иванов Иван Иванович" error={errors.fullName} onChange={(v) => set('fullName', v)} autoComplete="name" />
          <Field label="Должность" value={form.position} placeholder="Директор / Уполномоченный" error={errors.position} onChange={(v) => set('position', v)} autoComplete="organization-title" />
          <Field
            label="Телефон"
            type="tel"
            value={form.phone}
            placeholder="+7 9XX XXX-XX-XX"
            error={errors.phone}
            autoComplete="tel"
            onChange={(v) => set('phone', v)}
          />
          <Field label="Корпоративный email" type="email" value={form.email} placeholder="имя@компания.рф" error={errors.email} onChange={(v) => set('email', v)} autoComplete="email" />
          <PasswordField value={form.password} error={errors.password} onChange={(v) => set('password', v)} />
        </div>
      </section>

      {/* Consents */}
      <section style={S.card} aria-label="Согласия">
        <span style={S.micro}>Согласия</span>
        {[
          { key: 'consentRules' as const, text: 'Ознакомлен и согласен с правилами участия в платформе «Прозрачная Цена»' },
          { key: 'consentPd'    as const, text: 'Согласен на обработку персональных данных в соответствии с 152-ФЗ' },
        ].map(({ key, text }) => (
          <div key={key}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form[key] as boolean}
                onChange={(e) => set(key, e.target.checked)}
                style={{ marginTop: 2, accentColor: '#087a3b', width: 16, height: 16, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: '#111827', lineHeight: 1.45 }}>{text}</span>
            </label>
            {errors[key] && <span style={S.errMsg} role="alert">{errors[key]}</span>}
          </div>
        ))}
      </section>

      {/* Submit */}
      <div style={{ display: 'grid', gap: 8 }}>
        {Object.keys(errors).length > 0 && (
          <div role="alert" style={{ padding: '10px 14px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#991B1B', fontWeight: 700 }}>
            Исправьте {Object.keys(errors).length} {Object.keys(errors).length === 1 ? 'ошибку' : 'ошибки'} перед отправкой
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          style={{ ...S.submitBtn, opacity: submitting ? 0.75 : 1 }}
        >
          {submitting ? 'Отправка заявки…' : 'Отправить заявку на проверку'}
        </button>
        <Link
          href="/platform-v7/login"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 16, fontSize: 14, fontWeight: 800, color: '#087a3b', background: 'rgba(8,122,59,.07)', border: '1px solid rgba(8,122,59,.18)', textDecoration: 'none' }}
        >
          Уже есть доступ — войти
        </Link>
      </div>
    </form>
  );
}
