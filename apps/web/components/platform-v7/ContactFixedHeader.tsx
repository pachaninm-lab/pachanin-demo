'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';

export function ContactFixedHeader() {
  useEffect(() => {
    const applyOffset = () => {
      const page = document.querySelector<HTMLElement>('.p7-contact-page');
      const layout = document.querySelector<HTMLElement>('.p7-contact-layout');
      const header = document.querySelector<HTMLElement>('.pc-site-header');
      if (!page || !layout || !header) return;

      const headerHeight = Math.ceil(header.getBoundingClientRect().height);
      const layoutOffset = headerHeight + 20;
      page.style.paddingTop = window.innerWidth <= 760 ? '10px' : '14px';
      layout.style.paddingTop = `${layoutOffset}px`;
      layout.style.marginTop = '0px';
    };

    applyOffset();
    window.addEventListener('resize', applyOffset);
    window.addEventListener('orientationchange', applyOffset);
    const timer = window.setTimeout(applyOffset, 120);

    return () => {
      window.removeEventListener('resize', applyOffset);
      window.removeEventListener('orientationchange', applyOffset);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <PublicSiteHeader
        ariaLabel='Шапка страницы обращения'
        actions={(
          <>
            <Link href='/platform-v7' className='pc-site-action' aria-label='Назад'><ChevronLeft size={18} /><span>Назад</span></Link>
            <Link href='/platform-v7/contact' className='pc-site-action' aria-label='Справка'><HelpCircle size={18} /><span>Справка</span></Link>
          </>
        )}
      />
      <style>{css}</style>
    </>
  );
}

const css = `
.pc-shell-root-v4:has(.p7-contact-page){--pc-header-offset:0px!important}.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-header,.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-header,.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-bottomnav,.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-drawer,.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-pilot-note{display:none!important}.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:transparent!important;min-height:100svh!important}html body .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-page{padding-top:78px!important}html body .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-layout{padding-top:0!important;margin-top:0!important}.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-fixed-header{position:fixed;top:0;left:0;right:0;z-index:2800;min-height:64px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:max(8px,env(safe-area-inset-top)) 14px 8px;border-bottom:1px solid rgba(7,22,17,.08);background:rgba(255,255,255,.98);box-shadow:0 12px 30px rgba(7,22,17,.08);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.p7-contact-fixed-header a{color:#071611;text-decoration:none}.p7-contact-fixed-brand{min-width:0;display:inline-flex;align-items:center;justify-content:flex-start;gap:10px;font-weight:950;letter-spacing:-.03em}.p7-contact-fixed-logo{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:transparent;flex:0 0 auto;overflow:visible}.p7-contact-fixed-brand strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.p7-contact-fixed-actions{display:inline-flex;align-items:center;justify-content:flex-end;gap:8px}.p7-contact-fixed-action{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;border-radius:14px;border:1px solid rgba(7,22,17,.1);background:#fff;font-weight:900;box-shadow:0 8px 20px rgba(7,22,17,.05)}@media(max-width:760px){html body .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-page{padding-top:72px!important}html body .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-layout{padding-top:0!important;margin-top:0!important}.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-fixed-header{min-height:60px;padding:max(7px,env(safe-area-inset-top)) 10px 7px}.p7-contact-fixed-logo{width:40px;height:40px}.p7-contact-fixed-brand strong{font-size:16px}.p7-contact-fixed-action{min-height:38px;padding:0 9px}.p7-contact-fixed-actions{gap:6px}}@media(max-width:560px){.pc-shell-root-v4:has(.p7-contact-page) .pc-site-action span{display:none!important}.pc-shell-root-v4:has(.p7-contact-page) .pc-site-action{width:42px;padding:0!important}}
`;
