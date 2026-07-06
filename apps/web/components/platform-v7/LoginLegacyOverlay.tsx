'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightFromLine, Banknote, BriefcaseBusiness, Building2, ClipboardCheck, Crown, FlaskConical, Landmark, Scale, ShieldCheck, Truck, UserRound, Wheat, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PLATFORM_V7_ACTIVE_ROLE_KEY, platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

type Item = { role: PlatformRole; Icon: LucideIcon };
const ENTRY_COOKIE = 'pc_v7_entry_seen';
// Подписи ролей и вся копия экрана — в apps/web/messages/*.json (namespace `loginLegacy`).
const items: Item[] = [
  { role: 'operator', Icon: BriefcaseBusiness }, { role: 'buyer', Icon: UserRound },
  { role: 'seller', Icon: Wheat }, { role: 'logistics', Icon: Truck },
  { role: 'driver', Icon: ClipboardCheck }, { role: 'elevator', Icon: Building2 },
  { role: 'lab', Icon: FlaskConical }, { role: 'surveyor', Icon: ShieldCheck },
  { role: 'bank', Icon: Landmark }, { role: 'compliance', Icon: Banknote },
  { role: 'arbitrator', Icon: Scale }, { role: 'executive', Icon: Crown },
];

function markEntrySeen() {
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ENTRY_COOKIE}=true; Path=/; Max-Age=14400; SameSite=Lax${secure}`;
}

export function LoginLegacyOverlay() {
  const t = useTranslations('loginLegacy');
  const router = useRouter();
  const setStoreRole = usePlatformV7RStore((state) => state.setRole);
  const [role, setRole] = React.useState<PlatformRole>('operator');
  const [login, setLogin] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [error, setError] = React.useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!login.trim() || !password.trim() || !company.trim()) return setError(t('error'));
    setError('');
    sessionStorage.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role);
    markEntrySeen();
    setStoreRole(role);
    try { await fetch('/api/platform-v7/cabinet-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, company: company.trim() }), keepalive: true }); } catch {}
    router.replace(platformV7RoleHome(role));
  }

  return (
    <main className='p7-login-old'>
      <style>{css}</style>
      <PublicSiteHeader ariaLabel={t('brand')} actions={<Link href='/platform-v7' className='exit' aria-label={t('back')}><ArrowRightFromLine size={22}/></Link>} />
      <section className='card'>
        <span className='kicker'>{t('kicker')}</span>
        <h1>{t('title')}</h1>
        <p>{t('lead')}</p>
        <section className='roles' aria-label={t('chooseWorkspace')}>
          <h2>{t('chooseWorkspace')}</h2>
          <div>{items.map((item)=>{const Icon=item.Icon;const active=item.role===role;return <button key={item.role} type='button' className={active?'active':''} onClick={()=>{setRole(item.role);setError('')}}><Icon size={24}/><b>{t(`roles.${item.role}`)}</b></button>})}</div>
        </section>
        <form onSubmit={submit}>
          <label><span>{t('login')}</span><input value={login} onChange={(e)=>setLogin(e.target.value)} type='email' autoComplete='username'/></label>
          <label><span>{t('password')}</span><input value={password} onChange={(e)=>setPassword(e.target.value)} type='password' autoComplete='current-password'/></label>
          <label><span>{t('organisation')}</span><input value={company} onChange={(e)=>setCompany(e.target.value)} placeholder={t('orgPlaceholder')} autoComplete='organization'/></label>
          {error?<p className='error'>{error}</p>:null}
          <button className='enter'>{t('submit')}</button>
        </form>
      </section>
    </main>
  );
}

const css = `.p7-login-old{min-height:100svh;background:linear-gradient(180deg,#fff 0,#eef6ed 230px,#fff 100%);color:#071611;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Inter,ui-sans-serif,system-ui,sans-serif;padding-top:64px;padding-bottom:42px;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}.p7-login-old *{box-sizing:border-box}.p7-login-old a{text-decoration:none;color:inherit}.old-top{height:82px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(18px,4vw,48px);box-shadow:0 10px 30px rgba(7,22,17,.045)}.brand{display:inline-flex;align-items:center;gap:10px;min-width:0}.brand b{font-size:22px;font-weight:780;letter-spacing:-.03em;white-space:nowrap}.old-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:9px!important;min-width:max-content!important}.old-actions .p7-translator-slot{order:1!important;margin:0!important}.old-actions .p7-translator-button{width:50px!important;min-width:50px!important;height:50px!important;padding:0!important;border-radius:17px!important;border-color:rgba(8,122,59,.18)!important;background:rgba(8,122,59,.055)!important;box-shadow:none!important}.old-actions .p7-translator-button svg{width:21px!important;height:21px!important}.old-actions .p7-translator-button b,.old-actions .p7-translator-button span{display:none!important}.exit{order:2;width:50px;height:50px;border-radius:17px;display:grid;place-items:center;background:#fff7f7;color:#9f1d1d;border:1px solid rgba(185,28,28,.15);box-shadow:none}.card{width:min(100% - 28px,760px);margin:54px auto 0;padding:30px;border-radius:34px;background:rgba(255,255,255,.95);border:1px solid rgba(7,22,17,.07);box-shadow:0 22px 56px rgba(7,22,17,.085)}.kicker{display:inline-flex;padding:9px 15px;border-radius:999px;background:rgba(8,122,59,.105);color:#087a3b;font-size:14px;font-weight:780;letter-spacing:.075em}.card h1{max-width:640px;margin:25px 0 15px;font-size:clamp(43px,7.1vw,64px);line-height:1.01;letter-spacing:-.045em;font-weight:790}.card>p{max-width:620px;margin:0 0 28px;color:#5b6963;font-size:clamp(19px,3.2vw,24px);line-height:1.45;font-weight:600}.roles{padding:22px;border:1px solid rgba(7,22,17,.07);border-radius:26px;background:#fff}.roles h2{margin:0 0 16px;color:#5b6963;font-size:19px;line-height:1.2;font-weight:760}.roles div{display:grid;grid-template-columns:1fr 1fr;gap:13px}.roles button{min-height:104px;border-radius:22px;border:1px solid rgba(8,122,59,.18);background:#fff;color:#087a3b;display:grid;place-items:center;gap:8px;padding:13px;box-shadow:0 8px 22px rgba(7,22,17,.018)}.roles button svg{stroke-width:2.2}.roles button.active{background:#087a3b;color:#fff;border-color:#087a3b;box-shadow:0 14px 28px rgba(8,122,59,.18)}.roles b{color:#071611;font-size:19px;line-height:1.08;font-weight:760;letter-spacing:-.018em}.roles button.active b{color:#fff}form{display:grid;gap:15px;margin-top:24px}label{display:grid;gap:8px}label span{font-size:18px;color:#5b6963;font-weight:760}input{height:66px;border-radius:21px;border:1px solid rgba(7,22,17,.11);background:#fff;padding:0 22px;font-size:21px;font-weight:650;color:#071611}.error{margin:0;padding:16px 18px;border-radius:18px;background:#fff3e8;color:#92400e;font-size:17px;line-height:1.3;font-weight:760}.enter{min-height:66px;border:0;border-radius:22px;background:#088437;color:#fff;font-size:22px;font-weight:800}@media(max-width:560px){.old-top{height:76px;padding:0 16px}.brand{gap:8px}.brand b{font-size:20px}.old-actions{gap:8px!important}.old-actions .p7-translator-button,.exit{width:47px!important;height:47px!important;border-radius:16px!important}.card{width:calc(100% - 28px);margin-top:42px;padding:22px;border-radius:30px}.card h1{font-size:39px;letter-spacing:-.04em}.card>p{font-size:18px}.roles{padding:16px}.roles div{gap:10px}.roles button{min-height:88px;border-radius:20px}.roles b{font-size:17px}.roles button svg{width:23px;height:23px}input{height:60px;font-size:19px}.enter{min-height:62px;font-size:21px}}`;
