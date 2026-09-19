import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/v7r/BrandMark';
import type { AppLocale } from '@/i18n/locale';
import { StaffShellRuntime } from './StaffShellRuntime';
import styles from './StaffPlatformShell.module.css';

const COPY: Record<AppLocale, {
  internal: string;
  control: string;
  back: string;
  language: string;
  skip: string;
}> = {
  ru: {
    internal: 'Внутренний контур платформы',
    control: 'Управление доступом и операциями',
    back: 'К платформе',
    language: 'Язык интерфейса',
    skip: 'Перейти к управлению',
  },
  en: {
    internal: 'Internal platform control plane',
    control: 'Access and operations management',
    back: 'Back to platform',
    language: 'Interface language',
    skip: 'Skip to management',
  },
  zh: {
    internal: '平台内部控制中心',
    control: '访问与运营管理',
    back: '返回平台',
    language: '界面语言',
    skip: '跳转到管理区',
  },
};

const LOCALES: Array<{ value: AppLocale; label: string }> = [
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
  { value: 'zh', label: 'ZH' },
];

export function StaffPlatformShell({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  const copy = COPY[locale];

  return (
    <div className={styles.shell} data-staff-platform-shell data-locale={locale}>
      <StaffShellRuntime />
      <a className={styles.skip} href="#staff-control-center-content">{copy.skip}</a>
      <header className={styles.header}>
        <Link href="/platform-v7" className={styles.brand} aria-label="Прозрачная Цена">
          <BrandMark size={38} />
          <span>
            <strong>Прозрачная Цена</strong>
            <small>{copy.internal}</small>
          </span>
        </Link>

        <div className={styles.context} aria-hidden="true">
          <i />
          <span>{copy.control}</span>
        </div>

        <div className={styles.actions}>
          <nav className={styles.locales} aria-label={copy.language}>
            {LOCALES.map((item) => (
              <Link
                key={item.value}
                href={`/platform-v7/staff?lang=${item.value}`}
                aria-current={locale === item.value ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/platform-v7" className={styles.back}>{copy.back}</Link>
        </div>
      </header>
      <div id="staff-control-center-content" className={styles.content} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
