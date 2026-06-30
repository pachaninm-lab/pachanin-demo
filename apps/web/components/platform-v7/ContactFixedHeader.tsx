import Link from 'next/link';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';

export function ContactFixedHeader() {
  return (
    <>
      <header className='p7-contact-fixed-header' aria-label='Шапка страницы обращения'>
        <Link href='/platform-v7' className='p7-contact-fixed-brand' aria-label='Прозрачная Цена'>
          <span className='p7-contact-fixed-logo'><BrandMark size={40} /></span>
          <strong>Прозрачная Цена</strong>
        </Link>
        <nav className='p7-contact-fixed-actions' aria-label='Действия страницы обращения'>
          <Link href='/platform-v7' className='p7-contact-fixed-action' aria-label='Назад'>
            <ChevronLeft size={18} />
            <span>Назад</span>
          </Link>
          <Link href='/platform-v7/contact' className='p7-contact-fixed-action' aria-label='Справка'>
            <HelpCircle size={18} />
            <span>Справка</span>
          </Link>
        </nav>
      </header>
      <style>{css}</style>
    </>
  );
}

const css = `
.p7-contact-fixed-header{display:none}.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-header{display:none!important}html body .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-page{padding-top:calc(144px + env(safe-area-inset-top))!important}html body .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-layout{padding-top:0!important}.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-fixed-header{position:fixed;top:0;left:0;right:0;z-index:2800;min-height:64px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:max(8px,env(safe-area-inset-top)) 14px 8px;border-bottom:1px solid rgba(7,22,17,.08);background:rgba(255,255,255,.98);box-shadow:0 12px 30px rgba(7,22,17,.08);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.p7-contact-fixed-header a{color:#071611;text-decoration:none}.p7-contact-fixed-brand{min-width:0;display:inline-flex;align-items:center;justify-content:flex-start;gap:10px;font-weight:950;letter-spacing:-.03em}.p7-contact-fixed-logo{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:transparent;flex:0 0 auto;overflow:visible}.p7-contact-fixed-brand strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.p7-contact-fixed-actions{display:inline-flex;align-items:center;justify-content:flex-end;gap:8px}.p7-contact-fixed-action{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;border-radius:14px;border:1px solid rgba(7,22,17,.1);background:#fff;font-weight:900;box-shadow:0 8px 20px rgba(7,22,17,.05)}@media(max-width:760px){html body .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-page{padding-top:calc(136px + env(safe-area-inset-top))!important}.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-fixed-header{min-height:60px;padding:max(7px,env(safe-area-inset-top)) 10px 7px}.p7-contact-fixed-logo{width:40px;height:40px}.p7-contact-fixed-brand strong{font-size:16px}.p7-contact-fixed-action{min-height:38px;padding:0 9px}.p7-contact-fixed-actions{gap:6px}}@media(max-width:430px){.p7-contact-fixed-action span{display:none}.p7-contact-fixed-action{width:38px;padding:0}.p7-contact-fixed-brand strong{font-size:15px}}
`;
