import Link from 'next/link';
import { ChevronLeft, Wheat } from 'lucide-react';

export function ContactFixedHeader() {
  return (
    <>
      <header className='p7-contact-fixed-header' aria-label='Шапка страницы обращения'>
        <Link href='/platform-v7' className='p7-contact-fixed-back' aria-label='Назад'>
          <ChevronLeft size={19} />
          <span>Назад</span>
        </Link>
        <Link href='/platform-v7' className='p7-contact-fixed-brand' aria-label='Прозрачная Цена'>
          <span className='p7-contact-fixed-logo'><Wheat size={22} /></span>
          <strong>Прозрачная Цена</strong>
        </Link>
      </header>
      <style>{css}</style>
    </>
  );
}

const css = `
.p7-contact-fixed-header{display:none}.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-header{display:none!important}.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-page{padding-top:76px!important}.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-fixed-header{position:fixed;top:0;left:0;right:0;z-index:2800;min-height:60px;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding:max(8px,env(safe-area-inset-top)) 14px 8px;border-bottom:1px solid rgba(7,22,17,.08);background:rgba(255,255,255,.97);box-shadow:0 12px 30px rgba(7,22,17,.08);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.p7-contact-fixed-header a{color:#071611;text-decoration:none}.p7-contact-fixed-back{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;border-radius:14px;border:1px solid rgba(7,22,17,.1);background:#fff;font-weight:900}.p7-contact-fixed-brand{min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:10px;font-weight:950;letter-spacing:-.03em}.p7-contact-fixed-logo{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;color:#087a3b;background:rgba(0,122,47,.08)}.p7-contact-fixed-brand strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:760px){.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-page{padding-top:66px!important}.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-fixed-header{min-height:56px;padding:max(7px,env(safe-area-inset-top)) 10px 7px}.p7-contact-fixed-back{min-height:38px}.p7-contact-fixed-logo{width:36px;height:36px}.p7-contact-fixed-brand strong{font-size:16px}}@media(max-width:390px){.p7-contact-fixed-back span{display:none}.p7-contact-fixed-back{width:38px;padding:0}.p7-contact-fixed-brand strong{font-size:15px}}
`;
