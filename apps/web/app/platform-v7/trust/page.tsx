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

const META={"ru":["Доверие — Прозрачная Цена","Модель доверия платформы: полномочия, основание, источник и решение в контексте каждой Сделки."],"en":["Trust — Transparent Price","The platform trust model: authority, basis, source and decision in the context of every Deal."],"zh":["信任 — 透明价格","平台的信任模型：在每笔交易上下文中关联权限、依据、来源和决定。"]} as const;

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
 e:'Доверие',t:'Доверие строится на проверяемых фактах.',p:'Для каждого важного действия можно понять четыре вещи: кто вправе действовать, на каком основании, откуда взят факт и какое решение зафиксировано.',
 fact:'От факта к решению',factLead:'Если данных недостаточно, платформа не маскирует это уверенным статусом: показывает, что известно, а что ещё нужно подтвердить.',
 rail:['Факт получен','Источник определён','Полномочия проверены','Основание связано','Решение зафиксировано','Следующий шаг разрешён'],
 boundaries:'Границы доверия',boundariesLead:'Что платформа не выдаёт за факт без подтверждения.',
 boundary:[
  ['Роль и организация','Выбор роли в интерфейсе не даёт доступ. Права появляются только после проверки организации и полномочий.'],
  ['Расчёт','Пользователь не может вручную назначить финансовый статус. Платформа показывает только подтверждённое состояние и основание.'],
  ['Внешние системы','Интеграция или внешнее событие считается подтверждённым только при наличии фактического источника.'],
  ['Гекта','Гекта объясняет контекст и варианты, но решение и ответственность остаются за участником.'],
 ],
 faq:'Частые вопросы',
 faqs:[
  ['Можно ли увидеть закрытые данные лота без регистрации?','Нет. На публичном рынке видны только разрешённые обезличенные данные.'],
  ['Может ли интерфейс сам назначить роль?','Нет. Роль и доступ появляются только после проверки организации и полномочий.'],
  ['Что происходит, если источник недоступен?','Платформа прямо показывает, что данные недоступны или требуют обновления, и не подменяет их примерным значением.'],
  ['Как фиксируется спор?','Спор остаётся связан с конкретной Сделкой, основаниями, документами и журналом действий.'],
 ],
 register:'Регистрация',how:'Как проходит Сделка'
},
en:{
 e:'Trust',t:'Trust starts with facts you can verify.',p:'For every important action you can see who may act, what permits it, where the fact came from and what decision was recorded.',
 fact:'From fact to decision',factLead:'When information is incomplete, the platform does not disguise uncertainty as certainty. It shows what is known and what still needs confirmation.',
 rail:['Fact received','Source identified','Authority checked','Basis linked','Decision recorded','Next step permitted'],
 boundaries:'Trust boundaries',boundariesLead:'What the platform never presents as fact without confirmation.',
 boundary:[
  ['Role and organisation','Choosing a role in the interface grants no access. Rights appear only after the organisation and authority are verified.'],
  ['Settlement','A user cannot assign financial status manually. The platform shows only confirmed state and basis.'],
  ['External systems','An integration or external event is treated as confirmed only when there is a real source behind it.'],
  ['Gekta','Gekta explains context and options; decisions and accountability stay with the participant.'],
 ],
 faq:'Frequently asked questions',
 faqs:[
  ['Can private lot data be viewed without registration?','No. The public market shows only permitted anonymised data.'],
  ['Can the interface assign a role?','No. Role and access appear only after the organisation and authority are verified.'],
  ['What happens when a source is unavailable?','The platform says the data is unavailable or needs refreshing and does not silently replace it with sample data.'],
  ['How is a dispute recorded?','The dispute remains linked to the specific Deal, evidence, documents and action log.'],
 ],
 register:'Register',how:'How the Deal works'
},
zh:{
 e:'信任',t:'信任来自可核验的事实。',p:'每个重要操作都能看到：谁有权操作、依据是什么、事实来自哪里、最终记录了什么决定。',
 fact:'从事实到决定',factLead:'信息不完整时，平台不会把不确定包装成确定结果，而是明确显示已知内容和仍待确认的部分。',
 rail:['获得事实','识别来源','核验权限','关联依据','记录决定','允许下一步'],
 boundaries:'信任边界',boundariesLead:'没有确认时，平台不会把这些内容当成事实。',
 boundary:[
  ['角色与机构','在界面选择角色不会获得访问权限；机构和权限通过审核后才会开放。'],
  ['结算','用户不能手动指定金融状态；平台只展示已确认的状态和依据。'],
  ['外部系统','只有存在真实来源时，集成或外部事件才会被视为已确认。'],
  ['Gekta','Gekta 解释上下文和可用选项；决定和责任仍由参与方承担。'],
 ],
 faq:'常见问题',
 faqs:[
  ['未注册能查看批次私有数据吗？','不能。公开市场只展示获准的匿名投影。'],
  ['界面能自行分配角色吗？','不能。机构和权限通过审核后，角色和访问才会生效。'],
  ['数据源不可用时怎么办？','平台会明确显示数据不可用或需要更新，不会用示例数据替代事实。'],
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
    <aside className='pc-cp-trust-hero-quote'><strong>{locale==='ru'?'Надёжные данные. Сильный АПК России.':locale==='en'?'Reliable data. Strong agriculture.':'可靠数据。更强农业。'}</strong><span>{locale==='ru'?'Проверяемые факты вместо обещаний.':locale==='en'?'Verifiable facts instead of promises.':'用可核验事实替代空泛承诺。'}</span></aside>
   </div>
  </section>
  <section className='pc-cp-section pc-cp-trust-pillars-section'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Четыре столпа доверия':locale==='en'?'Four trust pillars':'四个信任支柱'}</span><h2>{locale==='ru'?'Четыре столпа доверия':locale==='en'?'Four trust pillars':'四个信任支柱'}</h2><p>{locale==='ru'?'Каждый факт в Сделке проверяется по единым принципам.':locale==='en'?'Every Deal fact is evaluated through the same principles.':'每个交易事实都按同一套原则核验。'}</p></div>
    <div className='pc-cp-trust-pillars'>
      {TRUST_MODEL[locale].map((item,index)=><article className='pc-cp-card pc-cp-trust-pillar' key={item[0]}>
        <div className='pc-cp-trust-pillar-head'><i>{index+1}</i><div><h3>{item[0]}</h3><p>{item[1]}</p></div></div>
        <ul>{TRUST_DETAILS[locale][index].map(bullet=><li key={bullet}><CheckCircle2 size={12} aria-hidden='true'/><span>{bullet}</span></li>)}</ul>
        <div className='pc-cp-trust-pillar-media' data-visual-index={index} aria-hidden='true'/>
        <small>{c.boundary[index]?.[1]}</small>
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
