import { getLocale } from 'next-intl/server';
import { CanonicalBottomNav, CanonicalPublicHeader, canonicalPublicLocale } from '@/components/platform-v7/PublicCanonicalPrimitives';
import { getPublicLoginCopy } from '@/i18n/public-login-copy';
import { LoginFormClient } from './LoginFormClient';

export default async function LoginPage() {
  const rawLocale=await getLocale();
  const locale=canonicalPublicLocale(rawLocale);
  const { form }=getPublicLoginCopy(locale);

  return (
    <main id='main-content' className='pc-canonical-public pc-v7-public-entry pc-auth-page'>
      <a className='pc-skip-link' href='#pc-login-title'>{locale==='ru'?'Перейти ко входу':locale==='en'?'Skip to sign in':'跳到登录'}</a>
      <CanonicalPublicHeader locale={locale} activePath='/platform-v7/login'/>
      <section className='pc-cp-section pc-cp-section--soft' style={{minHeight:'calc(100dvh - 72px)'}}>
        <div className='pc-cp-container'>
          <LoginFormClient copy={form} />
        </div>
      </section>
      <CanonicalBottomNav locale={locale} active='/platform-v7/login'/>
    </main>
  );
}
