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
.pc-site-brand{display:inline-flex;align-items:center;gap:8px;min-width:0;flex:0 0 auto;color:#071611;text-decoration:none}
.pc-site-brand-mark{width:34px;height:34px;flex:0 0 34px;display:inline-grid;place-items:center}
.pc-site-brand-mark>span,.pc-site-brand-mark img{width:100%!important;height:100%!important;display:block!important;object-fit:contain!important}
.pc-site-brand-text{display:grid;min-width:0}.pc-site-brand-text strong{font-size:16px;line-height:1;font-weight:900;letter-spacing:-.035em;white-space:nowrap}.pc-site-brand-text small{margin-top:2px;color:#66736e;font-size:10px;font-weight:650;white-space:nowrap}
.pc-site-nav{flex:1 1 auto;display:flex;justify-content:center;align-items:center;gap:15px;min-width:0;font-size:11px;font-weight:760;color:#17251f}
.pc-site-nav a{min-height:44px;display:inline-flex;align-items:center;color:inherit;text-decoration:none;white-space:nowrap}.pc-site-nav a:hover{color:#087a3b}
.pc-site-actions{margin-left:auto;display:flex;align-items:center;gap:7px;flex:0 0 auto}.pc-site-actions>div{display:flex;align-items:center;gap:7px}
.pc-site-mobile-menu{position:relative;display:none;flex:0 0 auto}.pc-site-mobile-menu>summary,.pc-site-header .pc-site-locale-switch,.pc-site-header .entry-login,.pc-site-header .pc-site-action{box-sizing:border-box;min-width:44px;height:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #c6d5cb;border-radius:9px;background:#fff;color:#092118;text-decoration:none}
.pc-site-mobile-menu>summary{padding:0;list-style:none;cursor:pointer}.pc-site-mobile-menu>summary::-webkit-details-marker{display:none}
.pc-site-menu-glyph{width:18px;display:grid;gap:4px}.pc-site-menu-glyph i{width:18px;height:2px;border-radius:99px;background:currentColor}
.pc-site-mobile-nav{position:fixed;top:68px;right:max(10px,env(safe-area-inset-right));width:min(340px,calc(100vw - 20px));max-height:calc(100dvh - 82px);overflow:auto;display:grid;gap:2px;padding:10px;border:1px solid #d6e0da;border-radius:14px;background:#fff;box-shadow:0 18px 44px rgba(16,42,29,.16)}
.pc-site-mobile-nav a{min-height:44px;padding:0 12px;border-radius:9px;justify-content:flex-start}
.pc-site-header :is(.pc-v6-header-cta,.pc-ppe-primary-button,.p7-about-register,.p7-contact-register){box-sizing:border-box;min-width:44px;height:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 13px;border:1px solid #087a3b;border-radius:9px;background:#087a3b;color:#fff!important;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}
.pc-site-header :focus-visible{outline:3px solid rgba(25,117,82,.34);outline-offset:2px}
@media(max-width:980px){.pc-site-nav{display:none}.pc-site-mobile-menu{display:block}.pc-site-brand-text small{display:none}}
@media(max-width:760px){.pc-site-header{height:60px;gap:5px;padding:0 8px}.pc-site-brand{gap:6px;flex:1 1 auto}.pc-site-brand-mark{width:31px;height:31px;flex-basis:31px}.pc-site-brand-text strong{font-size:13px}.pc-site-actions,.pc-site-actions>div{gap:3px}.pc-site-mobile-menu>summary{width:44px}.pc-site-mobile-nav{top:64px}.pc-site-header :is(.pc-v6-header-cta,.pc-ppe-primary-button,.p7-about-register,.p7-contact-register){padding-inline:9px;font-size:11px}}
@media(max-width:430px){.pc-site-header{padding-inline:6px}.pc-site-brand-text strong{font-size:12px}.pc-site-brand{min-width:118px}}
@media(prefers-reduced-motion:reduce){.pc-site-header *{scroll-behavior:auto!important}}
@media(forced-colors:active){.pc-site-header,.pc-site-mobile-menu>summary,.pc-site-mobile-nav,.pc-site-header .entry-login,.pc-site-header .pc-site-action{border:1px solid CanvasText}}
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
