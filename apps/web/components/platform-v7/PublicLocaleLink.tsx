import { headers } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { isAppLocale, SUPPORTED_LOCALES, type AppLocale } from '@/i18n/locale';

const LABELS: Record<AppLocale,string> = { ru:'RU', en:'EN', zh:'中文' };

function normalizePath(value:string|null){
  return (value||'').split('?')[0].replace(/\/$/,'')||'/platform-v7';
}

function localeHref(pathname:string, rawSearch:string, locale:AppLocale){
  const params=new URLSearchParams(rawSearch.startsWith('?')?rawSearch.slice(1):rawSearch);
  params.set('lang',locale);
  params.delete('l10n');
  const query=params.toString();
  return query?`${pathname}?${query}`:pathname;
}

/**
 * Zero-hydration canonical RU / EN / 中文 control.
 *
 * Existing navigation tokens are preserved when only the locale changes.
 * They remain URL/navigation data only and never become role/tenant authority.
 */
export async function PublicLocaleLink(){
  const localeValue=await getLocale();
  const t=await getTranslations('publicEntry.language');
  const locale:AppLocale=isAppLocale(localeValue)?localeValue:'ru';
  const requestHeaders=await headers();
  const pathname=normalizePath(requestHeaders.get('x-pc-pathname'));
  const rawSearch=requestHeaders.get('x-pc-search')||'';
  return (
    <nav
      className='pc-site-locale-cluster'
      aria-label={t('switchTitle',{current:LABELS[locale]})}
      data-current-locale={locale}
    >
      {SUPPORTED_LOCALES.map((item)=>(
        <a
          key={item}
          className='pc-site-locale-option'
          href={localeHref(pathname,rawSearch,item)}
          lang={item==='zh'?'zh-CN':item}
          aria-current={item===locale?'page':undefined}
          data-active={item===locale?'true':'false'}
        >
          {LABELS[item]}
        </a>
      ))}
    </nav>
  );
}
