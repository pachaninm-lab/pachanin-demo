import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { PublicExperienceLink } from './PublicExperienceAnalytics';
import { getPlatformV7HomeEnhancementCopy } from '@/i18n/platform-v7-home-enhancements';
import styles from './PlatformV7HomeEnhancements.module.css';

const HOME_LAYOUT_POLISH = `
.pc-v7-public-entry .pc-v6-category,
.pc-v7-public-entry .pc-v6-crops,
.pc-v7-public-entry .pc-v6-integrations,
.pc-v7-public-entry .pc-v6-assurance,
.pc-v7-public-entry .pc-v6-faq,
.pc-v7-public-entry .pc-v6-final {
  content-visibility: visible !important;
  contain-intrinsic-size: none !important;
}

@media (max-width: 767px) {
  .pc-v7-public-entry {
    padding-bottom: 96px !important;
  }

  .pc-v7-public-entry .pc-v6-hero {
    gap: 22px !important;
    padding-top: 28px !important;
    padding-bottom: 38px !important;
  }

  .pc-v7-public-entry .pc-v6-hero-copy > p.pc-v6-hero-lead {
    margin-top: 15px !important;
    font-size: 16px !important;
    line-height: 1.48 !important;
  }

  .pc-v7-public-entry .pc-v6-actions {
    margin-top: 18px !important;
  }

  .pc-v7-public-entry .pc-v6-hero-proofs {
    gap: 7px 12px !important;
    margin-top: 14px !important;
  }

  .pc-v7-public-entry .pc-v6-category,
  .pc-v7-public-entry .pc-v6-section {
    padding-block: 40px !important;
  }

  .pc-v7-public-entry .pc-v6-section-head {
    margin-bottom: 18px !important;
  }

  .pc-v7-public-entry .pc-v6-scenario {
    margin-inline: 0 !important;
    padding: 40px 14px !important;
  }

  .pc-v7-public-entry .pc-v6-money {
    padding: 40px 16px !important;
  }

  .pc-v7-public-entry #connect-organization {
    padding-block: 40px !important;
  }

  .pc-v7-public-entry .pc-v6-hero-tai-entry {
    margin-top: 14px !important;
    padding-top: 12px !important;
  }

  .pc-v7-public-entry .pc-v6-role-grid {
    gap: 10px !important;
    padding-right: 28px !important;
    scroll-padding-inline: 0 28px;
  }

  .pc-v7-public-entry .pc-v6-role-card {
    flex-basis: calc(100% - 24px) !important;
    min-height: 244px !important;
    padding: 18px !important;
  }

  .pc-v7-public-entry .pc-v6-role-note {
    margin-top: 10px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-definition {
    margin-bottom: 12px !important;
    padding: 14px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-answer,
  .pc-v7-public-entry .pc-v6-tai-rules {
    padding: 16px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-answer > p {
    margin-top: 12px !important;
    font-size: 16px !important;
    line-height: 1.46 !important;
  }

  .pc-v7-public-entry .pc-v6-tai-impact {
    margin-top: 12px !important;
    padding: 12px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-workflow-step {
    padding-block: 8px !important;
  }

  .pc-v7-public-entry .pc-v6-prepared-action {
    margin-top: 12px !important;
    padding: 12px !important;
  }

  .pc-v7-public-entry .pc-v6-money-flow {
    padding: 15px !important;
  }

  .pc-v7-public-entry .pc-v6-final {
    margin: 24px 0 48px !important;
    padding: 20px !important;
  }

  .pc-v7-public-entry .pc-v6-footer {
    padding: 26px 0 96px !important;
  }
}
`;

export function HeroTaiEntry({ locale, taiHref }: { locale: string; taiHref: string }) {
  const copy = getPlatformV7HomeEnhancementCopy(locale).heroTai;

  return (
    <aside className={`${styles.heroTaiEntry} pc-v6-hero-tai-entry`} aria-label={copy.name}>
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
  );
}

export function PublicRoleEntrances({ locale }: { locale: string }) {
  const copy = getPlatformV7HomeEnhancementCopy(locale).roles;

  return (
    <>
      <style>{HOME_LAYOUT_POLISH}</style>
      <section id='role-entry' className={`pc-v6-section ${styles.roleSection}`} aria-labelledby='pc-v6-role-entry-title'>
        <div className='pc-v6-section-head'>
          <span>{copy.eyebrow}</span>
          <h2 id='pc-v6-role-entry-title'>{copy.title}</h2>
          <p>{copy.lead}</p>
        </div>
        <div className={`${styles.roleGrid} pc-v6-role-grid`}>
          {copy.items.map((item, index) => {
            const href = `/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=role&stage=${item.stage}&lens=${item.lens}&perspective=${item.perspective}&scenario=standard`;
            return (
              <PublicExperienceLink
                key={item.key}
                href={href}
                className={`${styles.roleCard} pc-v6-role-card`}
                eventName='home_role_entry_open'
                locale={locale}
                params={{ role_entry: item.key, stage: item.stage, lens: item.lens }}
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
        <p className={`${styles.roleNote} pc-v6-role-note`}><CheckCircle2 aria-hidden='true' size={17} />{copy.note}</p>
      </section>
    </>
  );
}

export function TaiDefinition({ locale }: { locale: string }) {
  const copy = getPlatformV7HomeEnhancementCopy(locale).tai;

  return (
    <div className={`${styles.taiDefinition} pc-v6-tai-definition`}>
      <span>{copy.definitionLabel}</span>
      <p>{copy.definition}</p>
    </div>
  );
}

export function TaiImpact({ locale }: { locale: string }) {
  const copy = getPlatformV7HomeEnhancementCopy(locale).tai;

  return (
    <div className={`${styles.taiImpact} pc-v6-tai-impact`}>
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
          <div key={step.index} className={`${styles.taiWorkflowStep} pc-v6-tai-workflow-step`}>
            <span>{step.index}</span>
            <div><strong>{step.title}</strong><small>{step.text}</small></div>
          </div>
        ))}
      </div>
    </div>
  );
}
