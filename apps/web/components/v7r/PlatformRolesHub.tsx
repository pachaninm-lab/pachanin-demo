'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const ROLE_CARDS: Array<{
  role: PlatformRole;
  title: string;
  subtitle: string;
  href: string;
  nextStep: string;
  stage: 'sandbox' | 'pilot' | 'role-sim';
}> = [
  {
    role: 'seller',
    title: 'Продавец / хозяйство',
    subtitle: 'Лоты, документы, отгрузка, сумма к выпуску и причины удержания.',
    href: '/platform-v7/seller',
    nextStep: 'Создать лот или открыть зависшую выплату.',
    stage: 'pilot',
  },
  {
    role: 'buyer',
    title: 'Покупатель / трейдер',
    subtitle: 'Отбор предложений, сделки, качество, резерв, спорные суммы.',
    href: '/platform-v7/buyer',
    nextStep: 'Открыть закупку или проблемную сделку.',
    stage: 'pilot',
  },
  {
    role: 'operator',
    title: 'Оператор платформы',
    subtitle: 'Очереди, блокеры, деньги под риском, ручные эскалации.',
    href: '/platform-v7/control-tower',
    nextStep: 'Перейти в центр управления.',
    stage: 'pilot',
  },
  {
    role: 'logistics',
    title: 'Логистика / перевозка',
    subtitle: 'Рейсы, окна, ETA, отклонения, полевые события.',
    href: '/platform-v7/logistics',
    nextStep: 'Открыть диспетчерскую и активные рейсы.',
    stage: 'pilot',
  },
  {
    role: 'driver',
    title: 'Водитель',
    subtitle: 'Мобильный контур: маршрут, прибытие, инцидент, работа без связи.',
    href: '/platform-v7/driver',
    nextStep: 'Открыть текущий рейс.',
    stage: 'role-sim',
  },
  {
    role: 'surveyor',
    title: 'Сюрвейер / инспектор',
    subtitle: 'Назначения, акт осмотра, фотофиксация, доказательственный пакет.',
    href: '/platform-v7/surveyor',
    nextStep: 'Открыть назначенный кейс.',
    stage: 'role-sim',
  },
  {
    role: 'elevator',
    title: 'Элеватор / приёмка',
    subtitle: 'Окна, вес, разгрузка, акты и события площадки.',
    href: '/platform-v7/elevator',
    nextStep: 'Открыть очередь приёмки.',
    stage: 'role-sim',
  },
  {
    role: 'lab',
    title: 'Лаборатория',
    subtitle: 'Пробы, протоколы, допуски и качественная дельта.',
    href: '/platform-v7/lab',
    nextStep: 'Открыть новые образцы.',
    stage: 'role-sim',
  },
  {
    role: 'bank',
    title: 'Банк / финпартнёр',
    subtitle: 'Резерв, удержание, выпуск, возврат и ручная проверка.',
    href: '/platform-v7/bank',
    nextStep: 'Открыть денежный контур.',
    stage: 'sandbox',
  },
  {
    role: 'arbitrator',
    title: 'Арбитр / споры',
    subtitle: 'Комнаты разбора, пакет доказательств, решение и денежный эффект.',
    href: '/platform-v7/arbitrator',
    nextStep: 'Открыть активные споры.',
    stage: 'role-sim',
  },
  {
    role: 'compliance',
    title: 'Комплаенс / допуск',
    subtitle: 'KYC, реквизиты, аудит действий и стоп-флаги.',
    href: '/platform-v7/compliance',
    nextStep: 'Открыть журнал и очередь допуска.',
    stage: 'sandbox',
  },
  {
    role: 'executive',
    title: 'Руководитель / наблюдатель',
    subtitle: 'Сводка по обороту, спорности, SLA и зрелости контуров.',
    href: '/platform-v7/executive',
    nextStep: 'Открыть сводную панель.',
    stage: 'role-sim',
  },
];

function stageBadge(stage: 'sandbox' | 'pilot' | 'role-sim') {
  if (stage === 'pilot') return { label: 'Пилотный режим', bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (stage === 'sandbox') return { label: 'Тестовая среда', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { label: 'Демо-данные', bg: '#F5F7F8', border: '#E4E6EA', color: '#475569' };
}

export function PlatformRolesHub() {
  const { setRole } = usePlatformV7RStore();

  return (
    <div data-demo="true" style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Выбор роли и рабочего контура</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 900 }}>
              Это канонический вход в платформу. Каждый кабинет помечен честно: «Пилотный режим», «Тестовая среда» или «Демо-данные». Следующий шаг по каждой роли показан сразу.
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', color: '#B45309', fontSize: 12, fontWeight: 800 }}>
            Канонический вход
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {ROLE_CARDS.map((item) => {
          const badge = stageBadge(item.stage);
          const href = `${item.href}?as=${item.role}`;
          return (
            <Link
              key={item.role}
              href={href}
              onClick={() => setRole(item.role)}
              style={{
                textDecoration: 'none',
                textAlign: 'left',
                background: '#fff',
                border: '1px solid #E4E6EA',
                borderRadius: 18,
                padding: 18,
                cursor: 'pointer',
                display: 'grid',
                gap: 12,
                minHeight: 220,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 18, lineHeight: 1.3, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>{badge.label}</span>
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.65 }}>{item.subtitle}</div>
              <div style={{ marginTop: 'auto' }}>
                <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 6 }}>{item.nextStep}</div>
                <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(10,122,95,0.16)', background: 'rgba(10,122,95,0.08)', color: '#0A7A5F', fontSize: 13, fontWeight: 700 }}>Открыть кабинет</div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
