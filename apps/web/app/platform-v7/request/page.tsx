import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';

export const metadata: Metadata = {
  title: 'Оставить заявку — Прозрачная Цена',
  description: 'Отдельная страница заявки на подключение организации, банковское взаимодействие, региональный запуск или техническую интеграцию платформы Прозрачная Цена.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/request',
  },
};

export default function PlatformV7RequestPage() {
  return (
    <main className='p7-request-page' aria-label='Страница заявки'>
      <header className='p7-request-header' aria-label='Навигация страницы заявки'>
        <Link href='/platform-v7' className='p7-request-brand' aria-label='На главную Прозрачная Цена'>
          <span><BrandMark size={40} /></span>
          <strong>Прозрачная Цена</strong>
        </Link>
        <nav className='p7-request-actions' aria-label='Действия страницы заявки'>
          <Link href='/platform-v7' aria-label='Назад'><ChevronLeft size={18} /><em>Назад</em></Link>
          <Link href='/platform-v7/contact' aria-label='Справка'><HelpCircle size={18} /><em>Справка</em></Link>
        </nav>
      </header>
      <style>{css}</style>
    </main>
  );
}

const css = `
.pc-shell-root-v4:has(.p7-request-page){--pc-header-offset:0px!important;background:#f7faf6!important}.pc-shell-root-v4:has(.p7-request-page) .pc-v4-header,.pc-shell-root-v4:has(.p7-request-page) .pc-v4-bottomnav,.pc-shell-root-v4:has(.p7-request-page) .pc-v4-drawer,.pc-shell-root-v4:has(.p7-request-page) .pc-v4-pilot-note,.pc-shell-root-v4:has(.p7-request-page) .pc-v7-role-dock,.pc-shell-root-v4:has(.p7-request-page) .pc-v7-assistant-widget,.pc-shell-root-v4:has(.p7-request-page) .p7-mobile-action-rail,.pc-shell-root-v4:has(.p7-request-page) .p7-public-tour-trigger{display:none!important}.pc-shell-root-v4:has(.p7-request-page) .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#f7faf6!important;min-height:100svh!important}.p7-request-page{min-height:1px;background:#f7faf6;color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.p7-request-header{position:fixed;top:0;left:0;right:0;z-index:1800;min-height:72px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:max(8px,env(safe-area-inset-top)) clamp(14px,4vw,56px) 8px;border-bottom:1px solid rgba(7,22,17,.08);background:rgba(255,255,255,.98);box-shadow:0 12px 30px rgba(7,22,17,.08);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}.p7-request-header a{color:#071611;text-decoration:none}.p7-request-brand{display:inline-flex;align-items:center;gap:12px;min-width:0;font-weight:950;letter-spacing:-.03em}.p7-request-brand span{display:grid;place-items:center;width:42px;height:42px;flex:0 0 auto}.p7-request-brand strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:18px}.p7-request-actions{display:inline-flex;align-items:center;gap:8px}.p7-request-actions a{min-height:42px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;border-radius:15px;border:1px solid rgba(7,22,17,.1);background:#fff;font-weight:900;box-shadow:0 8px 20px rgba(7,22,17,.05)}.p7-request-actions em{font-style:normal}@media(max-width:640px){.p7-request-header{min-height:64px;padding:max(7px,env(safe-area-inset-top)) 12px 7px}.p7-request-brand{gap:9px}.p7-request-brand span{width:40px;height:40px}.p7-request-brand strong{font-size:16px}.p7-request-actions{gap:6px}.p7-request-actions a{width:40px;min-height:40px;padding:0;border-radius:14px}.p7-request-actions em{display:none}}
`;
