'use client';

import { useEffect, useRef } from 'react';

/** Enhance the existing native header; no second menu or navigation authority. */
export function PublicHeaderInteractions({ locale }: { locale: 'ru' | 'en' | 'zh' }) {
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const header = anchor.current?.closest<HTMLElement>('[data-public-site-header="canonical"]');
    const menu = header?.querySelector<HTMLDetailsElement>('.pc-site-mobile-menu');
    const summary = menu?.querySelector<HTMLElement>('summary');
    if (!header || !menu || !summary) return;
    const panel = menu.querySelector<HTMLElement>('.pc-site-mobile-nav');
    const labels = locale === 'ru' ? ['Открыть меню', 'Закрыть меню'] : locale === 'en' ? ['Open menu', 'Close menu'] : ['打开菜单', '关闭菜单'];
    let returnTarget: HTMLElement = summary;
    let frame = 0;
    const close = (restore: boolean) => {
      menu.open = false;
      if (restore) {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          const target = returnTarget.isConnected && returnTarget.getClientRects().length ? returnTarget : summary;
          target.focus({ preventScroll: true });
        });
      }
    };
    const sync = () => {
      summary.setAttribute('aria-expanded', String(menu.open));
      summary.setAttribute('aria-label', labels[menu.open ? 1 : 0]!);
      summary.setAttribute('title', labels[menu.open ? 1 : 0]!);
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target;
      if (target.closest('.pc-site-menu-close')) { event.preventDefault(); close(true); return; }
      const language = target.closest<HTMLElement>('.pc-site-locale-option[data-active="true"]');
      if (language && !menu.contains(language)) {
        event.preventDefault();
        returnTarget = language;
        if (window.matchMedia('(max-width:980px)').matches) {
          menu.open = true;
          frame = window.requestAnimationFrame(() => panel?.querySelector<HTMLElement>('.pc-site-mobile-locale .pc-site-locale-option:not([data-active="true"])')?.focus());
        } else {
          header.querySelector<HTMLElement>('.pc-site-actions>.pc-site-locale-cluster .pc-site-locale-option:not([data-active="true"])')?.focus();
        }
        return;
      }
      if (target.closest('summary') === summary) returnTarget = summary;
      if (panel?.contains(target) && target.closest('a[href], [data-gekta-chat-entry]')) close(false);
    };
    const onOutside = (event: PointerEvent) => {
      if (menu.open && event.target instanceof Node && !header.contains(event.target)) close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.open) { event.preventDefault(); close(true); }
    };
    const onFocus = (event: FocusEvent) => {
      if (menu.open && event.target instanceof Node && !header.contains(event.target)) close(false);
    };
    const onResize = () => { if (!window.matchMedia('(max-width:980px)').matches) close(false); };
    menu.addEventListener('toggle', sync);
    header.addEventListener('click', onClick);
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocus);
    window.addEventListener('resize', onResize);
    sync();
    return () => {
      window.cancelAnimationFrame(frame);
      menu.removeEventListener('toggle', sync);
      header.removeEventListener('click', onClick);
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocus);
      window.removeEventListener('resize', onResize);
    };
  }, [locale]);
  return <span ref={anchor} hidden data-public-header-interactions='true' />;
}
