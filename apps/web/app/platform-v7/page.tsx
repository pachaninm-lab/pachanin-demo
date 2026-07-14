import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-landing.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-public-entry-stable.css';
import '@/styles/platform-v7-role-cards-stable.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-public-webkit-safe.css';
import '@/styles/platform-v7-public-hero-watermark.css';
import '@/styles/platform-v7-public-world-class.css';
import '@/styles/platform-v7-public-typography.css';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { PlatformV7IntelligenceStrip } from '@/components/v7r/PlatformV7IntelligenceStrip';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { getPublicLandingCopy } from '@/i18n/public-landing-copy';

export const metadata: Metadata = {
  title: 'Прозрачная Цена — исполнение зерновой сделки',
  description: 'Платформа для исполнения внебиржевых зерновых сделок: перевозка, приёмка, качество, документы, расчёты и споры.',
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

type Card = { key: string; glyph: string };
type RoleCard = Card;
type PublicHeroLocale = 'ru' | 'en' | 'zh';

const controlCards: Card[] = [
  { key: 'money', glyph: '₽' },
  { key: 'documents', glyph: '§' },
  { key: 'logistics', glyph: '↗' },
  { key: 'quality', glyph: '∴' },
];

const processSteps: Card[] = [
  { key: 'price', glyph: '₽' },
  { key: 'deal', glyph: '✓' },
  { key: 'trip', glyph: '→' },
  { key: 'acceptance', glyph: '▣' },
  { key: 'documents', glyph: '§' },
  { key: 'settlement', glyph: '=' },
  { key: 'dispute', glyph: '!' },
];

const roles: RoleCard[] = [
  { key: 'operator', glyph: '◎' },
  { key: 'buyer', glyph: '↓' },
  { key: 'seller', glyph: '↑' },
  { key: 'logistics', glyph: '↗' },
  { key: 'driver', glyph: '→' },
  { key: 'elevator', glyph: '▣' },
  { key: 'lab', glyph: '∴' },
  { key: 'surveyor', glyph: '✓' },
  { key: 'bank', glyph: '₽' },
  { key: 'compliance', glyph: '§' },
  { key: 'arbitrator', glyph: '⚖' },
  { key: 'executive', glyph: '∑' },
];

const trustItems: Card[] = [
  { key: 'status', glyph: '✓' },
  { key: 'trail', glyph: '↻' },
  { key: 'docsControl', glyph: '§' },
  { key: 'basis', glyph: '₽' },
];

const heroSignals: { key: string; tone: 'done' | 'active' | 'wait' | 'pending' }[] = [
  { key: 'price', tone: 'done' },
  { key: 'trip', tone: 'active' },
  { key: 'acceptance', tone: 'wait' },
  { key: 'documents', tone: 'pending' },
  { key: 'settlement', tone: 'pending' },
];

const GLYPH_STYLE: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 32,
  height: 32,
  borderRadius: 11,
  background: 'rgba(0,122,47,.08)',
  color: '#087a3b',
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1,
};

const ON_GREEN_STYLE: CSSProperties = { color: '#ffffff' };

const PUBLIC_HERO_TITLES: Record<PublicHeroLocale, readonly [string, string]> = {
  ru: ['Управляйте зерновой сделкой', 'от условий до расчёта.'],
  en: ['Manage the grain deal', 'from terms to settlement.'],
  zh: ['管理粮食交易', '从交易条件到结算。'],
};

const LANDING_REFINEMENT_CSS = `
.pc-v7-public-entry .p7-support-chat-button{
  right:max(16px,env(safe-area-inset-right,0px))!important;
  bottom:calc(env(safe-area-inset-bottom,0px) + 18px)!important;
}
.pc-v7-public-entry .p7-support-chat-panel{
  bottom:calc(env(safe-area-inset-bottom,0px) + 86px)!important;
  max-height:min(680px,calc(100dvh - 112px))!important;
}
@media(max-width:720px){
  .pc-v7-public-entry .entry-hero{padding-top:24px;padding-bottom:30px}
  .pc-v7-public-entry .entry-hero-copy{gap:18px}
  .pc-v7-public-entry .entry-hero-actions{margin-top:2px}
}
`;

function EntryGlyph({ value, compact = false }: { value: string; compact?: boolean }) {
  return (
    <b
      aria-hidden='true'
      style={compact ? { ...GLYPH_STYLE, width: 28, height: 28, borderRadius: 9, fontSize: 15 } : GLYPH_STYLE}
    >
      {value}
    </b>
  );
}

export default async function PlatformV7RootPage() {
  const locale = await getLocale();
  const { t, supporting: publicLanding, rolesCatalog: roleCatalog } = getPublicLandingCopy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const currentYear = new Date().getUTCFullYear();
  const heroLocale: PublicHeroLocale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const heroTitle = PUBLIC_HERO_TITLES[heroLocale];

  const nav = (
    <>
      <a href='#process'>{t('nav.process')}</a>
      <a href='#control'>{t('nav.control')}</a>
      <a href='#roles'>{t('nav.roles')}</a>
      <a href='/platform-v7/deal-flow'>{t('nav.dealFlow')}</a>
      <a href='/platform-v7/docs'>{t('nav.docs')}</a>
      <a href='/platform-v7/contact'>{t('nav.contact')}</a>
    </>
  );

  return (
    <main
      id='main-content'
      data-testid='platform-v7-root-execution-cockpit'
      className='pc-v7-entry-page pc-v7-public-entry pc-public-world-class'
    >
      <a className='pc-skip-link' href='#entry-hero-title'>{chrome('skipToContent')}</a>

      <PublicSiteHeader
        ariaLabel={t('publicNav')}
        tagline={t('brandTagline')}
        brandHomeLabel={chrome('brandHomeLabel')}
        navLabel={chrome('navLabel')}
        menuLabel={chrome('menuLabel')}
        showMobileMenu={false}
        localeControl={<PublicLocaleLink />}
        nav={nav}
        actions={(
          <>
            <a href='/platform-v7/login' className='entry-login'>{t('signIn')}</a>
            <a href='/platform-v7/register' className='entry-header-register'>{t('hero.primaryCta')}</a>
          </>
        )}
      />
      <style>{LANDING_REFINEMENT_CSS}</style>

      <section className='entry-hero' aria-labelledby='entry-hero-title'>
        <div className='entry-hero-copy'>
          <span className='entry-kicker'>{t('hero.kicker')}</span>
          <h1 id='entry-hero-title'>
            {heroTitle.map((line) => <span key={line}>{line}</span>)}
          </h1>
          <p>{t('hero.lead')}</p>
          <div className='entry-hero-actions'>
            <a href='/platform-v7/register' className='entry-primary-cta' style={ON_GREEN_STYLE}>{t('hero.primaryCta')}<span aria-hidden='true'>→</span></a>
            <a href='/platform-v7/deal-flow' className='entry-secondary-cta'>{t('hero.secondaryCta')}<span aria-hidden='true'>→</span></a>
          </div>
        </div>

        <div className='entry-hero-visual' aria-hidden='true'>
          <div className='entry-visual-card'>
            <div className='entry-visual-head'>
              <span className='entry-visual-label'>{t('visual.label')}</span>
              <span className='entry-visual-live'>{t('visual.note')}</span>
            </div>
            <strong className='entry-visual-id'>{publicLanding('visualTitle')}</strong>
            <div className='entry-signal-list'>
              {heroSignals.map(({ key, tone }) => (
                <span key={key} className='entry-signal-row' data-tone={tone}>
                  <i className='entry-signal-dot' />
                  <b>{t(`visual.signals.${key}.label`)}</b>
                  <em>{t(`visual.signals.${key}.value`)}</em>
                </span>
              ))}
            </div>
            <div className='entry-visual-basis'>
              <span>{publicLanding('visualBasisLabel')}</span>
              <strong>{publicLanding('visualBasisText')}</strong>
            </div>
          </div>
        </div>
      </section>

      <section id='control' className='entry-section' aria-labelledby='control-title'>
        <SectionHead id='control-title' title={t('control.title')} text={t('control.text')} />
        <div className='entry-control-grid'>
          {controlCards.map(({ key, glyph }) => (
            <article key={key} className='entry-control-tile'>
              <EntryGlyph value={glyph} />
              <strong>{t(`control.${key}.title`)}</strong>
              <span>{t(`control.${key}.text`)}</span>
            </article>
          ))}
        </div>
      </section>

      <section id='process' className='entry-section entry-process-section' aria-labelledby='process-title'>
        <SectionHead id='process-title' title={t('process.title')} text={t('process.text')} compact />
        <div className='entry-process-row' tabIndex={0} role='region' aria-label={t('process.title')}>
          {processSteps.map(({ key, glyph }, index) => (
            <article key={key} className='entry-process-tile'>
              <span className='entry-process-index'>{index + 1}</span>
              <span className='entry-process-icon'><EntryGlyph value={glyph} compact /></span>
              <strong>{t(`process.${key}.title`)}</strong>
              <small>{t(`process.${key}.text`)}</small>
            </article>
          ))}
        </div>
      </section>

      <PlatformV7IntelligenceStrip />

      <section id='roles' className='entry-section' aria-labelledby='roles-title'>
        <SectionHead id='roles-title' title={roleCatalog('title')} text={roleCatalog('text')} />
        <div className='entry-role-grid' role='list'>
          {roles.map(({ key, glyph }) => (
            <article key={key} className='entry-role-tile' role='listitem'>
              <EntryGlyph value={glyph} />
              <strong>{t(`roles.${key}.title`)}</strong>
              <span>{t(`roles.${key}.text`)}</span>
              <em>{roleCatalog('cta')}</em>
            </article>
          ))}
        </div>
        <div className='entry-role-access'>
          <div>
            <strong>{publicLanding('rolesAccessTitle')}</strong>
            <span>{publicLanding('rolesAccessText')}</span>
          </div>
          <a href='/platform-v7/login' className='entry-role-access-cta' style={ON_GREEN_STYLE}>{publicLanding('rolesAccessCta')}<span aria-hidden='true'>→</span></a>
        </div>
      </section>

      <section className='entry-trust-strip' aria-label={t('trust.aria')}>
        {trustItems.map(({ key, glyph }) => (
          <article key={key} className='entry-trust-item'>
            <EntryGlyph value={glyph} compact />
            <strong>{t(`trust.${key}.title`)}</strong>
            <span>{t(`trust.${key}.text`)}</span>
          </article>
        ))}
        <a href='/platform-v7/register' className='entry-trust-cta' style={ON_GREEN_STYLE}>{t('trust.cta')}</a>
      </section>

      <footer className='entry-footer'>
        <div className='entry-footer-brand'>
          <strong>Прозрачная Цена</strong>
          <span>{publicLanding('footerStatement')}</span>
        </div>
        <nav aria-label={chrome('navLabel')}>
          <a href='/platform-v7/docs'>{publicLanding('footerDocs')}</a>
          <a href='/platform-v7/contact'>{publicLanding('footerContact')}</a>
          <a href='/platform-v7/login'>{publicLanding('footerLogin')}</a>
        </nav>
        <small>© {currentYear} · {publicLanding('footerRights')}</small>
      </footer>
    </main>
  );
}

function SectionHead({ id, title, text, compact }: { id: string; title: string; text: string; compact?: boolean }) {
  return <div className={compact ? 'entry-section-head compact' : 'entry-section-head'}><h2 id={id}>{title}</h2><p>{text}</p></div>;
}
