import type { ReactNode } from 'react';
import Link from 'next/link';
import { PublicSiteHeader } from './PublicSiteHeader';
import { PublicLocaleLink } from './PublicLocaleLink';

type Locale = 'ru' | 'en' | 'zh';
type SurfacePath = '/platform-v7/terms' | '/platform-v7/privacy' | '/platform-v7/oferta' | '/platform-v7/docs';
const COPY = {
  ru: { nav: 'Разделы платформы', menu: 'Открыть меню', home: 'Прозрачная Цена — на главную', register: 'Регистрация', login: 'Войти', how: 'Как работает', trust: 'Доверие', contact: 'Контакты', notice: '', terms: 'Условия использования', privacy: 'Обработка данных', skip: 'Перейти к содержанию' },
  en: { nav: 'Platform navigation', menu: 'Open menu', home: 'Transparent Price — home', register: 'Register', login: 'Sign in', how: 'How it works', trust: 'Trust', contact: 'Contact', notice: 'The authoritative legal text below is published in Russian. This navigation and language notice are not a translation of the consent document. Contact support for an explanation.', terms: 'Terms of use', privacy: 'Data processing', skip: 'Skip to content' },
  zh: { nav: '平台导航', menu: '打开菜单', home: '透明价格 — 返回首页', register: '注册', login: '登录', how: '如何运行', trust: '信任', contact: '联系', notice: '以下具有权威性的法律原文以俄语发布。此导航和语言说明不是同意文件的译文。如需解释，请联系支持团队。', terms: '使用条款', privacy: '数据处理', skip: '跳到内容' },
} satisfies Record<Locale, Record<string, string>>;

export function PublicLinkedSurfaceShell({ pathname, locale, children }: { pathname: SurfacePath; locale: string; children: ReactNode }) {
  const lang: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const copy = COPY[lang];
  const suffix = `?lang=${lang}`;
  const legal = pathname === '/platform-v7/terms' || pathname === '/platform-v7/privacy';
  const nav = <><Link href={`/platform-v7/how-it-works${suffix}`}>{copy.how}</Link><Link href={`/platform-v7/trust${suffix}`}>{copy.trust}</Link><Link href={`/platform-v7/contact${suffix}`}>{copy.contact}</Link><Link href={`/platform-v7/login${suffix}`}>{copy.login}</Link></>;
  return <div className='pc-linked-surface' data-linked-surface={pathname}>
    <style>{CSS}</style>
    <a className='pc-linked-skip' href='#pc-linked-content'>{copy.skip}</a>
    <PublicSiteHeader ariaLabel={copy.nav} brandHomeLabel={copy.home} brandHomeHref={`/platform-v7${suffix}`} navLabel={copy.nav} menuLabel={copy.menu} nav={nav} showMobileMenu localeControl={<PublicLocaleLink />} actions={<Link className='pc-v6-header-cta' href={`/platform-v7/register${suffix}`}>{copy.register}</Link>} />
    <div id='pc-linked-content' className='pc-linked-content' tabIndex={-1}>
      {legal ? <><h1 className={lang === 'ru' ? 'pc-linked-title pc-visually-hidden' : 'pc-linked-title'}>{pathname === '/platform-v7/terms' ? copy.terms : copy.privacy}</h1>{lang !== 'ru' ? <aside className='pc-linked-notice' lang={lang}><p>{copy.notice}</p><Link href={`/platform-v7/contact${suffix}`}>{copy.contact}</Link></aside> : null}<main className='pc-linked-policy' lang='ru'>{children}</main></> : children}
      <nav className='pc-linked-footer' aria-label={copy.nav}><Link href={`/platform-v7${suffix}`}>{copy.home}</Link><Link href={`/platform-v7/contact${suffix}`}>{copy.contact}</Link></nav>
    </div>
  </div>;
}

const CSS = `
.pc-linked-surface{min-height:100dvh;background:#f7faf8;color:#102019}.pc-linked-surface,.pc-linked-surface *{box-sizing:border-box}.pc-linked-content{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:96px 0 100px;min-width:0}.pc-linked-title{margin:0 0 20px;font-size:clamp(28px,5vw,42px);line-height:1.12;overflow-wrap:anywhere}.pc-linked-notice{padding:16px 20px;margin-bottom:20px;border:1px solid #c6d5cb;border-radius:14px;background:#fff}.pc-linked-notice p{margin:0;font-size:15px;line-height:1.6}.pc-linked-footer{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.pc-linked-footer a,.pc-linked-notice a{display:inline-flex;align-items:center;min-height:44px;padding:8px 12px;color:#07572e;overflow-wrap:anywhere}.pc-linked-policy{min-width:0;overflow-wrap:anywhere}.pc-linked-policy a{min-height:44px;align-items:center}.pc-linked-policy>div>div:last-child>a{display:inline-flex}.pc-linked-policy>div>section>div[style*='grid-template-columns']{grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))!important}.pc-linked-policy a:is([href='/platform-v7/auth'],[href='/platform-v7/bank'],[href='/platform-v7/profile'],[href='/platform-v7/security'],[href='/platform-v7/status']){display:none!important}
/* Only the Privacy navigation-only section has no remaining public destination.
   Legal-policy sections and the transitive PrivacyPortalPanel remain visible. */
[data-linked-surface='/platform-v7/privacy'] .pc-linked-policy>div>section:has(>div>a[href='/platform-v7/status']){display:none!important}
.pc-linked-surface a:focus-visible{outline:3px solid #087a3b;outline-offset:3px}.pc-linked-skip{position:fixed;left:12px;top:8px;z-index:2700;transform:translateY(-200%);min-height:44px;padding:12px;background:#fff;color:#07572e;border:2px solid #087a3b}.pc-linked-skip:focus{transform:none}
@media(max-width:430px){.pc-linked-content{width:calc(100% - 24px);padding-top:84px}.pc-linked-notice{padding:14px}.pc-linked-title{font-size:28px}}
@media(prefers-reduced-motion:reduce){.pc-linked-surface{scroll-behavior:auto}}
@media(forced-colors:active){.pc-linked-notice,.pc-linked-skip{border:1px solid CanvasText;background:Canvas;color:CanvasText}}
.pc-linked-info{display:grid;gap:24px;min-width:0}.pc-linked-info h1{max-width:22ch;margin:0;font-size:clamp(32px,4.8vw,56px);line-height:1.08;letter-spacing:-.03em;overflow-wrap:anywhere}.pc-linked-info h2{margin:0;font-size:23px;line-height:1.25;overflow-wrap:anywhere}.pc-linked-info p{margin:14px 0 0;color:#40564b;font-size:16px;line-height:1.65}.pc-linked-hero,.pc-linked-card,.pc-linked-grid article{min-width:0;padding:clamp(18px,3vw,32px);border:1px solid #cbd9d1;border-radius:18px;background:#fff}.pc-linked-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.pc-linked-grid svg{margin-bottom:16px;color:#087a3b}.pc-linked-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}.pc-linked-actions a{min-height:48px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;border:1px solid #b9d0c3;border-radius:12px;text-decoration:none;line-height:1.4;color:#07572e}.pc-linked-actions .pc-linked-primary{background:#087a3b;border-color:#087a3b;color:#fff}@media(max-width:900px){.pc-linked-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.pc-linked-grid{grid-template-columns:1fr}.pc-linked-actions a{width:100%}}
`;
