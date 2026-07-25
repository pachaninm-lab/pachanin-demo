import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { PublicExperienceLink } from './PublicExperienceAnalytics';
import { getPlatformV7HomeEnhancementCopy } from '@/i18n/platform-v7-home-enhancements';
import styles from './PlatformV7HomeEnhancements.module.css';

const HOME_LAYOUT_POLISH = `
.pc-v7-public-entry {
  --entry-public-header-base: 56px !important;
  --pc-public-header-base-height: 56px !important;
}

.pc-v7-public-entry .pc-v6-category,
.pc-v7-public-entry .pc-v6-crops,
.pc-v7-public-entry .pc-v6-integrations,
.pc-v7-public-entry .pc-v6-assurance,
.pc-v7-public-entry .pc-v6-faq,
.pc-v7-public-entry .pc-v6-final {
  content-visibility: visible !important;
  contain-intrinsic-size: none !important;
}

.pc-v7-public-entry :where(section[id], #connect-organization) {
  scroll-margin-top: calc(var(--pc-public-header-total-height, 56px) + 12px) !important;
}

@media (max-width: 767px) {
  .pc-v7-public-entry {
    padding-bottom: 88px !important;
  }

  .pc-v7-public-entry .pc-site-header {
    gap: 4px !important;
    height: 56px !important;
    min-height: 56px !important;
    max-height: 56px !important;
    padding-inline: 10px !important;
  }

  .pc-v7-public-entry .pc-site-brand {
    gap: 7px !important;
  }

  .pc-v7-public-entry .pc-site-brand-mark,
  .pc-v7-public-entry .pc-site-brand-mark[data-brand-mark='transparent-price-canonical'] {
    width: 30px !important;
    height: 30px !important;
    flex-basis: 30px !important;
    border-radius: 8px !important;
  }

  .pc-v7-public-entry .pc-site-brand-text strong {
    max-width: 148px !important;
    font-size: 15px !important;
    line-height: 1 !important;
  }

  .pc-v7-public-entry .pc-site-actions {
    gap: 4px !important;
  }

  .pc-v7-public-entry .pc-site-mobile-menu > summary,
  .pc-v7-public-entry .pc-site-locale-switch,
  .pc-v7-public-entry .entry-login {
    min-height: 44px !important;
    height: 44px !important;
    border-radius: 10px !important;
  }

  .pc-v7-public-entry .pc-site-mobile-menu > summary,
  .pc-v7-public-entry .entry-login {
    width: 44px !important;
  }

  .pc-v7-public-entry .pc-site-locale-switch {
    min-width: 56px !important;
    padding-inline: 8px !important;
  }

  .pc-v7-public-entry .pc-site-mobile-nav {
    top: calc(var(--pc-public-header-total-height, 56px) + 4px) !important;
    max-height: calc(100dvh - var(--pc-public-header-total-height, 56px) - 16px) !important;
  }

  .pc-v7-public-entry .pc-v6-shell {
    width: min(100% - 28px, 1120px) !important;
  }

  .pc-v7-public-entry .pc-v6-hero {
    gap: 18px !important;
    padding-top: 22px !important;
    padding-bottom: 30px !important;
  }

  .pc-v7-public-entry .pc-v6-hero h1.pc-v6-hero-title {
    font-size: clamp(34px, 9vw, 38px) !important;
    line-height: 1.02 !important;
  }

  .pc-v7-public-entry .pc-v6-hero-copy > p.pc-v6-hero-lead {
    margin-top: 12px !important;
    font-size: 15px !important;
    line-height: 1.45 !important;
  }

  .pc-v7-public-entry .pc-v6-actions {
    margin-top: 15px !important;
    gap: 8px !important;
  }

  .pc-v7-public-entry .pc-v6-primary,
  .pc-v7-public-entry .pc-v6-secondary {
    min-height: 48px !important;
    padding: 11px 15px !important;
  }

  .pc-v7-public-entry .pc-v6-hero-proofs {
    gap: 6px 10px !important;
    margin-top: 11px !important;
  }

  .pc-v7-public-entry .pc-v6-category,
  .pc-v7-public-entry .pc-v6-section {
    padding-block: 32px !important;
  }

  .pc-v7-public-entry .pc-v6-section-head {
    margin-bottom: 14px !important;
  }

  .pc-v7-public-entry .pc-v6-section-head > span {
    font-size: 13px !important;
  }

  .pc-v7-public-entry .pc-v6-section-head h2,
  .pc-v7-public-entry .pc-v6-final h2,
  .pc-v7-public-entry #connect-organization h2 {
    max-width: none !important;
    margin: 6px 0 9px !important;
    font-size: clamp(26px, 6.9vw, 30px) !important;
    line-height: 1.06 !important;
    letter-spacing: -0.03em !important;
    text-wrap: balance !important;
  }

  .pc-v7-public-entry .pc-v6-section-head p,
  .pc-v7-public-entry .pc-v6-final p,
  .pc-v7-public-entry #connect-organization > div:first-child > p {
    font-size: 15px !important;
    line-height: 1.46 !important;
  }

  .pc-v7-public-entry .pc-v6-trust-strip {
    margin-bottom: 20px !important;
  }

  .pc-v7-public-entry .pc-v6-trust-strip article {
    padding-block: 13px !important;
  }

  .pc-v7-public-entry .pc-v6-scenario {
    margin-inline: 0 !important;
    padding: 30px 12px !important;
    border-radius: 16px !important;
  }

  .pc-v7-public-entry .pc-v6-scenario-main,
  .pc-v7-public-entry .pc-v6-scenario-grid aside {
    padding: 15px !important;
  }

  .pc-v7-public-entry .pc-v6-hero-tai-entry {
    margin-top: 11px !important;
    padding-top: 10px !important;
  }

  .pc-v7-public-entry .pc-v6-role-grid {
    gap: 8px !important;
    padding-right: 20px !important;
    scroll-padding-inline: 0 20px;
  }

  .pc-v7-public-entry .pc-v6-role-card {
    flex-basis: calc(100% - 18px) !important;
    min-height: 214px !important;
    padding: 16px !important;
  }

  .pc-v7-public-entry .pc-v6-role-note {
    margin-top: 8px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-definition {
    margin-bottom: 10px !important;
    padding: 13px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-answer,
  .pc-v7-public-entry .pc-v6-tai-rules {
    padding: 14px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-answer > p {
    margin-top: 10px !important;
    font-size: 15px !important;
    line-height: 1.43 !important;
  }

  .pc-v7-public-entry .pc-v6-tai-impact {
    margin-top: 10px !important;
    padding: 11px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-rules {
    gap: 9px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-rules > .pc-v6-tai-workflow {
    display: grid !important;
    gap: 7px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-workflow-title {
    font-size: 14px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-workflow-step {
    grid-template-columns: 26px minmax(0, 1fr) !important;
    gap: 8px !important;
    padding-block: 7px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-workflow-step strong {
    font-size: 13px !important;
  }

  .pc-v7-public-entry .pc-v6-tai-workflow-step small {
    font-size: 12px !important;
    line-height: 1.4 !important;
  }

  .pc-v7-public-entry .pc-v6-tai-rules > div:not(.pc-v6-tai-workflow) {
    gap: 8px !important;
    font-size: 14px !important;
    line-height: 1.42 !important;
  }

  .pc-v7-public-entry .pc-v6-tai-rules > p {
    margin-top: 0 !important;
    padding: 12px !important;
    font-size: 13px !important;
    line-height: 1.42 !important;
  }

  .pc-v7-public-entry .pc-v6-prepared-action {
    margin-top: 10px !important;
    padding: 11px !important;
  }

  .pc-v7-public-entry .pc-v6-money {
    padding: 28px 16px !important;
    border-radius: 16px !important;
  }

  .pc-v7-public-entry .pc-v6-money-flow {
    padding: 13px !important;
    font-size: 14px !important;
    line-height: 1.42 !important;
  }

  .pc-v7-public-entry .pc-v6-money-steps {
    gap: 6px !important;
    margin-top: 10px !important;
  }

  .pc-v7-public-entry .pc-v6-money-steps span {
    padding: 7px 9px !important;
    font-size: 12px !important;
  }

  .pc-v7-public-entry .pc-v6-money > p {
    margin-top: 11px !important;
    font-size: 14px !important;
  }

  .pc-v7-public-entry .pc-v6-crop-grid,
  .pc-v7-public-entry .pc-v6-integration-grid {
    gap: 7px !important;
  }

  .pc-v7-public-entry .pc-v6-crop-grid article,
  .pc-v7-public-entry .pc-v6-integration-grid article {
    min-height: 56px !important;
    align-items: center !important;
    gap: 10px !important;
    padding: 11px 13px !important;
    border-radius: 11px !important;
  }

  .pc-v7-public-entry .pc-v6-crop-grid strong,
  .pc-v7-public-entry .pc-v6-integration-grid strong {
    font-size: 15px !important;
    line-height: 1.28 !important;
  }

  .pc-v7-public-entry .pc-v6-crop-grid span,
  .pc-v7-public-entry .pc-v6-integration-grid span {
    max-width: 52% !important;
    font-size: 12px !important;
    line-height: 1.32 !important;
  }

  .pc-v7-public-entry .pc-v6-integration-hub {
    padding: 17px !important;
  }

  .pc-v7-public-entry .pc-v6-integration-hub strong {
    font-size: 23px !important;
  }

  .pc-v7-public-entry .pc-v6-pillar-grid {
    gap: 0 !important;
    overflow: hidden;
    border: 1px solid var(--pc-v6-line) !important;
    border-radius: 13px !important;
    background: #ffffff;
  }

  .pc-v7-public-entry .pc-v6-pillar-grid > div {
    gap: 9px !important;
    padding: 12px 13px !important;
    border: 0 !important;
    border-bottom: 1px solid var(--pc-v6-line) !important;
    border-radius: 0 !important;
  }

  .pc-v7-public-entry .pc-v6-pillar-grid > div:last-child {
    border-bottom: 0 !important;
  }

  .pc-v7-public-entry .pc-v6-pillar-grid strong {
    font-size: 14px !important;
  }

  .pc-v7-public-entry .pc-v6-pillar-grid small {
    font-size: 12px !important;
    line-height: 1.38 !important;
  }

  .pc-v7-public-entry .pc-v6-assurance-foot {
    margin-top: 9px !important;
    padding: 12px 13px !important;
    font-size: 13px !important;
  }

  .pc-v7-public-entry #connect-organization {
    gap: 20px !important;
    padding-block: 32px !important;
  }

  .pc-v7-public-entry #connect-organization > div:first-child > div {
    gap: 7px !important;
    margin-top: 14px !important;
  }

  .pc-v7-public-entry #connect-organization form {
    gap: 14px !important;
    padding: 15px !important;
    border-radius: 15px !important;
  }

  .pc-v7-public-entry #connect-organization form > div[aria-label] {
    gap: 9px !important;
    padding-bottom: 12px !important;
  }

  .pc-v7-public-entry #connect-organization form > div[aria-hidden] {
    gap: 12px !important;
  }

  .pc-v7-public-entry #connect-organization form label {
    gap: 5px !important;
  }

  .pc-v7-public-entry #connect-organization form input,
  .pc-v7-public-entry #connect-organization form select {
    min-height: 48px !important;
  }

  .pc-v7-public-entry #connect-organization form button {
    min-height: 48px !important;
  }

  .pc-v7-public-entry .pc-v6-faq-list summary {
    min-height: 54px !important;
    padding-block: 13px !important;
  }

  .pc-v7-public-entry .pc-v6-final {
    margin: 20px 0 38px !important;
    padding: 18px !important;
  }

  .pc-v7-public-entry .pc-v6-footer {
    padding: 22px 0 88px !important;
  }
}

@media (max-width: 359px) {
  .pc-v7-public-entry .pc-site-brand-text strong {
    max-width: 112px !important;
    font-size: 14px !important;
  }

  .pc-v7-public-entry .pc-v6-crop-grid article,
  .pc-v7-public-entry .pc-v6-integration-grid article {
    display: grid !important;
    gap: 4px !important;
  }

  .pc-v7-public-entry .pc-v6-crop-grid span,
  .pc-v7-public-entry .pc-v6-integration-grid span {
    max-width: none !important;
    text-align: left !important;
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
    <div className={`${styles.taiWorkflow} pc-v6-tai-workflow`}>
      <strong className={`${styles.taiWorkflowTitle} pc-v6-tai-workflow-title`}>{copy.workflowTitle}</strong>
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
