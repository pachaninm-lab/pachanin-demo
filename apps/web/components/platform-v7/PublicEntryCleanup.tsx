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
] as const;

const PENDING_ROLE_KEY = 'pc_v7_pending_role';

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
.pc-shell-root-v4[data-public-entry='true'] .entry-brand-mark{background:transparent!important;color:inherit!important;padding:0!important;overflow:visible!important;box-shadow:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand-mark img,
.pc-shell-root-v4[data-public-entry='true'] .entry-brand-mark img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;background:transparent!important}
@media (max-width:640px){
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-header,
.pc-shell-root-v4[data-public-entry='true'] .entry-header{position:sticky!important;top:0!important;height:72px!important;min-height:72px!important;width:100%!important;padding:8px 16px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;background:rgba(255,255,255,.96)!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand,
.pc-shell-root-v4[data-public-entry='true'] .entry-brand{height:44px!important;display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important;max-width:calc(100% - 104px)!important;flex:1 1 auto!important;overflow:visible!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand > span:not(.entry-brand-mark),
.pc-shell-root-v4[data-public-entry='true'] .entry-brand > span:not(.entry-brand-mark){display:block!important;min-width:0!important;max-width:none!important;flex:1 1 auto!important;overflow:visible!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand-mark,
.pc-shell-root-v4[data-public-entry='true'] .entry-brand-mark{width:42px!important;height:42px!important;min-width:42px!important;flex:0 0 42px!important;border-radius:13px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand strong,
.pc-shell-root-v4[data-public-entry='true'] .entry-brand strong{display:block!important;font-size:17px!important;line-height:1!important;letter-spacing:-.035em!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;max-width:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand small,
.pc-shell-root-v4[data-public-entry='true'] .entry-brand small{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-header-actions,
.pc-shell-root-v4[data-public-entry='true'] .entry-header-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:0!important;margin:0!important;flex:0 0 auto!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-login,
.pc-shell-root-v4[data-public-entry='true'] .entry-login{height:44px!important;min-height:44px!important;min-width:88px!important;flex:0 0 auto!important;padding:0 17px!important;border-radius:16px!important;background:#fff!important;color:#071611!important;border:1px solid rgba(7,22,17,.12)!important;box-shadow:0 8px 20px rgba(7,22,17,.06)!important;font-size:15px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-login svg,
.pc-shell-root-v4[data-public-entry='true'] .entry-login svg{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero{min-height:0!important;padding:14px 14px 14px!important;gap:0!important;display:grid!important;grid-template-columns:1fr!important;overflow:visible!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero::before,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero::before{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero-visual,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero-visual{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero-copy,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero-copy{display:grid!important;gap:13px!important;align-self:start!important;max-width:none!important;padding:22px 20px!important;border-radius:28px!important;background:rgba(255,255,255,.88)!important;border:1px solid rgba(7,22,17,.08)!important;box-shadow:0 16px 42px rgba(7,22,17,.07)!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-kicker,
.pc-shell-root-v4[data-public-entry='true'] .entry-kicker{margin-bottom:0!important;padding:7px 11px!important;font-size:10.5px!important;letter-spacing:.05em!important;line-height:1!important;color:#087a3b!important;background:rgba(0,122,47,.08)!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero h1,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero h1{font-size:42px!important;line-height:1.02!important;letter-spacing:-.055em!important;max-width:100%!important;margin:0!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero p,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero p{margin:0!important;font-size:17px!important;line-height:1.38!important;color:#46534e!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero-actions,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero-actions{margin-top:2px!important;display:grid!important;grid-template-columns:1fr!important;gap:9px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-primary-cta,
.pc-shell-root-v4[data-public-entry='true'] .entry-primary-cta{min-height:56px!important;border-radius:18px!important;background:#087a3b!important;color:#fff!important;box-shadow:0 14px 30px rgba(0,122,47,.20)!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-secondary-cta,
.pc-shell-root-v4[data-public-entry='true'] .entry-secondary-cta{min-height:54px!important;border-radius:18px!important;background:#fff!important;color:#087a3b!important;border:1px solid rgba(0,122,47,.20)!important;box-shadow:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-register-cta,
.pc-shell-root-v4[data-public-entry='true'] .entry-register-cta{min-height:46px!important;border-radius:16px!important;background:rgba(0,122,47,.07)!important;color:#087a3b!important;border:1px solid rgba(0,122,47,.14)!important;box-shadow:none!important;font-size:14.5px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-section,
.pc-shell-root-v4[data-public-entry='true'] .entry-section{padding:18px 14px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-section h2,
.pc-shell-root-v4[data-public-entry='true'] .entry-section h2{font-size:32px!important;line-height:1.04!important;letter-spacing:-.052em!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-section-head p,
.pc-shell-root-v4[data-public-entry='true'] .entry-section-head p{font-size:14.5px!important;line-height:1.42!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-control-grid,
.pc-shell-root-v4[data-public-entry='true'] .entry-control-grid{grid-template-columns:1fr!important;gap:12px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-process-row,
.pc-shell-root-v4[data-public-entry='true'] .entry-process-row{display:flex!important;grid-template-columns:none!important;gap:10px!important;overflow-x:auto!important;overflow-y:hidden!important;scroll-snap-type:x mandatory!important;padding:0 2px 8px!important;-webkit-overflow-scrolling:touch!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-process-row::-webkit-scrollbar,
.pc-shell-root-v4[data-public-entry='true'] .entry-process-row::-webkit-scrollbar{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-process-tile,
.pc-shell-root-v4[data-public-entry='true'] .entry-process-tile{flex:0 0 176px!important;min-width:176px!important;min-height:142px!important;text-align:left!important;display:grid!important;justify-items:start!important;align-content:start!important;padding:15px!important;border-radius:21px!important;scroll-snap-align:start!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-process-tile:not(:last-child)::after,
.pc-shell-root-v4[data-public-entry='true'] .entry-process-tile:not(:last-child)::after{display:none!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-role-grid,
.pc-shell-root-v4[data-public-entry='true'] .entry-role-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-role-tile,
.pc-shell-root-v4[data-public-entry='true'] .entry-role-tile{min-height:142px!important;padding:14px!important;border-radius:21px!important;gap:8px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-role-tile strong,
.pc-shell-root-v4[data-public-entry='true'] .entry-role-tile strong{font-size:16px!important;line-height:1.08!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-role-tile span,
.pc-shell-root-v4[data-public-entry='true'] .entry-role-tile span{font-size:12px!important;line-height:1.32!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-trust-strip,
.pc-shell-root-v4[data-public-entry='true'] .entry-trust-strip{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;margin:18px 14px 34px!important;padding:12px!important;border-radius:26px!important;overflow:visible!important;background:rgba(255,255,255,.72)!important;border:1px solid rgba(7,22,17,.08)!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-trust-item,
.pc-shell-root-v4[data-public-entry='true'] .entry-trust-item{display:grid!important;grid-template-columns:auto 1fr!important;gap:6px 12px!important;border:1px solid rgba(7,22,17,.07)!important;border-radius:20px!important;background:#fff!important;padding:15px!important;box-shadow:0 10px 24px rgba(7,22,17,.05)!important;color:#087a3b!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-trust-item span,
.pc-shell-root-v4[data-public-entry='true'] .entry-trust-item span{grid-column:2!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-trust-cta,
.pc-shell-root-v4[data-public-entry='true'] .entry-trust-cta{min-height:54px!important;min-width:0!important;border-radius:18px!important;background:#087a3b!important;color:#fff!important;margin:2px 0 0!important}
}
@media (max-width:374px){
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-header,
.pc-shell-root-v4[data-public-entry='true'] .entry-header{padding:8px 12px!important;gap:8px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand,
.pc-shell-root-v4[data-public-entry='true'] .entry-brand{gap:8px!important;max-width:calc(100% - 96px)!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand-mark,
.pc-shell-root-v4[data-public-entry='true'] .entry-brand-mark{width:38px!important;height:38px!important;min-width:38px!important;flex-basis:38px!important;border-radius:12px!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-brand strong,
.pc-shell-root-v4[data-public-entry='true'] .entry-brand strong{font-size:16px!important;letter-spacing:-.04em!important}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-login,
.pc-shell-root-v4[data-public-entry='true'] .entry-login{min-width:84px!important;height:42px!important;min-height:42px!important;padding:0 14px!important}
}
`;

function roleFromTitle(title: string) {
  return ROLE_BY_TITLE[title.trim() as keyof typeof ROLE_BY_TITLE];
}

function roleLoginHref(title: string) {
  const role = roleFromTitle(title);
  return role ? `/platform-v7/login?role=${role}` : '/platform-v7/login';
}

function persistPendingRole(link: HTMLAnchorElement, role: string) {
  link.dataset.entryRole = role;
  link.addEventListener('click', () => window.sessionStorage?.setItem(PENDING_ROLE_KEY, role), { once: true });
}

function rewritePublicLinks(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="/platform-v7/"]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href === '/platform-v7/login' || href.startsWith('/platform-v7/login?')) return;
    if (href === '/platform-v7/open' || href === '/platform-v7/docs' || href === '/platform-v7/register' || href.startsWith('/platform-v7/register?')) return;
    link.setAttribute('href', '/platform-v7/login');
  });
}

function normalizeRoleCtas(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('.entry-role-tile em').forEach((item) => {
    item.textContent = 'Продолжить вход в этот ЛК';
  });
}

function applyRoleLoginHandoff(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>('.entry-role-tile').forEach((link) => {
    const title = link.querySelector('strong')?.textContent?.trim() || '';
    const role = roleFromTitle(title);
    if (!role) return;
    link.setAttribute('href', roleLoginHref(title));
    link.setAttribute('aria-label', `${title}: перейти ко входу в выбранный кабинет`);
    persistPendingRole(link, role);
  });
}

function appendRole(grid: HTMLElement, title: string, text: string) {
  const item = document.createElement('a');
  item.className = 'entry-role-tile';
  item.setAttribute('href', roleLoginHref(title));

  const titleNode = document.createElement('strong');
  titleNode.textContent = title;
  const textNode = document.createElement('span');
  textNode.textContent = text;
  const ctaNode = document.createElement('em');
  ctaNode.textContent = 'Продолжить вход в этот ЛК';

  item.append(titleNode, textNode, ctaNode);
  grid.appendChild(item);
}

function ensurePublicRoles(root: ParentNode) {
  const grid = root.querySelector<HTMLElement>('.entry-role-grid');
  if (!grid || grid.dataset.fullRoleSet === 'true') return;
  const existing = grid.textContent || '';
  PUBLIC_ROLES.forEach(([title, text]) => {
    if (!existing.includes(title)) appendRole(grid, title, text);
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
        mark.replaceChildren();
        const img = document.createElement('img');
        img.src = BRAND_LOGO_DATA_URI;
        img.alt = '';
        img.draggable = false;
        mark.appendChild(img);
        mark.dataset.brandApplied = 'true';
      }
      ensurePublicRoles(entry);
      applyRoleLoginHandoff(entry);
      rewritePublicLinks(entry);
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
