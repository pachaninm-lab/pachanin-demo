'use client';

import { useEffect, type MouseEvent, type ReactNode } from 'react';

function viewportGroup() {
  if (typeof window === 'undefined') return 'server';
  if (window.innerWidth < 720) return 'mobile';
  if (window.innerWidth < 1100) return 'tablet';
  return 'desktop';
}

function emit(name: string, locale: string, params: Record<string, string> = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
    detail: { name, locale, viewport_group: viewportGroup(), ...params },
  }));
}

export function PublicExperiencePageView({ locale, name }: { locale: string; name: 'home_view' | 'deal_xray_open' }) {
  useEffect(() => emit(name, locale), [locale, name]);
  return null;
}

export function PublicExperienceLink({
  href,
  className,
  eventName,
  locale,
  params,
  children,
}: {
  href: string;
  className?: string;
  eventName: string;
  locale: string;
  params?: Record<string, string>;
  children: ReactNode;
}) {
  const onClick = (_event: MouseEvent<HTMLAnchorElement>) => emit(eventName, locale, params);
  return <a href={href} className={className} onClick={onClick}>{children}</a>;
}
