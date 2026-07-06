'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { HeaderLanguageSwitch } from '@/components/platform-v7/HeaderLanguageSwitch';

const DEAL_PATH_CTA_SELECTOR = '[data-public-deal-path-cta="true"]';
const ROOT_SELECTOR = '.pc-v7-public-entry';
const DEAL_FLOW_HREF = '/platform-v7/deal-flow';
const DEAL_FLOW_LABEL = 'Разобрать контур сделки';
const SOFT_NAV_TARGETS = ['/platform-v7/login', '/platform-v7/register', '/platform-v7/deal-flow', '/platform-v7/contact', '/platform-v7/request'];

function buildDealPathCta() {
  const link = document.createElement('a');
  link.className = 'entry-deal-path-standalone';
  link.dataset.publicDealPathCta = 'true';
  link.href = DEAL_FLOW_HREF;
  link.setAttribute('aria-label', DEAL_FLOW_LABEL);
  link.innerHTML = '<span aria-hidden="true" class="entry-deal-path-icon">▶</span><span>Разобрать контур сделки</span>';
  return link;
}

function shouldUseSoftNavigation(href: string) {
  if (!href || href.startsWith('#')) return false;
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    return SOFT_NAV_TARGETS.some((target) => url.pathname === target || url.pathname.startsWith(`${target}/`));
  } catch {
    return false;
  }
}

function showHandoffOverlay(label = 'Открываем рабочий контур') {
  const existing = document.querySelector<HTMLElement>('[data-public-platform-handoff="true"]');
  if (existing) return;
  const overlay = document.createElement('div');
  overlay.dataset.publicPlatformHandoff = 'true';
  overlay.innerHTML = `<div><span></span><strong>${label}</strong><small>Переход в раздел платформы</small></div>`;
  document.body.appendChild(overlay);
}

function hideHandoffOverlay() {
  document.querySelector<HTMLElement>('[data-public-platform-handoff="true"]')?.remove();
}

function normalizePrimaryActions(root: HTMLElement) {
  root.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const label = link.textContent?.trim() || '';
    if (href === '/platform-v7/demo' || href.startsWith('/platform-v7/demo?') || label.includes('Разобрать контур сделки')) {
      link.href = DEAL_FLOW_HREF;
      link.setAttribute('href', DEAL_FLOW_HREF);
    }
  });
}

function stabilizeControlGrid(root: HTMLElement) {
  const control = root.querySelector<HTMLElement>('#control');
  const grid = control?.querySelector<HTMLElement>('.entry-control-grid');
  if (!control || !grid) return;
  control.dataset.controlGridStable = 'true';
  grid.dataset.controlGridStable = 'true';
  grid.querySelectorAll<HTMLElement>('.entry-control-tile').forEach((tile) => {
    tile.hidden = false;
    tile.removeAttribute('aria-hidden');
    tile.dataset.controlTileStable = 'true';
  });
}

function ensureDealPathCta() {
  const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);
  if (!root) return;
  normalizePrimaryActions(root);
  stabilizeControlGrid(root);
  const control = root.querySelector<HTMLElement>('#control');
  const process = root.querySelector<HTMLElement>('#process');
  if (!control || !process || !control.parentNode) return;

  const existing = root.querySelector<HTMLAnchorElement>(DEAL_PATH_CTA_SELECTOR);
  const cta = existing ?? buildDealPathCta();
  cta.href = DEAL_FLOW_HREF;
  cta.setAttribute('href', DEAL_FLOW_HREF);
  if (!cta.textContent?.includes(DEAL_FLOW_LABEL)) {
    cta.replaceChildren();
    const icon = document.createElement('span');
    icon.className = 'entry-deal-path-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '▶';
    const label = document.createElement('span');
    label.textContent = DEAL_FLOW_LABEL;
    cta.append(icon, label);
  }
  control.parentNode.insertBefore(cta, control);
}

const css = `
.pc-v7-public-entry .entry-deal-path-standalone{width:min(560px,calc(100% - 28px));min-height:58px;margin:4px auto 8px;padding:0 20px;border-radius:999px;border:1px solid rgba(8,122,59,.20);background:rgba(255,255,255,.96);color:#087a3b;display:flex;align-items:center;justify-content:center;gap:10px;text-align:center;text-decoration:none;font-size:16px;font-weight:950;box-shadow:0 16px 38px rgba(7,22,17,.08)}
.pc-v7-public-entry .entry-deal-path-standalone:hover{border-color:rgba(8,122,59,.34);box-shadow:0 20px 44px rgba(7,22,17,.11);transform:translateY(-1px)}
.pc-v7-public-entry .entry-deal-path-icon{width:22px;height:22px;border-radius:999px;border:2px solid currentColor;display:inline-flex;align-items:center;justify-content:center;font-size:9px;line-height:1;padding-left:1px;flex:0 0 22px}
html body [data-public-platform-handoff='true']{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;background:rgba(247,250,246,.96);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
html body [data-public-platform-handoff='true']>div{display:grid;place-items:center;gap:10px;padding:24px;border-radius:28px;background:#fff;border:1px solid rgba(7,22,17,.08);box-shadow:0 20px 64px rgba(7,22,17,.12)}
html body [data-public-platform-handoff='true'] span{width:34px;height:34px;border-radius:999px;border:4px solid rgba(8,122,59,.15);border-top-color:#087a3b;animation:p7PublicHandoffSpin .8s linear infinite}
html body [data-public-platform-handoff='true'] strong{font-size:18px;font-weight:950}
html body [data-public-platform-handoff='true'] small{color:#61716b;font-size:13px;font-weight:750}
@keyframes p7PublicHandoffSpin{to{transform:rotate(360deg)}}
@media(max-width:720px){
.pc-v7-public-entry .entry-deal-path-standalone{width:calc(100% - 28px);min-height:58px;margin:8px auto 10px;font-size:16px}
html body .pc-v7-public-entry #control.entry-section{display:block!important;min-height:0!important;height:auto!important;max-height:none!important;padding:28px 14px 18px!important;overflow:visible!important;contain:none!important;content-visibility:visible!important}
html body .pc-v7-public-entry #control .entry-section-head{display:grid!important;gap:10px!important;margin:0 0 14px!important;height:auto!important;max-height:none!important;overflow:visible!important}
html body .pc-v7-public-entry #control .entry-control-grid{display:grid!important;grid-template-columns:1fr!important;gap:12px!important;width:100%!important;min-height:0!important;height:auto!important;max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important;contain:none!important;content-visibility:visible!important;align-items:stretch!important}
html body .pc-v7-public-entry #control .entry-control-tile{display:grid!important;position:relative!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:0!important;height:auto!important;max-height:none!important;margin:0!important;padding:20px!important;border-radius:24px!important;gap:12px!important;align-content:start!important;opacity:1!important;visibility:visible!important;transform:none!important;overflow:visible!important;contain:none!important;content-visibility:visible!important;background:rgba(255,255,255,.96)!important;box-shadow:0 14px 34px rgba(7,22,17,.065)!important}
html body .pc-v7-public-entry #control .entry-control-tile svg{display:block!important;color:#087a3b!important;width:31px!important;height:31px!important}
html body .pc-v7-public-entry #control .entry-control-tile strong{display:block!important;color:#071611!important;font-size:24px!important;line-height:1.08!important;font-weight:950!important}
html body .pc-v7-public-entry #control .entry-control-tile span{display:block!important;color:#61716b!important;font-size:15px!important;line-height:1.42!important;font-weight:650!important}
html body .pc-v7-public-entry #process.entry-section{margin-top:0!important;padding-top:22px!important}
}
`;

export function PublicDealPathCtaGuard() {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (pathname && pathname.replace(/\/$/, '') !== '/platform-v7') return;
    let cancelled = false;
    const sync = () => {
      if (!cancelled) ensureDealPathCta();
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest('a') as HTMLAnchorElement | null;
      const root = target?.closest(ROOT_SELECTOR);
      if (!link || !root || !shouldUseSoftNavigation(link.getAttribute('href') || link.href)) return;
      const url = new URL(link.getAttribute('href') || link.href, window.location.origin);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showHandoffOverlay(link.textContent?.trim() || undefined);
      window.setTimeout(() => {
        router.push(`${url.pathname}${url.search}${url.hash}`);
        window.setTimeout(hideHandoffOverlay, 250);
      }, 30);
    };
    const raf = window.requestAnimationFrame(sync);
    const timers = [80, 220, 600, 1200, 2200].map((delay) => window.setTimeout(sync, delay));
    const observer = new MutationObserver(sync);
    document.addEventListener('click', onClick, true);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener('click', onClick, true);
      observer.disconnect();
    };
  }, [pathname, router]);

  return <><HeaderLanguageSwitch /><style dangerouslySetInnerHTML={{ __html: css }} /></>;
}
