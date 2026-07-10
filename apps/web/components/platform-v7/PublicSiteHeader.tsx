import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { PublicLocaleSwitch } from '@/components/platform-v7/PublicLocaleSwitch';

export const PUBLIC_SITE_HEADER_HEIGHT = 64;

/**
 * Single canonical public header shared by every public platform-v7 surface.
 * Locale switching is rendered inside the header and triggers a server-side
 * next-intl render; it does not mutate translated text in the DOM.
 */
export function PublicSiteHeader({
  tagline,
  nav,
  actions,
  ariaLabel = 'Шапка сайта',
}: {
  tagline?: string;
  nav?: ReactNode;
  actions: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <header className='pc-site-header' aria-label={ariaLabel}>
      <Link href='/platform-v7' className='pc-site-brand' aria-label='Прозрачная Цена — на главную'>
        <span className='pc-site-brand-mark'><BrandMark size={40} /></span>
        <span className='pc-site-brand-text'>
          <strong>Прозрачная Цена</strong>
          {tagline ? <small>{tagline}</small> : null}
        </span>
      </Link>
      {nav ? <nav className='pc-site-nav' aria-label='Разделы'>{nav}</nav> : null}
      <div className='pc-site-actions'>
        <PublicLocaleSwitch />
        {actions}
      </div>
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </header>
  );
}

const css = `
.pc-site-header{
  position:fixed;top:0;left:0;right:0;z-index:2600;
  display:flex;align-items:center;gap:16px;
  height:${PUBLIC_SITE_HEADER_HEIGHT}px;
  padding:0 clamp(16px,4vw,44px);
  background:rgba(255,255,255,.97);
  border-bottom:1px solid rgba(7,22,17,.08);
  box-shadow:0 8px 24px rgba(7,22,17,.06);
  -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
.pc-site-brand{display:inline-flex;align-items:center;gap:11px;min-width:0;color:#071611;text-decoration:none;flex:0 0 auto}
.pc-site-brand-mark{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:11px;overflow:hidden;flex:0 0 40px}
.pc-site-brand-mark img{width:100%;height:100%;object-fit:contain}
.pc-site-brand-text{display:grid;min-width:0}
.pc-site-brand-text strong{font-size:18px;line-height:1.05;font-weight:900;letter-spacing:-.03em;white-space:nowrap}
.pc-site-brand-text small{margin-top:2px;color:#66736e;font-size:12px;font-weight:650;line-height:1.05;white-space:nowrap}
.pc-site-nav{flex:1 1 auto;display:flex;justify-content:center;align-items:center;gap:20px;min-width:0;color:#17251f;font-size:14px;font-weight:760}
.pc-site-nav a{color:inherit;text-decoration:none;white-space:nowrap}
.pc-site-nav a:hover{color:#087a3b}
.pc-site-actions{flex:0 0 auto;margin-left:auto;display:flex;align-items:center;justify-content:flex-end;gap:9px}
.pc-site-action,.pc-site-locale-switch{height:42px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;padding:0;border-radius:14px;background:rgba(255,255,255,.9);border:1px solid rgba(7,22,17,.10);color:#071611;text-decoration:none}
.pc-site-action{width:42px}
.pc-site-action>span{display:none}
.pc-site-action.is-primary{background:rgba(0,122,47,.09);border-color:rgba(0,122,47,.2);color:#087a3b}
.pc-site-locale-switch{min-width:54px;gap:5px;padding:0 10px;color:#087a3b;background:rgba(0,122,47,.08);border-color:rgba(0,122,47,.18);font:inherit;cursor:pointer}
.pc-site-locale-switch span{font-size:11px;font-weight:950;letter-spacing:.03em}
.pc-site-action:hover,.pc-site-locale-switch:hover{border-color:rgba(0,122,47,.34);background:rgba(0,122,47,.06)}
.pc-site-header a:focus-visible,.pc-site-header button:focus-visible{outline:3px solid #087a3b;outline-offset:3px;border-radius:12px}
@media (max-width:1080px){.pc-site-nav{display:none}}
@media (max-width:720px){
  .pc-site-header{gap:10px;padding:0 16px}
  .pc-site-brand-text small{display:none}
  .pc-site-brand-text strong{font-size:17px}
  .pc-site-actions{gap:6px}
  .pc-site-locale-switch{min-width:50px;height:40px;padding:0 8px}
}
@media (max-width:374px){
  .pc-site-header{padding:0 12px}
  .pc-site-brand{gap:9px}
  .pc-site-brand-mark{width:36px;height:36px;flex-basis:36px}
  .pc-site-brand-text strong{font-size:16px}
  .pc-site-locale-switch{min-width:46px;padding:0 7px}
}
`;
