'use client';

import { ReactNode } from 'react';
import { AppChrome } from './app-chrome';
import { SystemModeBanner } from './system-mode-banner';

export function PageFrame({
  title,
  subtitle,
  kicker = 'Прозрачная Цена · рабочий контур',
  actions,
  breadcrumbs,
  shellMode = 'external',
  children
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  shellMode?: 'external' | 'internal';
  children?: ReactNode;
}) {
  return (
    <>
      <AppChrome />
      <main className="page-frame-section app-page-shell">
        <section className="page-heading-block">
          <div className="page-heading-meta">{kicker}</div>
          <div className="page-heading-row">
            <div className="min-w-0">
              <h1 className="page-heading-title">{title}</h1>
              {subtitle ? <p className="page-heading-subtitle">{subtitle}</p> : null}
            </div>
            {actions ? <div className="page-heading-actions">{actions}</div> : null}
          </div>
          {breadcrumbs ? <div className="page-heading-breadcrumbs">{breadcrumbs}</div> : null}
        </section>
        <SystemModeBanner mode={shellMode} />
        <section className="page-surface">{children}</section>
      </main>
    </>
  );
}
