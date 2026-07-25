import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { PublicExperienceLink } from './PublicExperienceAnalytics';
import { getPlatformV7HomeEnhancementCopy } from '@/i18n/platform-v7-home-enhancements';
import styles from './PlatformV7HomeEnhancements.module.css';

const CONTACT_DOCK_CONTRAST_BOUNDARY = `
.pc-public-contact-dock {
  opacity: 1 !important;
  transition: transform .2s ease !important;
}
.pc-public-contact-dock[data-dialog-open='true'],
.pc-public-contact-dock[data-scroll-hidden='true'] {
  opacity: 1 !important;
}
.pc-public-contact-dock-action:disabled {
  color: inherit !important;
  opacity: 1 !important;
  -webkit-text-fill-color: currentColor;
}
`;

export function HeroTaiEntry({ locale, taiHref }: { locale: string; taiHref: string }) {
  const copy = getPlatformV7HomeEnhancementCopy(locale).heroTai;

  return (
    <>
      <style>{CONTACT_DOCK_CONTRAST_BOUNDARY}</style>
      <aside className={styles.heroTaiEntry} aria-label={copy.name}>
        <Sparkles aria-hidden='true' size={18} strokeWidth={1.9} />
        <div className={styles.heroTaiCopy}>
          <strong>{copy.name}</strong>
          <span>{copy.text}</span>
        </div>
        <PublicExperienceLink
          href={taiHref}
          className={styles.heroTaiLink}
          eventName='hero_tai_explainer_open'
          locale={locale}
          params={{ source: 'hero_tai_definition_v2' }}
        >
          {copy.cta}<ArrowRight aria-hidden='true' size={16} />
        </PublicExperienceLink>
      </aside>
    </>
  );
}

export function PublicRoleEntrances({ locale }: { locale: string }) {
  const copy = getPlatformV7HomeEnhancementCopy(locale).roles;

  return (
    <section id='role-entry' className={`pc-v6-section ${styles.roleSection}`} aria-labelledby='pc-v6-role-entry-title'>
      <div className='pc-v6-section-head'>
        <span>{copy.eyebrow}</span>
        <h2 id='pc-v6-role-entry-title'>{copy.title}</h2>
        <p>{copy.lead}</p>
      </div>
      <div className={styles.roleGrid}>
        {copy.items.map((item, index) => {
          const href = `/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=role&stage=${item.stage}&lens=${item.lens}&perspective=${item.perspective}&scenario=standard`;
          return (
            <PublicExperienceLink
              key={item.key}
              href={href}
              className={styles.roleCard}
              eventName='home_role_entry_open'
              locale={locale}
              params={{ role_entry: item.key, stage: item.stage, lens: item.lens }}
              aria-label={`${item.title}: ${item.cta}`}
            >
              <span className={styles.roleIndex}>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item.title}</strong>
              <span className={styles.roleText}>{item.text}</span>
              <span className={styles.roleResult}>{item.result}</span>
              <span className={styles.roleCta}>{item.cta}<ArrowRight aria-hidden='true' size={16} /></span>
            </PublicExperienceLink>
          );
        })}
      </div>
      <p className={styles.roleNote}><CheckCircle2 aria-hidden='true' size={17} />{copy.note}</p>
    </section>
  );
}

export function TaiDefinition({ locale }: { locale: string }) {
  const copy = getPlatformV7HomeEnhancementCopy(locale).tai;

  return (
    <div className={styles.taiDefinition}>
      <span>{copy.definitionLabel}</span>
      <p>{copy.definition}</p>
    </div>
  );
}

export function TaiImpact({ locale }: { locale: string }) {
  const copy = getPlatformV7HomeEnhancementCopy(locale).tai;

  return (
    <div className={styles.taiImpact}>
      <span>{copy.impactLabel}</span>
      <strong>{copy.impact}</strong>
    </div>
  );
}

export function TaiWorkflow({ locale }: { locale: string }) {
  const copy = getPlatformV7HomeEnhancementCopy(locale).tai;

  return (
    <div className={styles.taiWorkflow}>
      <strong className={styles.taiWorkflowTitle}>{copy.workflowTitle}</strong>
      <div className={styles.taiWorkflowGrid}>
        {copy.workflow.map((step) => (
          <div key={step.index} className={styles.taiWorkflowStep}>
            <span>{step.index}</span>
            <div><strong>{step.title}</strong><small>{step.text}</small></div>
          </div>
        ))}
      </div>
    </div>
  );
}
