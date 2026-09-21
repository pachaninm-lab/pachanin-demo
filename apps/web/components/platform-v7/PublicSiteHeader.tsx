import { Children, isValidElement, type ReactNode } from 'react';
import { BrandMark } from '@/components/v7r/BrandMark';

export const PUBLIC_SITE_HEADER_HEIGHT = 64;

/*
 * Critical header CSS only.
 * Route-specific appearance lives in platform-v7-canonical-public-v1.css.
 * Keeping this block intentionally small reduces the inline HTML / render path
 * while preserving a stable shell for public pages that do not import the
 * canonical stylesheet.
 */
const PUBLIC_SITE_HEADER_STYLES = `
.pc-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.pc-site-header{--pc-site-control-height:44px;position:fixed;inset:0 0 auto;z-index:2600;height:64px;display:flex;align-items:center;gap:12px;padding:0 clamp(12px,3vw,30px);background:#fff;border-bottom:1px solid rgba(7,22,17,.08);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.pc-site-brand{min-height:44px;display:inline-flex;align-items:center;gap:8px;min-width:0;flex:0 0 auto;color:#071611;text-decoration:none}
.pc-site-brand-mark{width:34px;height:34px;flex:0 0 34px;display:inline-grid;place-items:center}
.pc-site-brand-mark>span,.pc-site-brand-mark img{width:100%!important;height:100%!important;display:block!important;object-fit:contain!important}
.pc-site-brand-text{display:grid;min-width:0}.pc-site-brand-text strong{font-size:16px;line-height:1;font-weight:900;letter-spacing:-.035em;white-space:nowrap}.pc-site-brand-text small{margin-top:2px;color:#66736e;font-size:12px;font-weight:650;white-space:nowrap}
.pc-site-nav{flex:1 1 auto;display:flex;justify-content:center;align-items:center;gap:15px;min-width:0;font-size:12px;font-weight:760;color:#17251f}
.pc-site-header[data-public-site-header='canonical'] .pc-site-nav>a{box-sizing:border-box!important;min-width:44px!important;min-height:44px!important;display:inline-flex!important;align-items:center;justify-content:center;color:inherit;text-decoration:none;white-space:nowrap}.pc-site-nav a:hover{color:#087a3b}
.pc-site-actions{margin-left:auto;display:flex;align-items:center;gap:7px;flex:0 0 auto}.pc-site-actions>div{display:flex;align-items:center;gap:7px}
.pc-site-locale-cluster{display:flex;align-items:center;justify-content:center;gap:2px;flex:0 0 auto}.pc-site-locale-option{box-sizing:border-box;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px;border-radius:8px;color:#5d6963;text-decoration:none;font-size:12px;font-weight:750;line-height:1}.pc-site-locale-option:focus-visible{outline:3px solid rgba(25,117,82,.34);outline-offset:2px}
.pc-site-locale-cluster{display:flex;align-items:center;justify-content:center;gap:2px;flex:0 0 auto}
.pc-site-locale-option{box-sizing:border-box;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px;border-radius:8px;color:#5d6963;text-decoration:none;font-size:12px;font-weight:750;line-height:1}
.pc-site-locale-option[data-active='true']{background:#087a3b;color:#fff;font-weight:900}.pc-site-locale-option:focus-visible{outline:3px solid rgba(25,117,82,.34);outline-offset:2px}
.pc-site-mobile-menu{position:relative;display:none;flex:0 0 auto}.pc-site-mobile-menu>summary,.pc-site-header .pc-site-locale-switch,.pc-site-header .entry-login,.pc-site-header .pc-site-action{box-sizing:border-box;min-width:44px;height:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #c6d5cb;border-radius:9px;background:#fff;color:#092118;text-decoration:none}
.pc-site-mobile-menu>summary{padding:0;list-style:none;cursor:pointer}.pc-site-mobile-menu>summary::-webkit-details-marker{display:none}
.pc-site-menu-glyph{width:18px;display:grid;gap:4px}.pc-site-menu-glyph i{width:18px;height:2px;border-radius:99px;background:currentColor}
.pc-site-mobile-nav{position:fixed;top:68px;right:max(10px,env(safe-area-inset-right));width:min(340px,calc(100vw - 20px));max-height:calc(100dvh - 82px);overflow:auto;display:grid;gap:2px;padding:10px;border:1px solid #d6e0da;border-radius:14px;background:#fff;box-shadow:0 18px 44px rgba(16,42,29,.16)}
.pc-site-mobile-nav a{min-height:44px;padding:0 12px;border-radius:9px;justify-content:flex-start}
.pc-site-header :is(.pc-v6-header-cta,.pc-ppe-primary-button,.p7-about-register,.p7-contact-register){box-sizing:border-box;min-width:44px;height:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 13px;border:1px solid #087a3b;border-radius:9px;background:#087a3b;color:#fff!important;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}
.pc-site-header :focus-visible{outline:3px solid rgba(25,117,82,.34);outline-offset:2px}
@media(max-width:980px){.pc-site-nav{display:none}.pc-site-mobile-menu{display:block}.pc-site-brand-text small{display:none}}
@media(max-width:760px){.pc-site-locale-option{min-width:44px;min-height:44px;padding-inline:2px}.pc-site-header{height:60px;gap:5px;padding:0 8px}.pc-site-brand{gap:6px;flex:1 1 auto}.pc-site-brand-mark{width:31px;height:31px;flex-basis:31px}.pc-site-brand-text strong{font-size:13px}.pc-site-actions,.pc-site-actions>div{gap:3px}.pc-site-mobile-menu>summary{width:44px}.pc-site-mobile-nav{top:64px}.pc-site-header :is(.pc-v6-header-cta,.pc-ppe-primary-button,.p7-about-register,.p7-contact-register){padding-inline:9px;font-size:12px}}
@media(max-width:430px){.pc-site-header{padding-inline:6px}.pc-site-brand-text strong{font-size:12px}.pc-site-brand{min-width:118px}}
@media(prefers-reduced-motion:reduce){.pc-site-header *{scroll-behavior:auto!important}}
@media(forced-colors:active){.pc-site-header,.pc-site-mobile-menu>summary,.pc-site-mobile-nav,.pc-site-header .entry-login,.pc-site-header .pc-site-action{border:1px solid CanvasText}}

/* FINAL PUBLIC EXPERIENCE v1 — canonical header polish */
.pc-site-header[data-public-site-header='canonical']{
  background:rgba(251,253,251,.97);
  border-bottom-color:#d9e7de;
  box-shadow:0 8px 28px rgba(20,54,39,.055);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI Variable","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
}
.pc-site-header[data-public-site-header='canonical'] .pc-site-brand-text strong{font-size:16px;line-height:1.08;font-weight:700;letter-spacing:-.025em}
.pc-site-header[data-public-site-header='canonical'] .pc-site-nav{gap:2px;font-size:14px;font-weight:690;color:#24382e}
.pc-site-header[data-public-site-header='canonical'] .pc-site-nav>a{gap:5px;padding-inline:10px;border-radius:10px;transition:background-color .16s ease,color .16s ease}
.pc-site-header[data-public-site-header='canonical'] .pc-site-nav>a:hover{background:#edf7f1;color:#0b6046}
.pc-site-header[data-public-site-header='canonical'] .pc-site-nav>a[data-active='true']{background:#e3f2e8;color:#0a5a41}
.pc-site-header[data-public-site-header='canonical'] .pc-site-nav-gekta{background:#edf8f2;color:#0a6548;font-weight:780}
.pc-site-header[data-public-site-header='canonical'] .pc-site-nav-gekta svg{color:#0b7452}
.pc-site-header[data-public-site-header='canonical'] .pc-site-locale-option[data-active='true']{background:#e3f2e8;color:#0a5a41;box-shadow:inset 0 0 0 1px #cbe2d4}
.pc-site-header[data-public-site-header='canonical'] .entry-login{border-color:#d6e5dc;background:#f7fbf8;color:#244338}
.pc-site-header[data-public-site-header='canonical'] :is(.pc-v6-header-cta,.pc-ppe-primary-button,.p7-about-register,.p7-contact-register){background:#0b6046;border-color:#0b6046;border-radius:10px;font-size:13px}
.pc-gekta-chat-button{box-sizing:border-box;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid #bcd9c9;border-radius:10px;background:#e7f4eb;color:#0a5d43;font:inherit;font-size:13px;font-weight:780;line-height:1;cursor:pointer;text-decoration:none;white-space:nowrap}
.pc-gekta-chat-button:hover{background:#dcefe3;border-color:#9fc9b3}
.pc-gekta-chat-button:focus-visible{outline:3px solid rgba(25,117,82,.28);outline-offset:2px}
.pc-gekta-chat-button--header{padding-inline:11px}
.pc-site-mobile-nav{border-color:#d6e5dc;background:#fbfdfb;box-shadow:0 22px 56px rgba(20,54,39,.15)}
.pc-site-mobile-nav-links{display:grid;gap:4px}
.pc-site-mobile-nav-links>a,.pc-site-mobile-nav-links>.pc-gekta-chat-button{width:100%;min-height:48px;justify-content:flex-start;padding:0 13px;border-radius:11px;font-size:14px}
.pc-site-mobile-nav-links>a[data-active='true']{background:#e7f4eb;color:#0a5d43}
.pc-site-mobile-nav-links>.pc-gekta-chat-button{border-color:#c5ddcf;background:#eef8f2}
@media(max-width:980px){
  .pc-gekta-chat-button--header{display:none}
}
@media(max-width:760px){
  .pc-site-header[data-public-site-header='canonical'] .pc-site-brand-text strong{font-size:14px!important}
  .pc-site-header[data-public-site-header='canonical'] .pc-site-locale-option{font-size:12px!important}
  .pc-site-header[data-public-site-header='canonical'] :is(.pc-v6-header-cta,.pc-ppe-primary-button,.p7-about-register,.p7-contact-register){font-size:12px!important}
}
@media(max-width:430px){
  .pc-site-header[data-public-site-header='canonical'] .pc-site-brand-text strong{font-size:14px!important}
}

`;

type PublicLocale = 'ru' | 'en' | 'zh';

function findActionLocale(node: ReactNode): PublicLocale | null {
  const queue = [...Children.toArray(node)];
  while (queue.length > 0) {
    const child = queue.shift();
    if (!isValidElement<{ href?: unknown; children?: ReactNode }>(child)) continue;
    const href = child.props.href;
    if (typeof href === 'string' && href.startsWith('/platform-v7')) {
      const match = href.match(/[?&]lang=(ru|en|zh)(?:&|#|$)/);
      if (match?.[1] === 'ru' || match?.[1] === 'en' || match?.[1] === 'zh') return match[1];
    }
    queue.push(...Children.toArray(child.props.children));
  }
  return null;
}

function resolveBrandHomeHref(actions: ReactNode, explicitHref?: string) {
  if (explicitHref) return explicitHref;
  const locale = findActionLocale(actions);
  return locale ? `/platform-v7?lang=${locale}` : '/platform-v7';
}

/**
 * Single server-rendered public header. The mobile menu uses native <details>,
 * therefore the public shell does not add a hydration dependency.
 */
export function PublicSiteHeader({
  tagline,
  nav,
  localeControl,
  actions,
  showMobileMenu = true,
  ariaLabel = 'Шапка сайта',
  brandHomeLabel = 'Прозрачная Цена — на главную',
  brandHomeHref,
  navLabel = 'Разделы',
  menuLabel = 'Открыть меню',
}: {
  tagline?: string;
  nav?: ReactNode;
  localeControl?: ReactNode;
  actions: ReactNode;
  showMobileMenu?: boolean;
  ariaLabel?: string;
  brandHomeLabel?: string;
  brandHomeHref?: string;
  navLabel?: string;
  menuLabel?: string;
}) {
  const resolvedBrandHomeHref = resolveBrandHomeHref(actions, brandHomeHref);
  return (
    <>
      <style>{PUBLIC_SITE_HEADER_STYLES}</style>
      <header className='pc-site-header' data-public-site-header='canonical' aria-label={ariaLabel}>
        <a href={resolvedBrandHomeHref} className='pc-site-brand' aria-label={brandHomeLabel}>
          <span className='pc-site-brand-mark' data-brand-mark='transparent-price-canonical'><BrandMark size={34} /></span>
          <span className='pc-site-brand-text'>
            <strong>Прозрачная Цена</strong>
            {tagline ? <small>{tagline}</small> : null}
          </span>
        </a>

        {nav ? <nav className='pc-site-nav' aria-label={navLabel}>{nav}</nav> : null}

        <div className='pc-site-actions'>
          {localeControl ?? null}
          {nav && showMobileMenu ? (
            <details className='pc-site-mobile-menu'>
              <summary aria-label={menuLabel} title={menuLabel}>
                <span aria-hidden='true' className='pc-site-menu-glyph'><i /><i /><i /></span>
                <span className='pc-visually-hidden'>{menuLabel}</span>
              </summary>
              <div className='pc-site-mobile-nav'>
                <nav className='pc-site-mobile-nav-links' aria-label={navLabel}>{nav}</nav>
                <div className='pc-site-mobile-locale'>{localeControl ?? null}</div>
              </div>
            </details>
          ) : null}
          {actions}
        </div>
      </header>
    </>
  );
}
