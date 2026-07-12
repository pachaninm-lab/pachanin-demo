import { ArrowLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { getPublicLoginCopy } from '@/i18n/public-login-copy';
import { LoginFormClient } from './LoginFormClient';

export default async function LoginPage() {
  const locale = await getLocale();
  const { publicNav, brandTagline, backHome, form } = getPublicLoginCopy(locale);
  const chrome = await getTranslations('publicEntry.chrome');

  return (
    <main id='main-content' className='pc-v7-public-entry pc-auth-page'>
      <a className='pc-skip-link' href='#pc-login-title'>{chrome('skipToContent')}</a>
      <PublicSiteHeader
        ariaLabel={publicNav}
        tagline={brandTagline}
        brandHomeLabel={chrome('brandHomeLabel')}
        navLabel={chrome('navLabel')}
        menuLabel={chrome('menuLabel')}
        localeControl={<PublicLocaleLink />}
        actions={(
          <a className='pc-site-action' href='/platform-v7' aria-label={backHome} title={backHome}>
            <ArrowLeft size={20} aria-hidden='true' />
            <span>{backHome}</span>
          </a>
        )}
      />
      <LoginFormClient copy={form} />
    </main>
  );
}
