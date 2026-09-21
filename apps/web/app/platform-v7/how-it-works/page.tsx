import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
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

const META={"ru":["Как проходит Сделка — Прозрачная Цена","Семь этапов Сделки: лот, торги, обязательства, доставка, приёмка и качество, документы и расчёт, закрытие или спор."],"en":["How the Deal works — Transparent Price","Seven Deal stages from lot and trading through commitments, delivery, acceptance and quality, documents, settlement, closure or dispute."],"zh":["交易如何进行 — 透明价格","交易的七个阶段：批次、交易、义务、交付、验收与质量、文件与结算、关闭或争议。"]} as const;

export async function generateMetadata():Promise<Metadata>{
  const locale=canonicalPublicLocale(await getLocale());
  const copy=META[locale];
  return {
    title:copy[0],
    description:copy[1],
    alternates:{
      canonical:'/platform-v7/how-it-works',
      languages:{
        ru:'/platform-v7/how-it-works?lang=ru',
        en:'/platform-v7/how-it-works?lang=en',
        zh:'/platform-v7/how-it-works?lang=zh',
      },
    },
    robots:{index:true,follow:true},
  };
}

const COPY={
ru:{
 e:'7 этапов Сделки',t:'От лота до закрытия — по этапам',p:'На каждом этапе видно, кто отвечает, какие факты нужны, что влияет на расчёт и что можно делать дальше.',
 actor:'Участник',fact:'Факт',basis:'Основание',money:'Влияние на расчёт',next:'Следующий шаг',
 stages:[
 ['Лот','Продавец','Параметры товара и условия публикации','Данные лота и подтверждённые полномочия организации','Расчёт ещё не формируется','Опубликовать лот и перейти к торгам'],
 ['Торги','Продавец · Покупатель','Ставки и итог торгов','Правила торгов и зафиксированный результат','Фиксируются цена и ключевые экономические условия','Зафиксировать обязательства сторон'],
 ['Обязательства','Продавец · Покупатель','Условия, роли и ответственность сторон','Согласованные условия и подтверждённые полномочия','Понятно, какие условия будут влиять на расчёт','Перейти к исполнению'],
 ['Доставка','Логистика · Водитель','Рейс, маршрут и фактическое исполнение','Подтверждённые события доставки и полномочия исполнителей','Доставка сама по себе не меняет расчёт','Передать результат на приёмку'],
 ['Приёмка / качество','Элеватор · Лаборатория · Сюрвейер','Вес, приёмка, показатели качества и подтверждения','Источник каждого факта и полномочия участника','Отклонения могут изменить основание для расчёта','Зафиксировать результат и нужные действия'],
 ['Документы / расчёт','Стороны · Банк','Документы и подтверждённые основания','Связанные документы, события и банковские правила','Платформа показывает, почему финансовый шаг доступен или заблокирован','Выполнить финансовый шаг или устранить причину блокировки'],
 ['Закрытие / спор','Участники Сделки','Финальный статус или зафиксированное расхождение','История фактов, документов, действий и решений','Сделка закрывается после выполнения условий; спор остаётся видимым до решения','Закрыть Сделку или продолжить разбор спора'],
 ],
 trust:'Доверие на каждом шаге',trustLead:'На каждом этапе работает один принцип: кто вправе действовать, на каком основании, откуда взят факт и какое решение принято.',
 cta:'Зарегистрироваться',market:'Открыть рынок'
},
en:{
 e:'7 Deal stages',t:'From lot to closure, stage by stage',p:'At every stage you can see who acts, which facts matter, what affects settlement and what can happen next.',
 actor:'Participant',fact:'Fact',basis:'Basis',money:'Settlement impact',next:'Next step',
 stages:[
 ['Lot','Seller','Product parameters and publication terms','Lot data and confirmed organisation authority','No settlement basis yet','Publish the lot and move to trading'],
 ['Trading','Seller · Buyer','Bids and trading result','Trading rules and recorded outcome','Price and key economic terms are fixed','Record the parties’ commitments'],
 ['Commitments','Seller · Buyer','Terms, roles and responsibilities','Agreed terms and confirmed authority','The conditions that may affect settlement are clear','Move into execution'],
 ['Delivery','Logistics · Driver','Trip, route and execution facts','Confirmed delivery events and executor authority','Delivery alone does not change settlement','Pass the result to acceptance'],
 ['Acceptance / quality','Elevator · Laboratory · Surveyor','Weight, acceptance, quality indicators and confirmations','The source of each fact and participant authority','A deviation may change settlement basis','Record the result and required actions'],
 ['Documents / settlement','Parties · Bank','Documents and confirmed basis','Linked documents, events and banking rules','The platform shows why a financial step is available or blocked','Perform the financial step or clear the blocking reason'],
 ['Closure / dispute','Deal participants','Final status or recorded discrepancy','History of facts, documents, actions and decisions','The Deal closes when conditions are met; a dispute stays visible until resolved','Close the Deal or continue resolving the dispute'],
 ],
 trust:'Trust at every step',trustLead:'The same principle applies at every stage: who may act, what permits it, where the fact came from and what decision was recorded.',
 cta:'Register',market:'Open market'
},
zh:{
 e:'交易的 7 个阶段',t:'从批次到关闭，按阶段执行',p:'每个阶段都能看到谁负责、需要哪些事实、什么影响结算，以及下一步可以做什么。',
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
 trust:'每一步都建立信任',trustLead:'每个阶段都遵循同一原则：谁有权操作、依据是什么、事实来自哪里、最终记录了什么决定。',
 cta:'注册',market:'打开市场'
}} as const;

export default async function HowItWorksPage(){
 const locale=canonicalPublicLocale(await getLocale()); const c=COPY[locale];
 return <main className='pc-canonical-public pc-cp-page-how'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/how-it-works'/>
  <section className='pc-cp-hero pc-cp-how-hero'>
   <div className='pc-cp-container pc-cp-how-hero-grid'>
    <div className='pc-cp-hero-copy'><span className='pc-cp-eyebrow'>{c.e}</span><h1>{c.t}</h1><p>{c.p}</p></div>
    <aside className='pc-cp-how-hero-quote'><strong>{locale==='ru'?'От лота до закрытия':locale==='en'?'From lot to closure':'从批次到关闭'}</strong><span>{locale==='ru'?'На каждом этапе видны факты и ответственный участник.':locale==='en'?'Each stage shows its facts and responsible participant.':'每个阶段都显示相关事实和责任方。'}</span></aside>
   </div>
  </section>
  <section className='pc-cp-how-spine'><div className='pc-cp-container'><CanonicalDealSpine locale={locale} currentIndex={0}/></div></section>
  <section className='pc-cp-section'><div className='pc-cp-container'>
   <div className='pc-cp-process-cards'>
    {c.stages.map((s,index)=><article className='pc-cp-card pc-cp-process-card' key={s[0]}><i>{index+1}</i><div><h3>{s[0]}</h3><div className='pc-cp-process-meta'>
      <Meta l={c.actor} v={s[1]}/><Meta l={c.fact} v={s[2]}/><Meta l={c.basis} v={s[3]}/><Meta l={c.money} v={s[4]}/><Meta l={c.next} v={s[5]}/>
    </div></div></article>)}
   </div>
  </div></section>
  <section className='pc-cp-section pc-cp-section--soft pc-cp-how-trust'><div className='pc-cp-container'>
   <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.trust}</span><h2>{c.trust}</h2><p>{c.trustLead}</p></div>
   <div className='pc-cp-how-trust-layout'><CanonicalTrustLedger locale={locale}/><aside className='pc-cp-how-gekta-note'><strong>{locale==='ru'?'Гекта показывает, какие факты Сделки нужно проверить':locale==='en'?'Gekta shows which Deal facts need checking':'Gekta 显示需要核验的交易事实'}</strong><p>{locale==='ru'?'Показывает связанные факты и риски. Решение остаётся за участником.':locale==='en'?'Shows the linked facts and risks. The participant makes the decision.':'展示相关事实和风险；决定仍由参与方作出。'}</p></aside></div>
  </div></section>
  <section className='pc-cp-section pc-cp-section--tight pc-cp-how-gekta'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/how-it-works'/>
 </main>
}
function Meta({l,v}:{l:string;v:string}){return <div><span>{l}</span><strong>{v}</strong></div>}
