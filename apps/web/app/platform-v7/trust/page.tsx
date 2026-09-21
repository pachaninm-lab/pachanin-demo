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
 e:'Доверие',t:'Доверие. На основе фактов.',p:'Платформа не просит “верить интерфейсу”. Критическое действие должно быть объяснимо через полномочия, основание, источник и зафиксированное решение.',
 fact:'От факта к решению',factLead:'Ни один экран не должен превращать неизвестность в уверенный статус. Если данных нет, они остаются недоступными или требуют подтверждения.',
 rail:['Факт получен','Источник определён','Полномочия проверены','Основание связано','Решение зафиксировано','Следующий шаг разрешён'],
 boundaries:'Границы доверия',boundariesLead:'Что платформа принципиально не подменяет интерфейсом.',
 boundary:[
  ['Роль и tenant','Публичный выбор роли не выдаёт права. Авторитетный контекст формируется сервером после проверки.'],
  ['Финансовое состояние','Клиент не выбирает authoritative financial state; он показывает только серверно подтверждённый статус и основание.'],
  ['Внешняя система','Наличие интеграции или события не заявляется без фактического внешнего подтверждения.'],
  ['Гекта','AI объясняет контекст и варианты, но не получает самостоятельного права на критическое решение.'],
 ],
 faq:'Частые вопросы',
 faqs:[
  ['Можно ли увидеть закрытые данные лота без регистрации?','Нет. Публичный рынок раскрывает только разрешённую обезличенную проекцию.'],
  ['Может ли интерфейс сам назначить роль?','Нет. Роль, организация и tenant приходят из серверно проверенного контекста.'],
  ['Что происходит при недоступном источнике?','UI показывает unavailable/stale и не подменяет факт последним известным или примерным значением без явной маркировки.'],
  ['Как фиксируется спор?','Спор остаётся связан с конкретной Сделкой, основаниями, документами и журналом действий.'],
 ],
 register:'Регистрация',how:'Как проходит Сделка'
},
en:{
 e:'Trust',t:'Trust. Built on facts.',p:'The platform does not ask users to “trust the interface”. Every critical action must be explainable through authority, basis, source and a recorded decision.',
 fact:'From fact to decision',factLead:'No screen turns uncertainty into a confident status. Missing data remains unavailable or explicitly awaits confirmation.',
 rail:['Fact received','Source identified','Authority checked','Basis linked','Decision recorded','Next step permitted'],
 boundaries:'Trust boundaries',boundariesLead:'What the platform deliberately refuses to replace with UI assumptions.',
 boundary:[
  ['Role and tenant','A public role choice grants no rights. Authoritative context is server-issued after checks.'],
  ['Financial state','The client never selects authoritative financial state; it only presents server-confirmed status and basis.'],
  ['External system','An integration or external event is not claimed without actual external confirmation.'],
  ['Gekta','AI explains context and options but receives no independent critical-decision authority.'],
 ],
 faq:'Frequently asked questions',
 faqs:[
  ['Can private lot data be viewed without registration?','No. The public market exposes only the permitted anonymised projection.'],
  ['Can the interface assign a role?','No. Role, organisation and tenant come from a server-verified context.'],
  ['What happens when a source is unavailable?','The UI shows unavailable/stale and does not silently replace the fact with sample or last-known data.'],
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
  ['角色与 tenant','公开角色选择不会授予权限。权威上下文由服务器审核后签发。'],
  ['金融状态','客户端不能选择权威金融状态，只展示服务器确认的状态和依据。'],
  ['外部系统','没有真实外部确认时，不会宣称存在集成或外部事件。'],
  ['Gekta','AI 解释上下文和选项，但不获得独立关键决策权。'],
 ],
 faq:'常见问题',
 faqs:[
  ['未注册能查看批次私有数据吗？','不能。公开市场只展示获准的匿名投影。'],
  ['界面能自行分配角色吗？','不能。角色、机构和 tenant 来自服务器验证的上下文。'],
  ['数据源不可用时怎么办？','UI 明确显示 unavailable/stale，不会用示例或旧数据悄悄替代事实。'],
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
