'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { applyCsrfHeader } from '@/lib/csrf';
import styles from './OrganizationAccessShell.module.css';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: { brand: 'Прозрачная Цена', nav: 'Кабинет организации', profile: 'Профиль', team: 'Команда', notifications: 'Уведомления', onboarding: 'Онбординг', status: 'Статус', logout: 'Выйти', loggingOut: 'Выходим…' },
  en: { brand: 'Transparent Price', nav: 'Organization cabinet', profile: 'Profile', team: 'Team', notifications: 'Notifications', onboarding: 'Onboarding', status: 'Status', logout: 'Log out', loggingOut: 'Logging out…' },
  zh: { brand: '透明价格', nav: '组织工作空间', profile: '档案', team: '团队', notifications: '通知', onboarding: '入驻', status: '状态', logout: '退出', loggingOut: '正在退出…' },
} as const;

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export function OrganizationAccessShell({ children, locale }: { children: ReactNode; locale: string }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const copy = COPY[localeOf(locale)];

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: applyCsrfHeader(),
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } finally {
      document.cookie = 'pc-role=; Max-Age=0; Path=/; SameSite=Lax';
      window.location.assign('/platform-v7/login?logout=1');
    }
  };

  return (
    <div className={styles.shell} data-testid='organization-access-shell'>
      <header className={styles.header}>
        <Link className={styles.brand} href='/platform-v7/profile'>{copy.brand}</Link>
        <nav className={styles.nav} aria-label={copy.nav}>
          <Link href='/platform-v7/profile'>{copy.profile}</Link>
          <Link href='/platform-v7/profile/team'>{copy.team}</Link>
          <Link href='/platform-v7/notifications'>{copy.notifications}</Link>
          <Link href='/platform-v7/onboarding'>{copy.onboarding}</Link>
          <Link href='/platform-v7/status'>{copy.status}</Link>
        </nav>
        <button type='button' onClick={() => void logout()} disabled={loggingOut} aria-busy={loggingOut}>
          {loggingOut ? copy.loggingOut : copy.logout}
        </button>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
