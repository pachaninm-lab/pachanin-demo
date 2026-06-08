'use client';

import { useState } from 'react';
import Link from 'next/link';

type RegForm = {
  inn: string;
  ogrn: string;
  name: string;
  region: string;
  contact: string;
  email: string;
  phone: string;
  roles: string[];
  hasCharter: boolean;
  hasProxy: boolean;
  account: string;
  bankName: string;
  sberId: string;
  agree: boolean;
};

const EMPTY: RegForm = {
  inn: '',
  ogrn: '',
  name: '',
  region: '',
  contact: '',
  email: '',
  phone: '',
  roles: [],
  hasCharter: false,
  hasProxy: false,
  account: '',
  bankName: '',
  sberId: '',
  agree: false,
};

const ROLE_OPTIONS = [
  { value: 'seller', label: 'Продавец' },
  { value: 'buyer', label: 'Покупатель' },
  { value: 'logistics', label: 'Логистика' },
  { value: 'lab', label: 'Лаборатория' },
  { value: 'bank', label: 'Банк / финпартнёр' },
];

const inp: React.CSSProperties = {
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

const lbl: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--p7-color-text-muted, #6B778C)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  marginBottom: 5,
  display: 'block',
};

function F({ id, text, children }: { id?: string; text: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <label htmlFor={id} style={lbl}>{text}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: 'var(--p7-color-surface, #fff)',
      border: '1px solid var(--p7-color-border, #E4E6EA)',
      borderRadius: 16,
      padding: '18px 20px',
      display: 'grid',
      gap: 14,
    }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--p7-color-text-primary, #0F1419)', letterSpacing: '-0.02em' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function RegisterPage() {
  const [form, setForm] = useState<RegForm>(EMPTY);
  const [done, setDone] = useState(false);

  const set = (k: keyof RegForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
  };

  const toggleRole = (value: string) => {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(value) ? f.roles.filter((r) => r !== value) : [...f.roles, value],
    }));
  };

  const canSubmit =
    form.inn.length >= 10 &&
    form.name.length > 0 &&
    form.email.includes('@') &&
    form.roles.length > 0 &&
    form.agree;

  if (done) {
    return (
      <div style={{ display: 'grid', gap: 18, maxWidth: 680 }}>
        <div style={{
          background: 'var(--p7-color-surface, #fff)',
          border: '1px solid var(--p7-color-border, #E4E6EA)',
          borderRadius: 18,
          padding: 32,
          textAlign: 'center',
          display: 'grid',
          gap: 16,
        }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>✓</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--p7-color-text-primary, #0F1419)', letterSpacing: '-0.03em' }}>
            Заявка принята
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--p7-color-text-muted, #6B778C)', lineHeight: 1.6 }}>
            Данные переданы на верификацию. После подтверждения вы получите доступ к контуру своей роли.
            Пока идёт проверка — изучите онбординг.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <Link
              href='/platform-v7/onboarding'
              style={{ textDecoration: 'none', borderRadius: 12, padding: '11px 18px', background: 'var(--p7-color-brand, #0A7A5F)', color: '#fff', fontSize: 14, fontWeight: 800 }}
            >
              Открыть онбординг
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
    <div style={{ display: 'grid', gap: 18, maxWidth: 680 }}>
      <section style={{
        background: 'var(--p7-color-surface, #fff)',
        border: '1px solid var(--p7-color-border, #E4E6EA)',
        borderRadius: 18,
        padding: '20px 22px',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB', fontSize: 11, fontWeight: 900, marginBottom: 12 }}>
          Подключение компании
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: 'var(--p7-color-text-primary, #0F1419)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
          Регистрация
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--p7-color-text-muted, #6B778C)', lineHeight: 1.65 }}>
          Создание учётной записи компании в контуре исполнения сделки. Реквизиты, документы и финансовый контур настраиваются на следующем шаге.
        </p>
      </section>

      <Section title='Компания'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F id='inn' text='ИНН'>
            <input id='inn' style={inp} value={form.inn} onChange={set('inn')} placeholder='7701234567' maxLength={12} />
          </F>
          <F id='ogrn' text='ОГРН'>
            <input id='ogrn' style={inp} value={form.ogrn} onChange={set('ogrn')} placeholder='1027700000000' maxLength={15} />
          </F>
        </div>
        <F id='name' text='Полное наименование'>
          <input id='name' style={inp} value={form.name} onChange={set('name')} placeholder='ООО «Агро-Центр»' />
        </F>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F id='region' text='Регион'>
            <input id='region' style={inp} value={form.region} onChange={set('region')} placeholder='Ростовская область' />
          </F>
          <F id='contact' text='Контактное лицо'>
            <input id='contact' style={inp} value={form.contact} onChange={set('contact')} placeholder='Иванов И.И.' />
          </F>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F id='email' text='E-mail'>
            <input id='email' style={inp} value={form.email} onChange={set('email')} placeholder='ceo@company.ru' type='email' />
          </F>
          <F id='phone' text='Телефон'>
            <input id='phone' style={inp} value={form.phone} onChange={set('phone')} placeholder='+7 900 000 00 00' type='tel' />
          </F>
        </div>
      </Section>

      <Section title='Роль в контуре'>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--p7-color-text-muted, #6B778C)', lineHeight: 1.55 }}>
          Выберите одну или несколько ролей. Права доступа выдаются после верификации.
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {ROLE_OPTIONS.map((opt) => {
            const checked = form.roles.includes(opt.value);
            return (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `1px solid ${checked ? 'var(--p7-color-brand, #0A7A5F)' : 'var(--p7-color-border, #E4E6EA)'}`,
                  background: checked ? 'var(--p7-color-brand-soft, rgba(10,122,95,0.06))' : 'var(--p7-color-surface, #fff)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type='checkbox'
                  checked={checked}
                  onChange={() => toggleRole(opt.value)}
                  style={{ width: 15, height: 15, accentColor: 'var(--p7-color-brand, #0A7A5F)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--p7-color-text-primary, #0F1419)' }}>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </Section>

      <Section title='Документы'>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--p7-color-text-muted, #6B778C)', lineHeight: 1.55 }}>
          Укажите, какие документы готовы. Загрузка доступна после создания учётной записи.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type='checkbox' checked={form.hasCharter} onChange={set('hasCharter')} style={{ width: 15, height: 15, accentColor: 'var(--p7-color-brand, #0A7A5F)', cursor: 'pointer' }} />
          <span style={{ fontSize: 14, color: 'var(--p7-color-text-primary, #0F1419)', fontWeight: 700 }}>Устав / ЕГРЮЛ готов к загрузке</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type='checkbox' checked={form.hasProxy} onChange={set('hasProxy')} style={{ width: 15, height: 15, accentColor: 'var(--p7-color-brand, #0A7A5F)', cursor: 'pointer' }} />
          <span style={{ fontSize: 14, color: 'var(--p7-color-text-primary, #0F1419)', fontWeight: 700 }}>Доверенности и полномочия оформлены</span>
        </label>
      </Section>

      <Section title='Финансовый контур'>
        <F id='account' text='Расчётный счёт'>
          <input id='account' style={inp} value={form.account} onChange={set('account')} placeholder='40702810000000000000' maxLength={20} />
        </F>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F id='bankName' text='Банк'>
            <input id='bankName' style={inp} value={form.bankName} onChange={set('bankName')} placeholder='ПАО Сбербанк' />
          </F>
          <F id='sberId' text='СберБизнес ID'>
            <input id='sberId' style={inp} value={form.sberId} onChange={set('sberId')} placeholder='SB-00000000' />
          </F>
        </div>
      </Section>

      <section style={{
        background: 'var(--p7-color-surface, #fff)',
        border: '1px solid var(--p7-color-border, #E4E6EA)',
        borderRadius: 16,
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', flex: 1, minWidth: 260 }}>
          <input type='checkbox' checked={form.agree} onChange={set('agree')} style={{ width: 15, height: 15, accentColor: 'var(--p7-color-brand, #0A7A5F)', cursor: 'pointer', marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--p7-color-text-muted, #6B778C)', lineHeight: 1.6 }}>
            Подтверждаю достоверность данных и согласен с{' '}
            <Link href='/platform-v7/oferta' style={{ color: 'var(--p7-color-brand, #0A7A5F)', textDecoration: 'none', fontWeight: 800 }}>условиями подключения</Link>
          </span>
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            href='/platform-v7/login'
            style={{ textDecoration: 'none', borderRadius: 12, padding: '11px 16px', background: 'var(--p7-color-surface-muted, #F8FAFB)', border: '1px solid var(--p7-color-border, #E4E6EA)', color: 'var(--p7-color-text-primary, #0F1419)', fontSize: 14, fontWeight: 800 }}
          >
            Уже есть доступ
          </Link>
          <button
            disabled={!canSubmit}
            onClick={() => setDone(true)}
            style={{
              borderRadius: 12,
              padding: '11px 18px',
              border: 'none',
              background: canSubmit ? 'var(--p7-color-brand, #0A7A5F)' : 'var(--p7-color-border, #E4E6EA)',
              color: canSubmit ? '#fff' : 'var(--p7-color-text-muted, #6B778C)',
              fontSize: 14,
              fontWeight: 800,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            Подать заявку
          </button>
        </div>
      </section>
    </div>
  );
}
