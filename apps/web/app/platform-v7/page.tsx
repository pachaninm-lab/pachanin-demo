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
import { PlatformV7IntelligenceStrip } from '@/components/v7r/PlatformV7IntelligenceStrip';
import { BrandMark } from '@/components/v7r/BrandMark';

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
      <header className='entry-header' aria-label={t('publicNav')}>
        <Link href='/platform-v7' className='entry-brand' aria-label={t('brand')}>
          <span className='entry-brand-mark'><BrandMark size={40} /></span>
          <span><strong>{t('brand')}</strong><small>{t('brandTagline')}</small></span>
        </Link>
        <nav className='entry-nav' aria-label={t('sectionsNav')}>
          <a href='#process'>{t('nav.process')}</a>
          <a href='#control'>{t('nav.control')}</a>
          <a href='#roles'>{t('nav.roles')}</a>
          <Link href='/platform-v7/demo'>{t('nav.demo')}</Link>
          <Link href='/platform-v7/contact'>{t('nav.contact')}</Link>
          <Link href='/platform-v7/docs'>{t('nav.docs')}</Link>
        </nav>
        <div className='entry-header-actions'>
          <Link href='/platform-v7/login' className='entry-login'><LogIn size={16} />{t('signIn')}</Link>
          <Link href='/platform-v7/register' className='entry-header-register'>{t('register')}</Link>
        </div>
      </header>

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
    </main>
  );
}

function SectionHead({ title, text, compact }: { title: string; text: string; compact?: boolean }) {
  return <div className={compact ? 'entry-section-head compact' : 'entry-section-head'}><h2>{title}</h2><p>{text}</p></div>;
}

const css = `
  .pc-v7-public-entry{min-height:100vh;background:linear-gradient(180deg,#fbfdf9 0%,#eef6eb 38%,#fff 100%);color:#06130f;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow-x:hidden}.pc-v7-public-entry *{box-sizing:border-box}.entry-header{position:sticky;top:0;z-index:50;display:grid;grid-template-columns:auto 1fr auto;gap:24px;align-items:center;padding:18px clamp(22px,4vw,46px);background:rgba(255,255,255,.94);border-bottom:1px solid rgba(6,19,15,.08);backdrop-filter:blur(18px)}.entry-brand{display:inline-flex;align-items:center;gap:14px;text-decoration:none;color:#06130f;min-width:0}.entry-brand-mark{width:62px;height:62px;border-radius:18px;background:rgba(0,122,47,.08);display:grid;place-items:center;color:#087a3b;flex:0 0 62px}.entry-brand strong{display:block;font-size:clamp(24px,3vw,34px);font-weight:950;letter-spacing:-.055em;line-height:1}.entry-brand small{display:block;margin-top:5px;color:#5e6b65;font-weight:800;font-size:13px}.entry-nav{display:flex;align-items:center;justify-content:center;gap:12px;min-width:0}.entry-nav a{color:#33423d;text-decoration:none;font-size:13px;font-weight:850;padding:10px 12px;border-radius:999px;background:rgba(255,255,255,.54);border:1px solid rgba(6,19,15,.06)}.entry-header-actions{display:inline-flex;align-items:center;gap:10px}.entry-login,.entry-header-register{min-height:46px;border-radius:15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 17px;text-decoration:none;font-weight:950}.entry-login{color:#06130f;background:#fff;border:1px solid rgba(6,19,15,.12)}.entry-header-register{color:#fff;background:#087a3b;border:1px solid #087a3b}.entry-hero{display:grid;grid-template-columns:minmax(0,1.04fr) minmax(320px,.96fr);gap:28px;max-width:1180px;margin:30px auto 0;padding:0 clamp(20px,4vw,46px) 24px}.entry-hero-copy{padding:42px;border-radius:34px;background:rgba(255,255,255,.82);border:1px solid rgba(6,19,15,.08);box-shadow:0 24px 70px rgba(6,19,15,.10)}.entry-kicker{display:inline-flex;border-radius:999px;padding:10px 14px;background:rgba(0,122,47,.09);color:#087a3b;font-size:13px;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.entry-hero h1{margin:18px 0 18px;font-size:clamp(48px,7vw,88px);line-height:.91;letter-spacing:-.07em;font-weight:950}.entry-hero h1 span{display:block}.entry-hero p{margin:0;color:#43534d;font-size:clamp(19px,2vw,25px);line-height:1.52;font-weight:720}.entry-hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.entry-primary-cta,.entry-secondary-cta,.entry-register-cta{min-height:52px;border-radius:17px;display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:0 18px;text-decoration:none;font-weight:950}.entry-primary-cta{background:#087a3b;color:#fff}.entry-secondary-cta,.entry-register-cta{background:#fff;color:#06130f;border:1px solid rgba(6,19,15,.1)}.entry-hero-visual{position:relative;min-height:520px;border-radius:34px;background:radial-gradient(circle at 20% 12%,rgba(0,122,47,.16),transparent 28%),linear-gradient(135deg,#f7fbf5,#fff);border:1px solid rgba(6,19,15,.08);box-shadow:0 24px 70px rgba(6,19,15,.10);overflow:hidden}.entry-visual-card{position:absolute;border-radius:24px;background:rgba(255,255,255,.88);border:1px solid rgba(6,19,15,.08);box-shadow:0 18px 44px rgba(6,19,15,.12);padding:22px}.entry-visual-main{left:32px;right:32px;top:34px}.entry-visual-label{display:block;color:#087a3b;font-size:13px;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.entry-visual-main strong{display:block;margin-top:8px;font-size:58px;line-height:1;font-weight:950;letter-spacing:-.06em}.entry-visual-main small{display:block;margin-top:8px;color:#596762;font-weight:800}.entry-signal-list{display:grid;gap:8px;margin-top:18px}.entry-signal-list span{display:flex;align-items:center;justify-content:space-between;gap:10px;border-radius:15px;background:#f7faf6;border:1px solid rgba(6,19,15,.07);padding:10px 12px}.entry-signal-list b{font-size:13px}.entry-signal-list em{font-style:normal;color:#087a3b;font-weight:950}.entry-route-line{position:absolute;left:72px;right:72px;bottom:180px;height:3px;background:linear-gradient(90deg,#087a3b,#93c5aa);border-radius:99px}.entry-floating-card{display:grid;gap:5px;position:absolute;bottom:42px;width:31%;min-height:112px}.entry-floating-card.docs{left:32px}.entry-floating-card.quality{left:50%;transform:translateX(-50%)}.entry-floating-card.money{right:32px}.entry-floating-card svg{color:#087a3b}.entry-floating-card span{color:#5a6963;font-size:12px;font-weight:850}.entry-floating-card b{font-size:17px;line-height:1.15}.entry-section{max-width:1180px;margin:20px auto 0;padding:30px clamp(20px,4vw,46px);border-radius:34px;background:rgba(255,255,255,.82);border:1px solid rgba(6,19,15,.08);box-shadow:0 20px 60px rgba(6,19,15,.08)}.entry-section-head{display:flex;justify-content:space-between;gap:22px;align-items:end;margin-bottom:22px}.entry-section-head.compact{display:block}.entry-section-head h2{margin:0;font-size:clamp(32px,4vw,54px);line-height:1;letter-spacing:-.055em;font-weight:950}.entry-section-head p{max-width:560px;margin:0;color:#52625c;font-size:17px;line-height:1.55;font-weight:750}.entry-control-grid,.entry-role-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.entry-control-tile,.entry-role-tile,.entry-process-tile{border-radius:24px;background:#fff;border:1px solid rgba(6,19,15,.08);box-shadow:0 12px 32px rgba(6,19,15,.07);padding:20px;text-decoration:none;color:#06130f}.entry-control-tile{display:grid;gap:10px}.entry-control-tile svg,.entry-role-tile svg{color:#087a3b}.entry-control-tile strong,.entry-role-tile strong{font-size:19px;line-height:1.12;font-weight:950}.entry-control-tile span,.entry-role-tile span,.entry-process-tile small{color:#53635d;font-weight:750;line-height:1.45}.entry-process-row{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px}.entry-process-tile{position:relative;min-height:190px;display:grid;align-content:start;gap:9px}.entry-process-index{color:#cbd5cf;font-size:12px;font-weight:950}.entry-process-icon{width:42px;height:42px;border-radius:14px;background:rgba(0,122,47,.08);display:grid;place-items:center;color:#087a3b}.entry-process-tile strong{font-size:16px;line-height:1.18;font-weight:950}.entry-role-tile{display:grid;gap:9px;min-height:190px}.entry-role-tile em{margin-top:auto;color:#087a3b;font-style:normal;font-weight:950}@media(max-width:960px){.entry-header{grid-template-columns:1fr auto}.entry-nav{display:none}.entry-hero{grid-template-columns:1fr}.entry-hero-visual{min-height:460px}.entry-control-grid,.entry-role-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.entry-process-row{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.entry-header{padding:14px 18px;gap:12px}.entry-brand-mark{width:50px;height:50px;flex-basis:50px}.entry-brand strong{font-size:24px}.entry-header-register{display:none}.entry-login{min-width:92px}.entry-hero{margin-top:16px;padding:0 14px 14px}.entry-hero-copy{padding:24px;border-radius:28px}.entry-hero h1{font-size:48px}.entry-hero p{font-size:18px}.entry-primary-cta,.entry-secondary-cta,.entry-register-cta{width:100%}.entry-hero-visual{display:none}.entry-section{margin-top:14px;padding:22px 14px;border-radius:28px}.entry-section-head{display:grid}.entry-control-grid,.entry-role-grid,.entry-process-row{grid-template-columns:1fr}.entry-role-tile{min-height:140px}.entry-control-tile,.entry-role-tile,.entry-process-tile{border-radius:22px;padding:18px}}`;
