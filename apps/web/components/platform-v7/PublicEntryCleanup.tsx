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
`;

function rewritePublicLinks(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="/platform-v7/"]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href === '/platform-v7/login' || href === '/platform-v7/open' || href === '/platform-v7/register') return;
    link.setAttribute('href', '/platform-v7/login');
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
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: cleanupCss }} />;
}
