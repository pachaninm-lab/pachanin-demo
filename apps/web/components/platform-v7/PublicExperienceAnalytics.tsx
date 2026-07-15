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

function intersects(a: DOMRect, b: DOMRect, gap = 8) {
  return !(
    a.right + gap <= b.left
    || a.left >= b.right + gap
    || a.bottom + gap <= b.top
    || a.top >= b.bottom + gap
  );
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
    let frame: number | undefined;
    const root = document.documentElement;

    const placeSupportControl = () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        const page = document.querySelector<HTMLElement>('.pc-ppe-page');
        const button = document.querySelector<HTMLElement>('.p7-support-chat-button');
        if (!page || !button) {
          root.style.removeProperty('--pc-ppe-support-lift');
          return;
        }

        root.style.setProperty('--pc-ppe-support-lift', '18px');
        const buttonRect = button.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        let lift = 18;
        const targets = page.querySelectorAll<HTMLElement>([
          '.pc-ppe-primary-button',
          '.pc-ppe-secondary-button',
          '.pc-ppe-inline-link',
          '.pc-ppe-perspective-card',
          '.pc-ppe-entry-option',
          '.pc-ppe-stage-track button',
          '.pc-ppe-chip-button',
        ].join(','));

        for (const target of targets) {
          const rect = target.getBoundingClientRect();
          if (rect.bottom <= 0 || rect.top >= viewportHeight || rect.width === 0 || rect.height === 0) continue;
          if (!intersects(buttonRect, rect, 10)) continue;
          lift = Math.max(lift, Math.min(viewportHeight * 0.46, viewportHeight - rect.top + 12));
        }

        root.style.setProperty('--pc-ppe-support-lift', `${Math.ceil(lift)}px`);
      });
    };

    const clear = () => {
      root.removeAttribute('data-pc-ppe-scrolling');
      timer = undefined;
      placeSupportControl();
    };
    const onScroll = () => {
      root.setAttribute('data-pc-ppe-scrolling', 'true');
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(clear, 180);
      placeSupportControl();
    };

    const observer = new MutationObserver(placeSupportControl);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', placeSupportControl, { passive: true });
    window.visualViewport?.addEventListener('resize', placeSupportControl);
    window.visualViewport?.addEventListener('scroll', placeSupportControl);
    placeSupportControl();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', placeSupportControl);
      window.visualViewport?.removeEventListener('resize', placeSupportControl);
      window.visualViewport?.removeEventListener('scroll', placeSupportControl);
      if (timer !== undefined) window.clearTimeout(timer);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      root.style.removeProperty('--pc-ppe-support-lift');
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
