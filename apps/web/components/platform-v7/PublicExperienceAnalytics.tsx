'use client';

import { useEffect, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

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

type PublicExperienceLinkProps = Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'role' | 'aria-label'> & {
  eventName: string;
  locale: string;
  params?: Record<string, string>;
  children: ReactNode;
};

type PublicExperiencePageViewName = 'home_view' | 'home_v3_view' | 'deal_xray_open' | 'ai_in_action_opened';

export function PublicExperiencePageView({ locale, name }: { locale: string; name: PublicExperiencePageViewName }) {
  useEffect(() => emit(name, locale), [locale, name]);
  return null;
}

export function PublicExperienceScrollCoordinator() {
  useEffect(() => {
    let timer: number | undefined;
    const root = document.documentElement;
    const clear = () => {
      root.removeAttribute('data-pc-ppe-scrolling');
      timer = undefined;
    };
    const onScroll = () => {
      root.setAttribute('data-pc-ppe-scrolling', 'true');
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(clear, 180);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer !== undefined) window.clearTimeout(timer);
      clear();
    };
  }, []);

  return null;
}

export function PublicExperienceLink({
  href,
  className,
  role,
  'aria-label': ariaLabel,
  eventName,
  locale,
  params,
  children,
}: PublicExperienceLinkProps) {
  const onClick = (_event: MouseEvent<HTMLAnchorElement>) => emit(eventName, locale, params);
  return <a href={href} className={className} role={role} aria-label={ariaLabel} onClick={onClick}>{children}</a>;
}
