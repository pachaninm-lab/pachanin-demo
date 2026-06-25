'use client';

import * as React from 'react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

const ROLE_BY_TITLE = {
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
} as const;

const PUBLIC_ROLES = [
  ['Водитель', 'Маршрут, прибытие, фото и полевые события.'],
  ['Комплаенс', 'Допуск, полномочия, стоп-факторы и контроль рисков.'],
  ['Оператор', 'Центр управления, блокеры, ответственные и следующий шаг.'],
  ['Руководитель', 'Деньги под риском, статус контура и управленческий срез.'],
];

const cleanupCss = `
.pc-shell-root-v4:has(.pc-v7-public-entry),
.pc-shell-root-v4[data-public-entry='true']{--pc-header-offset:0px!important;background:#fbfcf9!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-header,
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-bottomnav,
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-drawer,
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-pilot-note,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-header,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-bottomnav,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-drawer,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-pilot-note{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-main,
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#fbfcf9!important;min-height:100svh!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v7-public-entry,
.pc-shell-root-v4[data-public-entry='true'] .pc-v7-public-entry{padding-bottom:max(64px,env(safe-area-inset-bottom))!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand-mark,
.pc-shell-root-v4[data-public-entry='true'] .entry-brand-mark{background:transparent!important;color:inherit!important;padding:0!important;overflow:visible!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand-mark img,
.pc-shell-root-v4[data-public-entry='true'] .entry-brand-mark img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;background:transparent!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-register,
.pc-shell-root-v4[data-public-entry='true'] .entry-register{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:44px!important;padding:0 16px!important;border-radius:15px!important;border:1px solid rgba(0,122,47,.2)!important;background:#f3faf5!important;color:#007a2f!important;font-size:14px!important;font-weight:900!important;text-decoration:none!important;white-space:nowrap!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-register-cta,
.pc-shell-root-v4[data-public-entry='true'] .entry-register-cta{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:56px!important;padding:0 22px!important;border-radius:17px!important;border:1px solid rgba(0,122,47,.24)!important;background:#fff!important;color:#007a2f!important;font-size:16px!important;font-weight:900!important;text-decoration:none!important;box-shadow:0 14px 30px rgba(7,22,17,.07)!important}
@media (max-width:640px){
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-header,
.pc-shell-root-v4[data-public-entry='true'] .entry-header{position:sticky!important;top:0!important;min-height:64px!important;padding:10px 12px!important;gap:8px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand small,
.pc-shell-root-v4[data-public-entry='true'] .entry-brand small{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero{min-height:0!important;padding:18px 16px 14px!important;gap:0!important;display:grid!important;grid-template-columns:1fr!important;overflow:visible!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero::before,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero::before{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero-visual,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero-visual{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero-copy,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero-copy{display:grid!important;gap:10px!important;align-self:start!important;max-width:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-kicker,
.pc-shell-root-v4[data-public-entry='true'] .entry-kicker{margin-bottom:0!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero h1,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero h1{font-size:34px!important;line-height:1.02!important;letter-spacing:-.045em!important;max-width:100%!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero p,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero p{margin:0!important;font-size:15px!important;line-height:1.4!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero-actions,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero-actions{margin-top:4px!important;display:grid!important;gap:8px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-register-cta,
.pc-shell-root-v4[data-public-entry='true'] .entry-register-cta{min-height:52px!important;width:100%!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-status-note,
.pc-shell-root-v4[data-public-entry='true'] .entry-status-note{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-control-grid,
.pc-shell-root-v4[data-public-entry='true'] .entry-control-grid{grid-template-columns:1fr!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-process-row,
.pc-shell-root-v4[data-public-entry='true'] .entry-process-row{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;overflow:visible!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-process-tile,
.pc-shell-root-v4[data-public-entry='true'] .entry-process-tile{min-width:0!important;min-height:auto!important;text-align:left!important;display:grid!important;grid-template-columns:auto 1fr!important;justify-items:start!important;align-items:center!important;padding:14px 16px!important;border-radius:20px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-process-tile:not(:last-child)::after,
.pc-shell-root-v4[data-public-entry='true'] .entry-process-tile:not(:last-child)::after{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-process-index,
.pc-shell-root-v4[data-public-entry='true'] .entry-process-index{grid-row:1 / span 2!important;width:28px!important;height:28px!important;display:grid!important;place-items:center!important;border-radius:999px!important;background:rgba(0,122,47,.08)!important;color:#007a2f!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-process-icon,
.pc-shell-root-v4[data-public-entry='true'] .entry-process-icon{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-process-tile strong,
.pc-shell-root-v4[data-public-entry='true'] .entry-process-tile strong{font-size:18px!important;line-height:1.1!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-process-tile small,
.pc-shell-root-v4[data-public-entry='true'] .entry-process-tile small{font-size:13px!important;line-height:1.3!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-role-grid,
.pc-shell-root-v4[data-public-entry='true'] .entry-role-grid{grid-template-columns:1fr!important;gap:12px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-role-tile,
.pc-shell-root-v4[data-public-entry='true'] .entry-role-tile{min-height:auto!important;padding:18px!important;border-radius:22px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-role-tile strong,
.pc-shell-root-v4[data-public-entry='true'] .entry-role-tile strong{font-size:22px!important;line-height:1.05!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-role-tile span,
.pc-shell-root-v4[data-public-entry='true'] .entry-role-tile span{font-size:14px!important;line-height:1.35!important}
}
`;

function roleFromTitle(title: string) {
  return ROLE_BY_TITLE[title.trim() as keyof typeof ROLE_BY_TITLE];
}

function roleLoginHref(title: string) {
  const role = roleFromTitle(title);
  return role ? `/platform-v7/login?role=${role}` : '/platform-v7/login';
}

function rewritePublicLinks(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="/platform-v7/"]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href === '/platform-v7/open' || href === '/platform-v7/register') return;
    if (href === '/platform-v7/login' || href.startsWith('/platform-v7/login?')) return;
    link.setAttribute('href', '/platform-v7/login');
  });
}

function normalizeRoleCtas(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('.entry-role-tile em').forEach((item) => {
    item.textContent = 'Доступ после единого входа';
  });
}

function applyRoleLoginHandoff(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>('.entry-role-tile').forEach((link) => {
    const title = link.querySelector('strong')?.textContent?.trim() || '';
    const role = roleFromTitle(title);
    if (!role) return;
    link.setAttribute('href', roleLoginHref(title));
    link.dataset.entryRole = role;
    link.setAttribute('aria-label', `${title}: перейти к входу в этот кабинет`);
  });
}

function ensurePublicRegistrationEntry(root: ParentNode) {
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
  if (heroActions && !heroActions.querySelector('[data-entry-register="hero"]')) {
    const heroLink = document.createElement('a');
    heroLink.href = '/platform-v7/register';
    heroLink.className = 'entry-register-cta';
    heroLink.dataset.entryRegister = 'hero';
    heroLink.textContent = 'Зарегистрироваться';
    const textLink = heroActions.querySelector('.entry-text-cta');
    textLink?.before(heroLink) ?? heroActions.appendChild(heroLink);
  }
}

function ensurePublicRoles(root: ParentNode) {
  const grid = root.querySelector<HTMLElement>('.entry-role-grid');
  if (!grid || grid.dataset.fullRoleSet === 'true') return;
  const existing = grid.textContent || '';
  PUBLIC_ROLES.forEach(([title, text]) => {
    if (existing.includes(title)) return;
    const item = document.createElement('a');
    item.className = 'entry-role-tile';
    item.setAttribute('href', roleLoginHref(title));
    item.innerHTML = `<strong>${title}</strong><span>${text}</span><em>Доступ после единого входа</em>`;
    grid.appendChild(item);
  });
  grid.dataset.fullRoleSet = 'true';
}

export function PublicEntryCleanup() {
  React.useEffect(() => {
    let cancelled = false;
    function sync() {
      if (cancelled) return;
      const entry = document.querySelector('.pc-v7-public-entry,[data-testid="platform-v7-open-walkthrough"]') as HTMLElement | null;
      const shell = entry?.closest('.pc-shell-root-v4') as HTMLElement | null;
      document.querySelectorAll<HTMLElement>('.pc-shell-root-v4[data-public-entry]').forEach((item) => {
        if (item !== shell) delete item.dataset.publicEntry;
      });
      if (!shell || !entry) return;
      shell.dataset.publicEntry = 'true';
      const mark = entry.querySelector<HTMLElement>('.entry-brand-mark');
      if (mark && mark.dataset.brandApplied !== 'true') {
        mark.innerHTML = '';
        const img = document.createElement('img');
        img.src = BRAND_LOGO_DATA_URI;
        img.alt = '';
        img.draggable = false;
        mark.appendChild(img);
        mark.dataset.brandApplied = 'true';
      }
      ensurePublicRegistrationEntry(entry);
      rewritePublicLinks(entry);
      ensurePublicRoles(entry);
      applyRoleLoginHandoff(entry);
      normalizeRoleCtas(entry);
    }

    const raf = window.requestAnimationFrame(sync);
    const timers = [80, 220, 600].map((delay) => window.setTimeout(sync, delay));
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: cleanupCss }} />;
}
