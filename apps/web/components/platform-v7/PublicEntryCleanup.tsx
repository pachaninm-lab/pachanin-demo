'use client';

import * as React from 'react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

const PUBLIC_ROLES = [
  ['Водитель', 'Маршрут, прибытие, фото и полевые события.'],
  ['Комплаенс', 'Допуск, полномочия, стоп-факторы и контроль рисков.'],
  ['Оператор', 'Центр управления, блокеры, ответственные и следующий шаг.'],
  ['Руководитель', 'Деньги под риском, статус контура и управленческий срез.'],
];

const cleanupCss = `
.pc-shell-root-v4[data-public-entry='true']{--pc-header-offset:0px!important;background:#fbfcf9!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-header,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-bottomnav,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-drawer,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-pilot-note{display:none!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#fbfcf9!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v7-public-entry{padding-bottom:max(64px,env(safe-area-inset-bottom))!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-brand-mark{background:transparent!important;color:inherit!important;padding:0!important;overflow:visible!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-brand-mark img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;background:transparent!important}
@media (max-width:640px){
.pc-shell-root-v4[data-public-entry='true'] .entry-hero-visual{display:none!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-control-grid{grid-template-columns:1fr!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-process-row{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;overflow:visible!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-process-tile{min-width:0!important;min-height:auto!important;text-align:left!important;display:grid!important;grid-template-columns:auto 1fr!important;justify-items:start!important;align-items:center!important;padding:14px 16px!important;border-radius:20px!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-process-tile:not(:last-child)::after{display:none!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-process-index{grid-row:1 / span 2!important;width:28px!important;height:28px!important;display:grid!important;place-items:center!important;border-radius:999px!important;background:rgba(0,122,47,.08)!important;color:#007a2f!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-process-icon{display:none!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-process-tile strong{font-size:18px!important;line-height:1.1!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-process-tile small{font-size:13px!important;line-height:1.3!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-role-grid{grid-template-columns:1fr!important;gap:12px!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-role-tile{min-height:auto!important;padding:18px!important;border-radius:22px!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-role-tile strong{font-size:22px!important;line-height:1.05!important}
.pc-shell-root-v4[data-public-entry='true'] .entry-role-tile span{font-size:14px!important;line-height:1.35!important}
}
`;

function rewritePublicLinks(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="/platform-v7/"]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href === '/platform-v7/login' || href === '/platform-v7/open' || href === '/platform-v7/register') return;
    link.setAttribute('href', '/platform-v7/login');
  });
}

function normalizeRoleCtas(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('.entry-role-tile em').forEach((item) => {
    item.textContent = 'Доступ после единого входа';
  });
}

function ensurePublicRoles(root: ParentNode) {
  const grid = root.querySelector<HTMLElement>('.entry-role-grid');
  if (!grid || grid.dataset.fullRoleSet === 'true') return;
  const existing = grid.textContent || '';
  PUBLIC_ROLES.forEach(([title, text]) => {
    if (existing.includes(title)) return;
    const item = document.createElement('a');
    item.className = 'entry-role-tile';
    item.setAttribute('href', '/platform-v7/login');
    item.innerHTML = `<strong>${title}</strong><span>${text}</span><em>Доступ после единого входа</em>`;
    grid.appendChild(item);
  });
  grid.dataset.fullRoleSet = 'true';
}

export function PublicEntryCleanup() {
  React.useEffect(() => {
    function sync() {
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
      rewritePublicLinks(entry);
      ensurePublicRoles(entry);
      normalizeRoleCtas(entry);
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: cleanupCss }} />;
}
