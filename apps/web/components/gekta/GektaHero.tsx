import type { GektaLocale } from '@/lib/gekta/content';
import { getGektaMobileHeroCopy } from '@/lib/gekta/mobile-copy';
import styles from './GektaWorkspace.module.css';

export function GektaHero({ locale }: { locale: GektaLocale }) {
  const copy = getGektaMobileHeroCopy(locale);
  return (
    <header className={styles.hero} data-gekta-server-hero='true'>
      <h1>{copy.h1}</h1>
      <p data-gekta-hero-lead='true'>{copy.lead}</p>
    </header>
  );
}
