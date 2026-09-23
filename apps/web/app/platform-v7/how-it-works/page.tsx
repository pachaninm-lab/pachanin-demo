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

const META={"ru":["Как проходит сделка — Прозрачная Цена","Семь этапов сделки: лот, торги, обязательства, доставка, приёмка и качество, документы и расчёт, закрытие или спор."],"en":["How the Deal works — Transparent Price","Seven Deal stages from lot and trading through commitments, delivery, acceptance and quality, documents, settlement, closure or dispute."],"zh":["交易如何进行 — 透明价格","交易的七个阶段：批次、交易、义务、交付、验收与质量、文件与结算、关闭或争议。"]} as const;

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
 e:'Как проходит сделка',t:'От предложения до завершения сделки',p:'Семь этапов: кто выполняет задачу, какой результат фиксируется и что нужно для следующего шага.',
 actor:'Участник',fact:'Результат',basis:'Документ или условие',money:'Что с расчётом',next:'Следующий шаг',details:'Подробнее',
 stages:[
 ['Лот','Продавец','Культура, объём, качество и место отгрузки','Данные продукции и полномочия организации','Условия оплаты ещё предстоит согласовать','Опубликовать предложение и перейти к торгам'],
 ['Торги','Продавец · Покупатель','Согласованная цена и результат торгов','Правила торгов и подтверждённый результат торгов','Цена становится частью условий сделки','Согласовать обязательства сторон'],
 ['Обязательства','Продавец · Покупатель','Кто, что и в какой срок должен выполнить','Согласованные условия и документы сторон','Определяются условия оплаты и необходимые подтверждения','Подготовить отгрузку и доставку'],
 ['Доставка','Логистика · Водитель','Рейс, маршрут и события перевозки','Задание на перевозку и связанные документы','Доставка не означает завершение расчёта: сначала нужны приёмка и документы','Передать продукцию на приёмку'],
 ['Приёмка и качество','Элеватор · Лаборатория · Сюрвейер','Вес, показатели качества и выявленные расхождения','Результаты приёмки, анализов и осмотра','Расхождения рассматриваются с учётом согласованных условий','Подтвердить результат или зафиксировать разногласие'],
 ['Документы и расчёт','Стороны сделки; банк — в рамках согласованного участия','Документы и подтверждения для расчёта','Согласованные условия и комплект документов','Статус оплаты отражает подтверждённые события, а не нажатие кнопки','Проверить выполнение условий и подтверждение расчёта'],
 ['Закрытие или спор','Участники сделки','Завершённые обязательства или зафиксированное расхождение','История документов, действий и решений','Невыполненные условия и разногласия должны быть рассмотрены','Закрыть сделку или продолжить разбор спора'],
 ],
 trust:'Проверки на каждом этапе',trustLead:'На каждом этапе проверяются полномочия, основание и источник, а принятое решение фиксируется.',
 cta:'Подать заявку',market:'Открыть рынок',workspace:'Рабочий экран сделки'
},
en:{
 e:'How the Deal works',t:'From an offer to a completed Deal',p:'Seven stages: who handles the task, which result is recorded and what is needed for the next step.',
 actor:'Participant',fact:'Result',basis:'Document or condition',money:'Settlement',next:'Next step',details:'Details',
 stages:[
 ['Lot','Seller','Crop, quantity, quality and loading location','Product information and organisation permissions','Payment terms still need to be agreed','Publish the offer and move to trading'],
 ['Trading','Seller · Buyer','Agreed price and trading result','Trading rules and confirmed trading result','The price becomes part of the Deal terms','Agree the parties’ commitments'],
 ['Commitments','Seller · Buyer','Who must do what and by when','Agreed terms and the parties’ documents','Payment conditions and required confirmations are defined','Prepare loading and delivery'],
 ['Delivery','Logistics · Driver','Trip, route and transport events','Transport task and related documents','Delivery does not complete settlement: acceptance and documents are still needed.','Hand over the product for acceptance'],
 ['Acceptance and quality','Elevator · Laboratory · Surveyor','Weight, quality results and recorded discrepancies','Acceptance, laboratory and inspection records','Discrepancies are reviewed against the agreed terms','Confirm the result or record a disagreement'],
 ['Documents and settlement','Deal parties; a bank within its agreed participation','Documents and confirmations needed for settlement','Agreed terms and supporting documents','Payment status follows confirmed events, not a button press','Check fulfilment of the terms and settlement confirmation'],
 ['Closure or dispute','Deal participants','Completed commitments or a recorded discrepancy','History of documents, actions and decisions','Unfulfilled conditions and disagreements must be reviewed','Close the Deal or continue reviewing the dispute'],
 ],
 trust:'Checks at every stage',trustLead:'At every stage, authority, basis and source are checked, and the resulting decision is recorded.',
 cta:'Apply for access',market:'Open market',workspace:'Deal workspace'
},
zh:{
 e:'交易如何进行',t:'从供求信息到交易完成',p:'七个阶段：谁负责处理任务、记录什么结果，以及下一步需要什么。',
 actor:'参与方',fact:'结果',basis:'文件或条件',money:'结算',next:'下一步',details:'详情',
 stages:[
 ['批次','卖方','作物、数量、质量和装货地点','产品信息和机构权限','付款条件尚需约定','发布供求信息并进入交易阶段'],
 ['交易','卖方 · 买方','约定价格和交易结果','交易规则和已确认的交易结果','价格成为交易条款的一部分','约定各方义务'],
 ['义务','卖方 · 买方','由谁完成什么任务，以及完成期限','已约定的条款及各方文件','明确付款条件和所需确认','准备装货和交付'],
 ['交付','物流 · 司机','运输任务、路线和运输事件','运输任务及相关文件','交付不代表结算已完成，还需要验收和相关文件。','交接产品并进行验收'],
 ['验收与质量','粮库 · 实验室 · 检验机构','重量、质量结果及已记录的差异','验收、检测和检验记录','根据约定条款审查差异','确认结果或记录分歧'],
 ['文件与结算','交易各方；银行按约定参与','结算所需的文件和确认','已约定的条款及相关文件','付款状态依据已确认的事件，而不是一次按钮点击','核查条款履行情况及结算确认'],
 ['关闭或争议','交易参与方','已完成的义务或记录的差异','文件、操作和决定的历史','需审查未履行的条件和分歧','关闭交易或继续处理争议'],
 ],
 trust:'每个阶段的检查',trustLead:'每个阶段都会检查权限、依据和来源，并记录最终决定。',
 cta:'申请接入',market:'打开市场',workspace:'交易工作区'
}} as const;

export default async function HowItWorksPage(){
 const locale=canonicalPublicLocale(await getLocale()); const c=COPY[locale];
 return <main className='pc-canonical-public pc-cp-page-how'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/how-it-works'/>
  <section className='pc-cp-hero pc-cp-how-hero'>
   <div className='pc-cp-container pc-cp-how-hero-grid'>
    <div className='pc-cp-hero-copy'><span className='pc-cp-eyebrow'>{c.e}</span><h1>{c.t}</h1><p>{c.p}</p><div className='pc-cp-actions'><a className='pc-cp-button' href={`/platform-v7/register?lang=${locale}`}>{c.cta}</a><a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/deal-flow?lang=${locale}`}>{c.workspace}</a></div></div>
    <aside className='pc-cp-how-hero-quote'><strong>{locale==='ru'?'Семь этапов Сделки':locale==='en'?'Seven Deal stages':'交易七个阶段'}</strong><span>{locale==='ru'?'На каждом этапе указаны участник, факты, основание и следующий шаг.':locale==='en'?'Each stage shows the participant, facts, basis and next step.':'每个阶段都标明参与方、事实、依据和下一步。'}</span></aside>
   </div>
  </section>
  <section className='pc-cp-how-spine'><div className='pc-cp-container'><CanonicalDealSpine locale={locale} currentIndex={null}/></div></section>
  <section className='pc-cp-section'><div className='pc-cp-container'>
   <div className='pc-cp-process-cards'>
    {c.stages.map((s,index)=><article className='pc-cp-card pc-cp-process-card' key={s[0]}><i>{index+1}</i><div className='pc-cp-process-body'><h3>{s[0]}</h3>
      <p className='pc-cp-process-result'><span>{c.fact}</span><strong>{s[2]}</strong></p>
      <details className='pc-cp-process-details'><summary>{c.details}</summary><div className='pc-cp-process-meta'>
        <Meta l={c.actor} v={s[1]}/><Meta l={c.basis} v={s[3]}/><Meta l={c.money} v={s[4]}/><Meta l={c.next} v={s[5]}/>
      </div></details>
    </div></article>)}
   </div>
  </div></section>
  <section className='pc-cp-section pc-cp-section--soft pc-cp-how-trust'><div className='pc-cp-container'>
   <div className='pc-cp-section-head'><h2>{c.trust}</h2><p>{c.trustLead}</p></div>
   <div className='pc-cp-how-trust-layout'><CanonicalTrustLedger locale={locale}/><aside className='pc-cp-how-gekta-note'><strong>{locale==='ru'?'Гекта по данным Сделки':locale==='en'?'Gekta works from Deal data':'Gekta 基于交易数据'}</strong><p>{locale==='ru'?'Объясняет факты, риски и варианты дальнейших действий. Решение принимает участник.':locale==='en'?'Explains facts, risk and possible next actions. The participant makes the decision.':'解释事实、风险和可能的下一步；决定由参与方作出。'}</p></aside></div>
  </div></section>
  <section className='pc-cp-section pc-cp-section--tight pc-cp-how-gekta'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/how-it-works'/>
 </main>
}
function Meta({l,v}:{l:string;v:string}){return <div><span>{l}</span><strong>{v}</strong></div>}
