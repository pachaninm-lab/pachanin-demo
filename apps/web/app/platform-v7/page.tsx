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
import styles from './public-entry.module.css';

type Card = { key: string; Icon: LucideIcon };
type SignalTone = 'done' | 'active' | 'wait' | 'pending';

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

const roles: Card[] = [
  { key: 'operator', Icon: ClipboardCheck },
  { key: 'buyer', Icon: UserRound },
  { key: 'seller', Icon: Wheat },
  { key: 'logistics', Icon: Truck },
  { key: 'driver', Icon: Truck },
  { key: 'elevator', Icon: Building2 },
  { key: 'lab', Icon: FlaskConical },
  { key: 'surveyor', Icon: ShieldCheck },
  { key: 'bank', Icon: Landmark },
  { key: 'compliance', Icon: ShieldCheck },
  { key: 'arbitrator', Icon: Scale },
  { key: 'executive', Icon: Banknote },
];

const trustItems: Card[] = [
  { key: 'status', Icon: ShieldCheck },
  { key: 'trail', Icon: BadgeCheck },
  { key: 'docsControl', Icon: LockKeyhole },
  { key: 'basis', Icon: Calculator },
];

const heroSignals: { key: string; tone: SignalTone }[] = [
  { key: 'price', tone: 'done' },
  { key: 'trip', tone: 'active' },
  { key: 'acceptance', tone: 'wait' },
  { key: 'documents', tone: 'pending' },
  { key: 'settlement', tone: 'pending' },
];

export default async function PlatformV7RootPage() {
  const t = await getTranslations('landing');

  return (
    <main data-testid='platform-v7-root-execution-cockpit' className={styles.page}>
      <PublicSiteHeader
        ariaLabel={t('publicNav')}
        sectionsAriaLabel={t('sectionsNav')}
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

      <section className={styles.hero} aria-labelledby='entry-hero-title'>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>{t('hero.kicker')}</span>
          <h1 id='entry-hero-title'>
            <span>{t('hero.titleLine1')}</span>
            <span>{t('hero.titleLine2')}</span>
            <span>{t('hero.titleLine3')}</span>
          </h1>
          <p className={styles.heroLead}>{t('hero.lead')}</p>
          <div className={styles.heroActions}>
            <Link href='/platform-v7/register' className={styles.primaryCta}>
              {t('hero.primaryCta')}<ArrowRight size={20} aria-hidden='true' />
            </Link>
            <Link href='/platform-v7/deal-flow' className={styles.secondaryCta}>
              <PlayCircle size={18} aria-hidden='true' />{t('hero.secondaryCta')}
            </Link>
          </div>
          <div className={styles.heroTrust} aria-label={t('trust.aria')}>
            <span>{t('trust.status.title')}</span>
            <span>{t('trust.trail.title')}</span>
            <span>{t('trust.basis.title')}</span>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <article className={styles.visualCard} aria-label={`${t('visual.label')} DL-9102`}>
            <div className={styles.visualHead}>
              <span className={styles.visualLabel}>{t('visual.label')}</span>
              <span className={styles.visualNote}><i aria-hidden='true' />{t('visual.note')}</span>
            </div>
            <strong className={styles.visualId}>DL-9102</strong>
            <div className={styles.signalList}>
              {heroSignals.map(({ key, tone }) => (
                <span key={key} className={styles.signalRow} data-tone={tone}>
                  <i className={styles.signalDot} aria-hidden='true' />
                  <b>{t(`visual.signals.${key}.label`)}</b>
                  <em>{t(`visual.signals.${key}.value`)}</em>
                </span>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section id='control' className={styles.section} aria-labelledby='control-title'>
        <SectionHead id='control-title' title={t('control.title')} text={t('control.text')} />
        <div className={styles.controlGrid}>
          {controlCards.map(({ key, Icon }) => (
            <article key={key} className={styles.controlTile}>
              <Icon size={31} strokeWidth={2.25} aria-hidden='true' />
              <strong>{t(`control.${key}.title`)}</strong>
              <span>{t(`control.${key}.text`)}</span>
            </article>
          ))}
        </div>
      </section>

      <section id='process' className={styles.section} aria-labelledby='process-title'>
        <SectionHead id='process-title' title={t('process.title')} text={t('process.text')} />
        <div className={styles.processRow}>
          {processSteps.map(({ key, Icon }, index) => (
            <article key={key} className={styles.processTile}>
              <span className={styles.processIndex}>{index + 1}</span>
              <span className={styles.processIcon}><Icon size={21} strokeWidth={2.2} aria-hidden='true' /></span>
              <strong>{t(`process.${key}.title`)}</strong>
              <small>{t(`process.${key}.text`)}</small>
            </article>
          ))}
        </div>
      </section>

      <PlatformV7IntelligenceStrip />

      <section id='roles' className={styles.section} aria-labelledby='roles-title'>
        <SectionHead id='roles-title' title={t('roles.title')} text={t('roles.text')} />
        <div className={styles.roleGrid}>
          {roles.map(({ key, Icon }) => (
            <article key={key} className={styles.roleTile}>
              <Icon size={27} strokeWidth={2.25} aria-hidden='true' />
              <strong>{t(`roles.${key}.title`)}</strong>
              <span>{t(`roles.${key}.text`)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.trustStrip} aria-label={t('trust.aria')}>
        {trustItems.map(({ key, Icon }) => (
          <article key={key} className={styles.trustItem}>
            <Icon size={26} strokeWidth={2.25} aria-hidden='true' />
            <strong>{t(`trust.${key}.title`)}</strong>
            <span>{t(`trust.${key}.text`)}</span>
          </article>
        ))}
      </section>
    </main>
  );
}

function SectionHead({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <div className={styles.sectionHead}>
      <h2 id={id}>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
