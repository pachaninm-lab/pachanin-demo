import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, FileCheck2, Landmark, Scale, ShieldCheck, Truck, Wheat } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Документы сделки — СДИЗ, ЭДО, акты и основание для расчёта',
  description: 'Публичное описание документного контура Прозрачной Цены: СДИЗ, ЭДО, транспортные документы, акты, приёмка, качество, расчёт и доказательства по зерновой сделке.',
  alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/docs' },
  openGraph: {
    title: 'Документы сделки — Прозрачная Цена',
    description: 'Как документы, приёмка, качество, расчёт и доказательства связываются в контуре исполнения зерновой сделки.',
    url: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/docs',
    siteName: 'Прозрачная Цена',
    locale: 'ru_RU',
    type: 'website',
  },
};

const documentLayers = [
  { title: 'СДИЗ и ЭДО', text: 'Документы связаны с партией, рейсом, приёмкой и ответственными действиями.', icon: FileCheck2 },
  { title: 'Транспортные документы', text: 'Рейс, водитель, маршрут и контрольные точки дают основание для сверки.', icon: Truck },
  { title: 'Акты и приёмка', text: 'Факт поставки, вес и расхождения фиксируются до окончательного расчёта.', icon: BadgeCheck },
  { title: 'Качество', text: 'Лабораторные показатели учитываются до формирования основания для оплаты.', icon: ShieldCheck },
  { title: 'Основание для расчёта', text: 'Финансовый контур получает проверяемый набор событий и документов.', icon: Landmark },
  { title: 'Спор и доказательства', text: 'Разбор идёт по журналу событий, документам, приёмке и качеству.', icon: Scale },
];

export default function PlatformV7DocsPage() {
  return (
    <main className='p7-docs-page' data-testid='platform-v7-public-docs-page'>
      <style>{css}</style>
      <header className='p7-docs-header' aria-label='Навигация страницы документов'>
        <Link href='/platform-v7' className='p7-docs-brand' aria-label='На главную Прозрачная Цена'><span><Wheat size={24} /></span><strong>Прозрачная Цена</strong></Link>
        <nav className='p7-docs-nav' aria-label='Действия'><Link href='/platform-v7/demo'>Демо</Link><Link href='/platform-v7/contact'>Задать вопрос</Link><Link href='/platform-v7/register'>Подключить организацию</Link></nav>
      </header>

      <section className='p7-docs-hero' aria-labelledby='docs-title'>
        <span className='p7-docs-kicker'>Документный контур сделки</span>
        <h1 id='docs-title'>Документы должны подтверждать исполнение, а не догонять сделку после спора</h1>
        <p>Прозрачная Цена связывает СДИЗ, ЭДО, транспортные документы, акты, приёмку, качество, расчёт и доказательства в одном controlled pilot / pre-integration контуре.</p>
        <div className='p7-docs-actions'><Link href='/platform-v7/demo'>Посмотреть демо-сделку<ArrowRight size={18} /></Link><Link href='/platform-v7/contact'>Задать вопрос</Link></div>
      </section>

      <section className='p7-docs-grid' aria-label='Слои документного контроля'>
        {documentLayers.map((item) => { const Icon = item.icon; return <article key={item.title} className='p7-docs-card'><Icon size={26} /><strong>{item.title}</strong><p>{item.text}</p></article>; })}
      </section>

      <section className='p7-docs-note' aria-labelledby='docs-boundary-title'>
        <h2 id='docs-boundary-title'>Граница текущей готовности</h2>
        <p>Этот раздел описывает целевой документный контур controlled pilot / pre-integration. Боевые интеграции с ФГИС, ЭДО, банком и другими внешними системами не заявляются как подключённые, пока они не подтверждены договорами, доступами и реальными подключениями.</p>
      </section>
    </main>
  );
}

const css = `
.pc-shell-root-v4:has(.p7-docs-page){--pc-header-offset:0px!important;background:#f7faf6!important}.pc-shell-root-v4:has(.p7-docs-page) .pc-v4-header,.pc-shell-root-v4:has(.p7-docs-page) .pc-v4-bottomnav,.pc-shell-root-v4:has(.p7-docs-page) .pc-v4-drawer,.pc-shell-root-v4:has(.p7-docs-page) .pc-v4-pilot-note,.pc-shell-root-v4:has(.p7-docs-page) .pc-v7-role-dock,.pc-shell-root-v4:has(.p7-docs-page) .pc-v7-assistant-widget,.pc-shell-root-v4:has(.p7-docs-page) .p7-mobile-action-rail,.pc-shell-root-v4:has(.p7-docs-page) .p7-mobile-tool-panel{display:none!important}.pc-shell-root-v4:has(.p7-docs-page) .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#f7faf6!important;min-height:100svh!important}.p7-docs-page{min-height:100svh;padding:12px clamp(14px,4vw,56px) 42px;color:#071611;background:linear-gradient(180deg,#fbfcf9 0%,#f3f7f1 56%,#fff 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.p7-docs-page *{box-sizing:border-box}.p7-docs-page a{color:inherit;text-decoration:none}.p7-docs-header{position:sticky;top:10px;z-index:20;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;min-height:62px;padding:10px 12px 10px 14px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.93);box-shadow:0 16px 42px rgba(7,22,17,.08);backdrop-filter:blur(16px)}.p7-docs-brand{display:inline-flex;align-items:center;gap:10px;font-weight:950;letter-spacing:-.03em}.p7-docs-brand span{display:grid;place-items:center;width:40px;height:40px;border-radius:14px;color:#087a3b;background:rgba(0,122,47,.08)}.p7-docs-nav{display:flex;align-items:center;gap:8px}.p7-docs-nav a,.p7-docs-actions a{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 14px;border-radius:14px;border:1px solid rgba(7,22,17,.1);font-size:13px;font-weight:900}.p7-docs-nav a:last-child,.p7-docs-actions a:first-child{color:#fff;background:#087a3b;border-color:#087a3b}.p7-docs-hero,.p7-docs-note{margin-top:24px;border:1px solid rgba(7,22,17,.075);border-radius:32px;background:rgba(255,255,255,.82);box-shadow:0 18px 48px rgba(7,22,17,.065);backdrop-filter:blur(14px)}.p7-docs-hero{padding:clamp(24px,4vw,48px)}.p7-docs-kicker{display:inline-flex;width:fit-content;margin-bottom:14px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;letter-spacing:.055em;text-transform:uppercase}.p7-docs-hero h1{margin:0;max-width:980px;font-size:clamp(34px,5.3vw,72px);line-height:.99;letter-spacing:-.058em}.p7-docs-hero p,.p7-docs-card p,.p7-docs-note p{margin:16px 0 0;color:#4e5d56;font-size:16px;line-height:1.5;font-weight:640}.p7-docs-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.p7-docs-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}.p7-docs-card{min-height:190px;padding:19px;border:1px solid rgba(7,22,17,.075);border-radius:24px;background:#fff;box-shadow:0 14px 34px rgba(7,22,17,.055);display:grid;align-content:start;gap:10px}.p7-docs-card svg{color:#087a3b}.p7-docs-card strong{font-size:18px;font-weight:950;letter-spacing:-.035em}.p7-docs-card p{margin:0;font-size:13.5px}.p7-docs-note{padding:24px}.p7-docs-note h2{margin:0;font-size:clamp(26px,3vw,42px);line-height:1.04;letter-spacing:-.048em}.p7-docs-note p{max-width:940px}@media (max-width:980px){.p7-docs-page{padding:8px 12px 34px}.p7-docs-header{grid-template-columns:1fr}.p7-docs-nav{display:grid;grid-template-columns:1fr 1fr 1fr}.p7-docs-grid{grid-template-columns:1fr 1fr}}@media (max-width:620px){.p7-docs-grid,.p7-docs-nav{grid-template-columns:1fr}.p7-docs-hero,.p7-docs-note{border-radius:26px;padding:20px}.p7-docs-hero h1{font-size:34px}}
`;
