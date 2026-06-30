'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/request', '/platform-v7/docs']);
const PENDING_ROLE_KEY = 'pc_v7_pending_role';

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

function ensureRequestEntry(root: ParentNode) {
  if (root.querySelector('[data-entry-request="strip"]')) return;
  const hero = root.querySelector<HTMLElement>('.entry-hero');
  if (!hero) return;

  const strip = document.createElement('section');
  strip.className = 'entry-request-strip';
  strip.dataset.entryRequest = 'strip';
  strip.setAttribute('aria-label', 'Заявка на демонстрацию и пилот');
  strip.innerHTML = `
    <div class="entry-request-strip-copy">
      <strong>Заявка на демонстрацию или пилот</strong>
      <span>Отдельный канал для демонстрации, пилотного проекта, банка, региона или подключения организации.</span>
    </div>
    <a class="entry-request-strip-button" href="/platform-v7/request">Оставить заявку</a>
  `;
  hero.after(strip);
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

  root.querySelectorAll<HTMLAnchorElement>('.entry-role-tile').forEach((tile) => {
    const title = tile.querySelector('strong')?.textContent?.trim();
    const role = title ? roleByTitle[title] : undefined;
    if (!role) return;
    tile.href = `/platform-v7/login?role=${role}`;
    tile.dataset.entryRegister = 'role-login';
    persistPendingRole(tile, role);
    const cta = tile.querySelector('em');
    if (cta) cta.textContent = 'Продолжить вход в этот ЛК';
  });

  ensureRequestEntry(root);
}

const css = `
.pc-v7-public-entry .entry-register{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 15px;border-radius:15px;background:rgba(0,122,47,.07);color:#087a3b;border:1px solid rgba(0,122,47,.18);font-size:14px;font-weight:900;text-decoration:none;white-space:nowrap}
.pc-v7-public-entry .entry-request-strip{max-width:1180px;margin:-18px auto 28px;padding:14px 16px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.92);box-shadow:0 14px 34px rgba(7,22,17,.065)}
.pc-v7-public-entry .entry-request-strip-copy{display:grid;gap:4px;min-width:0}.pc-v7-public-entry .entry-request-strip-copy strong{font-size:18px;line-height:1.15;letter-spacing:-.035em}.pc-v7-public-entry .entry-request-strip-copy span{color:#52615a;font-size:13px;font-weight:760;line-height:1.35}.pc-v7-public-entry .entry-request-strip-button{min-height:46px;display:inline-flex;align-items:center;justify-content:center;padding:0 18px;border-radius:16px;background:#087a3b;color:#fff!important;font-size:14px;font-weight:950;text-decoration:none;white-space:nowrap;box-shadow:0 14px 28px rgba(0,122,47,.18)}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-header,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-bottomnav,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-drawer,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-pilot-note,.pc-shell-root-v4[data-public-entry='true'] .pc-v7-role-dock,.pc-shell-root-v4[data-public-entry='true'] .pc-v7-assistant-widget{display:none!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#fbfcf9!important;min-height:100svh!important}
@media(max-width:980px){.pc-v7-public-entry .entry-register{display:none!important}.pc-v7-public-entry .entry-request-strip{margin:8px 14px 20px;grid-template-columns:1fr;padding:14px;border-radius:22px}.pc-v7-public-entry .entry-request-strip-button{width:100%;min-height:52px;border-radius:17px}}
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
