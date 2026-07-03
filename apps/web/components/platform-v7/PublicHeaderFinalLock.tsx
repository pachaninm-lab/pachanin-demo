'use client';

import { usePathname } from 'next/navigation';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

type HeaderAction = {
  href: string;
  label: string;
  icon: string;
  primary?: boolean;
};

function getPageActions(pathname: string): HeaderAction[] {
  if (pathname === '/platform-v7') {
    return [
      { href: '/platform-v7/demo', label: 'Демо', icon: '▶' },
      { href: '/platform-v7/contact', label: 'Поддержка', icon: '?' },
      { href: '/platform-v7/login', label: 'Войти', icon: '↪', primary: true },
    ];
  }

  if (pathname === '/platform-v7/login') {
    return [
      { href: '/platform-v7', label: 'Главная', icon: '‹' },
      { href: '/platform-v7/contact', label: 'Поддержка', icon: '?' },
      { href: '/platform-v7/register', label: 'Заявка', icon: '+', primary: true },
    ];
  }

  if (pathname === '/platform-v7/register') {
    return [
      { href: '/platform-v7', label: 'Главная', icon: '‹' },
      { href: '/platform-v7/contact', label: 'Поддержка', icon: '?' },
      { href: '/platform-v7/login', label: 'Войти', icon: '↪', primary: true },
    ];
  }

  if (pathname === '/platform-v7/contact') {
    return [
      { href: '/platform-v7', label: 'Главная', icon: '‹' },
      { href: '/platform-v7/register', label: 'Подключить организацию', icon: '+', primary: true },
      { href: '/platform-v7/login', label: 'Войти', icon: '↪' },
    ];
  }

  if (pathname === '/platform-v7/demo') {
    return [
      { href: '/platform-v7', label: 'Главная', icon: '‹' },
      { href: '/platform-v7/contact', label: 'Вопрос', icon: '?' },
      { href: '/platform-v7/register', label: 'Заявка', icon: '+', primary: true },
    ];
  }

  if (pathname === '/platform-v7/request') {
    return [
      { href: '/platform-v7', label: 'Главная', icon: '‹' },
      { href: '/platform-v7/contact', label: 'Поддержка', icon: '?' },
      { href: '/platform-v7/login', label: 'Вход', icon: '↪', primary: true },
    ];
  }

  if (pathname === '/platform-v7/docs') {
    return [
      { href: '/platform-v7', label: 'Главная', icon: '‹' },
      { href: '/platform-v7/contact', label: 'Вопрос по документам', icon: '?' },
      { href: '/platform-v7/login', label: 'Вход', icon: '↪', primary: true },
    ];
  }

  return [
    { href: '/platform-v7', label: 'Главная', icon: '‹' },
    { href: '/platform-v7/contact', label: 'Поддержка', icon: '?' },
    { href: '/platform-v7/login', label: 'Вход', icon: '↪', primary: true },
  ];
}

const css = `
html body .entry-header,html body .login-top,html body .p7-register-header,html body .p7-contact-header,html body .p7-demo-header,html body .p7-docs-header,html body .p7-request-header{display:none!important;visibility:hidden!important;pointer-events:none!important}
html body:has(.pc-shell-root-v4) .p7-fixed-global-header{display:none!important;visibility:hidden!important;pointer-events:none!important}
html body .p7-fixed-global-header{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:5000!important;height:calc(70px + env(safe-area-inset-top,0px))!important;padding:calc(env(safe-area-inset-top,0px) + 10px) 18px 10px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;background:rgba(255,255,255,.985)!important;border-bottom:1px solid rgba(7,22,17,.08)!important;box-shadow:0 10px 24px rgba(7,22,17,.07)!important;backdrop-filter:blur(18px)!important;color:#071611!important}
html body .p7-fixed-global-header a{color:#071611!important;text-decoration:none!important}
html body .p7-fixed-global-brand{display:inline-flex!important;align-items:center!important;gap:10px!important;min-width:0!important;font-weight:950!important}
html body .p7-fixed-global-brand img{width:42px!important;height:42px!important;min-width:42px!important;object-fit:contain!important;display:block!important}
html body .p7-fixed-global-brand strong{font-size:18px!important;line-height:1.1!important;letter-spacing:-.035em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
html body .p7-fixed-global-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;flex:0 0 auto!important}
html body .p7-fixed-global-actions a{width:44px!important;height:44px!important;border-radius:16px!important;border:1px solid rgba(7,22,17,.1)!important;background:#fff!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;box-shadow:0 6px 18px rgba(7,22,17,.06)!important;font-size:25px!important;font-weight:950!important;line-height:1!important}
html body .p7-fixed-global-actions a[data-primary='true']{border-color:rgba(0,122,47,.22)!important;background:#f1fbf5!important;color:#087a3b!important}
html body .pc-v7-public-entry,html body .pc-v7-login-single,html body .p7-register-page,html body .p7-contact-page,html body .p7-demo-page,html body .p7-docs-page,html body .p7-request-page{padding-top:calc(88px + env(safe-area-inset-top,0px))!important;scroll-padding-top:calc(88px + env(safe-area-inset-top,0px))!important}
html body .pc-shell-root-v4 .pc-v4-main{padding-top:calc(88px + env(safe-area-inset-top,0px))!important}
@media(max-width:390px){html body .p7-fixed-global-header{padding-left:12px!important;padding-right:12px!important}html body .p7-fixed-global-brand img{width:38px!important;height:38px!important;min-width:38px!important}html body .p7-fixed-global-brand strong{font-size:16px!important}html body .p7-fixed-global-actions a{width:40px!important;height:40px!important;border-radius:14px!important}html body .p7-fixed-global-actions{gap:6px!important}}
`;

export function PublicHeaderFinalLock(){
  const pathname = usePathname() || '/platform-v7';
  const actions = getPageActions(pathname);

  return (
    <>
      <header className='p7-fixed-global-header' data-testid='platform-v7-global-fixed-header'>
        <a className='p7-fixed-global-brand' href='/platform-v7' aria-label='Прозрачная Цена'>
          <img src={BRAND_LOGO_DATA_URI} alt='' draggable={false} />
          <strong>Прозрачная Цена</strong>
        </a>
        <nav className='p7-fixed-global-actions' aria-label='Действия страницы'>
          {actions.map((action) => (
            <a key={`${action.href}-${action.label}`} href={action.href} aria-label={action.label} title={action.label} data-primary={action.primary ? 'true' : undefined}>
              {action.icon}
            </a>
          ))}
        </nav>
      </header>
      <style dangerouslySetInnerHTML={{__html:css}}/>
    </>
  );
}
