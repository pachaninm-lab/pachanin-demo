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

function canonicalFunnelName(detail: Record<string, unknown>) {
  const name = typeof detail.name === 'string' ? detail.name : '';
  if (name === 'deal_xray_open' || name === 'home_primary_cta_click') return 'deal_preview_opened';
  if (name === 'perspective_selected') return 'role_selected';
  if (name === 'entry_variant_selected' && detail.entry_variant === 'role') return 'role_selected';
  if (name === 'scenario_selected' || name === 'guided_tour_started') return 'scenario_started';
  if (name === 'guided_tour_completed') return 'scenario_completed';
  if (name === 'connect_cta_click' || name === 'home_connect_click') return 'organization_connect_started';
  return null;
}

type PublicExperienceLinkProps = Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'role' | 'aria-label'> & {
  eventName: string;
  locale: string;
  params?: Record<string, string>;
  children: ReactNode;
};

export function PublicExperiencePageView({ locale, name }: { locale: string; name: 'home_view' | 'deal_xray_open' }) {
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

  useEffect(() => {
    const bridge = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === 'object'
        ? event.detail as Record<string, unknown>
        : {};
      const canonicalName = canonicalFunnelName(detail);
      if (!canonicalName) return;
      window.dispatchEvent(new CustomEvent('pc:public-product-funnel', {
        detail: { ...detail, name: canonicalName, source_event: detail.name },
      }));
    };

    window.addEventListener('pc:public-product-analytics', bridge);
    return () => window.removeEventListener('pc:public-product-analytics', bridge);
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
