import { GEKTA_BRAND, GektaGlyph } from '@/lib/gekta/brand';
import styles from './GektaWorkspace.module.css';

export function GektaBrandMark({ size }: { size?: number } = {}) {
  return (
    <span className={styles.brandMark} aria-hidden='true' data-gekta-brand-mark='true'
      style={{ background: GEKTA_BRAND.background, ...(size ? { width: size, height: size } : {}) }}>
      <GektaGlyph size={size ? Math.round(size * 0.62) : 20} />
    </span>
  );
}
