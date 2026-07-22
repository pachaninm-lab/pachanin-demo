import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, CheckCircle2, CircleDollarSign, FileCheck2, Landmark, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { PublicSiteHeader } from './PublicSiteHeader';
import { PublicLocaleLink } from './PublicLocaleLink';
import { PublicExperienceLink, PublicExperiencePageView } from './PublicExperienceAnalytics';
import { getPlatformV7HomeCopy } from '@/i18n/platform-v7-home-v3';

function SectionHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return <div className='pc-v6-section-head'><span>{eyebrow}</span><h2>{title}</h2>{lead ? <p>{lead}</p> : null}</div>;
}

export async function PlatformV7StrategicHome() {
  const locale = await getLocale();
  const copy = getPlatformV7HomeCopy(locale);
  const chrome = await getTranslations('publicEntry.chrome');
  const dealHref = `/platform-v7/how-it-works?lang=${encodeURIComponent(locale)}&entry=deal&stage=terms&lens=execution&perspective=buyer`;
  const taiHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(locale)}`;

  const nav = <>
    <a href='#deal-path'>{copy.nav.how}</a>
    <a href='#participants'>{copy.nav.participants}</a>
    <a href='#tai'>{copy.nav.tai}</a>
    <a href='#integrations'>{copy.nav.integrations}</a>
    <a href='#maturity'>{copy.nav.status}</a>
  </>;

  return <main id='main-content' className='pc-v6-page'>
    <a className='pc-skip-link' href='#pc-v6-title'>{chrome('skipToContent')}</a>
    <PublicExperiencePageView locale={locale} name='home_v3_view' />
    <PublicSiteHeader
      ariaLabel='Прозрачная Цена'
      brandHomeLabel='Прозрачная Цена'
      navLabel='Главная навигация'
      menuLabel='Меню'
      nav={nav}
      showMobileMenu
      localeControl={<PublicLocaleLink />}
      actions={<div className='pc-v6-header-actions'><a href='/platform-v7/login'>{copy.nav.login}</a><a href='/platform-v7/register' className='pc-v6-header-cta'>{copy.nav.connect}</a></div>}
    />

    <div className='pc-v6-shell'>
      <section className='pc-v6-hero' aria-labelledby='pc-v6-title'>
        <div className='pc-v6-hero-copy'>
          <span className='pc-v6-kicker'>{copy.hero.kicker}</span>
          <h1 id='pc-v6-title'>{copy.hero.title}</h1>
          <p>{copy.hero.lead}</p>
          <div className='pc-v6-actions'>
            <PublicExperienceLink href={dealHref} className='pc-v6-primary' eventName='hero_primary_cta' locale={locale} params={{ source: 'hero_v3' }}>{copy.hero.primary}<ArrowRight size={19}/></PublicExperienceLink>
            <PublicExperienceLink href='/platform-v7/register' className='pc-v6-secondary' eventName='hero_secondary_cta' locale={locale} params={{ source: 'hero_v3' }}>{copy.hero.secondary}</PublicExperienceLink>
          </div>
          <PublicExperienceLink href={taiHref} className='pc-v6-text-link' eventName='open_tai' locale={locale} params={{ source: 'hero_v3' }}><Sparkles size={17}/>{copy.hero.tertiary}</PublicExperienceLink>
        </div>

        <div className='pc-v6-control-tower' aria-label='Фрагмент control tower Сделки'>
          <div className='pc-v6-ct-top'><span>Сделка PC-2026-0719</span><b>Приёмка и качество</b></div>
          <div className='pc-v6-ct-grid'>
            <article><small>Статус</small><strong>Расчёт заблокирован</strong><span className='pc-v6-status pc-v6-status-blocked'><TriangleAlert size={16}/>Отклонение</span></article>
            <article><small>Ответственный</small><strong>Лаборатория</strong><span>До 16:30</span></article>
            <article><small>Деньги</small><strong>Зарезервированы</strong><span className='pc-v6-status pc-v6-status-pending'><CircleDollarSign size={16}/>Release запрещён</span></article>
            <article><small>Следующий шаг</small><strong>Подписать акт</strong><span>Затем — правило перерасчёта</span></article>
          </div>
          <div className='pc-v6-tai-strip'><Sparkles size={18}/><div><strong>TAI выявил два блокера</strong><span>Расхождение качества и отсутствующая подпись. Подготовлен проект действия.</span></div></div>
        </div>
      </section>

      <section className='pc-v6-category'>
        <SectionHeader eyebrow={copy.category.eyebrow} title={copy.category.title} lead={copy.category.text}/>
        <div className='pc-v6-compare'>
          <article><span>{copy.category.marketplace}</span><p>{copy.category.marketplaceText}</p></article>
          <ArrowRight aria-hidden='true'/>
          <article className='is-platform'><span>{copy.category.platform}</span><p>{copy.category.platformText}</p></article>
        </div>
      </section>

      <section id='deal-path' className='pc-v6-section'>
        <SectionHeader eyebrow={copy.lifecycle.eyebrow} title={copy.lifecycle.title} lead={copy.lifecycle.lead}/>
        <div className='pc-v6-lifecycle' role='list'>{copy.lifecycle.phases.map((phase, index) => <div key={phase} role='listitem'><i>{index + 1}</i><span>{phase}</span></div>)}</div>
      </section>

      <section className='pc-v6-section pc-v6-scenario'>
        <SectionHeader eyebrow={copy.scenario.eyebrow} title={copy.scenario.title} lead={copy.scenario.lead}/>
        <div className='pc-v6-scenario-grid'>
          <article className='pc-v6-scenario-main'>
            <div><span>Сделка</span><strong>Подсолнечник · 1 200 т</strong></div>
            <div><span>Текущий этап</span><strong>Приёмка / лаборатория</strong></div>
            <div><span>Блокер</span><strong>{copy.scenario.blocker}</strong></div>
            <div><span>Ответственный</span><strong>{copy.scenario.owner}</strong></div>
          </article>
          <aside>
            <span className='pc-v6-status pc-v6-status-blocked'><TriangleAlert size={16}/>{copy.scenario.status}</span>
            <p>{copy.scenario.money}</p>
            <p>{copy.scenario.next}</p>
            <p>{copy.scenario.evidence}</p>
            <PublicExperienceLink href={dealHref} className='pc-v6-primary' eventName='open_deal_scenario' locale={locale} params={{ source: 'scenario_v3' }}>{copy.hero.primary}<ArrowRight size={18}/></PublicExperienceLink>
          </aside>
        </div>
      </section>

      <section id='tai' className='pc-v6-section pc-v6-tai'>
        <SectionHeader eyebrow={copy.tai.eyebrow} title={copy.tai.title} lead={copy.tai.text}/>
        <div className='pc-v6-tai-layout'>
          <div className='pc-v6-tai-answer'>
            <div className='pc-v6-tai-head'><Sparkles size={19}/><strong>TAI</strong><span>Операционный режим</span></div>
            <p>Сделка не может перейти к окончательному расчёту: лабораторный показатель вышел за допуск, а акт расхождений не подписан покупателем.</p>
            <ul><li>{copy.tai.source}</li><li>{copy.tai.freshness}</li><li>{copy.tai.confidence}</li></ul>
            <div className='pc-v6-prepared-action'><FileCheck2 size={18}/><span>{copy.tai.action}</span></div>
          </div>
          <div className='pc-v6-tai-rules'>
            {copy.tai.modes.map((mode) => <div key={mode}><CheckCircle2 size={18}/><span>{mode}</span></div>)}
            <p><ShieldCheck size={19}/>{copy.tai.boundaries}</p>
            <PublicExperienceLink href={taiHref} className='pc-v6-secondary' eventName='open_tai_fullscreen' locale={locale} params={{ source: 'tai_section_v3' }}>{copy.hero.tertiary}<ArrowRight size={18}/></PublicExperienceLink>
          </div>
        </div>
      </section>

      <section className='pc-v6-section'>
        <SectionHeader eyebrow={copy.crops.eyebrow} title={copy.crops.title} lead={copy.crops.lead}/>
        <div className='pc-v6-crop-grid'>{copy.crops.groups.map(([name,status]) => <article key={name}><strong>{name}</strong><span>{status}</span></article>)}</div>
      </section>

      <section id='participants' className='pc-v6-section'>
        <SectionHeader eyebrow={copy.participants.eyebrow} title={copy.participants.title}/>
        <div className='pc-v6-value-grid'>{copy.participants.cards.map(([title,text]) => <article key={title}><strong>{title}</strong><p>{text}</p></article>)}</div>
      </section>

      <section className='pc-v6-section pc-v6-money'>
        <SectionHeader eyebrow={copy.money.eyebrow} title={copy.money.title}/>
        <div className='pc-v6-money-flow'><Landmark size={24}/><strong>{copy.money.chain}</strong></div>
        <p>{copy.money.exception}</p>
      </section>

      <section id='integrations' className='pc-v6-section'>
        <SectionHeader eyebrow={copy.integrations.eyebrow} title={copy.integrations.title}/>
        <div className='pc-v6-integration-grid'>{copy.integrations.items.map(([name,status]) => <article key={name}><strong>{name}</strong><span>{status}</span></article>)}</div>
      </section>

      <section className='pc-v6-section'>
        <SectionHeader eyebrow={copy.federal.eyebrow} title={copy.federal.title}/>
        <div className='pc-v6-pillar-grid'>{copy.federal.pillars.map((pillar) => <div key={pillar}><ShieldCheck size={19}/><span>{pillar}</span></div>)}</div>
      </section>

      <section id='maturity' className='pc-v6-section'>
        <SectionHeader eyebrow={copy.maturity.eyebrow} title={copy.maturity.title}/>
        <div className='pc-v6-maturity-grid'>{copy.maturity.cards.map(([title,text]) => <article key={title}><strong>{title}</strong><p>{text}</p></article>)}</div>
      </section>

      <section className='pc-v6-final'>
        <h2>{copy.final.title}</h2><p>{copy.final.lead}</p>
        <div className='pc-v6-actions'><PublicExperienceLink href='/platform-v7/register' className='pc-v6-primary' eventName='submit_organization_request' locale={locale} params={{ source: 'final_v3' }}>{copy.final.primary}<ArrowRight size={18}/></PublicExperienceLink><PublicExperienceLink href={dealHref} className='pc-v6-secondary' eventName='open_deal_scenario' locale={locale} params={{ source: 'final_v3' }}>{copy.final.secondary}</PublicExperienceLink></div>
      </section>
    </div>

    <footer className='pc-v6-footer'><div className='pc-v6-shell'><strong>Прозрачная Цена</strong><p>{copy.footer}</p><nav><a href='/platform-v7/status'>{copy.nav.status}</a><a href='/platform-v7/privacy'>Privacy</a><a href='/platform-v7/contact'>Контакты</a></nav></div></footer>
  </main>;
}
