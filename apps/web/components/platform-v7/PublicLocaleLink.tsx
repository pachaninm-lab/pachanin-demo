import { headers } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { isAppLocale, SUPPORTED_LOCALES, type AppLocale } from '@/i18n/locale';

const LABELS: Record<AppLocale,string> = { ru:'RU', en:'EN', zh:'中文' };

function normalizePath(value:string|null){
  return (value||'').split('?')[0].replace(/\/$/,'')||'/platform-v7';
}

/** Zero-hydration canonical RU / EN / 中文 control. */
export async function PublicLocaleLink(){
  const localeValue=await getLocale();
  const t=await getTranslations('publicEntry.language');
  const locale:AppLocale=isAppLocale(localeValue)?localeValue:'ru';
  const pathname=normalizePath((await headers()).get('x-pc-pathname'));
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
          href={`${pathname}?lang=${item}`}
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
