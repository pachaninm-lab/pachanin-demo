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
    const discard = locale === 'ru'
      ? 'При смене языка введённые данные будут очищены. Продолжить? Нажмите «Отмена», чтобы остаться в заполненной форме.'
      : locale === 'en'
        ? 'Changing language clears the entries in this form. Continue? Choose Cancel to keep the completed form.'
        : '切换语言会清空已填写的内容。是否继续？选择取消可保留当前表单。';
    // Remember only whether the form changed, never values or credentials.
    // ContactClient already guards its document navigation with beforeunload.
    const dirtyForms = new WeakSet<HTMLFormElement>();
    const formRoute = () => ['/platform-v7/register', '/platform-v7/login'].includes(window.location.pathname.replace(/\/$/, ''));
    const changed = (event: Event) => {
      const control = event.target;
      if (!formRoute() || !(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) return;
      if (control instanceof HTMLInputElement && ['hidden', 'button', 'submit', 'reset'].includes(control.type)) return;
      if (control.form) dirtyForms.add(control.form);
    };
    const reset = (event: Event) => {
      const form = event.target;
      if (form instanceof HTMLFormElement) queueMicrotask(() => { if (!event.defaultPrevented) dirtyForms.delete(form); });
    };
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
      const language = target.closest<HTMLAnchorElement>('a.pc-site-locale-option');
      if (language?.dataset.active === 'true') {
        event.preventDefault();
        returnTarget = language;
        if (menu.contains(language) || window.matchMedia('(max-width:980px)').matches) {
          menu.open = true;
          window.cancelAnimationFrame(frame);
          frame = window.requestAnimationFrame(() => panel?.querySelector<HTMLElement>('.pc-site-mobile-locale .pc-site-locale-option:not([data-active="true"])')?.focus());
        } else {
          header.querySelector<HTMLElement>('.pc-site-actions>.pc-site-locale-cluster .pc-site-locale-option:not([data-active="true"])')?.focus();
        }
        return;
      }
      if (language && formRoute() && Array.from(document.forms).some((form) => dirtyForms.has(form))) {
        if (!window.confirm(discard)) { event.preventDefault(); return; }
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
    document.addEventListener('input', changed);
    document.addEventListener('change', changed);
    document.addEventListener('reset', reset);
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocus);
    window.addEventListener('resize', onResize);
    sync();
    return () => {
      window.cancelAnimationFrame(frame);
      menu.removeEventListener('toggle', sync);
      header.removeEventListener('click', onClick);
      document.removeEventListener('input', changed);
      document.removeEventListener('change', changed);
      document.removeEventListener('reset', reset);
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocus);
      window.removeEventListener('resize', onResize);
    };
  }, [locale]);
  // Recovery pages render the same header without a mobile menu. Keep their
  // unsaved-form navigation guard independent of menu enhancement.
  useEffect(() => {
    if (window.location.pathname.replace(/\/$/, '') !== '/platform-v7/forgot-password') return;
    const form = document.querySelector<HTMLFormElement>('.pc-recovery-page form.pc-recovery-card');
    if (!form) return;
    let dirty = false;
    let confirmedNavigation = false;
    const hasUnsavedEntry = () => dirty && form.isConnected;
    const onEntry = (event: Event) => {
      if (event.target instanceof HTMLInputElement && event.target.form === form) dirty = true;
    };
    const onClick = (event: MouseEvent) => {
      if (!hasUnsavedEntry() || event.defaultPrevented || event.button !== 0
        || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey
        || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const destination = new URL(link.href);
      if (destination.href === window.location.href
        || (destination.pathname === window.location.pathname && destination.search === window.location.search)) return;
      const lang = document.documentElement.lang.toLowerCase();
      const warning = lang.startsWith('zh')
        ? '离开此页面将丢失已填写的内容。是否继续？'
        : lang.startsWith('en')
          ? 'Leaving this page will clear your entries. Continue?'
          : 'При переходе введённые данные будут потеряны. Продолжить?';
      if (!window.confirm(warning)) { event.preventDefault(); return; }
      confirmedNavigation = true;
      window.setTimeout(() => { confirmedNavigation = false; }, 0);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedEntry() || confirmedNavigation) return;
      event.preventDefault();
      event.returnValue = '';
    };
    document.addEventListener('input', onEntry, true);
    document.addEventListener('change', onEntry, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('input', onEntry, true);
      document.removeEventListener('change', onEntry, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);
  return <span ref={anchor} hidden data-public-header-interactions='true' />;
}
