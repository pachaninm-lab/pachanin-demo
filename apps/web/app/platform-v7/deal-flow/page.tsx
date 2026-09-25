import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, LockKeyhole, Wheat } from 'lucide-react';
import { getLocale } from 'next-intl/server';
import {
  CanonicalBottomNav,
  CanonicalDealSpine,
  CanonicalFooter,
  CanonicalGektaStrip,
  CanonicalPublicHeader,
  CanonicalStateLens,
  CanonicalTrustLedger,
  canonicalPublicLocale

} from '@/components/platform-v7/PublicCanonicalPrimitives';

const META={"ru":["Рабочий экран сделки — Прозрачная Цена","Условия сделки, ответственные, документы и следующий шаг: узнайте, как устроен рабочий экран участника."],"en":["Deal workspace — Transparent Price","Deal terms, responsibilities, documents and the next step: see how the participant workspace is organised."],"zh":["交易工作区 — 透明价格","了解参与方如何在交易工作区查看条款、责任分工、文件及下一步任务。"]} as const;

export async function generateMetadata():Promise<Metadata>{
  const locale=canonicalPublicLocale(await getLocale());
  const copy=META[locale];
  return {
    title:copy[0],
    description:copy[1],
    alternates:{
      canonical:'/platform-v7/deal-flow',
      languages:{
        ru:'/platform-v7/deal-flow?lang=ru',
        en:'/platform-v7/deal-flow?lang=en',
        zh:'/platform-v7/deal-flow?lang=zh',
      },
    },
    robots:{index:true,follow:true},
  };
}

type Params=Record<string,string|string[]|undefined>;
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function PlatformV7DealFlowPage({searchParams}:{searchParams?:Promise<Params>}){
 const params=(await searchParams)??{};
 const locale=canonicalPublicLocale(first(params.lang)??await getLocale());
 const c=locale==='ru'
 ?{e:'Рабочий экран сделки',t:'Условия, ответственные и следующий шаг — перед вами',p:'Здесь показано, как устроен рабочий экран. В своей сделке участник видит согласованные условия, документы и задачи, к которым у него есть доступ.',h:'Что показывает рабочий экран',lead:'Платформа показывает основание для расчёта: согласованные условия и связанные документы.',state:['События и изменения условий сделки','Участник, который отвечает за задачу','Документ или условие, на котором основано действие','Условия и документы, необходимые для расчёта','Задача, которую нужно выполнить дальше'],login:'Войти',how:'Как проходит сделка',overview:'Обзор',stages:'Семь связанных этапов',timing:'Что и когда выполнить',responsible:'Участник задачи',status:'По событиям сделки',lotValues:['Название продукции','Согласованный объём','Место отгрузки','Участники сделки','Условия оплаты']}
 :locale==='en'
 ?{e:'Deal workspace',t:'Terms, responsibilities and the next step in one view',p:'This page explains the workspace layout. In their own Deal, participants see the agreed terms, documents and tasks they are allowed to access.',h:'What the workspace shows',lead:'Settlement is linked to the agreed terms and supporting documents.',state:['Events and changes to Deal terms','The participant responsible for the task','The document or condition supporting an action','Terms and documents needed for settlement','The task to complete next'],login:'Sign in',how:'How the Deal works',overview:'Overview',stages:'Seven connected stages',timing:'What is due and when',responsible:'Task owner',status:'Based on Deal events',lotValues:['Product name','Agreed quantity','Loading location','Deal participants','Payment terms']}
 :{e:'交易工作区',t:'条款、责任分工和下一步，一目了然',p:'本页介绍工作区的组成。参与方在自己的交易中查看有权访问的已约定条款、文件和任务。',h:'工作区展示什么',lead:'结算依据包括已约定的条款及相关文件。',state:['交易事件和条款变更','负责该任务的参与方','操作所依据的文件或条件','结算所需的条件和文件','接下来需要完成的任务'],login:'登录',how:'交易如何进行',overview:'概览',stages:'七个相互关联的阶段',timing:'任务及完成时间',responsible:'任务负责人',status:'根据交易事件确定',lotValues:['产品名称','约定数量','装货地点','交易参与方','付款条件']};
 return <main className='pc-canonical-public pc-cp-page-deal-flow p7-deal-flow-page'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/deal-flow'/>
  <section className='pc-cp-deal-public-hero'>
   <div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.e}</span><h1>{c.t}</h1><p>{c.p}</p></div>
    <div className='pc-cp-deal-mobile-summary' aria-label={c.e}>
      <div className='pc-cp-deal-mobile-summary-media' aria-hidden='true'><Wheat size={24}/></div>
      <div><strong>{c.e}</strong><span>{c.stages}</span></div>
      <span className='pc-cp-chip'>{c.overview}</span>
    </div>
    <CanonicalDealSpine locale={locale} currentIndex={null}/>
   </div>
  </section>

  <section className='pc-cp-deal-public-body'>
   <div className='pc-cp-container pc-cp-deal-public-layout'>
    <aside className='pc-cp-card pc-cp-deal-public-lot'>
      <div className='pc-cp-deal-public-lot-media' aria-hidden='true'><Wheat size={26}/></div>
      <span className='pc-cp-chip'><LockKeyhole size={12} aria-hidden='true'/>{locale==='ru'?'Данные вашей сделки':locale==='en'?'Your Deal data':'您的交易数据'}</span>
      <h2>{locale==='ru'?'Карточка лота':locale==='en'?'Lot card':'批次卡片'}</h2>
      <dl>
       <div><dt>{locale==='ru'?'Культура':locale==='en'?'Crop':'作物'}</dt><dd>{c.lotValues[0]}</dd></div>
       <div><dt>{locale==='ru'?'Объём':locale==='en'?'Volume':'数量'}</dt><dd>{c.lotValues[1]}</dd></div>
       <div><dt>{locale==='ru'?'Регион':locale==='en'?'Region':'地区'}</dt><dd>{c.lotValues[2]}</dd></div>
       <div><dt>{locale==='ru'?'Контрагент':locale==='en'?'Counterparty':'交易对手'}</dt><dd>{c.lotValues[3]}</dd></div>
       <div><dt>{locale==='ru'?'Расчёт':locale==='en'?'Settlement':'结算'}</dt><dd>{c.lotValues[4]}</dd></div>
      </dl>
      <p>{locale==='ru'?'Чтобы увидеть данные своей сделки, войдите в платформу. Доступ зависит от вашего участия в ней.':locale==='en'?'Sign in to view your own Deal. Access depends on your participation in it.':'请登录查看自己的交易。可访问的内容取决于您在该交易中的参与权限。'}</p>
      <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/login?lang=${locale}`}>{c.login}</Link>
    </aside>

    <div className='pc-cp-deal-public-main'>
      <header className='pc-cp-card pc-cp-deal-public-stage'>
        <div><span className='pc-cp-eyebrow'>{c.overview}</span><h2>{c.h}</h2><p>{c.lead}</p></div>
        <div className='pc-cp-deal-public-stage-facts'>
          <span><small>{locale==='ru'?'Срок':locale==='en'?'Timing':'期限'}</small><strong>{c.timing}</strong></span>
          <span><small>{locale==='ru'?'Ответственный':locale==='en'?'Responsible':'责任方'}</small><strong>{c.responsible}</strong></span>
          <span><small>{locale==='ru'?'Статус':locale==='en'?'Status':'状态'}</small><strong>{c.status}</strong></span>
        </div>
      </header>

      <CanonicalStateLens
        locale={locale}
        state={null}
        presentation='explanation'
        happened={c.state[0]}
        actor={c.state[1]}
        basis={c.state[2]}
        settlement={c.state[3]}
        next={c.state[4]}
      />

      <div className='pc-cp-actions pc-cp-deal-public-actions'>
        <Link className='pc-cp-button' href={`/platform-v7/login?lang=${locale}`}>{c.login}<ArrowRight size={16} aria-hidden='true'/></Link>
        <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/how-it-works?lang=${locale}`}>{c.how}</Link>
      </div>
    </div>
   </div>
  </section>

  <section className='pc-cp-deal-public-trust'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Условия и ответственность':locale==='en'?'Terms and responsibilities':'条款与责任'}</span><h2>{locale==='ru'?'Понятно, что согласовано и кто отвечает':locale==='en'?'Know what is agreed and who is responsible':'了解已约定的事项及责任分工'}</h2></div>
    <CanonicalTrustLedger locale={locale}/>
  </div></section>
  <section className='pc-cp-deal-public-gekta'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/deal-flow'/>
 </main>;
}
