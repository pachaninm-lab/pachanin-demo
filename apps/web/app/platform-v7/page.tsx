import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  Calculator,
  ClipboardCheck,
  FileCheck2,
  FlaskConical,
  Landmark,
  Leaf,
  LockKeyhole,
  LogIn,
  PlayCircle,
  Scale,
  ShieldCheck,
  Truck,
  UserRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PlatformV7IntelligenceStrip } from '@/components/v7r/PlatformV7IntelligenceStrip';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';

export const metadata: Metadata = {
  title: 'Прозрачная Цена — исполнение зерновой сделки',
  description: 'Цифровой контур исполнения внебиржевой зерновой сделки: логистика, приёмка, качество, документы, расчёты, спор и доказательства.',
  alternates: {
    canonical: '/platform-v7',
    languages: {
      ru: '/platform-v7?lang=ru',
      en: '/platform-v7?lang=en',
      zh: '/platform-v7?lang=zh',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

type Card = { key: string; Icon: LucideIcon };
type RoleCard = Card & { href: '/platform-v7/login' };

const controlCards: Card[] = [
  { key: 'money', Icon: Banknote },
  { key: 'documents', Icon: FileCheck2 },
  { key: 'logistics', Icon: Truck },
  { key: 'quality', Icon: FlaskConical },
];

const processSteps: Card[] = [
  { key: 'price', Icon: Leaf },
  { key: 'deal', Icon: ClipboardCheck },
  { key: 'trip', Icon: Truck },
  { key: 'acceptance', Icon: Building2 },
  { key: 'documents', Icon: FileCheck2 },
  { key: 'settlement', Icon: Banknote },
  { key: 'dispute', Icon: Scale },
];

const roles: RoleCard[] = [
  { key: 'operator', href: '/platform-v7/login', Icon: ClipboardCheck },
  { key: 'buyer', href: '/platform-v7/login', Icon: UserRound },
  { key: 'seller', href: '/platform-v7/login', Icon: Wheat },
  { key: 'logistics', href: '/platform-v7/login', Icon: Truck },
  { key: 'driver', href: '/platform-v7/login', Icon: Truck },
  { key: 'elevator', href: '/platform-v7/login', Icon: Building2 },
  { key: 'lab', href: '/platform-v7/login', Icon: FlaskConical },
  { key: 'surveyor', href: '/platform-v7/login', Icon: ShieldCheck },
  { key: 'bank', href: '/platform-v7/login', Icon: Landmark },
  { key: 'compliance', href: '/platform-v7/login', Icon: ShieldCheck },
  { key: 'arbitrator', href: '/platform-v7/login', Icon: Scale },
  { key: 'executive', href: '/platform-v7/login', Icon: Banknote },
];

const trustItems: Card[] = [
  { key: 'status', Icon: ShieldCheck },
  { key: 'trail', Icon: BadgeCheck },
  { key: 'docsControl', Icon: LockKeyhole },
  { key: 'basis', Icon: Calculator },
];

const heroSignals: { key: string; tone: 'done' | 'active' | 'wait' | 'pending' }[] = [
  { key: 'price', tone: 'done' },
  { key: 'trip', tone: 'active' },
  { key: 'acceptance', tone: 'wait' },
  { key: 'documents', tone: 'pending' },
  { key: 'settlement', tone: 'pending' },
];

export default async function PlatformV7RootPage() {
  const t = await getTranslations('landing');
  const roleCatalog = await getTranslations('publicEntry.rolesCatalog');

  return (
    <main data-testid='platform-v7-root-execution-cockpit' className='pc-v7-entry-page pc-v7-public-entry'>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <PublicSiteHeader
        ariaLabel={t('publicNav')}
        tagline={t('brandTagline')}
        nav={(
          <>
            <a href='#process'>{t('nav.process')}</a>
            <a href='#control'>{t('nav.control')}</a>
            <a href='#roles'>{t('nav.roles')}</a>
            <Link href='/platform-v7/deal-flow'>{t('nav.demo')}</Link>
            <Link href='/platform-v7/contact'>{t('nav.contact')}</Link>
            <Link href='/platform-v7/docs'>{t('nav.docs')}</Link>
          </>
        )}
        actions={(
          <>
            <Link href='/platform-v7/login' className='entry-login'><LogIn size={16} aria-hidden='true' />{t('signIn')}</Link>
            <Link href='/platform-v7/register' className='entry-header-register'>{t('register')}</Link>
          </>
        )}
      />

      <section className='entry-hero' aria-labelledby='entry-hero-title'>
        <div className='entry-hero-copy'>
          <span className='entry-kicker'>{t('hero.kicker')}</span>
          <h1 id='entry-hero-title'>
            <span>{t('hero.titleLine1')}</span>
            <span>{t('hero.titleLine2')}</span>
            <span>{t('hero.titleLine3')}</span>
          </h1>
          <p>{t('hero.lead')}</p>
          <div className='entry-hero-actions'>
            <Link href='/platform-v7/register' className='entry-primary-cta'>{t('hero.primaryCta')}<ArrowRight size={20} aria-hidden='true' /></Link>
            <Link href='/platform-v7/deal-flow' className='entry-secondary-cta'><PlayCircle size={18} aria-hidden='true' />{t('hero.secondaryCta')}</Link>
          </div>
        </div>

        <div className='entry-hero-visual' aria-hidden='true'>
          <div className='entry-visual-card'>
            <div className='entry-visual-head'>
              <span className='entry-visual-label'>{t('visual.label')}</span>
              <span className='entry-visual-live'><i />{t('visual.note')}</span>
            </div>
            <strong className='entry-visual-id'>DL-9102</strong>
            <div className='entry-signal-list'>
              {heroSignals.map(({ key, tone }) => (
                <span key={key} className='entry-signal-row' data-tone={tone}>
                  <i className='entry-signal-dot' />
                  <b>{t(`visual.signals.${key}.label`)}</b>
                  <em>{t(`visual.signals.${key}.value`)}</em>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id='control' className='entry-section' aria-labelledby='control-title'>
        <SectionHead id='control-title' title={t('control.title')} text={t('control.text')} />
        <div className='entry-control-grid'>
          {controlCards.map(({ key, Icon }) => (
            <article key={key} className='entry-control-tile'>
              <Icon size={31} strokeWidth={2.25} aria-hidden='true' />
              <strong>{t(`control.${key}.title`)}</strong>
              <span>{t(`control.${key}.text`)}</span>
            </article>
          ))}
        </div>
      </section>

      <section id='process' className='entry-section entry-process-section' aria-labelledby='process-title'>
        <SectionHead id='process-title' title={t('process.title')} text={t('process.text')} compact />
        <div className='entry-process-row' tabIndex={0} role='region' aria-label={t('process.title')}>
          {processSteps.map(({ key, Icon }, index) => (
            <article key={key} className='entry-process-tile'>
              <span className='entry-process-index'>{index + 1}</span>
              <span className='entry-process-icon'><Icon size={21} strokeWidth={2.2} aria-hidden='true' /></span>
              <strong>{t(`process.${key}.title`)}</strong>
              <small>{t(`process.${key}.text`)}</small>
            </article>
          ))}
        </div>
      </section>

      <PlatformV7IntelligenceStrip />

      <section id='roles' className='entry-section' aria-labelledby='roles-title'>
        <SectionHead id='roles-title' title={roleCatalog('title')} text={roleCatalog('text')} />
        <div className='entry-role-grid'>
          {roles.map(({ key, href, Icon }) => (
            <Link key={key} href={href} className='entry-role-tile'>
              <Icon size={27} strokeWidth={2.25} aria-hidden='true' />
              <strong>{t(`roles.${key}.title`)}</strong>
              <span>{t(`roles.${key}.text`)}</span>
              <em>{roleCatalog('cta')}</em>
            </Link>
          ))}
        </div>
      </section>

      <section className='entry-trust-strip' aria-label={t('trust.aria')}>
        {trustItems.map(({ key, Icon }) => (
          <article key={key} className='entry-trust-item'>
            <Icon size={26} strokeWidth={2.25} aria-hidden='true' />
            <strong>{t(`trust.${key}.title`)}</strong>
            <span>{t(`trust.${key}.text`)}</span>
          </article>
        ))}
        <Link href='/platform-v7/register' className='entry-trust-cta'>{t('trust.cta')}</Link>
      </section>
    </main>
  );
}

function SectionHead({ id, title, text, compact }: { id: string; title: string; text: string; compact?: boolean }) {
  return <div className={compact ? 'entry-section-head compact' : 'entry-section-head'}><h2 id={id}>{title}</h2><p>{text}</p></div>;
}

const css = `
.pc-v7-public-entry{--entry-green:#087a3b;--entry-green-dark:#055c2d;--entry-ink:#071611;--entry-muted:#5e6b66;--entry-line:rgba(7,22,17,.09);--entry-card:rgba(255,255,255,.88);--entry-header-height:64px;min-height:100vh;padding-top:var(--entry-header-height);overflow-x:hidden;color:var(--entry-ink);background:radial-gradient(circle at 12% 0%,rgba(0,122,47,.13),transparent 30%),radial-gradient(circle at 92% 8%,rgba(196,145,42,.10),transparent 34%),linear-gradient(180deg,#fbfcf9 0%,#f2f7f0 54%,#fff 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-v7-public-entry *{box-sizing:border-box}.pc-v7-public-entry a{color:inherit;text-decoration:none}.pc-v7-public-entry a:focus-visible{outline:3px solid var(--entry-green);outline-offset:3px;border-radius:12px}.pc-v7-public-entry :where(.entry-role-tile,.entry-primary-cta,.entry-secondary-cta,.entry-login,.entry-header-register,.entry-trust-cta):focus-visible{outline:3px solid var(--entry-green-dark);outline-offset:3px}@media(prefers-reduced-motion:reduce){.pc-v7-public-entry *,.pc-v7-public-entry *::before,.pc-v7-public-entry *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
.entry-login,.entry-header-register{min-height:42px;border-radius:15px;border:1px solid rgba(7,22,17,.10);background:rgba(255,255,255,.86);font-size:14px;font-weight:900;display:inline-flex;align-items:center;justify-content:center}.entry-login{gap:8px;padding:0 15px}.entry-header-register{padding:0 16px;color:var(--entry-green);background:rgba(0,122,47,.07);border-color:rgba(0,122,47,.16)}
.entry-hero{max-width:1220px;margin:0 auto;min-height:calc(100svh - var(--entry-header-height));padding:clamp(34px,5vw,74px) clamp(18px,4vw,46px) 34px;display:grid;grid-template-columns:minmax(0,1.02fr) minmax(360px,.82fr);gap:clamp(26px,5vw,70px);align-items:center;position:relative}.entry-hero::before{content:"";position:absolute;inset:42px 0 auto 42%;height:420px;border-radius:999px;background:linear-gradient(135deg,rgba(0,122,47,.10),rgba(196,145,42,.10));filter:blur(34px);pointer-events:none}.entry-hero-copy{position:relative;z-index:1;display:grid;gap:20px;max-width:760px}.entry-kicker{width:max-content;display:inline-flex;align-items:center;min-height:34px;padding:0 14px;border-radius:999px;background:rgba(0,122,47,.09);color:var(--entry-green-dark);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.entry-hero h1{margin:0;display:grid;gap:2px;font-size:clamp(50px,7.3vw,92px);line-height:.94;letter-spacing:-.067em;color:var(--entry-ink)}.entry-hero h1 span:last-child{color:var(--entry-green-dark)}.entry-hero p{max-width:720px;margin:0;color:#43514b;font-size:clamp(18px,2vw,23px);line-height:1.42;font-weight:520}.entry-hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}.entry-primary-cta,.entry-secondary-cta{min-height:54px;border-radius:18px;padding:0 20px;display:inline-flex;align-items:center;justify-content:center;gap:10px;font-size:15px;font-weight:950;border:1px solid transparent;transition:transform .18s ease,box-shadow .18s ease}.entry-primary-cta{color:#fff;background:linear-gradient(135deg,#087a3b,#0b6a37);box-shadow:0 20px 42px rgba(0,122,47,.24)}.entry-secondary-cta{color:#0b5f31;background:#fff;border-color:rgba(0,122,47,.18);box-shadow:0 14px 34px rgba(7,22,17,.08)}.entry-primary-cta:hover,.entry-secondary-cta:hover{transform:translateY(-1px)}
.entry-hero-visual{position:relative;z-index:1;display:flex;align-items:center;min-height:520px;padding:26px;border-radius:42px;background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(245,249,242,.80));border:1px solid rgba(7,22,17,.08);box-shadow:0 30px 80px rgba(7,22,17,.13);overflow:hidden}.entry-hero-visual::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,22,17,.03) 1px,transparent 1px),linear-gradient(rgba(7,22,17,.03) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(180deg,rgba(0,0,0,.85),transparent);pointer-events:none}.entry-visual-card{position:relative;z-index:1;width:100%;display:flex;flex-direction:column;gap:16px;padding:26px;border-radius:30px;background:rgba(255,255,255,.94);border:1px solid rgba(7,22,17,.08);box-shadow:0 18px 45px rgba(7,22,17,.10)}.entry-visual-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.entry-visual-label{color:var(--entry-green);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap}.entry-visual-id{margin:-4px 0 4px;font-size:46px;line-height:1;letter-spacing:-.055em;white-space:nowrap}.entry-visual-live{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;background:rgba(0,122,47,.09);color:var(--entry-green-dark);font-size:12px;font-weight:850;white-space:nowrap}.entry-visual-live i{width:8px;height:8px;border-radius:999px;background:var(--entry-green);box-shadow:0 0 0 4px rgba(0,122,47,.16);animation:entryPulse 2.4s ease-in-out infinite}.entry-signal-list{display:flex;flex-direction:column;gap:9px}.entry-signal-row{display:grid;grid-template-columns:11px 104px 1fr;gap:12px;align-items:center;padding:13px 15px;border-radius:16px;background:#f8fbf7;border:1px solid rgba(7,22,17,.06)}.entry-signal-dot{width:11px;height:11px;border-radius:999px;background:var(--dot,#9aa8a2);box-shadow:0 0 0 4px var(--dot-halo,rgba(154,168,162,.16))}.entry-signal-row b{font-size:14px;font-weight:820}.entry-signal-row em{font-style:normal;justify-self:end;text-align:right;color:var(--val,#5a6762);font-size:13.5px;font-weight:820}.entry-signal-row[data-tone='done']{--dot:var(--entry-green);--dot-halo:rgba(0,122,47,.16);--val:var(--entry-green-dark)}.entry-signal-row[data-tone='active']{--dot:#c4912a;--dot-halo:rgba(196,145,42,.18);--val:#8a6410}.entry-signal-row[data-tone='wait']{--dot:#3b73c4;--dot-halo:rgba(59,115,196,.16);--val:#2c568f}@keyframes entryPulse{0%,100%{box-shadow:0 0 0 3px rgba(0,122,47,.20)}50%{box-shadow:0 0 0 6px rgba(0,122,47,.05)}}
.entry-section{max-width:1220px;margin:0 auto;padding:48px clamp(18px,4vw,46px)}.entry-section-head{display:flex;align-items:end;justify-content:space-between;gap:28px;margin-bottom:22px}.entry-section-head.compact{margin-bottom:18px}.entry-section-head h2{max-width:650px;margin:0;font-size:clamp(34px,4.5vw,58px);line-height:1;letter-spacing:-.055em}.entry-section-head p{max-width:500px;margin:0;color:#60706a;font-size:17px;line-height:1.48}.entry-control-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.entry-control-tile,.entry-process-tile,.entry-role-tile,.entry-trust-item{border:1px solid var(--entry-line);background:var(--entry-card);box-shadow:0 18px 46px rgba(7,22,17,.07);backdrop-filter:blur(12px)}.entry-control-tile{min-height:230px;padding:24px;border-radius:30px;display:grid;align-content:start;gap:14px;color:var(--entry-green)}.entry-control-tile strong{color:var(--entry-ink);font-size:22px;letter-spacing:-.03em}.entry-control-tile span{color:#61716b;line-height:1.45;font-weight:560}.entry-process-row{display:grid;grid-template-columns:repeat(7,minmax(132px,1fr));gap:10px}.entry-process-tile{position:relative;min-height:176px;padding:18px;border-radius:24px;display:grid;align-content:start;gap:10px}.entry-process-tile:not(:last-child)::after{content:"";position:absolute;right:-9px;top:50%;width:12px;height:2px;background:rgba(0,122,47,.28)}.entry-process-index{width:28px;height:28px;border-radius:999px;background:rgba(0,122,47,.09);color:var(--entry-green);display:grid;place-items:center;font-size:12px;font-weight:950}.entry-process-icon{color:var(--entry-green)}.entry-process-tile strong{font-size:18px}.entry-process-tile small{color:#68746f;line-height:1.38;font-size:13px;font-weight:570}.entry-role-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.entry-role-tile{min-height:196px;padding:20px;border-radius:28px;display:flex;flex-direction:column;align-items:flex-start;gap:10px;color:var(--entry-green);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.entry-role-tile:hover{transform:translateY(-2px);border-color:rgba(0,122,47,.28);box-shadow:0 24px 58px rgba(7,22,17,.11)}.entry-role-tile strong{color:var(--entry-ink);font-size:20px;letter-spacing:-.03em}.entry-role-tile span{color:#65736e;line-height:1.42;font-weight:560}.entry-role-tile em{margin-top:auto;color:var(--entry-green-dark);font-size:13px;font-style:normal;font-weight:900}.entry-trust-strip{max-width:1220px;margin:16px auto 70px;padding:18px clamp(18px,4vw,46px);display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;gap:12px}.entry-trust-item{min-height:128px;padding:18px;border-radius:24px;display:grid;align-content:start;gap:8px;color:var(--entry-green)}.entry-trust-item strong{color:var(--entry-ink);font-size:16px}.entry-trust-item span{color:#66736e;font-size:13px;line-height:1.35}.entry-trust-cta{min-height:128px;min-width:190px;border-radius:24px;display:grid;place-items:center;text-align:center;padding:18px;background:linear-gradient(135deg,#087a3b,#075f31);color:#fff;font-weight:950;box-shadow:0 20px 42px rgba(0,122,47,.22)}
@media(max-width:1080px){.entry-hero{grid-template-columns:1fr;min-height:0}.entry-hero-visual{min-height:0;justify-content:center;padding:22px}.entry-visual-card{max-width:560px}.entry-control-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.entry-process-row{display:flex;gap:10px;overflow-x:auto;padding:0 2px 8px;scroll-snap-type:x proximity}.entry-process-row::-webkit-scrollbar{display:none}.entry-process-tile{flex:0 0 172px;scroll-snap-align:start;min-height:0}.entry-process-tile:not(:last-child)::after{display:none}.entry-role-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.entry-trust-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.entry-trust-cta{min-height:92px}}
@media(max-width:720px){.entry-header-register{display:none}.entry-hero{padding:26px 14px 20px}.entry-hero-copy{padding:22px 20px;border-radius:28px;background:rgba(255,255,255,.88);border:1px solid rgba(7,22,17,.08);box-shadow:0 16px 42px rgba(7,22,17,.07)}.entry-hero h1{font-size:42px;line-height:1.02}.entry-hero p{font-size:17px}.entry-hero-actions{display:grid}.entry-primary-cta,.entry-secondary-cta{width:100%;min-height:54px}.entry-hero-visual{display:none}.entry-section{padding:36px 14px}.entry-section-head{display:grid;gap:10px}.entry-section-head h2{font-size:34px}.entry-section-head p{font-size:15px}.entry-control-grid{grid-template-columns:1fr}.entry-control-tile{min-height:0;padding:20px;border-radius:24px}.entry-role-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.entry-role-tile{min-height:172px;padding:16px;border-radius:22px}.entry-trust-strip{grid-template-columns:1fr;margin:8px auto 50px;padding:14px}.entry-trust-cta{min-height:64px}}
@media(max-width:420px){.entry-role-grid{grid-template-columns:1fr}.entry-role-tile{min-height:0}.entry-visual-id{font-size:38px}}
`;
