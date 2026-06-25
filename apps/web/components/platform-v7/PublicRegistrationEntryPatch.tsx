'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/docs']);

function isPublicPath(pathname: string | null) {
  if (!pathname) return false;
  const clean = pathname.replace(/\/$/, '') || '/platform-v7';
  return PUBLIC_PATHS.has(clean);
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
  if (!heroActions) return;
  const heroLink = heroActions.querySelector<HTMLAnchorElement>('.entry-text-cta,.entry-register-cta');
  if (!heroLink) return;
  heroLink.href = '/platform-v7/register';
  heroLink.classList.remove('entry-text-cta');
  heroLink.classList.add('entry-register-cta');
  heroLink.dataset.entryRegister = 'hero';
  heroLink.textContent = 'Зарегистрироваться';
}

function syncShellMode(pathname: string | null) {
  const shell = document.querySelector<HTMLElement>('.pc-shell-root-v4');
  if (!shell) return;
  if (isPublicPath(pathname)) {
    shell.dataset.publicEntry = 'true';
    return;
  }
  delete shell.dataset.publicEntry;
}

const css = `
.pc-v7-public-entry .entry-register{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:15px;background:#007a2f;color:#fff;border:1px solid #007a2f;font-size:14px;font-weight:900;text-decoration:none;white-space:nowrap}
.pc-v7-public-entry .entry-register-cta{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:56px!important;border-radius:17px!important;padding:0 22px!important;background:#071611!important;color:#fff!important;border:1px solid rgba(7,22,17,.16)!important;box-shadow:0 16px 34px rgba(7,22,17,.18)!important;font-size:16px!important;font-weight:900!important;text-align:center!important;text-decoration:none!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-header,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-bottomnav,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-drawer,.pc-shell-root-v4[data-public-entry='true'] .pc-v4-pilot-note,.pc-shell-root-v4[data-public-entry='true'] .pc-v7-role-dock,.pc-shell-root-v4[data-public-entry='true'] .pc-v7-assistant-widget{display:none!important}
.pc-shell-root-v4[data-public-entry='true'] .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#fbfcf9!important;min-height:100svh!important}
@media(max-width:980px){.pc-v7-public-entry .entry-register{display:none!important}.pc-v7-public-entry .entry-register-cta{width:100%!important;min-width:0!important}}
`;

export function PublicRegistrationEntryPatch() {
  const pathname = usePathname();

  React.useEffect(() => {
    let cancelled = false;
    function sync() {
      if (cancelled) return;
      syncShellMode(pathname);
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
