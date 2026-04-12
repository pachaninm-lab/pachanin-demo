'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const nav = [
  ['/platform-v6', 'Дашборд'],
  ['/platform-v6/roles', 'Роли'],
  ['/platform-v6/deal', 'Сделка'],
  ['/platform-v6/bank', 'Деньги'],
  ['/platform-v6/documents', 'Документы'],
  ['/platform-v6/control', 'Споры'],
] as const;

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className='tp-app'>
      <aside className='tp-rail'>
        <div className='tp-brand'>
          <div className='tp-brand-title'>Прозрачная Цена</div>
          <div className='tp-brand-sub'>ERP-контур сделки, документов и денег</div>
        </div>
        <nav className='tp-nav'>
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className={`tp-nav-link ${pathname === href ? 'is-active' : ''}`}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className='tp-stage'>
        <header className='tp-topbar'>
          <div>
            <div className='tp-top-title'>Инженерный премиум</div>
            <div className='tp-top-sub'>Статус, блокеры, доказательства, выпуск денег</div>
          </div>
          <div className='tp-top-tags'>
            <span className='tp-chip tp-chip-indigo'>Pilot-ready UI</span>
            <span className='tp-chip'>17 статусов сделки</span>
          </div>
        </header>
        <main>{children}</main>
        <nav className='tp-mobilebar'>
          {nav.slice(0, 5).map(([href, label]) => (
            <Link key={href} href={href} className={`tp-mobile-link ${pathname === href ? 'is-active' : ''}`}>{label}</Link>
          ))}
        </nav>
      </div>
      <style jsx global>{`
        :root{--bg:#f8fafc;--card:#fff;--line:#e2e8f0;--text:#0f172a;--text2:#475569;--text3:#64748b;--indigo:#4f46e5;--success:#059669;--warn:#f59e0b;--danger:#dc2626;--info:#0ea5e9;--seller:#0f766e;--buyer:#2563eb;--driver:#f97316;--bank:#4338ca;--docs:#8b5e34;--control:#7c3aed;}
        *{box-sizing:border-box} html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}
        a{text-decoration:none;color:inherit} button,input{font:inherit}
        .tp-app{min-height:100vh;background:radial-gradient(circle at top right,rgba(79,70,229,.08),transparent 32%),linear-gradient(180deg,#fbfdff 0%,var(--bg) 46%,#f1f5f9 100%)}
        .tp-stage{min-width:0}.tp-frame{max-width:1440px;margin:0 auto;padding:20px 16px 36px}.tp-stack{display:grid;gap:16px}.tp-hero,.tp-card,.tp-panel,.tp-money,.tp-railbox,.tp-alert{background:var(--card);border:1px solid var(--line);box-shadow:0 1px 2px rgba(0,0,0,.05);border-radius:24px}.tp-card{border-radius:20px}.tp-hero,.tp-panel,.tp-money,.tp-alert{padding:22px}.tp-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:var(--indigo)}
        .tp-h1{margin:12px 0 0;font-size:clamp(2rem,5vw,3.5rem);line-height:1.02;letter-spacing:-.03em;font-weight:700;max-width:14ch}.tp-h2{margin:0;font-size:20px;line-height:1.2;font-weight:600}.tp-lead{margin:14px 0 0;font-size:16px;line-height:1.6;color:var(--text2);max-width:76ch}.tp-subtext{font-size:14px;line-height:1.55;color:var(--text2)}
        .tp-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.tp-btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 16px;border-radius:16px;font-size:14px;font-weight:800;border:1px solid var(--line);background:#fff}.tp-btn.primary{background:var(--indigo);border-color:rgba(79,70,229,.25);color:#fff}.tp-btn.ghost{background:rgba(79,70,229,.08);border-color:rgba(79,70,229,.16);color:var(--indigo)}.tp-btn.danger{color:var(--danger);border-color:rgba(220,38,38,.18)}
        .tp-grid-2,.tp-grid-3,.tp-grid-4{display:grid;gap:16px}.tp-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}.tp-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}.tp-grid-4{grid-template-columns:repeat(4,minmax(0,1fr))}
        .tp-chip{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:#f1f5f9;border:1px solid var(--line);font-size:12px;font-weight:700;color:var(--text3)}.tp-chip-indigo{background:rgba(79,70,229,.08);border-color:rgba(79,70,229,.16);color:var(--indigo)}.tp-chip-success{background:rgba(5,150,105,.09);border-color:rgba(5,150,105,.18);color:var(--success)}.tp-chip-warn{background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.18);color:#b45309}.tp-chip-danger{background:rgba(220,38,38,.08);border-color:rgba(220,38,38,.16);color:var(--danger)}.tp-chip-bank{background:rgba(67,56,202,.08);border-color:rgba(67,56,202,.16);color:var(--bank)}.tp-chip-seller{background:rgba(15,118,110,.08);border-color:rgba(15,118,110,.16);color:var(--seller)}.tp-chip-buyer{background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.16);color:var(--buyer)}.tp-chip-driver{background:rgba(249,115,22,.1);border-color:rgba(249,115,22,.18);color:var(--driver)}.tp-chip-docs{background:rgba(139,94,52,.1);border-color:rgba(139,94,52,.16);color:var(--docs)}.tp-chip-control{background:rgba(124,58,237,.1);border-color:rgba(124,58,237,.16);color:var(--control)}
        .tp-stat-value,.tp-mono{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,monospace;font-variant-numeric:tabular-nums}.tp-stat-value{font-size:28px;font-weight:700;margin-top:14px}.tp-stat-label{margin-top:8px;font-size:14px;color:var(--text2);line-height:1.5}
        .tp-list{display:grid;gap:0}.tp-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:14px 0;border-top:1px solid #f1f5f9}.tp-row:first-child{border-top:0}.tp-row-title{font-size:15px;font-weight:600;line-height:1.45}.tp-row-text{margin-top:6px;font-size:13px;line-height:1.55;color:var(--text2)}
        .tp-topbar{position:sticky;top:0;z-index:30;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:14px 16px;background:rgba(248,250,252,.86);backdrop-filter:blur(16px);border-bottom:1px solid rgba(226,232,240,.92)}.tp-top-title{font-size:18px;font-weight:800}.tp-top-sub{margin-top:4px;font-size:12px;color:var(--text3)}.tp-top-tags{display:flex;gap:8px;flex-wrap:wrap}
        .tp-rail{display:none}.tp-brand{padding:18px 14px}.tp-brand-title{font-size:18px;font-weight:800}.tp-brand-sub{margin-top:4px;font-size:12px;line-height:1.45;color:var(--text3)}.tp-nav{display:grid;gap:8px;padding:0 14px 20px}.tp-nav-link{display:flex;align-items:center;min-height:48px;padding:0 12px;border-radius:16px;color:var(--text2);font-size:14px;font-weight:700}.tp-nav-link.is-active{background:#fff;border:1px solid rgba(79,70,229,.16);box-shadow:0 10px 24px rgba(15,23,42,.06);color:var(--text)}
        .tp-mobilebar{position:sticky;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.92);backdrop-filter:blur(18px);border-top:1px solid var(--line)}.tp-mobile-link{display:grid;place-items:center;min-height:42px;font-size:11px;font-weight:700;color:var(--text3);text-align:center}.tp-mobile-link.is-active{color:var(--indigo)}
        .tp-money-head,.tp-role-head,.tp-card-foot{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.tp-progress{margin-top:10px;height:8px;border-radius:999px;background:#eef2f7;overflow:hidden}.tp-progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--indigo),#6366f1)}
        .tp-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px}.tp-step{display:grid;gap:8px}.tp-step-line{height:4px;border-radius:999px;background:#e2e8f0}.tp-step.done .tp-step-line{background:var(--success)}.tp-step.active .tp-step-line{background:var(--indigo)}.tp-step.blocked .tp-step-line{background:var(--warn)}.tp-step-title{font-size:12px;font-weight:700}.tp-step-meta{font-size:11px;line-height:1.45;color:var(--text3)}
        .tp-role-card{display:grid;gap:16px;padding:20px;border-radius:24px;background:#fff;border:1px solid var(--line);box-shadow:0 1px 2px rgba(0,0,0,.05)}.tp-role-card:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(15,23,42,.08)}.tp-role-title{margin:0;font-size:20px;line-height:1.2;font-weight:600}.tp-role-summary{margin:0;font-size:14px;line-height:1.55;color:var(--text2)}.tp-role-bullets{margin:0;padding:0 0 0 18px;display:grid;gap:8px}.tp-role-bullets li{font-size:13px;line-height:1.55;color:var(--text2)}.tp-role-preview{padding:14px;border-radius:18px;background:linear-gradient(180deg,#f8fafc 0%,#fff 100%);border:1px solid #f1f5f9;display:grid;gap:10px}.tp-preview-row{display:flex;justify-content:space-between;gap:12px;align-items:center}.tp-preview-title{font-size:14px;font-weight:700}.tp-preview-text{margin-top:4px;font-size:12px;color:var(--text3)}.tp-cta{font-size:13px;font-weight:800;color:var(--indigo)}
        .tp-alert-title{font-size:14px;font-weight:700}.tp-alert-text{margin-top:6px;font-size:13px;line-height:1.55;color:var(--text2)}
        @media (min-width:1200px){.tp-app{display:grid;grid-template-columns:272px minmax(0,1fr)}.tp-rail{display:block;min-height:100vh;border-right:1px solid var(--line);background:rgba(255,255,255,.56);backdrop-filter:blur(18px);position:sticky;top:0}.tp-mobilebar{display:none}.tp-frame{padding:20px 20px 40px}}
        @media (max-width:1199px){.tp-grid-4,.tp-grid-3{grid-template-columns:repeat(2,minmax(0,1fr))}.tp-grid-2{grid-template-columns:1fr}}
        @media (max-width:767px){.tp-frame{padding:16px 14px 28px}.tp-grid-4,.tp-grid-3,.tp-grid-2{grid-template-columns:1fr}.tp-hero,.tp-panel,.tp-money,.tp-alert,.tp-role-card{border-radius:22px}.tp-h1{max-width:none}.tp-actions{display:grid;grid-template-columns:1fr}.tp-btn{width:100%}.tp-topbar{align-items:flex-start;flex-direction:column}.tp-row{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
