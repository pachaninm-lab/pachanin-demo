'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const nav = [
  ['/platform-v7', 'Дашборд'],
  ['/platform-v7/roles', 'Роли'],
  ['/platform-v7/deal', 'Сделка'],
  ['/platform-v7/bank', 'Деньги'],
  ['/platform-v7/documents', 'Документы'],
  ['/platform-v7/control', 'Споры'],
] as const;

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
      <aside className='t7-rail'>
        <div className='t7-brand'>
          <div className='t7-title'>Прозрачная Цена</div>
          <div className='t7-sub'>ERP-контур зерновой сделки: статус, документы, деньги, доказательства</div>
        </div>
        <nav className='t7-nav'>
          {nav.map(([href, label]) => <Link key={href} href={href} className={`t7-navlink ${pathname === href ? 'is-active' : ''}`}>{label}</Link>)}
        </nav>
      </aside>
      <div className='t7-stage'>
        <header className='t7-top'>
          <div>
            <div className='t7-top-title'>Инженерный premium B2B</div>
            <div className='t7-top-sub'>Никаких ложных зелёных экранов. Только факты, блокеры и следующий шаг.</div>
          </div>
          <div className='t7-tags'>
            <span className='t7-chip t7-chip-indigo'>Pilot-ready UI</span>
            <span className='t7-chip'>17 статусов сделки</span>
          </div>
          <div className='t7-crumbs'>
            {breadcrumb.map(([href, label], i) => <span key={href}><Link href={href} className={`t7-crumb ${i === breadcrumb.length - 1 ? 'is-current' : ''}`}>{label}</Link>{i < breadcrumb.length - 1 ? <span className='t7-sep'>/</span> : null}</span>)}
          </div>
        </header>
        <main>{children}</main>
        <nav className='t7-mobile'>
          {nav.slice(0, 5).map(([href, label]) => <Link key={href} href={href} className={`t7-mobilelink ${pathname === href ? 'is-active' : ''}`}>{label}</Link>)}
        </nav>
      </div>
      <style jsx global>{`
        :root{--bg:#f8fafc;--card:#fff;--line:#e2e8f0;--text:#0f172a;--text2:#475569;--text3:#64748b;--indigo:#4f46e5;--success:#059669;--warn:#f59e0b;--danger:#dc2626;--info:#0ea5e9;--seller:#0f766e;--buyer:#2563eb;--driver:#f97316;--bank:#4338ca;--docs:#8b5e34;--control:#7c3aed;}
        *{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}a{text-decoration:none;color:inherit}
        .t7-app{min-height:100vh;background:radial-gradient(circle at top right,rgba(79,70,229,.08),transparent 34%),radial-gradient(circle at top left,rgba(14,165,233,.06),transparent 26%),linear-gradient(180deg,#fbfdff 0%,var(--bg) 46%,#f1f5f9 100%)}
        .t7-stage{min-width:0}.t7-frame{max-width:1440px;margin:0 auto;padding:20px 16px 36px}.t7-stack{display:grid;gap:16px}.t7-hero,.t7-panel,.t7-card,.t7-alert,.t7-money{background:var(--card);border:1px solid var(--line);box-shadow:0 1px 2px rgba(0,0,0,.05)}.t7-hero,.t7-panel,.t7-alert,.t7-money{border-radius:24px;padding:22px}.t7-card{border-radius:20px;padding:18px}.t7-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:var(--indigo)}.t7-h1{margin:12px 0 0;font-size:clamp(2rem,5vw,3.6rem);line-height:1.02;letter-spacing:-.03em;font-weight:700;max-width:14ch}.t7-h2{margin:0;font-size:20px;line-height:1.2;font-weight:600}.t7-lead{margin:14px 0 0;font-size:16px;line-height:1.6;color:var(--text2);max-width:76ch}.t7-text{font-size:14px;line-height:1.55;color:var(--text2)}
        .t7-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.t7-btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 16px;border-radius:16px;font-size:14px;font-weight:800;border:1px solid var(--line);background:#fff}.t7-btn.primary{background:var(--indigo);border-color:rgba(79,70,229,.24);color:#fff}.t7-btn.ghost{background:rgba(79,70,229,.08);border-color:rgba(79,70,229,.16);color:var(--indigo)}.t7-btn.danger{color:var(--danger);border-color:rgba(220,38,38,.18)}
        .t7-grid2,.t7-grid3,.t7-grid4{display:grid;gap:16px}.t7-grid2{grid-template-columns:repeat(2,minmax(0,1fr))}.t7-grid3{grid-template-columns:repeat(3,minmax(0,1fr))}.t7-grid4{grid-template-columns:repeat(4,minmax(0,1fr))}
        .t7-chip{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:#f1f5f9;border:1px solid var(--line);font-size:12px;font-weight:700;color:var(--text3)}.t7-chip-indigo{background:rgba(79,70,229,.08);border-color:rgba(79,70,229,.16);color:var(--indigo)}.t7-chip-success{background:rgba(5,150,105,.09);border-color:rgba(5,150,105,.18);color:var(--success)}.t7-chip-warn{background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.18);color:#b45309}.t7-chip-danger{background:rgba(220,38,38,.08);border-color:rgba(220,38,38,.16);color:var(--danger)}.t7-chip-seller{background:rgba(15,118,110,.08);border-color:rgba(15,118,110,.16);color:var(--seller)}.t7-chip-buyer{background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.16);color:var(--buyer)}.t7-chip-driver{background:rgba(249,115,22,.1);border-color:rgba(249,115,22,.18);color:var(--driver)}.t7-chip-bank{background:rgba(67,56,202,.08);border-color:rgba(67,56,202,.16);color:var(--bank)}.t7-chip-docs{background:rgba(139,94,52,.1);border-color:rgba(139,94,52,.16);color:var(--docs)}.t7-chip-control{background:rgba(124,58,237,.1);border-color:rgba(124,58,237,.16);color:var(--control)}
        .t7-mono,.t7-value{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,monospace;font-variant-numeric:tabular-nums}.t7-value{font-size:28px;font-weight:700;margin-top:14px}.t7-label{margin-top:8px;font-size:14px;line-height:1.5;color:var(--text2)}
        .t7-list{display:grid;gap:0}.t7-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:14px 0;border-top:1px solid #f1f5f9}.t7-row:first-child{border-top:0}.t7-rowtitle{font-size:15px;line-height:1.45;font-weight:600}.t7-rowtext{margin-top:6px;font-size:13px;line-height:1.55;color:var(--text2)}
        .t7-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px}.t7-step{display:grid;gap:8px}.t7-line{height:4px;border-radius:999px;background:#e2e8f0}.t7-step.done .t7-line{background:var(--success)}.t7-step.active .t7-line{background:var(--indigo)}.t7-step.blocked .t7-line{background:var(--warn)}.t7-steptitle{font-size:12px;font-weight:700}.t7-stepmeta{font-size:11px;line-height:1.45;color:var(--text3)}
        .t7-role{display:grid;gap:16px;padding:20px;border-radius:24px;background:#fff;border:1px solid var(--line);box-shadow:0 1px 2px rgba(0,0,0,.05)}.t7-role:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(15,23,42,.08)}.t7-rolehead,.t7-previewrow,.t7-moneyhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.t7-roletitle{margin:0;font-size:20px;line-height:1.2;font-weight:600}.t7-rolesummary{margin:0;font-size:14px;line-height:1.55;color:var(--text2)}.t7-rolebullets{margin:0;padding:0 0 0 18px;display:grid;gap:8px}.t7-rolebullets li{font-size:13px;line-height:1.55;color:var(--text2)}.t7-preview{padding:14px;border-radius:18px;background:linear-gradient(180deg,#f8fafc 0%,#fff 100%);border:1px solid #f1f5f9;display:grid;gap:10px}.t7-previewtitle{font-size:14px;font-weight:700}.t7-previewtext{margin-top:4px;font-size:12px;color:var(--text3)}.t7-cta{font-size:13px;font-weight:800;color:var(--indigo)}
        .t7-progress{margin-top:10px;height:8px;border-radius:999px;background:#eef2f7;overflow:hidden}.t7-progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--indigo),#6366f1)}
        .t7-top{position:sticky;top:0;z-index:30;padding:14px 16px;background:rgba(248,250,252,.86);backdrop-filter:blur(16px);border-bottom:1px solid rgba(226,232,240,.92)}.t7-top-title{font-size:18px;font-weight:800}.t7-top-sub{margin-top:4px;font-size:12px;color:var(--text3)}.t7-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.t7-crumbs{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}.t7-crumb{font-size:12px;font-weight:700;color:var(--text3)}.t7-crumb.is-current{color:var(--text)}.t7-sep{font-size:12px;color:#94a3b8}
        .t7-rail{display:none}.t7-brand{padding:18px 14px}.t7-title{font-size:18px;font-weight:800}.t7-sub{margin-top:4px;font-size:12px;line-height:1.45;color:var(--text3)}.t7-nav{display:grid;gap:8px;padding:0 14px 20px}.t7-navlink{display:flex;align-items:center;min-height:48px;padding:0 12px;border-radius:16px;color:var(--text2);font-size:14px;font-weight:700}.t7-navlink.is-active{background:#fff;border:1px solid rgba(79,70,229,.16);box-shadow:0 10px 24px rgba(15,23,42,.06);color:var(--text)}
        .t7-mobile{position:sticky;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.92);backdrop-filter:blur(18px);border-top:1px solid var(--line)}.t7-mobilelink{display:grid;place-items:center;min-height:42px;font-size:11px;font-weight:700;color:var(--text3);text-align:center}.t7-mobilelink.is-active{color:var(--indigo)}
        @media (min-width:1200px){.t7-app{display:grid;grid-template-columns:272px minmax(0,1fr)}.t7-rail{display:block;min-height:100vh;border-right:1px solid var(--line);background:rgba(255,255,255,.56);backdrop-filter:blur(18px);position:sticky;top:0}.t7-mobile{display:none}.t7-frame{padding:20px 20px 40px}}
        @media (max-width:1199px){.t7-grid4,.t7-grid3{grid-template-columns:repeat(2,minmax(0,1fr))}.t7-grid2{grid-template-columns:1fr}}
        @media (max-width:767px){.t7-frame{padding:16px 14px 28px}.t7-grid4,.t7-grid3,.t7-grid2{grid-template-columns:1fr}.t7-hero,.t7-panel,.t7-alert,.t7-money,.t7-role{border-radius:22px}.t7-h1{max-width:none}.t7-actions{display:grid;grid-template-columns:1fr}.t7-btn{width:100%}.t7-row{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
