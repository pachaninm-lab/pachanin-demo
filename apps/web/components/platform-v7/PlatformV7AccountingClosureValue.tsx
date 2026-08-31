import {
  BookOpenCheck,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRoundCheck,
} from 'lucide-react';
import { getPlatformV7AccountingValueCopy } from '@/i18n/platform-v7-accounting-value';
import styles from './PlatformV7AccountingClosureValue.module.css';

const flowIcons = [Building2, Truck, FileCheck2, BookOpenCheck, CircleDollarSign] as const;
const personIcons = [UserRoundCheck, BookOpenCheck, CheckCircle2] as const;

export function PlatformV7AccountingClosureValue({ locale }: { locale: string }) {
  const copy = getPlatformV7AccountingValueCopy(locale);

  return (
    <section
      id='accounting-close'
      className={`pc-v6-section ${styles.section}`}
      aria-labelledby='accounting-close-title'
      data-testid='platform-v7-accounting-closure-value'
    >
      <div className='pc-v6-section-head'>
        <span>{copy.eyebrow}</span>
        <h2 id='accounting-close-title'>{copy.title}</h2>
        <p>{copy.lead}</p>
      </div>

      <div className={styles.flow} role='list' aria-label={copy.flowLabel}>
        {copy.flow.map((step, index) => {
          const Icon = flowIcons[index] ?? CheckCircle2;
          return (
            <article key={step.label} role='listitem'>
              <Icon className={styles.flowIcon} aria-hidden='true' />
              <strong>{step.label}</strong>
              <span>{step.text}</span>
            </article>
          );
        })}
      </div>

      <div className={styles.valueGrid}>
        {copy.people.map((person, index) => {
          const Icon = personIcons[index] ?? CheckCircle2;
          return (
            <article key={person.audience} className={styles.personCard}>
              <div className={styles.personTop}>
                <span>{person.audience}</span>
                <Icon aria-hidden='true' />
              </div>
              <h3>{person.title}</h3>
              <p>{person.text}</p>
            </article>
          );
        })}
      </div>

      <div className={styles.contextGrid}>
        <article className={styles.gektaCard} aria-label={copy.gekta.eyebrow}>
          <Sparkles aria-hidden='true' />
          <div className={styles.gektaBody}>
            <span>{copy.gekta.eyebrow}</span>
            <h3>{copy.gekta.title}</h3>
            <p>{copy.gekta.text}</p>
            <span className={styles.gektaStatus}>{copy.gekta.status}</span>
          </div>
        </article>

        <div className={styles.controlStack}>
          <article className={styles.controlCard}>
            <PlugZap aria-hidden='true' />
            <div>
              <strong>{copy.connection.title}</strong>
              <span>{copy.connection.text}</span>
            </div>
          </article>
          <article className={styles.controlCard}>
            <ShieldCheck aria-hidden='true' />
            <div>
              <strong>{copy.protection.title}</strong>
              <span>{copy.protection.text}</span>
            </div>
          </article>
        </div>
      </div>

      <div className={styles.systems} aria-label={copy.systemsLabel}>
        <strong>{copy.systemsLabel}</strong>
        {copy.systems.map((system) => <span key={system}>{system}</span>)}
      </div>

      <p className={styles.boundary}>{copy.boundary}</p>
    </section>
  );
}
