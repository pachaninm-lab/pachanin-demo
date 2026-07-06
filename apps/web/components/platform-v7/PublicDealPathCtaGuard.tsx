'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

const DEAL_PATH_CTA_SELECTOR = '[data-public-deal-path-cta="true"]';
const ROOT_SELECTOR = '.pc-v7-public-entry';
const DEAL_FLOW_HREF = '/platform-v7/deal-flow';
const DEAL_FLOW_LABEL = 'Разобрать контур сделки';

function buildDealPathCta() {
  const link = document.createElement('a');
  link.className = 'entry-deal-path-standalone';
  link.dataset.publicDealPathCta = 'true';
  link.href = DEAL_FLOW_HREF;
  link.setAttribute('aria-label', DEAL_FLOW_LABEL);
  link.innerHTML = '<span aria-hidden="true" class="entry-deal-path-icon">▶</span><span>Разобрать контур сделки</span>';
  return link;
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
@media(max-width:720px){
.pc-v7-public-entry .entry-deal-path-standalone{width:calc(100% - 28px);min-height:58px;margin:8px auto 10px;font-size:16px}
html body .pc-v7-public-entry #control.entry-section{display:block!important;min-height:0!important;height:auto!important;max-height:none!important;padding:28px 14px 18px!important;overflow:visible!important;contain:none!important;content-visibility:visible!important}
html body .pc-v7-public-entry #control .entry-section-head{display:grid!important;gap:10px!important;margin:0 0 14px!important;height:auto!important;max-height:none!important;overflow:visible!important}
html body .pc-v7-public-entry #control .entry-control-grid{display:flex!important;flex-direction:column!important;grid-template-columns:none!important;gap:12px!important;width:100%!important;min-height:0!important;height:auto!important;max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important;contain:none!important;content-visibility:visible!important;align-items:stretch!important}
html body .pc-v7-public-entry #control .entry-control-tile{display:grid!important;position:relative!important;flex:0 0 auto!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:0!important;height:auto!important;max-height:none!important;margin:0!important;padding:20px!important;border-radius:24px!important;gap:12px!important;align-content:start!important;opacity:1!important;visibility:visible!important;transform:none!important;overflow:visible!important;contain:none!important;content-visibility:visible!important;background:rgba(255,255,255,.96)!important;box-shadow:0 14px 34px rgba(7,22,17,.065)!important}
html body .pc-v7-public-entry #control .entry-control-tile svg{display:block!important;color:#087a3b!important;width:31px!important;height:31px!important}
html body .pc-v7-public-entry #control .entry-control-tile strong{display:block!important;color:#071611!important;font-size:24px!important;line-height:1.08!important;font-weight:950!important}
html body .pc-v7-public-entry #control .entry-control-tile span{display:block!important;color:#61716b!important;font-size:15px!important;line-height:1.42!important;font-weight:650!important}
html body .pc-v7-public-entry #process.entry-section{margin-top:0!important;padding-top:22px!important}
}
`;

export function PublicDealPathCtaGuard() {
  const pathname = usePathname();

  React.useEffect(() => {
    if (pathname && pathname.replace(/\/$/, '') !== '/platform-v7') return;
    let cancelled = false;
    const sync = () => {
      if (!cancelled) ensureDealPathCta();
    };
    const raf = window.requestAnimationFrame(sync);
    const timers = [80, 220, 600, 1200, 2200].map((delay) => window.setTimeout(sync, delay));
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, [pathname]);

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
