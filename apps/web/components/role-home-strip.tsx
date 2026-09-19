'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../lib/api';
import { toSurfaceRole } from '../../../shared/role-contract';

const ROLE_TO_RUNTIME: Record<string, string> = {
  FARMER: 'seller',
  BUYER: 'buyer',
  LOGISTICIAN: 'logistics',
  DRIVER: 'driver',
  LAB: 'lab',
  ELEVATOR: 'receiving',
  ACCOUNTING: 'finance',
  EXECUTIVE: 'executive',
  SUPPORT_MANAGER: 'ops',
  ADMIN: 'admin'
};

type Me = { role?: string; surfaceRole?: string; fullName?: string; orgName?: string };
type CabinetPayload = {
  summary?: { primaryCta?: string; queueCount?: number; blockerCount?: number; unreadCount?: number };
  widgets?: { queue?: any[]; alerts?: any[]; supportTickets?: any[]; quickActions?: any[]; documents?: any[] };
};

type QuickSet = {
  title: string;
  subtitle: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string }[];
};

const quickByRole: Record<string, QuickSet> = {
  GUEST: {
    title: 'Вход в продукт',
    subtitle: 'Сначала выбери роль, войди в систему и только потом открывай свой рабочий контур. Гостю не нужны внутренние панели и pilot-runtime экраны.',
    primary: { href: '/login', label: 'Войти' },
    secondary: [{ href: '/register', label: 'Регистрация' }, { href: '/cabinet', label: 'Роли и кабинеты' }]
  },
  FARMER: {
    title: 'Контур продавца',
    subtitle: 'Выставить партию, выбрать лучший режим продажи и довести сделку до денег без лишних переходов.',
    primary: { href: '/lots/create', label: 'Создать лот' },
    secondary: [{ href: '/lots', label: 'Мои лоты' }, { href: '/documents', label: 'Документы' }, { href: '/payments', label: 'Платежи' }]
  },
  BUYER: {
    title: 'Контур покупателя',
    subtitle: 'Найти подходящую партию, зафиксировать условия и быстро перейти к исполнению сделки.',
    primary: { href: '/lots', label: 'Открыть витрину лотов' },
    secondary: [{ href: '/purchase-requests', label: 'RFQ' }, { href: '/deals', label: 'Сделки' }, { href: '/payments', label: 'Платежи' }]
  },
  LOGISTICIAN: {
    title: 'Контур логиста',
    subtitle: 'Рейсы, окна приёмки и инциденты — только то, что влияет на исполнение.',
    primary: { href: '/dispatch', label: 'Открыть рейсы' },
    secondary: [{ href: '/logistics', label: 'Логистика' }, { href: '/railway', label: 'ЖД' }, { href: '/support', label: 'Инциденты' }]
  },
  DRIVER: {
    title: 'Контур водителя',
    subtitle: 'Принять рейс, пройти по шагам, загрузить подтверждения и завершить этап.',
    primary: { href: '/driver-mobile', label: 'Открыть мой рейс' },
    secondary: [{ href: '/support', label: 'Поддержка' }]
  },
  LAB: {
    title: 'Контур лаборатории',
    subtitle: 'Очередь проб, повторный анализ, протокол и связанный спор в одном месте.',
    primary: { href: '/lab', label: 'Открыть лабораторию' },
    secondary: [{ href: '/documents', label: 'Протоколы' }, { href: '/disputes', label: 'Споры' }]
  },
  ELEVATOR: {
    title: 'Контур приёмки',
    subtitle: 'Очередь машин, взвешивание, лаборатория и решение по поставке без лишних экранов.',
    primary: { href: '/receiving', label: 'Открыть приёмку' },
    secondary: [{ href: '/documents', label: 'Документы' }, { href: '/support', label: 'Инциденты' }]
  },
  ACCOUNTING: {
    title: 'Контур бухгалтерии',
    subtitle: 'Платежи, worksheet, сверка и экспорт без общего продуктового шума.',
    primary: { href: '/payments', label: 'Открыть платежи' },
    secondary: [{ href: '/export-1c', label: '1С / экспорт' }, { href: '/documents', label: 'Документы' }]
  },
  EXECUTIVE: {
    title: 'Контур руководителя',
    subtitle: 'Только canonical KPI, блокеры и действия по сделкам, деньгам, допуску и спорам — без internal/demo шума.',
    primary: { href: '/cabinet/executive', label: 'Открыть кабинет руководителя' },
    secondary: [{ href: '/deals', label: 'Сделки' }, { href: '/payments', label: 'Платежи' }, { href: '/disputes', label: 'Споры' }]
  },
  SUPPORT_MANAGER: {
    title: 'Контур оператора',
    subtitle: 'Одна очередь по деньгам, блокерам, спорам и эскалациям без распыления по модулям.',
    primary: { href: '/operator-cockpit', label: 'Открыть центр оператора' },
    secondary: [{ href: '/onboarding', label: 'Допуск' }, { href: '/disputes', label: 'Споры' }, { href: '/support', label: 'Поддержка' }]
  },
  ADMIN: {
    title: 'Контур администратора',
    subtitle: 'Контроль системы, интеграции и аудит — без лишних клиентских экранов.',
    primary: { href: '/operator-cockpit', label: 'Открыть центр контроля' },
    secondary: [{ href: '/anti-fraud', label: 'Риск и антиобход' }, { href: '/connectors', label: 'Интеграции' }, { href: '/audit', label: 'Аудит' }]
  }
};

export function RoleHomeStrip() {
  const [me, setMe] = useState<Me | null>(null);
  const [cabinet, setCabinet] = useState<CabinetPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<Me>('/auth/me', { retryOn401: false })
      .then(async (payload) => {
        if (cancelled) return;
        setMe(payload);
        const roleId = ROLE_TO_RUNTIME[toSurfaceRole(payload?.surfaceRole || payload?.role || 'GUEST')];
        if (!roleId) return;
        try {
          const cabinetPayload = await fetchJson<CabinetPayload>(`/role-homes/${roleId}`, { retryOn401: false });
          if (!cancelled) setCabinet(cabinetPayload);
        } catch {
          if (!cancelled) setCabinet(null);
        }
      })
      .catch(() => setMe(null));
    return () => { cancelled = true; };
  }, []);

  const quick = useMemo(() => quickByRole[toSurfaceRole(me?.surfaceRole || me?.role || 'GUEST')] || quickByRole.GUEST, [me?.role, me?.surfaceRole]);
  const queueCount = Number(cabinet?.summary?.queueCount || cabinet?.widgets?.queue?.length || 0);
  const blockerCount = Number(cabinet?.summary?.blockerCount || cabinet?.widgets?.alerts?.length || 0);
  const supportCount = Number(cabinet?.widgets?.supportTickets?.length || 0);
  const documentCount = Number(cabinet?.widgets?.documents?.length || 0);
  const topQueue = cabinet?.widgets?.queue?.[0];

  return (
    <section className="detail-header detail-hero-grid">
      <div className="min-w-0">
        <div className="eyebrow">Role-first canonical entry</div>
        <div className="detail-title">{quick.title}</div>
        <div className="page-subtitle" style={{ marginTop: 8, maxWidth: 760 }}>{quick.subtitle}</div>
        <div className="cta-stack" style={{ marginTop: 18 }}>
          <Link href={quick.primary.href} className="primary-link">{quick.primary.label}</Link>
          {quick.secondary.map((item) => (
            <Link key={item.href} href={item.href} className="secondary-link">{item.label}</Link>
          ))}
        </div>
      </div>
      <div className="aside-stack min-w-[280px]">
        <div className="info-card card-accent">
          <div className="label">Следующее действие</div>
          <div className="value">{topQueue?.title || topQueue?.label || topQueue?.code || cabinet?.summary?.primaryCta || 'Открой кабинет роли и начни с главного действия.'}</div>
          <div className="text-xs mt-2" style={{ color: 'var(--text-soft)' }}>{me?.fullName || 'Пользователь'} · {toSurfaceRole(me?.surfaceRole || me?.role || 'GUEST')}{me?.orgName ? ` · ${me.orgName}` : ''}</div>
        </div>
        <div className="role-kpi-grid">
          <div className="info-card"><div className="label">очередь</div><div className="value">{queueCount}</div></div>
          <div className="info-card"><div className="label">блокеры</div><div className="value">{blockerCount}</div></div>
          <div className="info-card"><div className="label">support</div><div className="value">{supportCount}</div></div>
          <div className="info-card"><div className="label">документы</div><div className="value">{documentCount}</div></div>
        </div>
      </div>
    </section>
  );
}
