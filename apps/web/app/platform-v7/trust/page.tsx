import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { getLocale } from 'next-intl/server';
import {
  CanonicalBottomNav,
  CanonicalFooter,
  CanonicalGektaStrip,
  CanonicalPublicHeader,
  TRUST_MODEL,
  canonicalPublicLocale,
} from '@/components/platform-v7/PublicCanonicalPrimitives';

const META={"ru":["Доверие — Прозрачная Цена","Перед важным действием платформа проверяет полномочия, основание, источник и фиксирует решение."],"en":["Trust — Transparent Price","Before an important action, the platform checks authority, basis and source, then records the decision."],"zh":["信任 — 透明价格","每个重要操作前，平台都会检查权限、依据和来源，并记录决定。"]} as const;

export async function generateMetadata():Promise<Metadata>{
  const locale=canonicalPublicLocale(await getLocale());
  const copy=META[locale];
  return {
    title:copy[0],
    description:copy[1],
    alternates:{
      canonical:'/platform-v7/trust',
      languages:{
        ru:'/platform-v7/trust?lang=ru',
        en:'/platform-v7/trust?lang=en',
        zh:'/platform-v7/trust?lang=zh',
      },
    },
    robots:{index:true,follow:true},
  };
}

const COPY={
ru:{
 e:'Доверие',t:'Доверие. На основе фактов.',p:'Для важного действия всегда видно, кто вправе его выполнить, на каком основании, из какого источника взят факт и какое решение зафиксировано.',
 fact:'От факта к решению',factLead:'Ни один экран не должен превращать неизвестность в уверенный статус. Если данных нет, они остаются недоступными или требуют подтверждения.',
 rail:['Факт получен','Источник определён','Полномочия проверены','Основание связано','Решение зафиксировано','Следующий шаг разрешён'],
 boundaries:'Границы доверия',boundariesLead:'Что интерфейс не может решить сам.',
 boundary:[
  ['Роль и организация','Выбор роли в публичном интерфейсе не даёт доступ. Права появляются только после проверки организации и полномочий.'],
  ['Финансовое состояние','Статус расчёта меняется только по подтверждённым событиям.'],
  ['Внешняя система','Интеграция или внешнее событие считаются подтверждёнными только после фактического подтверждения внешней системой.'],
  ['Гекта','Гекта объясняет данные и варианты действий, но не принимает критические решения.'],
 ],
 faq:'Частые вопросы',
 faqs:[
  ['Можно ли увидеть закрытые данные лота без регистрации?','Нет. Публичный рынок показывает только разрешённые обезличенные данные.'],
  ['Может ли интерфейс сам назначить роль?','Нет. Доступ появляется только после проверки роли, организации и полномочий.'],
  ['Что происходит при недоступном источнике?','Интерфейс показывает, что источник недоступен или данные устарели. Примерные и старые значения не выдаются за актуальные.'],
  ['Как фиксируется спор?','Спор остаётся связан с конкретной Сделкой, основаниями, документами и журналом действий.'],
 ],
 register:'Регистрация',how:'Как проходит Сделка'
},
en:{
 e:'Trust',t:'Trust based on verifiable facts.',p:'For every important action, users can see who may act, the basis, the source and the recorded decision.',
 fact:'From fact to decision',factLead:'No screen turns uncertainty into a confident status. Missing data remains unavailable or explicitly awaits confirmation.',
 rail:['Fact received','Source identified','Authority checked','Basis linked','Decision recorded','Next step permitted'],
 boundaries:'Trust boundaries',boundariesLead:'What the interface cannot decide on its own.',
 boundary:[
  ['Role and organisation','Choosing a role in the public interface grants no access. Rights appear only after organisation and authority checks.'],
  ['Financial state','Settlement status changes only after confirmed events.'],
  ['External system','An integration or external event is treated as confirmed only after the external system confirms it.'],
  ['Gekta','Gekta explains data and options but does not make critical decisions.'],
 ],
 faq:'Frequently asked questions',
 faqs:[
  ['Can private lot data be viewed without registration?','No. The public market shows only permitted anonymised data.'],
  ['Can the interface assign a role?','No. Access is granted only after role, organisation and authority verification.'],
  ['What happens when a source is unavailable?','The interface says when a source is unavailable or data is stale. Sample and old values are never presented as current.'],
  ['How is a dispute recorded?','The dispute remains linked to the specific Deal, evidence, documents and action log.'],
 ],
 register:'Register',how:'How the Deal works'
},
zh:{
 e:'信任',t:'信任，建立在事实之上。',p:'平台不会要求用户“相信界面”。每个关键操作都必须能够通过权限、依据、来源和已记录决定来解释。',
 fact:'从事实到决定',factLead:'任何界面都不会把未知变成确定状态。缺失数据会保持不可用或明确等待确认。',
 rail:['获得事实','识别来源','核验权限','关联依据','记录决定','允许下一步'],
 boundaries:'信任边界',boundariesLead:'平台不会用界面假设替代以下权威事实。',
 boundary:[
  ['角色与机构','在公开界面选择角色不会获得访问权限。机构和权限审核通过后才会开放相应权利。'],
  ['金融状态','结算状态只会根据已确认事件发生变化。'],
  ['外部系统','只有外部系统确认后，集成或外部事件才被视为已确认。'],
  ['Gekta','Gekta 解释数据和可选操作，但不替人做关键决定。'],
 ],
 faq:'常见问题',
 faqs:[
  ['未注册能查看批次私有数据吗？','不能。公开市场只展示获准公开的匿名数据。'],
  ['界面能自行分配角色吗？','不能。角色、机构和权限审核通过后才会开放访问。'],
  ['数据源不可用时怎么办？','界面会明确提示来源不可用或数据过期，不会把示例或旧数据当成最新数据。'],
  ['争议如何记录？','争议始终与具体交易、依据、文件和操作日志关联。'],
 ],
 register:'注册',how:'交易如何进行'
}} as const;


const TRUST_DETAILS={
  ru:[
    ['Проверка регистрации и статуса компании','Доверенности и роли в системе','Проверка ограничений и доступов'],
    ['Договоры и приложения','Соответствие требованиям','Версии и первичные документы'],
    ['Государственные реестры и API','Лабораторные протоколы','Логистические и банковские подтверждения'],
    ['Фиксация результата и статуса','Прозрачная история изменений','Уведомление участников и аудит'],
  ],
  en:[
    ['Organisation status verification','Authority and system roles','Access and restriction checks'],
    ['Contracts and attachments','Requirement compliance','Versions and primary documents'],
    ['Public registries and APIs','Laboratory protocols','Logistics and banking confirmations'],
    ['Recorded outcome and status','Transparent change history','Participant notification and audit'],
  ],
  zh:[
    ['机构状态核验','授权与系统角色','访问和限制检查'],
    ['合同及附件','要求合规性','版本与原始文件'],
    ['公共登记与 API','实验室协议','物流与银行确认'],
    ['记录结果与状态','透明变更历史','参与方通知与审计'],
  ],
} as const;

export default async function TrustPage(){
 const locale=canonicalPublicLocale(await getLocale());const c=COPY[locale];
 return <main className='pc-canonical-public pc-cp-page-trust'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/trust'/>
  <section className='pc-cp-hero pc-cp-trust-hero'>
   <div className='pc-cp-container pc-cp-hero-grid'>
    <div className='pc-cp-hero-copy'><span className='pc-cp-eyebrow'>{c.e}</span><h1>{c.t}</h1><p>{c.p}</p><div className='pc-cp-actions'><Link className='pc-cp-button' href={`/platform-v7/register?lang=${locale}`}>{c.register}<ArrowRight size={16}/></Link><Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/how-it-works?lang=${locale}`}>{c.how}</Link></div></div>
    <aside className='pc-cp-trust-hero-quote'><strong>{locale==='ru'?'Факты, права и решения можно проверить.':locale==='en'?'Facts, authority and decisions can be verified.':'事实、权限和决定都可核验。'}</strong><span>{locale==='ru'?'Проверяемые факты и история действий.':locale==='en'?'Verifiable facts and an action history.':'可核验事实和操作记录。'}</span></aside>
   </div>
  </section>
  <section className='pc-cp-section pc-cp-trust-pillars-section'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Четыре проверки перед действием':locale==='en'?'Four checks before action':'操作前的四项检查'}</span><h2>{locale==='ru'?'Четыре проверки перед действием':locale==='en'?'Four checks before action':'操作前的四项检查'}</h2><p>{locale==='ru'?'Перед важным действием проверяются четыре вещи.':locale==='en'?'Four checks are made before an important action.':'每个重要操作前都会完成四项检查。'}</p></div>
    <div className='pc-cp-trust-pillars'>
      {TRUST_MODEL[locale].map((item,index)=><article className='pc-cp-card pc-cp-trust-pillar' key={item[0]}>
        <div className='pc-cp-trust-pillar-head'><i>{index+1}</i><div><h3>{item[0]}</h3><p>{item[1]}</p></div></div>
        <ul>{TRUST_DETAILS[locale][index].map(bullet=><li key={bullet}><CheckCircle2 size={12} aria-hidden='true'/><span>{bullet}</span></li>)}</ul>
        <div className='pc-cp-trust-pillar-media' data-visual-index={index} aria-hidden='true'/>
      </article>)}
    </div>
  </div></section>
  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'>
   <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.fact}</span><h2>{c.fact}</h2><p>{c.factLead}</p></div>
   <div className='pc-cp-card pc-cp-state-shell'><div className='pc-cp-deal-spine' role='list' tabIndex={0} aria-label={c.fact} style={{gridTemplateColumns:'repeat(6,minmax(0,1fr))'}}>
    {c.rail.map((x,i)=><div className='pc-cp-stage' role='listitem' key={x} data-state={i===5?'current':'done'}><i>{i+1}</i><strong>{x}</strong></div>)}
   </div></div>
  </div></section>
  <section className='pc-cp-section pc-cp-section--tight pc-cp-trust-gekta'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'>
   <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.faq}</span><h2>{c.faq}</h2></div>
   <div className='pc-cp-faq-row'>{c.faqs.map(([q,a])=><details className='pc-cp-card pc-cp-faq-item' key={q}><summary>{q}<span aria-hidden='true'>↓</span></summary><p>{a}</p></details>)}</div>
  </div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/trust'/>
 </main>
}
