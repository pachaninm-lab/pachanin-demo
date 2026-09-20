import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getLocale } from 'next-intl/server';
import {
  CanonicalBottomNav,
  CanonicalDealSpine,
  CanonicalFooter,
  CanonicalGektaStrip,
  CanonicalPublicHeader,
  CanonicalTrustLedger,
  canonicalPublicLocale,
} from '@/components/platform-v7/PublicCanonicalPrimitives';

export const metadata:Metadata={
  title:'Как проходит Сделка — Прозрачная Цена',
  description:'Семь этапов Сделки: лот, торги, обязательства, доставка, приёмка и качество, документы и расчёт, закрытие или спор.',
  alternates:{canonical:'/platform-v7/how-it-works'},robots:{index:true,follow:true},
};

const COPY={
ru:{
 e:'Как проходит Сделка',t:'Семь прозрачных шагов — от товара до результата.',p:'Каждый этап отвечает на одни и те же вопросы: кто действует, какой факт нужен, на каком основании можно двигаться дальше и как это влияет на расчёт.',
 actor:'Участник',fact:'Факт',basis:'Основание',money:'Влияние на расчёт',next:'Следующий шаг',
 stages:[
 ['Лот','Продавец','Публичные и закрытые параметры товара','Подтверждённые данные лота и право организации действовать','Расчёт ещё не формируется','Допустить лот к разрешённому торговому контуру'],
 ['Торги','Продавец · Покупатель','Ставки и зафиксированный результат торгов','Правила торгов и серверно подтверждённый результат','Фиксируются экономические условия будущей Сделки','Перейти к обязательствам сторон'],
 ['Обязательства','Продавец · Покупатель','Условия, роли и ответственность сторон','Согласованные условия и подтверждённые полномочия','Появляются условия, от которых зависит будущий финансовый шаг','Запустить исполнение'],
 ['Доставка','Логистика · Водитель','Рейс, маршрут и фактическое исполнение','Разрешённые действия логистической роли и события доставки','Сам факт доставки не даёт клиенту права менять финансовое состояние','Передать факт на приёмку'],
 ['Приёмка / качество','Элеватор · Лаборатория · Сюрвейер','Вес, приёмка, показатели качества и подтверждения','Источники фактов и полномочия соответствующих участников','Отклонения могут изменить основание для расчёта или создать блокер','Зафиксировать принятый результат и необходимые действия'],
 ['Документы / расчёт','Стороны · Банк','Комплект документов и подтверждённые основания','Связанные документы, события и банковские правила','Платформа показывает основание; внешнее финансовое событие требует подтверждения','Выполнить разрешённый финансовый шаг либо устранить блокер'],
 ['Закрытие / спор','Участники Сделки','Финальный статус либо зафиксированное расхождение','История фактов, документов, действий и решений','Закрытие возможно только при выполненных условиях; спор сохраняет влияние до решения','Закрыть Сделку либо вести спор в связанном контексте'],
 ],
 trust:'Доверие на каждом шаге',trustLead:'Полномочия → Основание → Источник → Решение — не отдельный раздел, а сквозная модель всей Сделки.',
 cta:'Зарегистрироваться',market:'Открыть рынок'
},
en:{
 e:'How the Deal works',t:'Seven transparent steps — from product to outcome.',p:'Every stage answers the same questions: who acts, which fact is required, what basis permits progress and how it affects settlement.',
 actor:'Participant',fact:'Fact',basis:'Basis',money:'Settlement impact',next:'Next step',
 stages:[
 ['Lot','Seller','Public and private product parameters','Confirmed lot data and organisation authority','No settlement basis yet','Admit the lot to the authorised trading circuit'],
 ['Trading','Seller · Buyer','Bids and confirmed trading result','Trading rules and server-confirmed outcome','Economic terms of the future Deal are fixed','Move to commitments'],
 ['Commitments','Seller · Buyer','Terms, roles and responsibilities','Agreed terms and confirmed authority','Conditions affecting the future financial step become explicit','Start execution'],
 ['Delivery','Logistics · Driver','Trip, route and execution facts','Authorised logistics actions and delivery events','Delivery itself cannot let the client choose financial state','Pass confirmed facts to acceptance'],
 ['Acceptance / quality','Elevator · Laboratory · Surveyor','Weight, acceptance, quality indicators and confirmations','Fact sources and participant authority','Deviation can change settlement basis or create a blocker','Fix the accepted result and required actions'],
 ['Documents / settlement','Parties · Bank','Document set and confirmed basis','Linked documents, events and banking rules','The platform shows basis; the external financial event still requires confirmation','Perform the permitted financial step or clear the blocker'],
 ['Closure / dispute','Deal participants','Final status or recorded discrepancy','History of facts, documents, actions and decisions','Closure requires satisfied conditions; a dispute keeps its impact until resolved','Close the Deal or handle the dispute in the same context'],
 ],
 trust:'Trust at every step',trustLead:'Authority → Basis → Source → Decision is not a separate feature; it is the control model across the Deal.',
 cta:'Register',market:'Open market'
},
zh:{
 e:'交易如何进行',t:'七个透明步骤——从商品到结果。',p:'每个阶段都回答同样的问题：谁处理、需要什么事实、依据是什么、对结算有什么影响。',
 actor:'参与方',fact:'事实',basis:'依据',money:'结算影响',next:'下一步',
 stages:[
 ['批次','卖方','商品的公开和非公开参数','已确认的批次数据和机构权限','尚未形成结算依据','允许批次进入授权交易流程'],
 ['交易','卖方 · 买方','报价和已确认交易结果','交易规则和服务器确认的结果','固定未来交易的经济条件','进入义务阶段'],
 ['义务','卖方 · 买方','条件、角色和责任','已同意条件和已确认权限','明确影响未来金融步骤的条件','启动履约'],
 ['交付','物流 · 司机','运输、路线和履约事实','获授权物流操作和交付事件','交付本身不能让客户端选择金融状态','将确认事实传递到验收'],
 ['验收 / 质量','粮库 · 实验室 · 检验机构','重量、验收、质量指标和确认','事实来源及对应参与方权限','偏差可能改变结算依据或形成阻断','固定验收结果和所需操作'],
 ['文件 / 结算','交易方 · 银行','文件集和已确认依据','关联文件、事件和银行规则','平台展示依据；外部金融事件仍需确认','执行允许的金融步骤或解除阻断'],
 ['关闭 / 争议','交易参与方','最终状态或已记录差异','事实、文件、操作和决定的历史','满足条件后才能关闭；争议在解决前持续影响交易','关闭交易或在同一上下文处理争议'],
 ],
 trust:'每一步都建立信任',trustLead:'权限 → 依据 → 来源 → 决定不是独立功能，而是贯穿整笔交易的控制模型。',
 cta:'注册',market:'打开市场'
}} as const;

export default async function HowItWorksPage(){
 const locale=canonicalPublicLocale(await getLocale()); const c=COPY[locale];
 return <main className='pc-canonical-public'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/how-it-works'/>
  <section className='pc-cp-hero' style={{minHeight:520}}>
   <div className='pc-cp-container pc-cp-hero-grid'>
    <div className='pc-cp-hero-copy'><span className='pc-cp-eyebrow'>{c.e}</span><h1 style={{maxWidth:'13ch'}}>{c.t}</h1><p>{c.p}</p><div className='pc-cp-actions'><Link className='pc-cp-button' href={`/platform-v7/register?lang=${locale}`}>{c.cta}<ArrowRight size={16}/></Link><Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/market?lang=${locale}`}>{c.market}</Link></div></div>
    <aside className='pc-cp-card pc-cp-state-shell'><CanonicalDealSpine locale={locale} currentIndex={0}/></aside>
   </div>
  </section>
  <section className='pc-cp-section'><div className='pc-cp-container'>
   <div className='pc-cp-process-cards'>
    {c.stages.map((s,index)=><article className='pc-cp-card pc-cp-process-card' key={s[0]}><i>{index+1}</i><div><h3>{s[0]}</h3><div className='pc-cp-process-meta'>
      <Meta l={c.actor} v={s[1]}/><Meta l={c.fact} v={s[2]}/><Meta l={c.basis} v={s[3]}/><Meta l={c.money} v={s[4]}/><Meta l={c.next} v={s[5]}/>
    </div></div></article>)}
   </div>
  </div></section>
  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'><div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.trust}</span><h2>{c.trust}</h2><p>{c.trustLead}</p></div><CanonicalTrustLedger locale={locale}/></div></section>
  <section className='pc-cp-section pc-cp-section--tight'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/how-it-works'/>
 </main>
}
function Meta({l,v}:{l:string;v:string}){return <div><span>{l}</span><strong>{v}</strong></div>}
