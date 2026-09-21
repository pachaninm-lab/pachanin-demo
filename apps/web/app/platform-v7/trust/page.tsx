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
 e:'Доверие',t:'Доверие начинается с проверяемых фактов.',p:'Для критического действия должно быть понятно, кто его выполняет, на каком основании, откуда пришёл факт и что было зафиксировано.',
 fact:'От факта к решению',factLead:'Если данных нет или они устарели, интерфейс показывает это прямо. Неизвестность не превращается в подтверждённый статус.',
 rail:['Факт получен','Источник определён','Полномочия проверены','Основание связано','Решение зафиксировано','Следующий шаг разрешён'],
 boundaries:'Границы доверия',boundariesLead:'Что интерфейс не решает за сервер и внешние системы.',
 boundary:[
  ['Роль и организация','Выбор роли на сайте не выдаёт права. Доступ появляется только после серверной проверки.'],
  ['Статус расчёта','Интерфейс не назначает статус расчёта. Он показывает только состояние и основание, подтверждённые сервером.'],
  ['Внешняя система','Наличие интеграции или события не заявляется без фактического внешнего подтверждения.'],
  ['Гекта','Гекта объясняет факты и варианты, но не принимает критические решения за участника.'],
 ],
 faq:'Частые вопросы',
 faqs:[
  ['Можно ли увидеть закрытые данные лота без регистрации?','Нет. Публичный рынок раскрывает только разрешённую обезличенную проекцию.'],
  ['Может ли интерфейс сам назначить роль?','Нет. Роль и организация берутся из проверенного серверного профиля.'],
  ['Что происходит при недоступном источнике?','Интерфейс показывает, что источник недоступен или данные устарели. Он не подставляет пример или последнее значение молча.'],
  ['Как фиксируется спор?','Спор остаётся связан с конкретной Сделкой, основаниями, документами и журналом действий.'],
 ],
 register:'Регистрация',how:'Как проходит Сделка'
},
en:{
 e:'Trust',t:'Trust starts with verifiable facts.',p:'For every critical action, users can see who acts, what permits it, where the fact came from and what was recorded.',
 fact:'From fact to decision',factLead:'If data is missing or stale, the interface says so. Uncertainty is never presented as a confirmed status.',
 rail:['Fact received','Source identified','Authority checked','Basis linked','Decision recorded','Next step permitted'],
 boundaries:'Trust boundaries',boundariesLead:'What the interface never decides on behalf of the server or an external system.',
 boundary:[
  ['Role and organisation','Choosing a role on the public site grants no rights. Access appears only after server-side checks.'],
  ['Settlement status','The interface never assigns settlement status. It only displays server-confirmed state and evidence.'],
  ['External system','An integration or external event is not claimed without actual external confirmation.'],
  ['Gekta','Gekta explains facts and options but does not make critical decisions for the participant.'],
 ],
 faq:'Frequently asked questions',
 faqs:[
  ['Can private lot data be viewed without registration?','No. The public market exposes only the permitted anonymised projection.'],
  ['Can the interface assign a role?','No. Role and organisation come from the verified server profile.'],
  ['What happens when a source is unavailable?','The interface marks the source as unavailable or stale and does not silently substitute sample or last-known data.'],
  ['How is a dispute recorded?','The dispute remains linked to the specific Deal, evidence, documents and action log.'],
 ],
 register:'Register',how:'How the Deal works'
},
zh:{
 e:'信任',t:'信任从可核验事实开始。',p:'每个关键操作都能看到谁在执行、依据是什么、事实来自哪里，以及最终记录了什么。',
 fact:'从事实到决定',factLead:'数据缺失或过期时，界面会直接说明，不会把未知状态显示成已确认。',
 rail:['获得事实','识别来源','核验权限','关联依据','记录决定','允许下一步'],
 boundaries:'信任边界',boundariesLead:'界面不会替服务器或外部系统做以下决定。',
 boundary:[
  ['角色与机构','在公开页面选择角色不会获得权限；访问权只在服务器审核后生效。'],
  ['结算状态','界面不能指定结算状态，只展示服务器确认的状态和依据。'],
  ['外部系统','没有真实外部确认时，不会宣称存在集成或外部事件。'],
  ['Gekta','Gekta 解释事实和可选方案，但不会替参与方作出关键决定。'],
 ],
 faq:'常见问题',
 faqs:[
  ['未注册能查看批次私有数据吗？','不能。公开市场只展示获准的匿名投影。'],
  ['界面能自行分配角色吗？','不能。角色和机构来自服务器已验证的用户资料。'],
  ['数据源不可用时怎么办？','界面会明确标记来源不可用或数据过期，不会悄悄用示例或旧数据替代。'],
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
    <aside className='pc-cp-trust-hero-quote'><strong>{locale==='ru'?'Статус без источника не считаем подтверждённым.':locale==='en'?'A status without a source is not treated as confirmed.':'没有来源的状态不会被视为已确认。'}</strong><span>{locale==='ru'?'Неподтверждённые данные помечаем явно.':locale==='en'?'Unconfirmed data is marked clearly.':'未确认数据会被明确标记。'}</span></aside>
   </div>
  </section>
  <section className='pc-cp-section pc-cp-trust-pillars-section'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Четыре проверки перед действием':locale==='en'?'Four checks before an action':'操作前的四项检查'}</span><h2>{locale==='ru'?'Четыре столпа доверия':locale==='en'?'Four trust pillars':'四个信任支柱'}</h2><p>{locale==='ru'?'Один и тот же порядок проверки действует на всех этапах Сделки.':locale==='en'?'The same verification order applies at every Deal stage.':'交易各阶段都使用同一套核验顺序。'}</p></div>
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
