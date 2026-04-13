'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

function Ico({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      strokeWidth={1.75} stroke="currentColor" width={size} height={size}
      aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ICO = {
  dashboard: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  roles: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  deal: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
  bank: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z',
  documents: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  disputes: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  catalog: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
};

const nav: Array<[string, string, string]> = [
  ['/platform-v7', 'Дашборд', ICO.dashboard],
  ['/platform-v7/roles', 'Роли', ICO.roles],
  ['/platform-v7/deal', 'Сделка', ICO.deal],
  ['/platform-v7/bank', 'Деньги', ICO.bank],
  ['/platform-v7/documents', 'Документы', ICO.documents],
  ['/platform-v7/control', 'Споры', ICO.disputes],
  ['/platform-v7/catalog', 'Каталог', ICO.catalog],
];

const labels: Record<string, string> = {
  '/platform-v7': 'Дашборд',
  '/platform-v7/roles': 'Роли',
  '/platform-v7/seller': 'Продавец',
  '/platform-v7/buyer': 'Покупатель',
  '/platform-v7/driver': 'Водитель',
  '/platform-v7/deal': 'Сделка',
  '/platform-v7/bank': 'Деньги',
  '/platform-v7/documents': 'Документы',
  '/platform-v7/control': 'Споры',
  '/platform-v7/catalog': 'Каталог',
};

function crumbs(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  const result: Array<[string, string]> = [];
  let current = '';
  for (const part of parts) {
    current += `/${part}`;
    result.push([current, labels[current] ?? part]);
  }
  return result;
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const breadcrumb = crumbs(pathname);
  return (
    <div className='t7-app'>
      <aside className='t7-rail' aria-label='Панель навигации'>
        <div className='t7-brand'>
          <div className='t7-logo'>ПЦ</div>
          <div className='t7-brand-text'>
            <div className='t7-title'>Прозрачная Цена</div>
            <div className='t7-sub'>ERP-контур зерновой сделки</div>
          </div>
          <span className='t7-ver'>v7</span>
        </div>
        <nav className='t7-nav' aria-label='Основная навигация'>
          {nav.map(([href, label, ico]) => {
            const isActive = href === '/platform-v7'
              ? pathname === href
              : pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`t7-navlink${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Ico d={ico} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className='t7-userzone'>
          <div className='t7-useravatar' aria-hidden='true'>О</div>
          <div>
            <div className='t7-username'>Оператор</div>
            <div className='t7-userrole'>Демо-сессия</div>
          </div>
        </div>
      </aside>

      <div className='t7-stage'>
        <header className='t7-top'>
          <div className='t7-top-inner'>
            <div>
              <div className='t7-top-title'>Прозрачная Цена · Операционный контур</div>
              <div className='t7-top-sub'>Только факты, блокеры и следующий шаг</div>
            </div>
            <div className='t7-tags'>
              <span className='t7-chip t7-chip-indigo'>Pilot-ready</span>
              <span className='t7-chip'>17 статусов</span>
              <span className='t7-chip t7-chip-success'>v7</span>
            </div>
          </div>
          <nav className='t7-crumbs' aria-label='Навигационная цепочка'>
            {breadcrumb.map(([href, label], i) => (
              <span key={href} className='t7-crumb-item'>
                <Link
                  href={href}
                  className={`t7-crumb${i === breadcrumb.length - 1 ? ' is-current' : ''}`}
                  aria-current={i === breadcrumb.length - 1 ? 'page' : undefined}
                >
                  {label}
                </Link>
                {i < breadcrumb.length - 1 && (
                  <span className='t7-sep' aria-hidden='true'>/</span>
                )}
              </span>
            ))}
          </nav>
        </header>

        <main id='main-content'>{children}</main>

        <nav className='t7-mobile' aria-label='Мобильная навигация'>
          {nav.slice(0, 6).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`t7-mobilelink${pathname === href ? ' is-active' : ''}`}
              aria-current={pathname === href ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <style jsx global>{`
        :root {
          --bg: #f8fafc; --card: #fff; --line: #e2e8f0;
          --text: #0f172a; --text2: #475569; --text3: #64748b;
          --indigo: #4f46e5; --success: #059669; --warn: #f59e0b;
          --danger: #dc2626; --info: #0ea5e9;
          --seller: #0f766e; --buyer: #2563eb; --driver: #f97316;
          --bank: #4338ca; --docs: #8b5e34; --control: #7c3aed;
        }
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; overflow-x: hidden; }
        a { text-decoration: none; color: inherit; }
        a:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; border-radius: 4px; }

        /* APP SHELL */
        .t7-app { min-height: 100vh; background: radial-gradient(circle at top right, rgba(79,70,229,.07), transparent 34%), radial-gradient(circle at bottom left, rgba(14,165,233,.05), transparent 26%), linear-gradient(180deg, #fbfdff 0%, var(--bg) 50%, #f1f5f9 100%); }
        .t7-stage { min-width: 0; display: flex; flex-direction: column; }

        /* SIDEBAR */
        .t7-rail { display: none; flex-direction: column; }
        .t7-brand { display: flex; align-items: center; gap: 10px; padding: 16px 14px 14px; border-bottom: 1px solid var(--line); }
        .t7-logo { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: var(--indigo); color: #fff; font-size: 12px; font-weight: 900; letter-spacing: -.02em; flex-shrink: 0; }
        .t7-brand-text { flex: 1; min-width: 0; }
        .t7-title { font-size: 14px; font-weight: 800; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .t7-sub { margin-top: 2px; font-size: 11px; line-height: 1.4; color: var(--text3); }
        .t7-ver { flex-shrink: 0; padding: 2px 7px; border-radius: 6px; background: rgba(79,70,229,.08); border: 1px solid rgba(79,70,229,.16); font-size: 10px; font-weight: 800; color: var(--indigo); }
        .t7-nav { display: grid; gap: 2px; padding: 10px 10px 16px; flex: 1; }
        .t7-navlink { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 0 12px; border-radius: 12px; color: var(--text2); font-size: 13px; font-weight: 600; transition: background .12s, color .12s; }
        .t7-navlink:hover { background: rgba(15,23,42,.04); color: var(--text); }
        .t7-navlink:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; }
        .t7-navlink.is-active { background: #fff; border: 1px solid rgba(79,70,229,.14); box-shadow: 0 2px 8px rgba(15,23,42,.06); color: var(--text); font-weight: 700; }
        .t7-navlink.is-active svg { color: var(--indigo); }
        .t7-userzone { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-top: 1px solid var(--line); }
        .t7-useravatar { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, var(--indigo), #6366f1); color: #fff; font-size: 11px; font-weight: 800; flex-shrink: 0; }
        .t7-username { font-size: 13px; font-weight: 700; line-height: 1.2; }
        .t7-userrole { font-size: 11px; color: var(--text3); }

        /* TOP HEADER */
        .t7-top { position: sticky; top: 0; z-index: 30; padding: 12px 16px 10px; background: rgba(248,250,252,.92); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(226,232,240,.9); }
        .t7-top-inner { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .t7-top-title { font-size: 15px; font-weight: 800; }
        .t7-top-sub { margin-top: 2px; font-size: 12px; color: var(--text3); }
        .t7-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .t7-crumbs { display: flex; flex-wrap: wrap; gap: 2px; align-items: center; margin-top: 8px; }
        .t7-crumb-item { display: flex; align-items: center; gap: 4px; }
        .t7-crumb { font-size: 12px; font-weight: 600; color: var(--text3); padding: 2px 4px; border-radius: 4px; }
        .t7-crumb:hover { color: var(--text); background: rgba(15,23,42,.04); }
        .t7-crumb.is-current { color: var(--text); font-weight: 700; }
        .t7-sep { font-size: 12px; color: #cbd5e1; }

        /* MOBILE NAV */
        .t7-mobile { position: sticky; bottom: 0; display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px; padding: 8px 8px calc(8px + env(safe-area-inset-bottom)); background: rgba(255,255,255,.95); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border-top: 1px solid var(--line); }
        .t7-mobilelink { display: grid; place-items: center; min-height: 38px; font-size: 10px; font-weight: 700; color: var(--text3); text-align: center; border-radius: 8px; transition: background .1s; }
        .t7-mobilelink:hover { background: rgba(79,70,229,.06); }
        .t7-mobilelink.is-active { color: var(--indigo); background: rgba(79,70,229,.08); }

        /* CONTENT AREA */
        .t7-frame { max-width: 1440px; margin: 0 auto; padding: 20px 16px 40px; }
        .t7-stack { display: grid; gap: 16px; }

        /* CARDS & PANELS */
        .t7-hero, .t7-panel, .t7-card, .t7-alert, .t7-money { background: var(--card); border: 1px solid var(--line); box-shadow: 0 1px 3px rgba(0,0,0,.04); }
        .t7-hero, .t7-panel, .t7-alert, .t7-money { border-radius: 24px; padding: 24px; }
        .t7-card { border-radius: 20px; padding: 18px; }

        /* TYPOGRAPHY */
        .t7-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; font-weight: 800; color: var(--indigo); }
        .t7-h1 { margin: 12px 0 0; font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.04; letter-spacing: -.03em; font-weight: 700; max-width: 15ch; }
        .t7-h2 { margin: 0; font-size: 20px; line-height: 1.2; font-weight: 600; }
        .t7-h3 { margin: 0; font-size: 15px; font-weight: 700; }
        .t7-lead { margin: 14px 0 0; font-size: 16px; line-height: 1.65; color: var(--text2); max-width: 72ch; }
        .t7-text { font-size: 14px; line-height: 1.55; color: var(--text2); }
        .t7-small { font-size: 12px; color: var(--text3); }

        /* BUTTONS */
        .t7-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
        .t7-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 18px; border-radius: 14px; font-size: 14px; font-weight: 700; border: 1px solid var(--line); background: #fff; cursor: pointer; transition: box-shadow .15s, transform .1s, background .1s; white-space: nowrap; }
        .t7-btn:hover { box-shadow: 0 4px 14px rgba(15,23,42,.1); transform: translateY(-1px); }
        .t7-btn:active { transform: translateY(0); }
        .t7-btn:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; }
        .t7-btn.primary { background: var(--indigo); border-color: transparent; color: #fff; }
        .t7-btn.primary:hover { background: #4338ca; }
        .t7-btn.ghost { background: rgba(79,70,229,.07); border-color: rgba(79,70,229,.16); color: var(--indigo); }
        .t7-btn.danger { color: var(--danger); border-color: rgba(220,38,38,.2); }
        .t7-btn.danger:hover { background: rgba(220,38,38,.05); }
        .t7-btn.big { min-height: 56px; font-size: 16px; border-radius: 18px; padding: 0 28px; }

        /* GRIDS */
        .t7-grid2, .t7-grid3, .t7-grid4 { display: grid; gap: 16px; }
        .t7-grid2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .t7-grid3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .t7-grid4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

        /* CHIPS */
        .t7-chip { display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; background: #f1f5f9; border: 1px solid var(--line); font-size: 11px; font-weight: 700; color: var(--text3); white-space: nowrap; }
        .t7-chip-indigo { background: rgba(79,70,229,.08); border-color: rgba(79,70,229,.16); color: var(--indigo); }
        .t7-chip-success { background: rgba(5,150,105,.08); border-color: rgba(5,150,105,.18); color: var(--success); }
        .t7-chip-warn { background: rgba(245,158,11,.1); border-color: rgba(245,158,11,.2); color: #b45309; }
        .t7-chip-danger { background: rgba(220,38,38,.07); border-color: rgba(220,38,38,.16); color: var(--danger); }
        .t7-chip-seller { background: rgba(15,118,110,.08); border-color: rgba(15,118,110,.16); color: var(--seller); }
        .t7-chip-buyer { background: rgba(37,99,235,.08); border-color: rgba(37,99,235,.16); color: var(--buyer); }
        .t7-chip-driver { background: rgba(249,115,22,.09); border-color: rgba(249,115,22,.18); color: var(--driver); }
        .t7-chip-bank { background: rgba(67,56,202,.08); border-color: rgba(67,56,202,.16); color: var(--bank); }
        .t7-chip-docs { background: rgba(139,94,52,.09); border-color: rgba(139,94,52,.16); color: var(--docs); }
        .t7-chip-control { background: rgba(124,58,237,.09); border-color: rgba(124,58,237,.16); color: var(--control); }

        /* VALUES / METRICS */
        .t7-mono, .t7-value { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace; font-variant-numeric: tabular-nums; }
        .t7-value { font-size: 28px; font-weight: 700; margin-top: 12px; line-height: 1.1; }
        .t7-value-sm { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .t7-label { margin-top: 8px; font-size: 13px; line-height: 1.5; color: var(--text2); }

        /* ROWS / LISTS */
        .t7-list { display: grid; gap: 0; }
        .t7-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 13px 0; border-top: 1px solid #f1f5f9; align-items: start; }
        .t7-row:first-child { border-top: 0; }
        .t7-rowtitle { font-size: 14px; line-height: 1.45; font-weight: 600; }
        .t7-rowtext { margin-top: 4px; font-size: 12px; line-height: 1.5; color: var(--text2); }

        /* PROGRESS */
        .t7-progress { height: 8px; border-radius: 999px; background: #e2e8f0; overflow: hidden; margin-top: 10px; }
        .t7-progress > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--indigo), #6366f1); transition: width .6s ease; }

        /* STEPS PIPELINE */
        .t7-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; }
        .t7-step { display: grid; gap: 8px; }
        .t7-line { height: 4px; border-radius: 999px; background: #e2e8f0; }
        .t7-step.done .t7-line { background: var(--success); }
        .t7-step.active .t7-line { background: var(--indigo); }
        .t7-step.blocked .t7-line { background: var(--warn); }
        .t7-step.pending .t7-line { background: #e2e8f0; }
        .t7-steptitle { font-size: 12px; font-weight: 700; }
        .t7-stepmeta { font-size: 11px; line-height: 1.45; color: var(--text3); }

        /* ROLE CARDS (roles page) */
        .t7-role { display: grid; gap: 14px; padding: 20px; border-radius: 22px; background: #fff; border: 1px solid var(--line); box-shadow: 0 1px 3px rgba(0,0,0,.04); transition: box-shadow .18s, transform .14s; }
        .t7-role:hover { transform: translateY(-3px); box-shadow: 0 16px 36px rgba(15,23,42,.09); }
        .t7-role:focus-visible { outline: 2px solid var(--indigo); outline-offset: 3px; }
        .t7-rolehead { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .t7-roletitle { margin: 0; font-size: 19px; line-height: 1.2; font-weight: 700; }
        .t7-rolesummary { margin: 0; font-size: 14px; line-height: 1.55; color: var(--text2); }
        .t7-rolebullets { margin: 0; padding: 0 0 0 16px; display: grid; gap: 6px; }
        .t7-rolebullets li { font-size: 13px; line-height: 1.55; color: var(--text2); }
        .t7-rolemetrics { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; border-top: 1px solid #f1f5f9; }
        .t7-rolemetric { display: grid; gap: 2px; }
        .t7-rolemetric-v { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .t7-rolemetric-l { font-size: 11px; color: var(--text3); }
        .t7-cta { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: var(--indigo); }

        /* DESKTOP */
        @media (min-width: 1200px) {
          .t7-app { display: grid; grid-template-columns: 252px minmax(0, 1fr); }
          .t7-rail { display: flex; min-height: 100vh; height: 100vh; position: sticky; top: 0; overflow-y: auto; border-right: 1px solid var(--line); background: rgba(255,255,255,.62); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
          .t7-mobile { display: none; }
          .t7-frame { padding: 24px 28px 48px; }
        }

        /* TABLET */
        @media (max-width: 1199px) {
          .t7-grid4, .t7-grid3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .t7-grid2 { grid-template-columns: 1fr; }
        }

        /* MOBILE */
        @media (max-width: 767px) {
          .t7-frame { padding: 14px 12px 28px; }
          .t7-grid4, .t7-grid3, .t7-grid2 { grid-template-columns: 1fr; }
          .t7-hero, .t7-panel, .t7-alert, .t7-money, .t7-role { border-radius: 20px; }
          .t7-hero, .t7-panel, .t7-alert, .t7-money { padding: 18px; }
          .t7-h1 { max-width: none; font-size: clamp(1.8rem, 8vw, 2.5rem); }
          .t7-actions { display: grid; grid-template-columns: 1fr; }
          .t7-btn { width: 100%; justify-content: center; }
          .t7-row { grid-template-columns: 1fr; }
          .t7-value { font-size: 24px; }
        }
      `}</style>
    </div>
  );
}
