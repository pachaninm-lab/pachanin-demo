'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/docs']);
const PENDING_ROLE_KEY = 'pc_v7_pending_role';

const roleRegistrationParams: Record<string, string> = {
  'Продавец': 'seller',
  'Покупатель': 'buyer',
  'Логистика': 'logistics',
  'Водитель': 'driver',
  'Элеватор': 'elevator',
  'Банк': 'bank',
  'Лаборатория': 'lab',
  'Сюрвейер': 'surveyor',
  'Арбитр': 'arbitrator',
  'Комплаенс': 'compliance',
  'Оператор': 'operator',
  'Руководитель': 'executive',
};

const roleByTitle: Record<string, string> = {
  'Продавец': 'seller',
  'Покупатель': 'buyer',
  'Логистика': 'logistics',
  'Водитель': 'driver',
  'Элеватор': 'elevator',
  'Банк': 'bank',
  'Лаборатория': 'lab',
  'Сюрвейер': 'surveyor',
  'Арбитр': 'arbitrator',
  'Комплаенс': 'compliance',
  'Оператор': 'operator',
  'Руководитель': 'executive',
};

function normalize(pathname: string | null) {
  if (!pathname) return '';
  return pathname.replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string | null) {
  return PUBLIC_PATHS.has(normalize(pathname));
}

function syncShellChrome(pathname: string | null) {
  const shell = document.querySelector<HTMLElement>('.pc-shell-root-v4');
  if (!shell) return;
  if (isPublicPath(pathname)) {
    shell.dataset.publicEntry = 'true';
    return;
  }
  delete shell.dataset.publicEntry;
}

function persistPendingRole(link: HTMLAnchorElement, role: string) {
  link.dataset.entryRole = role;
  link.onclick = () => window.sessionStorage?.setItem(PENDING_ROLE_KEY, role);
}

function ensureRegistrationEntry(root: ParentNode) {
  const headerActions = root.querySelector<HTMLElement>('.entry-header-actions');
  if (headerActions && !headerActions.querySelector('[data-entry-register="header"]')) {
    const headerLink = document.createElement('a');
    headerLink.href = '/platform-v7/register';
    headerLink.className = 'entry-register';
    headerLink.dataset.entryRegister = 'header';
    headerLink.textContent = 'Регистрация';
    const loginLink = headerActions.querySelector('.entry-login');
    loginLink?.after(headerLink) ?? headerActions.prepend(headerLink);
  }

  const heroActions = root.querySelector<HTMLElement>('.entry-hero-actions');
  if (heroActions) {
    const heroLink = heroActions.querySelector<HTMLAnchorElement>('.entry-text-cta,.entry-register-cta');
    if (heroLink) {
      heroLink.href = '/platform-v7/register';
      heroLink.classList.remove('entry-text-cta');
      heroLink.classList.add('entry-register-cta');
      heroLink.dataset.entryRegister = 'hero';
      heroLink.textContent = 'Зарегистрироваться';
    }
  }

  ensurePublicActionTriplet(root, heroActions);
}

// Три различимых публичных действия: вопрос без обязательств, заявка на
// подключение и регистрация. Раньше публичный вход предлагал только
// регистрацию — посетителю с вопросом некуда было идти, кроме кабинета.
const PUBLIC_ACTIONS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/platform-v7/contact', label: 'Направить обращение' },
  { href: '/platform-v7/request', label: 'Оставить заявку' },
  { href: '/platform-v7/register', label: 'Перейти к регистрации' },
];

function ensurePublicActionTriplet(root: ParentNode, heroActions: HTMLElement | null) {
  if (!heroActions || root.querySelector('[data-entry-actions="triplet"]')) return;
  const row = document.createElement('nav');
  row.className = 'entry-public-actions';
  row.dataset.entryActions = 'triplet';
  row.setAttribute('aria-label', 'Публичные действия');
  for (const action of PUBLIC_ACTIONS) {
    const link = document.createElement('a');
    link.href = action.href;
    link.textContent = action.label;
    link.className = 'entry-public-action';
    row.appendChild(link);
  }
  heroActions.after(row);

  root.querySelectorAll<HTMLAnchorElement>('.entry-role-tile').forEach((tile) => {
    const title = tile.querySelector('strong')?.textContent?.trim();
    const role = title ? (roleRegistrationParams[title] ?? roleByTitle[title]) : undefined;
    if (!role) return;
    tile.href = `/platform-v7/register?role=${role}`;
    tile.dataset.entryRegister = 'role';
    persistPendingRole(tile, role);
    const cta = tile.querySelector('em');
    if (cta) cta.textContent = 'Подать заявку на роль';
  });
}

const css = `
.pc-v7-public-entry .entry-register{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 15px;border-radius:15px;background:rgba(0,122,47,.07);color:#087a3b;border:1px solid rgba(0,122,47,.18);font-size:14px;font-weight:900;text-decoration:none;white-space:nowrap}
.pc-v7-public-entry .entry-register-cta{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:46px!important;border-radius:16px!important;padding:0 18px!important;background:rgba(0,122,47,.07)!important;color:#087a3b!important;border:1px solid rgba(0,122,47,.14)!important;box-shadow:none!important;font-size:14.5px!important;font-weight:900!important;text-align:center!important;text-decoration:none!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-header,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-bottomnav,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-drawer,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-pilot-note,.pc-shell-root-v4[data-public-entry='true'] .pc-v7-role-dock,.pc-shell-root-v4[data-public-entry='true'] .pc-v7-assistant-widget{display:none!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#fbfcf9!important;min-height:100svh!important}
.pc-v7-public-entry .entry-public-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.pc-v7-public-entry .entry-public-action{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:14px;background:#fff;color:#0f2e1f;border:1px solid rgba(7,22,17,.14);font-size:13.5px;font-weight:800;text-decoration:none}
@media(max-width:980px){.pc-v7-public-entry .entry-register{display:none!important}.pc-v7-public-entry .entry-register-cta{width:100%!important;min-width:0!important}.pc-v7-public-entry .entry-public-action{flex:1 1 100%!important}}
`;

export function PublicRegistrationEntryPatch() {
  const pathname = usePathname();

  React.useEffect(() => {
    let cancelled = false;
    function sync() {
      if (cancelled) return;
      syncShellChrome(pathname);
      const root = document.querySelector('.pc-v7-public-entry') as HTMLElement | null;
      if (root) ensureRegistrationEntry(root);
    }
    const raf = window.requestAnimationFrame(sync);
    const timers = [80, 220, 600, 1200].map((delay) => window.setTimeout(sync, delay));
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
