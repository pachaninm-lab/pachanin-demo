'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const CONTROL_ID = 'control';
const EXPECTED_TILES = 4;

function normalize(pathname: string | null): string {
  return (pathname || '/platform-v7').split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function stabilizeControlGrid() {
  const control = document.getElementById(CONTROL_ID);
  const grid = control?.querySelector<HTMLElement>('.entry-control-grid');
  if (!control || !grid) return;

  control.setAttribute('data-control-grid-stable', 'true');
  grid.setAttribute('data-control-grid-stable', 'true');

  const tiles = Array.from(grid.querySelectorAll<HTMLElement>('.entry-control-tile'));
  tiles.forEach((tile) => {
    tile.hidden = false;
    tile.removeAttribute('aria-hidden');
    tile.style.removeProperty('display');
    tile.style.removeProperty('opacity');
    tile.style.removeProperty('visibility');
    tile.style.removeProperty('transform');
    tile.style.removeProperty('position');
    tile.setAttribute('data-control-tile-stable', 'true');
  });

  if (tiles.length >= EXPECTED_TILES) grid.setAttribute('data-control-grid-complete', 'true');
}

export function PublicControlGridStabilityGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (normalize(pathname) !== '/platform-v7') return;
    let cancelled = false;
    const sync = () => {
      if (!cancelled) stabilizeControlGrid();
    };
    sync();
    const timers = [60, 160, 360, 800, 1400, 2400].map((delay) => window.setTimeout(sync, delay));
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden', 'aria-hidden', 'class'] });
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, [pathname]);

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

const css = `
@media(max-width:720px){
  html body .pc-v7-public-entry #control.entry-section,
  html body .pc-shell-root-v4 .pc-v7-public-entry #control.entry-section{
    display:block!important;
    position:relative!important;
    inline-size:100%!important;
    max-inline-size:100%!important;
    min-block-size:0!important;
    block-size:auto!important;
    height:auto!important;
    max-height:none!important;
    margin:0 auto!important;
    padding:28px 14px 18px!important;
    overflow:visible!important;
    contain:none!important;
    content-visibility:visible!important;
  }

  html body .pc-v7-public-entry #control .entry-section-head,
  html body .pc-shell-root-v4 .pc-v7-public-entry #control .entry-section-head{
    display:grid!important;
    gap:10px!important;
    margin:0 0 14px!important;
    min-block-size:0!important;
    block-size:auto!important;
    max-block-size:none!important;
    overflow:visible!important;
  }

  html body .pc-v7-public-entry #control .entry-control-grid,
  html body .pc-shell-root-v4 .pc-v7-public-entry #control .entry-control-grid,
  html body .pc-v7-public-entry #control .entry-control-grid[data-control-grid-stable='true']{
    display:flex!important;
    flex-direction:column!important;
    grid-template-columns:none!important;
    gap:12px!important;
    inline-size:100%!important;
    max-inline-size:100%!important;
    min-block-size:0!important;
    block-size:auto!important;
    height:auto!important;
    max-height:none!important;
    margin:0!important;
    padding:0!important;
    overflow:visible!important;
    contain:none!important;
    content-visibility:visible!important;
    align-items:stretch!important;
  }

  html body .pc-v7-public-entry #control .entry-control-tile,
  html body .pc-shell-root-v4 .pc-v7-public-entry #control .entry-control-tile,
  html body .pc-v7-public-entry #control .entry-control-tile[data-control-tile-stable='true']{
    display:grid!important;
    position:relative!important;
    inset:auto!important;
    flex:0 0 auto!important;
    inline-size:100%!important;
    min-inline-size:0!important;
    max-inline-size:100%!important;
    min-block-size:0!important;
    block-size:auto!important;
    height:auto!important;
    max-height:none!important;
    margin:0!important;
    padding:20px!important;
    border-radius:24px!important;
    gap:12px!important;
    align-content:start!important;
    opacity:1!important;
    visibility:visible!important;
    transform:none!important;
    overflow:visible!important;
    contain:none!important;
    content-visibility:visible!important;
    background:rgba(255,255,255,.96)!important;
    box-shadow:0 14px 34px rgba(7,22,17,.065)!important;
  }

  html body .pc-v7-public-entry #control .entry-control-tile svg{
    display:block!important;
    color:#087a3b!important;
    inline-size:31px!important;
    block-size:31px!important;
  }

  html body .pc-v7-public-entry #control .entry-control-tile strong{
    display:block!important;
    color:#071611!important;
    font-size:24px!important;
    line-height:1.08!important;
    font-weight:950!important;
  }

  html body .pc-v7-public-entry #control .entry-control-tile span{
    display:block!important;
    color:#61716b!important;
    font-size:15px!important;
    line-height:1.42!important;
    font-weight:650!important;
  }

  html body .pc-v7-public-entry #process.entry-section,
  html body .pc-shell-root-v4 .pc-v7-public-entry #process.entry-section{
    margin-top:0!important;
    padding-top:22px!important;
  }
}
`;
