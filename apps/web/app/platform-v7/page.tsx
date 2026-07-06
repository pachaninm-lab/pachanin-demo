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
  MessageCircleQuestion,
  PlayCircle,
  Scale,
  ShieldCheck,
  Truck,
  UserRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PlatformPublicHeader } from '@/components/platform-v7/PlatformPublicHeader';
import { PlatformV7IntelligenceStrip } from '@/components/v7r/PlatformV7IntelligenceStrip';

// Копия страницы живёт в apps/web/messages/{ru,en,zh}.json (namespace `landing`);
// en/zh генерируются из ru по общему словарю: scripts/build-platform-v7-messages.mjs.
type Card = { key: string; Icon: LucideIcon };
type RoleCard = Card & { href: string };

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
  { key: 'operator', href: '/platform-v7/login?role=operator', Icon: ClipboardCheck },
  { key: 'buyer', href: '/platform-v7/login?role=buyer', Icon: UserRound },
  { key: 'seller', href: '/platform-v7/login?role=seller', Icon: Wheat },
  { key: 'logistics', href: '/platform-v7/login?role=logistics', Icon: Truck },
  { key: 'driver', href: '/platform-v7/login?role=driver', Icon: Truck },
  { key: 'elevator', href: '/platform-v7/login?role=elevator', Icon: Building2 },
  { key: 'lab', href: '/platform-v7/login?role=lab', Icon: FlaskConical },
  { key: 'surveyor', href: '/platform-v7/login?role=surveyor', Icon: ShieldCheck },
  { key: 'bank', href: '/platform-v7/login?role=bank', Icon: Landmark },
  { key: 'compliance', href: '/platform-v7/login?role=compliance', Icon: ShieldCheck },
  { key: 'arbitrator', href: '/platform-v7/login?role=arbitrator', Icon: Scale },
  { key: 'executive', href: '/platform-v7/login?role=executive', Icon: Banknote },
];

const trustItems: Card[] = [
  { key: 'status', Icon: ShieldCheck },
  { key: 'trail', Icon: BadgeCheck },
  { key: 'docsControl', Icon: LockKeyhole },
  { key: 'basis', Icon: Calculator },
];

const heroSignalKeys = ['price', 'trip', 'acceptance', 'documents', 'settlement'] as const;

export default async function PlatformV7RootPage() {
  const t = await getTranslations('landing');
  return (
    <main data-testid='platform-v7-root-execution-cockpit' className='pc-v7-entry-page pc-v7-public-entry'>
      <style>{css}</style>
      <PlatformPublicHeader mode='public' brandLabel={t('brand')} rightLabel={t('signIn')} />

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
            <Link href='/platform-v7/register' className='entry-primary-cta'>{t('hero.primaryCta')}<ArrowRight size={20} /></Link>
            <Link href='/platform-v7/demo' className='entry-secondary-cta'><PlayCircle size={18} />{t('hero.secondaryCta')}</Link>
            <Link href='/platform-v7/contact' className='entry-register-cta'><MessageCircleQuestion size={18} />{t('hero.questionCta')}</Link>
          </div>
        </div>

        <div className='entry-hero-visual' aria-hidden='true'>
          <div className='entry-visual-card entry-visual-main'>
            <span className='entry-visual-label'>{t('visual.label')}</span>
            <strong>DL-9102</strong>
            <small>{t('visual.note')}</small>
            <div className='entry-signal-list'>
              {heroSignalKeys.map((key) => (
                <span key={key}><b>{t(`visual.signals.${key}.label`)}</b><em>{t(`visual.signals.${key}.value`)}</em></span>
              ))}
            </div>
          </div>
          <div className='entry-route-line' />
          <div className='entry-floating-card docs'><FileCheck2 size={22} /><span>{t('visual.docs')}</span><b>{t('visual.docsState')}</b></div>
          <div className='entry-floating-card quality'><FlaskConical size={22} /><span>{t('visual.quality')}</span><b>{t('visual.qualityState')}</b></div>
          <div className='entry-floating-card money'><Banknote size={22} /><span>{t('visual.money')}</span><b>{t('visual.moneyState')}</b></div>
        </div>
      </section>

      <section id='control' className='entry-section' aria-labelledby='control-title'>
        <SectionHead title={t('control.title')} text={t('control.text')} />
        <div className='entry-control-grid'>
          {controlCards.map((item) => {
            const Icon = item.Icon;
            return (
              <article key={item.key} className='entry-control-tile'>
                <Icon size={31} strokeWidth={2.25} />
                <strong>{t(`control.${item.key}.title`)}</strong>
                <span>{t(`control.${item.key}.text`)}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section id='process' className='entry-section entry-process-section' aria-labelledby='process-title'>
        <SectionHead title={t('process.title')} text={t('process.text')} compact />
        <div className='entry-process-row'>
          {processSteps.map((step, index) => {
            const Icon = step.Icon;
            return (
              <article key={step.key} className='entry-process-tile'>
                <span className='entry-process-index'>{index + 1}</span>
                <span className='entry-process-icon'><Icon size={21} strokeWidth={2.2} /></span>
                <strong>{t(`process.${step.key}.title`)}</strong>
                <small>{t(`process.${step.key}.text`)}</small>
              </article>
            );
          })}
        </div>
      </section>

      <PlatformV7IntelligenceStrip />

      <section id='roles' className='entry-section' aria-labelledby='roles-title'>
        <SectionHead title={t('roles.title')} text={t('roles.text')} />
        <div className='entry-role-grid'>
          {roles.map((role) => {
            const Icon = role.Icon;
            return (
              <Link key={role.key} href={role.href} className='entry-role-tile'>
                <Icon size={27} strokeWidth={2.25} />
                <strong>{t(`roles.${role.key}.title`)}</strong>
                <span>{t(`roles.${role.key}.text`)}</span>
                <em>{t(`roles.${role.key}.cta`)}</em>
              </Link>
            );
          })}
        </div>
      </section>

      <section className='entry-trust-strip' aria-label={t('trust.aria')}>
        {trustItems.map((item) => {
          const Icon = item.Icon;
          return (
            <article key={item.key} className='entry-trust-item'>
              <Icon size={26} strokeWidth={2.25} />
              <strong>{t(`trust.${item.key}.title`)}</strong>
              <span>{t(`trust.${item.key}.text`)}</span>
            </article>
          );
        })}
        <Link href='/platform-v7/register' className='entry-trust-cta'>{t('trust.cta')}</Link>
      </section>
    </main>
  );
}

function SectionHead({ title, text, compact }: { title: string; text: string; compact?: boolean }) {
  return <div className={compact ? 'entry-section-head compact' : 'entry-section-head'}><h2>{title}</h2><p>{text}</p></div>;
}

const css = `
.pc-v7-public-entry{
  --entry-green:#087a3b;
  --entry-green-dark:#055c2d;
  --entry-ink:#071611;
  --entry-muted:#5e6b66;
  --entry-line:rgba(7,22,17,.09);
  --entry-card:rgba(255,255,255,.86);
  --entry-header-height:64px;
  min-height:100vh;
  padding-top:var(--entry-header-height);
  overflow-x:hidden;
  color:var(--entry-ink);
  background:
    radial-gradient(circle at 12% 0%,rgba(0,122,47,.13),transparent 30%),
    radial-gradient(circle at 92% 8%,rgba(196,145,42,.10),transparent 34%),
    linear-gradient(180deg,#fbfcf9 0%,#f2f7f0 54%,#fff 100%);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
.pc-v7-public-entry *{box-sizing:border-box}
.pc-v7-public-entry a{color:inherit;text-decoration:none}
.entry-hero{max-width:1220px;margin:0 auto;min-height:calc(100svh - var(--entry-header-height));padding:clamp(34px,5vw,74px) clamp(18px,4vw,46px) 34px;display:grid;grid-template-columns:minmax(0,1.02fr) minmax(360px,.82fr);gap:clamp(26px,5vw,70px);align-items:center;position:relative}.entry-hero::before{content:"";position:absolute;inset:42px 0 auto 42%;height:420px;border-radius:999px;background:linear-gradient(135deg,rgba(0,122,47,.10),rgba(196,145,42,.10));filter:blur(34px);pointer-events:none}.entry-hero-copy{position:relative;z-index:1;display:grid;gap:20px;max-width:760px}.entry-kicker{width:max-content;display:inline-flex;align-items:center;min-height:34px;padding:0 14px;border-radius:999px;background:rgba(0,122,47,.09);color:var(--entry-green-dark);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.entry-hero h1{margin:0;display:grid;gap:2px;font-size:clamp(50px,7.3vw,92px);line-height:.94;letter-spacing:-.067em;color:var(--entry-ink)}.entry-hero h1 span:last-child{color:var(--entry-green-dark)}.entry-hero p{max-width:720px;margin:0;color:#43514b;font-size:clamp(18px,2vw,23px);line-height:1.42;font-weight:520}.entry-hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}.entry-primary-cta,.entry-secondary-cta,.entry-register-cta{min-height:54px;border-radius:18px;padding:0 20px;display:inline-flex;align-items:center;justify-content:center;gap:10px;font-size:15px;font-weight:950;border:1px solid transparent;transition:transform .18s ease,box-shadow .18s ease}.entry-primary-cta{color:#fff;background:linear-gradient(135deg,#087a3b,#0b6a37);box-shadow:0 20px 42px rgba(0,122,47,.24)}.entry-secondary-cta{color:#0b5f31;background:#fff;border-color:rgba(0,122,47,.18);box-shadow:0 14px 34px rgba(7,22,17,.08)}.entry-register-cta{color:#17251f;background:rgba(255,255,255,.62);border-color:rgba(7,22,17,.10)}.entry-primary-cta:hover,.entry-secondary-cta:hover,.entry-register-cta:hover{transform:translateY(-1px)}
.entry-hero-visual{position:relative;z-index:1;min-height:520px;border-radius:42px;background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(245,249,242,.80));border:1px solid rgba(7,22,17,.08);box-shadow:0 30px 80px rgba(7,22,17,.13);overflow:hidden}.entry-hero-visual::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,22,17,.035) 1px,transparent 1px),linear-gradient(rgba(7,22,17,.035) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(180deg,rgba(0,0,0,.9),transparent)}.entry-route-line{position:absolute;left:58px;right:58px;top:260px;height:3px;border-radius:999px;background:linear-gradient(90deg,rgba(0,122,47,.08),rgba(0,122,47,.82),rgba(196,145,42,.52));box-shadow:0 0 0 10px rgba(0,122,47,.06)}.entry-visual-card{position:absolute;left:42px;right:42px;top:42px;padding:24px;border-radius:30px;background:rgba(255,255,255,.92);border:1px solid rgba(7,22,17,.08);box-shadow:0 18px 45px rgba(7,22,17,.10)}.entry-visual-label{display:block;color:var(--entry-green);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.entry-visual-main strong{display:block;margin-top:8px;font-size:44px;letter-spacing:-.055em}.entry-visual-main small{display:block;margin-top:2px;color:var(--entry-muted);font-weight:760}.entry-signal-list{display:grid;gap:8px;margin-top:18px}.entry-signal-list span{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:center;padding:10px 12px;border-radius:16px;background:#f8fbf7;border:1px solid rgba(7,22,17,.06)}.entry-signal-list b{font-size:13px}.entry-signal-list em{font-style:normal;color:#5a6762;font-size:13px;font-weight:750}.entry-floating-card{position:absolute;display:grid;gap:6px;min-width:132px;padding:16px;border-radius:22px;background:#fff;border:1px solid rgba(7,22,17,.08);box-shadow:0 16px 42px rgba(7,22,17,.12);color:var(--entry-green)}.entry-floating-card span{color:#2b3832;font-size:13px;font-weight:900}.entry-floating-card b{color:#6a756f;font-size:12px}.entry-floating-card.docs{left:42px;bottom:54px}.entry-floating-card.quality{left:50%;bottom:92px;transform:translateX(-50%)}.entry-floating-card.money{right:42px;bottom:54px}
.entry-section{max-width:1220px;margin:0 auto;padding:48px clamp(18px,4vw,46px)}.entry-section-head{display:flex;align-items:end;justify-content:space-between;gap:28px;margin-bottom:22px}.entry-section-head.compact{margin-bottom:18px}.entry-section-head h2{max-width:650px;margin:0;font-size:clamp(34px,4.5vw,58px);line-height:1;letter-spacing:-.055em}.entry-section-head p{max-width:500px;margin:0;color:#60706a;font-size:17px;line-height:1.48}.entry-control-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.entry-control-tile,.entry-process-tile,.entry-role-tile,.entry-trust-item{border:1px solid var(--entry-line);background:var(--entry-card);box-shadow:0 18px 46px rgba(7,22,17,.07);backdrop-filter:blur(12px)}.entry-control-tile{min-height:230px;padding:24px;border-radius:30px;display:grid;align-content:start;gap:14px;color:var(--entry-green)}.entry-control-tile strong{color:var(--entry-ink);font-size:22px;letter-spacing:-.03em}.entry-control-tile span{color:#61716b;line-height:1.45;font-weight:560}.entry-process-row{display:grid;grid-template-columns:repeat(7,minmax(132px,1fr));gap:10px}.entry-process-tile{position:relative;min-height:176px;padding:18px;border-radius:24px;display:grid;align-content:start;gap:10px}.entry-process-tile:not(:last-child)::after{content:"";position:absolute;right:-9px;top:50%;width:12px;height:2px;background:rgba(0,122,47,.28)}.entry-process-index{width:28px;height:28px;border-radius:999px;background:rgba(0,122,47,.09);color:var(--entry-green);display:grid;place-items:center;font-size:12px;font-weight:950}.entry-process-icon{color:var(--entry-green)}.entry-process-tile strong{font-size:18px}.entry-process-tile small{color:#68746f;line-height:1.38;font-size:13px;font-weight:570}.entry-role-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.entry-role-tile{min-height:196px;padding:20px;border-radius:28px;display:grid;align-content:start;gap:10px;color:var(--entry-green);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.entry-role-tile:hover{transform:translateY(-2px);border-color:rgba(0,122,47,.28);box-shadow:0 24px 58px rgba(7,22,17,.11)}.entry-role-tile strong{color:var(--entry-ink);font-size:20px;letter-spacing:-.03em}.entry-role-tile span{color:#65736e;line-height:1.42;font-weight:560}.entry-role-tile em{margin-top:auto;color:var(--entry-green-dark);font-size:13px;font-style:normal;font-weight:900}.entry-trust-strip{max-width:1220px;margin:16px auto 70px;padding:18px clamp(18px,4vw,46px);display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;gap:12px}.entry-trust-item{min-height:128px;padding:18px;border-radius:24px;display:grid;align-content:start;gap:8px;color:var(--entry-green)}.entry-trust-item strong{color:var(--entry-ink);font-size:16px}.entry-trust-item span{color:#66736e;font-size:13px;line-height:1.35}.entry-trust-cta{min-height:128px;min-width:190px;border-radius:24px;display:grid;place-items:center;text-align:center;padding:18px;background:linear-gradient(135deg,#087a3b,#075f31);color:#fff;font-weight:950;box-shadow:0 20px 42px rgba(0,122,47,.22)}
@media (max-width:1080px){.entry-hero{grid-template-columns:1fr;min-height:0}.entry-hero-visual{min-height:420px}.entry-control-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.entry-role-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.entry-trust-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.entry-trust-cta{min-height:92px}}
@media (max-width:720px){.pc-v7-public-entry{--entry-header-height:70px}.entry-hero{padding:26px 14px 20px}.entry-hero-copy{padding:22px 20px;border-radius:28px;background:rgba(255,255,255,.88);border:1px solid rgba(7,22,17,.08);box-shadow:0 16px 42px rgba(7,22,17,.07)}.entry-hero h1{font-size:42px;line-height:1.02}.entry-hero p{font-size:17px}.entry-hero-actions{display:grid}.entry-primary-cta,.entry-secondary-cta,.entry-register-cta{width:100%;min-height:54px}.entry-hero-visual{display:none}.entry-section{padding:22px 14px}.entry-section-head{display:grid;gap:10px;margin-bottom:14px}.entry-section-head h2{font-size:32px}.entry-section-head p{font-size:14.5px}.entry-control-grid{grid-template-columns:1fr}.entry-control-tile{min-height:156px;border-radius:22px;padding:18px}.entry-process-row{display:flex;gap:10px;overflow-x:auto;padding:0 2px 8px}.entry-process-row::-webkit-scrollbar{display:none}.entry-process-tile{flex:0 0 176px;scroll-snap-align:start;min-height:142px}.entry-register-cta{color:#fff!important;background:#087a3b}.entry-process-tile:not(:last-child)::after{display:none}.entry-role-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.entry-role-tile{min-height:142px;padding:14px;border-radius:21px}.entry-role-tile strong{font-size:16px}.entry-role-tile span{font-size:12px}.entry-trust-strip{display:grid;grid-template-columns:1fr;margin:18px 14px 34px;padding:0;gap:10px}.entry-trust-item{min-height:0;border-radius:20px}.entry-trust-cta{min-height:54px;border-radius:18px}}
@media (max-width:374px){.entry-hero h1{font-size:38px}}
`;
