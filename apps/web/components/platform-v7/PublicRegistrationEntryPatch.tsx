'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/request', '/platform-v7/contact', '/platform-v7/docs']);
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

function restoreActionLinks(root: ParentNode) {
  const pairs = [
    ['.entry-action-card-contact a', '/platform-v7/contact'],
    ['.entry-action-card-review a', '/platform-v7/request'],
    ['.entry-action-card-register a', '/platform-v7/register'],
  ] as const;

  pairs.forEach(([selector, href]) => {
    root.querySelectorAll<HTMLAnchorElement>(selector).forEach((link) => {
      link.href = href;
      link.setAttribute('href', href);
      link.dataset.publicActionHref = href;
    });
  });
}

function ensureRequestEntry(root: ParentNode) {
  const existing = root.querySelector('[data-entry-request="actions"]');
  if (existing) {
    restoreActionLinks(root);
    return;
  }
  const hero = root.querySelector<HTMLElement>('.entry-hero');
  if (!hero) return;

  const strip = document.createElement('section');
  strip.className = 'entry-request-actions';
  strip.dataset.entryRequest = 'actions';
  strip.setAttribute('aria-label', 'Действия по платформе');
  strip.innerHTML = `
    <div class="entry-action-card entry-action-card-contact">
      <strong>Обращение по платформе</strong>
      <span>Вопрос по демо, доступу, подключению, банку, региону или техническому взаимодействию.</span>
      <a href="/platform-v7/contact">Направить обращение</a>
    </div>
    <div class="entry-action-card entry-action-card-review">
      <strong>Разбор сделки</strong>
      <span>Заявка на демонстрацию controlled pilot и разбор сценария исполнения сделки.</span>
      <a href="/platform-v7/request">Оставить заявку</a>
    </div>
    <div class="entry-action-card entry-action-card-register">
      <strong>Регистрация</strong>
      <span>Отдельная опция для подключения организации и последующей проверки доступа.</span>
      <a href="/platform-v7/register">Перейти к регистрации</a>
    </div>
  `;
  hero.after(strip);
  restoreActionLinks(root);
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
.pc-v7-public-entry .entry-request-actions{max-width:1180px;margin:-18px auto 28px;padding:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;border:1px solid rgba(7,22,17,.08);border-radius:26px;background:rgba(255,255,255,.78);box-shadow:0 14px 34px rgba(7,22,17,.06)}
.pc-v7-public-entry .entry-action-card{min-width:0;display:grid;gap:8px;align-content:start;padding:16px;border:1px solid rgba(7,22,17,.08);border-radius:21px;background:#fff;box-shadow:0 8px 22px rgba(7,22,17,.045)}
.pc-v7-public-entry .entry-action-card strong{font-size:18px;line-height:1.12;letter-spacing:-.035em}.pc-v7-public-entry .entry-action-card span{min-height:54px;color:#52615a;font-size:13px;font-weight:760;line-height:1.35}.pc-v7-public-entry .entry-action-card a{min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 14px;border-radius:15px;font-size:13.5px;font-weight:950;text-align:center;text-decoration:none;white-space:nowrap}.pc-v7-public-entry .entry-action-card-contact a{background:#fff;color:#087a3b!important;border:1px solid rgba(0,122,47,.22)}.pc-v7-public-entry .entry-action-card-review a{background:#087a3b;color:#fff!important;box-shadow:0 14px 28px rgba(0,122,47,.18)}.pc-v7-public-entry .entry-action-card-register a{background:rgba(0,122,47,.07);color:#087a3b!important;border:1px solid rgba(0,122,47,.16)}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-header,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-bottomnav,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-drawer,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-pilot-note,.pc-shell-root-v4[data-public-entry='true'] .pc-v7-role-dock,.pc-shell-root-v4[data-public-entry='true'] .pc-v7-assistant-widget{display:none!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#fbfcf9!important;min-height:100svh!important}
@media(max-width:980px){.pc-v7-public-entry .entry-register{display:none!important}.pc-v7-public-entry .entry-request-actions{margin:8px 14px 20px;grid-template-columns:1fr;padding:12px;border-radius:24px}.pc-v7-public-entry .entry-action-card{padding:14px;border-radius:20px}.pc-v7-public-entry .entry-action-card span{min-height:0}.pc-v7-public-entry .entry-action-card a{width:100%;min-height:50px;border-radius:17px;white-space:normal}}
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
    const timers = [80, 220, 600, 1200, 2200].map((delay) => window.setTimeout(sync, delay));
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
