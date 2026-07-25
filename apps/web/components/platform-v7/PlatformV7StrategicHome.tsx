import { getLocale, getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  Landmark,
  LogIn,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { PublicSiteHeader } from './PublicSiteHeader';
import { PublicLocaleLink } from './PublicLocaleLink';
import { PublicExperienceLink, PublicExperiencePageView } from './PublicExperienceAnalytics';
import { PublicDealRoleScenario } from './PublicDealRoleScenario';
import { OrganizationConnectForm } from './OrganizationConnectForm';
import {
  PublicRoleEntrances,
  TaiImpact,
  TaiWorkflow,
} from './PlatformV7HomeEnhancements';
import { getPlatformV7HomeCopy } from '@/i18n/platform-v7-home-v3';
import { getPlatformV7HomeEnhancementCopy } from '@/i18n/platform-v7-home-enhancements';
import { getPlatformV7HeroMessage } from '@/i18n/platform-v7-hero-message';

function SectionHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className='pc-v6-section-head'>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {lead ? <p>{lead}</p> : null}
    </div>
  );
}

export async function PlatformV7StrategicHome() {
  const locale = await getLocale();
  const copy = getPlatformV7HomeCopy(locale);
  const enhancement = getPlatformV7HomeEnhancementCopy(locale);
  const heroMessage = getPlatformV7HeroMessage(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const dealHref = `/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=deal&stage=terms&lens=execution&perspective=buyer`;
  const taiHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(locale)}`;
  const taiProduct = locale === 'en'
    ? {
        productBadge: 'Independent agribusiness AI product',
        title: 'Operational intelligence built for agribusiness',
        lead: 'Created by Transparent Price and designed as a standalone product, TAI understands Deal execution, documents, logistics, quality, money and risk without becoming a chat detached from operations.',
        definitionLabel: 'Why TAI is different',
        definition: 'TAI combines platform architecture knowledge with agribusiness context. It explains the basis of a conclusion, respects organisation roles and prepares an action that remains under human control.',
        domainsLabel: 'TAI product domains',
        domains: ['Deal Intelligence', 'Document Intelligence', 'Logistics & Quality', 'Money & Risk', 'Dispute Evidence'],
      }
    : locale === 'zh'
      ? {
          productBadge: '独立的农业商业 AI 产品',
          title: '为农业商业打造的运营智能',
          lead: 'TAI 由“透明价格”创建，并按独立产品设计。它理解交易执行、文件、物流、质量、资金与风险，而不是脱离运营流程的聊天工具。',
          definitionLabel: 'TAI 的独特之处',
          definition: 'TAI 将平台架构知识与农业商业上下文结合起来，说明结论依据，遵守机构角色，并准备由人工确认的下一步行动。',
          domainsLabel: 'TAI 产品领域',
          domains: ['交易智能', '文件智能', '物流与质量', '资金与风险', '争议证据'],
        }
      : {
          productBadge: 'Отдельный AI-продукт для агробизнеса',
          title: 'Собственный операционный интеллект для агробизнеса',
          lead: 'TAI создан нами для «Прозрачной Цены» и спроектирован как самостоятельный продукт. Он понимает исполнение Сделки, документы, логистику, качество, деньги и риск — без отрыва от реального процесса.',
          definitionLabel: 'В чём уникальность TAI',
          definition: 'TAI объединяет знание архитектуры платформы и контекст агробизнеса, показывает основание вывода, учитывает роль организации и готовит действие, которое остаётся под контролем человека.',
          domainsLabel: 'Продуктовые контуры TAI',
          domains: ['Deal Intelligence', 'Document Intelligence', 'Логистика и качество', 'Деньги и риск', 'Спор и доказательства'],
        };
  const towerTaiTitle = locale === 'en'
    ? 'TAI found two reasons for the pause'
    : locale === 'zh'
      ? 'TAI 发现两个暂停原因'
      : 'TAI нашёл две причины остановки';

  const nav = <>
    <a href='#deal-path'>{copy.nav.how}</a>
    <a href='#role-entry'>{enhancement.nav.participants}</a>
    <a href='#tai'>{enhancement.nav.tai}</a>
    <a href='#money'>{copy.nav.money}</a>
    <a href='#integrations'>{copy.nav.integrations}</a>
  </>;

  return (
    <main id='main-content' className='pc-v6-page pc-v7-public-entry' data-testid='platform-v7-root-execution-cockpit'>
      <a className='pc-skip-link' href='#pc-v6-title'>{chrome('skipToContent')}</a>
      <PublicExperiencePageView locale={locale} name='home_v3_view' />
      <PublicSiteHeader
        ariaLabel={copy.a11y.site}
        brandHomeLabel={copy.a11y.site}
        navLabel={copy.a11y.nav}
        menuLabel={copy.a11y.menu}
        nav={nav}
        showMobileMenu
        localeControl={<PublicLocaleLink />}
        actions={
          <div className='pc-v6-header-actions'>
            <a href='/platform-v7/login' className='entry-login' aria-label={copy.nav.login}>
              <LogIn aria-hidden='true' size={18} strokeWidth={1.9} />
              <span>{copy.nav.login}</span>
            </a>
            <a href='#connect-organization' className='pc-v6-header-cta'>{copy.nav.connect}</a>
          </div>
        }
      />

      <div className='pc-v6-shell'>
        <section className='pc-v6-hero' aria-labelledby='pc-v6-title'>
          <div className='pc-v6-hero-copy'>
            <span className='pc-v6-kicker'>{heroMessage.kicker}</span>
            <h1 id='pc-v6-title' className='pc-v6-hero-title'>
              <span className='pc-v6-hero-brand'>{heroMessage.brand}</span>
              <span className='pc-v6-hero-title-line'>{heroMessage.title}</span>
            </h1>
            <p className='pc-v6-hero-lead'>{heroMessage.lead}</p>
            <div className='pc-v6-actions'>
              <PublicExperienceLink href={dealHref} className='pc-v6-primary' eventName='hero_primary_cta' locale={locale} params={{ source: 'hero_final' }}>
                {copy.hero.primary}<ArrowRight size={19} />
              </PublicExperienceLink>
              <PublicExperienceLink href='#connect-organization' className='pc-v6-secondary' eventName='hero_secondary_cta' locale={locale} params={{ source: 'hero_final' }}>
                {copy.hero.secondary}<ArrowRight size={17} />
              </PublicExperienceLink>
            </div>
          </div>

          <div className='pc-v6-control-tower' aria-label={copy.a11y.controlTower}>
            <div className='pc-v6-ct-top'>
              <div><small>{copy.tower.sampleLabel}</small><span>{copy.tower.deal}</span></div>
              <b>{copy.tower.stage}</b>
            </div>
            <div className='pc-v6-ct-progress' role='progressbar' aria-label={copy.tower.progressLabel} aria-valuemin={1} aria-valuemax={5} aria-valuenow={3}>
              <span className='is-done' /><span className='is-done' /><span className='is-active' /><span /><span />
            </div>
            <div className='pc-v6-ct-grid'>
              <article>
                <small>{copy.tower.statusLabel}</small>
                <strong>{copy.tower.status}</strong>
                <span className='pc-v6-status pc-v6-status-blocked'><TriangleAlert size={16} />{copy.tower.deviation}</span>
              </article>
              <article>
                <small>{copy.tower.ownerLabel}</small>
                <strong>{copy.tower.owner}</strong>
                <span>{copy.tower.deadline}</span>
              </article>
              <article>
                <small>{copy.tower.moneyLabel}</small>
                <strong>{copy.tower.money}</strong>
                <span className='pc-v6-status pc-v6-status-pending'><CircleDollarSign size={16} />{copy.tower.release}</span>
              </article>
              <article>
                <small>{copy.tower.nextLabel}</small>
                <strong>{copy.tower.next}</strong>
                <span>{copy.tower.nextNote}</span>
              </article>
            </div>
            <div className='pc-v6-tai-strip'>
              <Sparkles size={18} />
              <div><strong>{towerTaiTitle}</strong><span>{copy.tower.taiText}</span></div>
            </div>
            <div className='pc-v6-ct-actions'>
              <PublicExperienceLink href={dealHref} eventName='hero_cockpit_open' locale={locale} params={{ source: 'hero_cockpit_final' }}>
                {copy.hero.primary}<ArrowRight size={17} />
              </PublicExperienceLink>
              <PublicExperienceLink href={taiHref} eventName='open_tai' locale={locale} params={{ source: 'hero_cockpit_final' }}>
                <Sparkles size={16} />{copy.hero.tertiary}
              </PublicExperienceLink>
            </div>
          </div>

          <div className='pc-v6-hero-proofs' aria-label={copy.hero.proofLabel}>
            {copy.hero.proofs.map((proof) => <span key={proof}><CheckCircle2 aria-hidden='true' size={16} />{proof}</span>)}
          </div>
        </section>

        <section className='pc-v6-trust-strip' aria-label={copy.trust.label}>
          {copy.trust.items.map(([title, text]) => <article key={title}><strong>{title}</strong><span>{text}</span></article>)}
        </section>

        <section id='participants' className='pc-v6-section pc-v6-scenario'>
          <SectionHeader eyebrow={copy.scenario.eyebrow} title={copy.scenario.title} lead={copy.scenario.lead} />
          <PublicDealRoleScenario locale={locale} />
          <div className='pc-v6-scenario-footer'>
            <span>{copy.scenario.evidence}</span>
            <PublicExperienceLink href={dealHref} className='pc-v6-primary' eventName='open_deal_scenario' locale={locale} params={{ source: 'scenario_final' }}>
              {copy.scenario.cta}<ArrowRight size={18} />
            </PublicExperienceLink>
          </div>
        </section>

        <PublicRoleEntrances locale={locale} />

        <section className='pc-v6-category'>
          <SectionHeader eyebrow={copy.category.eyebrow} title={copy.category.title} lead={copy.category.text} />
          <div className='pc-v6-compare'>
            <article><span>{copy.category.marketplace}</span><p>{copy.category.marketplaceText}</p></article>
            <ArrowRight aria-hidden='true' />
            <article className='is-platform'><span>{copy.category.platform}</span><p>{copy.category.platformText}</p></article>
          </div>
        </section>

        <section id='deal-path' className='pc-v6-section'>
          <SectionHeader eyebrow={copy.lifecycle.eyebrow} title={copy.lifecycle.title} lead={copy.lifecycle.lead} />
          <div className='pc-v6-lifecycle' role='list' tabIndex={0} aria-label={copy.lifecycle.title}>
            {copy.lifecycle.phases.map((phase, index) => <div key={phase} role='listitem'><i>{index + 1}</i><span>{phase}</span></div>)}
          </div>
          <p className='pc-v6-scroll-hint' style={{ color: '#596a61' }}>{copy.lifecycle.hint}</p>
        </section>

        <section id='tai' className='pc-v6-section pc-v6-tai'>
          <div className='pc-v6-tai-lockup'>
            <span><Sparkles aria-hidden='true' size={20} /></span>
            <div><strong>TAI</strong><small>Transparent Agro Intelligence</small></div>
            <em>{taiProduct.productBadge}</em>
          </div>
          <SectionHeader eyebrow={enhancement.tai.eyebrow} title={taiProduct.title} lead={taiProduct.lead} />
          <div className='pc-v6-tai-definition'>
            <span>{taiProduct.definitionLabel}</span>
            <p>{taiProduct.definition}</p>
          </div>
          <div className='pc-v6-tai-layout'>
            <div className='pc-v6-tai-answer'>
              <div className='pc-v6-tai-head'><Sparkles size={19} /><strong>TAI</strong><span>{copy.tai.mode}</span></div>
              <p>{copy.tai.answer}</p>
              <TaiImpact locale={locale} />
              <ul><li>{copy.tai.source}</li><li>{copy.tai.freshness}</li><li>{copy.tai.confidence}</li></ul>
              <div className='pc-v6-prepared-action'><FileCheck2 size={18} /><span>{copy.tai.action}</span></div>
            </div>
            <div className='pc-v6-tai-rules'>
              <TaiWorkflow locale={locale} />
              {copy.tai.modes.map((mode) => <div key={mode}><CheckCircle2 size={18} /><span>{mode}</span></div>)}
              <p><ShieldCheck size={19} />{copy.tai.boundaries}</p>
            </div>
          </div>
          <div className='pc-v6-tai-product-footer'>
            <div aria-label={taiProduct.domainsLabel}>
              {taiProduct.domains.map((domain) => <span key={domain}>{domain}</span>)}
            </div>
            <PublicExperienceLink href={taiHref} className='pc-v6-primary' eventName='open_tai_fullscreen' locale={locale} params={{ source: 'tai_product_final' }}>
              {copy.hero.tertiary}<ArrowRight size={18} />
            </PublicExperienceLink>
          </div>
        </section>

        <section id='money' className='pc-v6-section pc-v6-money'>
          <SectionHeader eyebrow={copy.money.eyebrow} title={copy.money.title} lead={copy.money.lead} />
          <div className='pc-v6-money-flow'><Landmark size={24} /><strong>{copy.money.chain}</strong></div>
          <div className='pc-v6-money-steps'>{copy.money.steps.map((step) => <span key={step}><CheckCircle2 size={16} />{step}</span>)}</div>
          <p>{copy.money.exception}</p>
        </section>

        <section id='integrations' className='pc-v6-section pc-v6-integrations'>
          <SectionHeader eyebrow={copy.integrations.eyebrow} title={copy.integrations.title} lead={copy.integrations.lead} />
          <div className='pc-v6-integration-map'>
            <div className='pc-v6-integration-hub'><small>{copy.integrations.hubLabel}</small><strong>{copy.integrations.hub}</strong><span>{copy.integrations.hubText}</span></div>
            <div className='pc-v6-integration-grid'>{copy.integrations.items.map(([name, status]) => <article key={name}><strong>{name}</strong><span>{status}</span></article>)}</div>
          </div>
          <p className='pc-v6-integration-note'>{copy.integrations.note}</p>
        </section>

        <section className='pc-v6-section pc-v6-crops'>
          <SectionHeader eyebrow={copy.crops.eyebrow} title={copy.crops.title} lead={copy.crops.lead} />
          <div className='pc-v6-crop-grid'>{copy.crops.groups.map(([name, status]) => <article key={name}><strong>{name}</strong><span>{status}</span></article>)}</div>
        </section>

        <section id='maturity' className='pc-v6-section pc-v6-assurance'>
          <SectionHeader eyebrow={copy.federal.eyebrow} title={copy.federal.title} lead={copy.federal.lead} />
          <div className='pc-v6-pillar-grid'>{copy.federal.pillars.map(([title, text]) => <div key={title}><ShieldCheck size={19} /><span><strong>{title}</strong><small>{text}</small></span></div>)}</div>
          <div className='pc-v6-assurance-foot'><CheckCircle2 size={20} /><span>{copy.federal.foot}</span></div>
        </section>

        <OrganizationConnectForm locale={locale} />

        <section className='pc-v6-section pc-v6-faq'>
          <SectionHeader eyebrow={copy.faq.eyebrow} title={copy.faq.title} />
          <div className='pc-v6-faq-list'>{copy.faq.items.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
        </section>

        <section className='pc-v6-final'>
          <h2>{copy.final.title}</h2><p>{copy.final.lead}</p>
          <div className='pc-v6-actions'>
            <PublicExperienceLink href={dealHref} className='pc-v6-primary' eventName='open_deal_scenario' locale={locale} params={{ source: 'final_final' }}>
              {copy.final.secondary}<ArrowRight size={18} />
            </PublicExperienceLink>
            <PublicExperienceLink href='#connect-organization' className='pc-v6-secondary' eventName='open_organization_connect' locale={locale} params={{ source: 'final_final' }}>
              {copy.final.primary}<ArrowRight size={17} />
            </PublicExperienceLink>
          </div>
        </section>
      </div>

      <footer className='pc-v6-footer'>
        <div className='pc-v6-shell'>
          <strong>{copy.a11y.site}</strong>
          <p>{copy.footer.note}</p>
          <nav><a href='/platform-v7/status'>{copy.nav.status}</a><a href='/platform-v7/privacy'>{copy.footer.privacy}</a><a href='/platform-v7/contact'>{copy.footer.contacts}</a></nav>
        </div>
      </footer>
    </main>
  );
}
