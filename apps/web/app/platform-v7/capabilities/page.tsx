import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getLocale } from 'next-intl/server';
import {
  CAPABILITIES,
  CanonicalBottomNav,
  CanonicalDealSpine,
  CanonicalFooter,
  CanonicalGektaStrip,
  CanonicalPublicHeader,
  CanonicalTrustLedger,
  canonicalPublicLocale,
} from '@/components/platform-v7/PublicCanonicalPrimitives';

const META={"ru":["Возможности — Прозрачная Цена","Двенадцать задач для работы со сделкой: найти продукцию, согласовать условия, организовать исполнение, проверить качество и документы."],"en":["Capabilities — Transparent Price","Twelve Deal tasks: find produce, agree terms, organise execution and review quality and documents."],"zh":["功能 — 透明价格","处理交易的十二项任务：查找产品、约定条款、组织履约、核查质量与文件。"]} as const;

export async function generateMetadata():Promise<Metadata>{
  const locale=canonicalPublicLocale(await getLocale());
  const copy=META[locale];
  return {
    title:copy[0],
    description:copy[1],
    alternates:{
      canonical:'/platform-v7/capabilities',
      languages:{
        ru:'/platform-v7/capabilities?lang=ru',
        en:'/platform-v7/capabilities?lang=en',
        zh:'/platform-v7/capabilities?lang=zh',
      },
    },
    robots:{index:true,follow:true},
  };
}

const COPY={
ru:{e:'Возможности',t:'Всё, что нужно для работы со сделкой',p:'Рынок, исполнение, документы, расчёт и закрытие связаны между собой. Выберите задачу и узнайте, как она устроена.',items:{
market:['Найти продукцию','Выберите культуру, регион и класс. Сравните условия опубликованных предложений.'],trading:['Согласовать цену','Рассмотрите предложения сторон и зафиксируйте результат торгов.'],commitments:['Распределить обязанности','Определите, что выполняет каждая сторона, в какой срок и на каких условиях.'],delivery:['Организовать доставку','Согласуйте задачи логиста и водителя, место отгрузки и маршрут.'],acceptance:['Проверить качество','Сопоставьте вес, показатели качества и результаты приёмки с условиями сделки.'],documents:['Собрать документы','Проверьте документы своей сделки и связанные с ними действия.'],settlement:['Проверить условия расчёта','Посмотрите, какие условия выполнены и какие подтверждения ещё нужны.'],dispute:['Разобрать расхождение','Зафиксируйте разногласие и соберите документы для его рассмотрения.'],trust:['Проверить основания','Уточните, кто вправе действовать и на какой документ или условие он опирается.'],gekta:['Задать вопрос Гекте','Обсудите документы, приёмку и следующий шаг. Важное решение принимает участник.'],roles:['Определить участие','Выберите подходящий формат работы от имени организации. Доступ предоставляется после проверки.'],history:['Вернуться к решению','Посмотрите историю изменений и основания принятых решений.']},cta:'Выбрать формат участия',more:'Как проходит сделка'},
en:{e:'Capabilities',t:'What you need to work on a Deal',p:'Market, execution, documents, settlement and closure stay connected. Choose a task to see how it works.',items:{
market:['Find produce','Choose a crop, region and grade. Compare the terms of published offers.'],trading:['Agree a price','Review the parties’ offers and record the trading result.'],commitments:['Assign responsibilities','Agree what each party must do, by when and under which terms.'],delivery:['Organise delivery','Agree tasks for logistics and the driver, the loading location and route.'],acceptance:['Review quality','Compare weight, quality indicators and acceptance results with the Deal terms.'],documents:['Gather documents','Check your Deal documents and the actions connected to them.'],settlement:['Check settlement terms','See which conditions have been met and which confirmations are still needed.'],dispute:['Review a discrepancy','Record a disagreement and gather the documents needed to review it.'],trust:['Check the basis','See who can act and which document or condition supports their action.'],gekta:['Ask Gekta','Discuss documents, acceptance and the next step. The participant makes important decisions.'],roles:['Choose your participation','Choose how your organisation will participate. Access is granted after review.'],history:['Revisit a decision','Review the history of changes and the basis for decisions.']},cta:'Choose how to participate',more:'How the Deal works'},
zh:{e:'功能',t:'处理交易所需的各项任务',p:'市场、履约、文件、结算和关闭保持关联。选择任务，了解其具体流程。',items:{
market:['查找产品','选择作物、地区和等级，比较已发布供求信息的条件。'],trading:['约定价格','审查各方报价并记录交易结果。'],commitments:['分配责任','约定各方需要完成的事项、期限和条件。'],delivery:['组织交付','约定物流和司机的任务、装货地点及路线。'],acceptance:['核查质量','将重量、质量指标和验收结果与交易条款进行比较。'],documents:['收集文件','检查自己交易的文件及相关操作。'],settlement:['检查结算条件','查看已满足的条件和仍需提供的确认。'],dispute:['处理差异','记录分歧并收集审查所需的文件。'],trust:['核查依据','了解谁有权操作，以及操作所依据的文件或条件。'],gekta:['向 Gekta 提问','讨论文件、验收和下一步。重要决定由参与方作出。'],roles:['确定参与方式','选择机构参与交易的方式，审核后开放访问权限。'],history:['回顾决定','查看变更历史及作出决定的依据。']},cta:'选择参与方式',more:'交易如何进行'},
} as const;

export default async function CapabilitiesPage(){
 const locale=canonicalPublicLocale(await getLocale()); const c=COPY[locale];
 return <main className='pc-canonical-public pc-cp-page-capabilities'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/capabilities'/>
  <section className='pc-cp-hero'>
   <div className='pc-cp-container pc-cp-hero-grid'>
    <div className='pc-cp-hero-copy'><span className='pc-cp-eyebrow'>{c.e}</span><h1>{c.t}</h1><p>{c.p}</p><div className='pc-cp-actions'><Link className='pc-cp-button' href={`/platform-v7?lang=${locale}#participants`}>{c.cta}<ArrowRight size={16} aria-hidden='true'/></Link><Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/how-it-works?lang=${locale}`}>{c.more}</Link></div></div>
    <div className='pc-cp-card pc-cp-state-shell'><CanonicalDealSpine locale={locale} currentIndex={null}/></div>
   </div>
  </section>
  <section className='pc-cp-section'><div className='pc-cp-container'><div className='pc-cp-capabilities'>
   {CAPABILITIES.map(([Icon,key])=>{const [title,text]=c.items[key];return <article className='pc-cp-card pc-cp-capability' key={key}><Icon size={22} aria-hidden='true'/><strong>{title}</strong><p>{text}</p></article>})}
  </div></div></section>
  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'><div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Доверие':locale==='en'?'Trust':'信任'}</span><h2>{locale==='ru'?'Понятно, что согласовано и кто отвечает':locale==='en'?'Know what is agreed and who is responsible':'了解已约定的事项及责任分工'}</h2></div><CanonicalTrustLedger locale={locale}/></div></section>
  <section className='pc-cp-section pc-cp-section--tight'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale}/>
 </main>;
}
