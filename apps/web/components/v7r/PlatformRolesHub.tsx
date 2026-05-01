'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

type ScenarioCard = {
  title: string;
  description: string;
  cta: string;
  href: string;
  role?: PlatformRole;
  accent: string;
};

const SCENARIO_CARDS: ScenarioCard[] = [
  {
    title: 'Я продаю зерно',
    description: 'Создать лот, получить предложения, принять цену, отследить документы, отгрузку и деньги.',
    cta: 'Перейти в кабинет продавца',
    href: '/platform-v7/seller',
    role: 'seller',
    accent: '#0A7A5F',
  },
  {
    title: 'Я покупаю зерно',
    description: 'Найти лот, сделать ставку, зарезервировать деньги, принять груз и закрыть документы.',
    cta: 'Перейти в кабинет покупателя',
    href: '/platform-v7/buyer',
    role: 'buyer',
    accent: '#2563EB',
  },
  {
    title: 'Я везу груз',
    description: 'Принять рейс, фиксировать прибытие, фото, пломбу, вес, маршрут и завершение перевозки.',
    cta: 'Открыть рейс водителя',
    href: '/platform-v7/driver/field',
    role: 'driver',
    accent: '#7C3AED',
  },
  {
    title: 'Я принимаю или проверяю груз',
    description: 'Зафиксировать вес, качество, документы, отклонения и результат приёмки.',
    cta: 'Выбрать роль приёмки',
    href: '/platform-v7/elevator',
    role: 'elevator',
    accent: '#B45309',
  },
  {
    title: 'Я контролирую сделку',
    description: 'Видеть деньги, документы, споры, банк, причины остановки и следующий ответственный шаг.',
    cta: 'Открыть контроль сделки',
    href: '/platform-v7/control-tower',
    role: 'operator',
    accent: '#0F172A',
  },
];

const SECONDARY_LINKS = [
  { title: 'Все роли', href: '/platform-v7/roles' },
  { title: 'Демо-сценарий', href: '/platform-v7/demo' },
  { title: 'Инвесторский режим', href: '/platform-v7/investor' },
] as const;

const RECEIVING_LINKS = [
  { title: 'Элеватор', href: '/platform-v7/elevator', role: 'elevator' as PlatformRole },
  { title: 'Лаборатория', href: '/platform-v7/lab', role: 'lab' as PlatformRole },
  { title: 'Сюрвейер', href: '/platform-v7/surveyor', role: 'surveyor' as PlatformRole },
] as const;

const CONTROL_LINKS = [
  { title: 'Центр управления', href: '/platform-v7/control-tower', role: 'operator' as PlatformRole },
  { title: 'Банк', href: '/platform-v7/bank', role: 'bank' as PlatformRole },
  { title: 'Комплаенс', href: '/platform-v7/compliance', role: 'compliance' as PlatformRole },
  { title: 'Арбитр', href: '/platform-v7/arbitrator', role: 'arbitrator' as PlatformRole },
] as const;

function ScenarioLink({ scenario }: { scenario: ScenarioCard }) {
  const { setRole } = usePlatformV7RStore();

  return (
    <Link
      href={`${scenario.href}${scenario.role ? `?as=${scenario.role}` : ''}`}
      onClick={() => scenario.role && setRole(scenario.role)}
      style={{
        textDecoration: 'none',
        background: '#fff',
        border: '1px solid #E4E6EA',
        borderRadius: 22,
        padding: 20,
        display: 'grid',
        gap: 14,
        minHeight: 246,
        boxShadow: '0 18px 45px rgba(15, 20, 25, 0.06)',
      }}
    >
      <div style={{ width: 42, height: 4, borderRadius: 999, background: scenario.accent }} />
      <div style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.18, fontWeight: 900, color: '#0F1419' }}>{scenario.title}</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: '#475569' }}>{scenario.description}</p>
      </div>
      <div style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '11px 14px', borderRadius: 14, background: scenario.accent, color: '#fff', fontSize: 14, lineHeight: 1.2, fontWeight: 850, textAlign: 'center' }}>
        {scenario.cta}
      </div>
    </Link>
  );
}

function InlineRoleLinks({ mode }: { mode: 'receiving' | 'control' }) {
  const { setRole } = usePlatformV7RStore();
  const links = mode === 'receiving' ? RECEIVING_LINKS : CONTROL_LINKS;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={`${link.href}?as=${link.role}`}
          onClick={() => setRole(link.role)}
          style={{ textDecoration: 'none', padding: '8px 11px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 12, fontWeight: 800 }}
        >
          {link.title}
        </Link>
      ))}
    </div>
  );
}

export function PlatformRolesHub() {
  return (
    <main style={{ display: 'grid', gap: 18, padding: '8px 0 24px' }}>
      <section style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 10, maxWidth: 900 }}>
            <div style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
              Пилотный контур. Часть внешних подключений работает в тестовом режиме.
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.04, letterSpacing: '-0.045em', fontWeight: 950, color: '#0F1419' }}>
              Исполнение зерновой сделки по ролям
            </h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#475569', maxWidth: 820 }}>
              Это не доска объявлений. Выберите свою роль и сразу откройте рабочий контур: лот, ставка, сделка, резерв, логистика, приёмка, документы, деньги, спор и доказательства.
            </p>
          </div>
          <Link href='/platform-v7/control-tower?as=operator' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 850 }}>
            Открыть центр управления
          </Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
        {SCENARIO_CARDS.map((scenario) => (
          <ScenarioLink key={scenario.title} scenario={scenario} />
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 20, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F1419' }}>Роли приёмки</div>
          <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>Отдельные кабинеты для веса, качества и проверки на площадке.</div>
          <InlineRoleLinks mode='receiving' />
        </div>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 20, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F1419' }}>Контроль сделки</div>
          <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>Операционный контроль, деньги, допуск сторон и споры разнесены по ролям.</div>
          <InlineRoleLinks mode='control' />
        </div>
      </section>

      <nav aria-label='Дополнительные режимы platform-v7' style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {SECONDARY_LINKS.map((link) => (
          <Link key={link.href} href={link.href} style={{ textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '9px 13px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 850 }}>
            {link.title}
          </Link>
        ))}
      </nav>
    </main>
  );
}
