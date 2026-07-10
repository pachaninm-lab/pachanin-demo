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
