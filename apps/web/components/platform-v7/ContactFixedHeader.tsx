'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';

type Locale = 'ru' | 'en' | 'zh';

const COPY: Record<Locale, { aria: string; back: string; help: string }> = {
  ru: { aria: 'Шапка страницы обращения', back: 'Назад', help: 'Контакты' },
  en: { aria: 'Contact page header', back: 'Back', help: 'Contact' },
  zh: { aria: '联系页面页眉', back: '返回', help: '联系' },
};

export function ContactFixedHeader() {
  const searchParams = useSearchParams();
  const raw = searchParams.get('lang');
  const locale: Locale = raw === 'en' || raw === 'zh' ? raw : 'ru';
  const copy = COPY[locale];

  return (
    <>
      <PublicSiteHeader
        ariaLabel={copy.aria}
        actions={(
          <>
            <Link href={`/platform-v7?lang=${locale}`} className='pc-site-action' aria-label={copy.back}><ChevronLeft size={18} /><span>{copy.back}</span></Link>
            <Link href={`/platform-v7/contact?lang=${locale}`} className='pc-site-action' aria-label={copy.help}><HelpCircle size={18} /><span>{copy.help}</span></Link>
          </>
        )}
      />
      <style>{css}</style>
    </>
  );
}

const css = `
.pc-shell-root-v4:has(.p7-contact-page){--pc-header-offset:0px!important}
.pc-shell-root-v4:has(.p7-contact-page) .p7-contact-header,
.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-header,
.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-bottomnav,
.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-drawer,
.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-pilot-note{display:none!important}
.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:transparent!important;min-height:100svh!important}
html body .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-page{padding-top:78px!important}
html body .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-layout{padding-top:0!important;margin-top:0!important}
@media(max-width:760px){
  html body .pc-shell-root-v4:has(.p7-contact-page) .p7-contact-page{padding-top:72px!important}
}
@media(max-width:560px){
  .pc-shell-root-v4:has(.p7-contact-page) .pc-site-action span{display:none!important}
  .pc-shell-root-v4:has(.p7-contact-page) .pc-site-action{width:44px;min-height:44px;padding:0!important}
}
`;
