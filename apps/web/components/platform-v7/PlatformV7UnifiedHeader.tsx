'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Globe2, LogOut, Menu, X } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';
import {
  platformV7DrawerNavByRole,
  platformV7NavByRole,
  platformV7RoleRoute,
  type PlatformV7RoleNavItem,
} from '@/lib/platform-v7/shellRoutes';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const PENDING_ROLE_KEY = 'pc_v7_pending_role';
const STORE_KEY = 'pc-session-v10';
const LANGUAGE_KEY = 'pc-v7-language';

type Lang = 'RU' | 'EN' | 'ZH';
type HeaderLink = { href: string; label: string; note?: string };

const ROLE_PREFIXES: Array<[string, PlatformRole]> = [
  ['/platform-v7/control-tower', 'operator'],
  ['/platform-v7/operator', 'operator'],
  ['/platform-v7/buyer', 'buyer'],
  ['/platform-v7/procurement', 'buyer'],
  ['/platform-v7/seller', 'seller'],
  ['/platform-v7/logistics', 'logistics'],
  ['/platform-v7/driver', 'driver'],
  ['/platform-v7/surveyor', 'surveyor'],
  ['/platform-v7/elevator', 'elevator'],
  ['/platform-v7/lab', 'lab'],
  ['/platform-v7/bank', 'bank'],
  ['/platform-v7/arbitrator', 'arbitrator'],
  ['/platform-v7/compliance', 'compliance'],
  ['/platform-v7/executive', 'executive'],
];

const PUBLIC_LINKS: HeaderLink[] = [
  { href: '/platform-v7', label: 'Главная', note: 'Описание платформы' },
  { href: '/platform-v7/login', label: 'Вход', note: 'Единый вход в рабочие кабинеты' },
  { href: '/platform-v7/register', label: 'Подключение компании', note: 'Заявка на доступ' },
  { href: '/platform-v7/demo', label: 'Демо-сделка', note: 'Показ рабочего сценария' },
  { href: '/platform-v7/contact', label: 'Обращение', note: 'Вопрос или заявка' },
  { href: '/platform-v7/docs', label: 'Документы', note: 'Материалы платформы' },
];

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function roleFromPath(pathname: string | null): PlatformRole | null {
  const path = normalize(pathname);
  const match = ROLE_PREFIXES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match?.[1] ?? null;
}

function isActive(pathname: string | null, href: string) {
  const path = normalize(pathname);
  const target = normalize(href);
  return path === target || path.startsWith(`${target}/`);
}

function readLanguage(): Lang {
  if (typeof window === 'undefined') return 'RU';
  const value = window.localStorage.getItem(LANGUAGE_KEY);
  return value === 'en' ? 'EN' : value === 'zh' ? 'ZH' : 'RU';
}

function writeLanguage(lang: Lang) {
  if (typeof window === 'undefined') return;
  const value = lang === 'EN' ? 'en' : lang === 'ZH' ? 'zh' : 'ru';
  window.localStorage.setItem(LANGUAGE_KEY, value);
  window.dispatchEvent(new CustomEvent('pc-v7-language-change', { detail: value }));
}

function toHeaderLinks(items: PlatformV7RoleNavItem[]): HeaderLink[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  }).map((item) => ({ href: item.href, label: item.label, note: item.note }));
}

function clearSession() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    window.sessionStorage.removeItem(PENDING_ROLE_KEY);
    window.localStorage.removeItem(STORE_KEY);
  }
  if (typeof document !== 'undefined') {
    document.cookie = 'pc-role=; Max-Age=0; Path=/; SameSite=Lax';
  }
}

export function PlatformV7UnifiedHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const storeRole = usePlatformV7RStore((state) => state.role);
  const clearRoleSelection = usePlatformV7RStore((state) => state.clearRoleSelection);
  const routeRole = roleFromPath(pathname);
  const role = routeRole ?? storeRole ?? 'operator';
  const privateRoute = Boolean(routeRole);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [lang, setLang] = React.useState<Lang>('RU');

  React.useEffect(() => { setLang(readLanguage()); }, []);
  React.useEffect(() => { setMenuOpen(false); }, [pathname]);

  const roleLinks = privateRoute
    ? toHeaderLinks([{ href: platformV7RoleRoute(role), label: 'Кабинет', note: 'Главный экран роли' }, ...platformV7NavByRole(role), ...platformV7DrawerNavByRole(role)])
    : [];
  const links = privateRoute ? [...roleLinks, ...PUBLIC_LINKS] : PUBLIC_LINKS;

  function cycleLanguage() {
    const next = lang === 'RU' ? 'EN' : lang === 'EN' ? 'ZH' : 'RU';
    setLang(next);
    writeLanguage(next);
  }

  function exit() {
    clearRoleSelection();
    clearSession();
    router.replace('/platform-v7');
  }

  return (
    <>
      <header className='p7-unified-header' aria-label='Единая шапка платформы'>
        <Link href='/platform-v7' className='p7-unified-brand' aria-label='Прозрачная Цена — главная'>
          <span className='p7-unified-logo'><BrandMark size={42} /></span>
          <span className='p7-unified-title'>Прозрачная Цена</span>
        </Link>
        <div className='p7-unified-actions'>
          <button type='button' className='p7-unified-icon p7-unified-lang' onClick={cycleLanguage} aria-label='Сменить язык' title='Сменить язык'>
            <Globe2 size={20} strokeWidth={2.35} />
            <span>{lang}</span>
          </button>
          <button type='button' className='p7-unified-icon p7-unified-exit' onClick={exit} aria-label={privateRoute ? 'Выйти' : 'На главную'} title={privateRoute ? 'Выйти' : 'На главную'}>
            <LogOut size={21} strokeWidth={2.35} />
          </button>
          <button type='button' className='p7-unified-icon p7-unified-menu' onClick={() => setMenuOpen((value) => !value)} aria-label='Открыть меню' aria-expanded={menuOpen} title='Меню'>
            {menuOpen ? <X size={23} strokeWidth={2.45} /> : <Menu size={23} strokeWidth={2.45} />}
          </button>
        </div>
      </header>
      <div className='p7-unified-header-spacer' aria-hidden='true' />
      {menuOpen ? (
        <div className='p7-unified-drawer-backdrop' onClick={() => setMenuOpen(false)}>
          <aside className='p7-unified-drawer' aria-label='Меню платформы' onClick={(event) => event.stopPropagation()}>
            <div className='p7-unified-drawer-head'>
              <BrandMark size={36} />
              <div><strong>Прозрачная Цена</strong><span>{privateRoute ? 'Рабочее меню' : 'Публичное меню'}</span></div>
            </div>
            <nav className='p7-unified-drawer-nav'>
              {links.map((item) => (
                <Link key={`${item.href}:${item.label}`} href={item.href} className='p7-unified-drawer-link' data-active={isActive(pathname, item.href) ? 'true' : 'false'}>
                  <strong>{item.label}</strong>
                  {item.note ? <span>{item.note}</span> : null}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
      <style jsx global>{`
        :root{--p7-unified-header-h:calc(env(safe-area-inset-top) + 76px)}
        html,body{scroll-padding-top:var(--p7-unified-header-h)!important;overflow-x:hidden!important}
        .p7-unified-header{position:fixed;top:0;left:0;right:0;z-index:9000;min-height:var(--p7-unified-header-h);height:var(--p7-unified-header-h);padding:calc(env(safe-area-inset-top) + 10px) clamp(12px,3vw,32px) 10px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;background:rgba(255,255,255,.96);border-bottom:1px solid rgba(7,22,17,.08);box-shadow:0 10px 34px rgba(7,22,17,.08);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
        .p7-unified-header-spacer{height:var(--p7-unified-header-h);min-height:var(--p7-unified-header-h);width:100%;flex:0 0 auto}
        .p7-unified-brand{display:inline-flex;align-items:center;gap:12px;min-width:0;color:#071611;text-decoration:none;overflow:hidden}
        .p7-unified-logo{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;min-width:42px;flex:0 0 42px;overflow:visible}
        .p7-unified-title{display:block;min-width:0;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:clamp(22px,4.8vw,32px);line-height:1;font-weight:950;letter-spacing:-.055em;color:#071611}
        .p7-unified-actions{display:inline-flex;align-items:center;justify-content:flex-end;gap:8px;min-width:max-content;max-width:max-content;overflow:visible}
        .p7-unified-icon{width:44px;height:44px;min-width:44px;max-width:44px;min-height:44px;max-height:44px;padding:0;border-radius:15px;border:1px solid rgba(7,22,17,.10);background:#fff;color:#071611;display:inline-flex;align-items:center;justify-content:center;gap:0;box-shadow:0 8px 20px rgba(7,22,17,.05);cursor:pointer;appearance:none}
        .p7-unified-icon svg{width:21px;height:21px;min-width:21px;max-width:21px;flex:0 0 21px}
        .p7-unified-lang{width:auto;min-width:60px;max-width:72px;padding:0 10px;gap:5px;color:#087a3b;background:rgba(8,122,59,.08);border-color:rgba(8,122,59,.18)}
        .p7-unified-lang span{font-size:12px;line-height:1;font-weight:950;color:#087a3b}
        .p7-unified-exit{color:#9f1d1d;background:rgba(159,29,29,.06);border-color:rgba(159,29,29,.20)}
        .p7-unified-menu{color:#071611}
        .p7-unified-drawer-backdrop{position:fixed;inset:0;z-index:8999;background:rgba(7,22,17,.18);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);padding-top:var(--p7-unified-header-h)}
        .p7-unified-drawer{position:fixed;top:var(--p7-unified-header-h);right:10px;left:auto;width:min(420px,calc(100vw - 20px));max-height:calc(100dvh - var(--p7-unified-header-h) - 12px);overflow:auto;border-radius:24px;border:1px solid rgba(7,22,17,.10);background:rgba(255,255,255,.98);box-shadow:0 24px 70px rgba(7,22,17,.20);padding:14px;display:grid;gap:12px}
        .p7-unified-drawer-head{display:flex;align-items:center;gap:10px;padding:8px 8px 12px;border-bottom:1px solid rgba(7,22,17,.08)}
        .p7-unified-drawer-head strong{display:block;font-size:16px;line-height:1;font-weight:950;color:#071611}.p7-unified-drawer-head span{display:block;margin-top:4px;font-size:12px;font-weight:800;color:#68756f}
        .p7-unified-drawer-nav{display:grid;gap:7px}.p7-unified-drawer-link{display:grid;gap:3px;padding:12px 13px;border-radius:16px;border:1px solid rgba(7,22,17,.08);background:#fff;text-decoration:none;color:#071611}.p7-unified-drawer-link[data-active='true']{background:rgba(8,122,59,.08);border-color:rgba(8,122,59,.20);color:#087a3b}.p7-unified-drawer-link strong{font-size:14px;font-weight:950;line-height:1.1}.p7-unified-drawer-link span{font-size:12px;line-height:1.35;font-weight:750;color:#66736d}
        .pc-v4-header,.entry-header,.login-header,.p7-register-header,.p7-contact-header,.p7-contact-fixed-header,.p7-demo-header{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
        .pc-v4-main{padding-top:12px!important}.pc-shell-root-v4{--pc-header-offset:0px!important}.pc-v7-public-entry,.pc-v7-login-single,.p7-register-page,.p7-contact-page,.p7-demo-page{padding-top:0!important;margin-top:0!important}.pc-v7-public-entry .entry-hero{margin-top:16px!important}.pc-v4-main>main:first-child,.pc-v4-main>div:first-child{margin-top:0!important}
        @media(max-width:767px){:root{--p7-unified-header-h:calc(env(safe-area-inset-top) + 70px)}.p7-unified-header{padding:calc(env(safe-area-inset-top) + 8px) 10px 8px;gap:8px}.p7-unified-brand{gap:9px}.p7-unified-logo{width:40px;height:40px;min-width:40px;flex-basis:40px}.p7-unified-title{font-size:21px}.p7-unified-actions{gap:6px}.p7-unified-icon{width:40px;height:40px;min-width:40px;max-width:40px;min-height:40px;max-height:40px;border-radius:14px}.p7-unified-lang{min-width:54px;max-width:60px;padding:0 7px}.p7-unified-lang span{font-size:11px}.p7-unified-drawer{right:8px;width:calc(100vw - 16px);border-radius:22px}.pc-v4-main{padding-top:10px!important}}
        @media(max-width:374px){.p7-unified-title{font-size:18px}.p7-unified-logo{width:36px;height:36px;min-width:36px;flex-basis:36px}.p7-unified-icon{width:38px;height:38px;min-width:38px;max-width:38px;min-height:38px;max-height:38px;border-radius:13px}.p7-unified-lang{min-width:50px;max-width:54px;padding:0 6px}.p7-unified-actions{gap:5px}}
      `}</style>
    </>
  );
}
