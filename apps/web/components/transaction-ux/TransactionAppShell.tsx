'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { AppFrame } from '@pc/design-system-v8';
import { BrandMark } from '@/components/v7r/BrandMark';
import {
  PLATFORM_V7_ROLE_NAVIGATION,
  platformV7RoleRoute,
} from '@/lib/platform-v7/shellRoutes';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import styles from './TransactionAppShell.module.css';

const ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логистика',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
  executive: 'Руководитель',
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TransactionAppShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: PlatformRole;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const navigation = PLATFORM_V7_ROLE_NAVIGATION[role];
  const roleHome = platformV7RoleRoute(role);

  React.useEffect(() => {
    const stored = window.localStorage.getItem('pc-theme');
    const nextTheme = stored === 'dark' ? 'dark' : 'light';
    setTheme(nextTheme);
    window.localStorage.setItem('pc-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  }, []);

  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const toggleTheme = React.useCallback(() => {
    setTheme((current) => {
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('pc-theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      return nextTheme;
    });
  }, []);

  const drawerItems = navigation.command;
  const mobileItems = navigation.bottom.slice(0, 5);

  const header = (
    <div className={styles.headerInner}>
      <button
        type='button'
        className={styles.iconButton}
        onClick={() => setDrawerOpen(true)}
        aria-label='Открыть все разделы'
        aria-expanded={drawerOpen}
      >
        <Menu aria-hidden='true' size={20} />
      </button>
      <Link href={roleHome} className={styles.brand} aria-label='Прозрачная Цена — в кабинет'>
        <BrandMark size={38} />
        <span className={styles.brandCopy}>
          <strong>Прозрачная Цена</strong>
          <small>{ROLE_LABELS[role]} · исполнение сделки</small>
        </span>
      </Link>
      <div className={`${styles.actions} pc-v4-actions`} data-pc-header-actions>
        <button
          type='button'
          className={styles.iconButton}
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        >
          {theme === 'dark' ? <Sun aria-hidden='true' size={19} /> : <Moon aria-hidden='true' size={19} />}
        </button>
      </div>
    </div>
  );

  const drawer = (
    <div className={styles.drawerContent}>
      <div className={styles.drawerHeader}>
        <Link href={roleHome} className={styles.brand} aria-label='В кабинет'>
          <BrandMark size={38} />
          <span className={styles.brandCopy}>
            <strong>Прозрачная Цена</strong>
            <small>{ROLE_LABELS[role]}</small>
          </span>
        </Link>
        <button type='button' className={styles.iconButton} onClick={() => setDrawerOpen(false)} aria-label='Закрыть меню'>
          <X aria-hidden='true' size={20} />
        </button>
      </div>
      <nav className={styles.drawerNavigation} aria-label='Все разделы кабинета'>
        {drawerItems.map((item) => (
          <Link
            key={`${item.href}:${item.label}`}
            href={item.href}
            className={styles.drawerLink}
            data-active={isActive(pathname, item.href) ? 'true' : 'false'}
          >
            <strong>{item.label}</strong>
            {item.note ? <small>{item.note}</small> : null}
          </Link>
        ))}
      </nav>
    </div>
  );

  const mobileNavigation = (
    <div className={styles.mobileNavigationInner}>
      {mobileItems.map((item) => (
        <Link
          key={`${item.href}:${item.label}`}
          href={item.href}
          className={styles.mobileLink}
          data-active={isActive(pathname, item.href) ? 'true' : 'false'}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );

  return (
    <div className={`${styles.root} pc-shell-root-v8`}>
      <a className={styles.skipLink} href='#main-content'>К основному содержанию</a>
      {drawerOpen ? (
        <button
          type='button'
          className={styles.backdrop}
          onClick={() => setDrawerOpen(false)}
          aria-label='Закрыть меню'
        />
      ) : null}
      <AppFrame
        header={header}
        navigation={drawer}
        mobileNavigation={mobileNavigation}
        drawerOpen={drawerOpen}
      >
        {children}
      </AppFrame>
    </div>
  );
}
