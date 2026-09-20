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
  CanonicalStateLens,
  CanonicalTrustLedger,
  canonicalPublicLocale,
} from '@/components/platform-v7/PublicCanonicalPrimitives';

export const metadata:Metadata={
 title:'Контур сделки — Прозрачная Цена',
 description:'Как рабочий экран Сделки связывает этап, участника, основание, расчёт и следующий шаг без вымышленных production-данных.',
 alternates:{canonical:'/platform-v7/deal-flow'},robots:{index:true,follow:true},
};

export default async function PlatformV7DealFlowPage(){
 const locale=canonicalPublicLocale(await getLocale());
 const c=locale==='ru'
 ?{e:'Сделка в работе',t:'Сделка в работе',p:'Публичная страница показывает структуру рабочего экрана без вымышленных данных. После входа фактическое состояние приходит из разрешённого серверного контекста.',h:'Что показывает рабочий экран',lead:'Платформа показывает основание для расчёта, но не создаёт финансовое событие на клиенте.',state:['Фактическое состояние конкретной Сделки','Участник с подтверждёнными полномочиями','Связанный факт, условие или документ','Только серверно подтверждённое влияние на расчёт','Разрешённое действие для текущей роли'],login:'Войти',how:'Как проходит Сделка'}
 :locale==='en'
 ?{e:'Deal workspace',t:'A Deal in progress without losing context',p:'This public page shows the structure of the workspace but never presents an example as a real Deal. After sign-in, actual data comes from authorised server context.',h:'What the workspace shows',lead:'The platform shows settlement basis but does not create a financial event on the client.',state:['Actual state of the specific Deal','Participant with confirmed authority','Linked fact, condition or document','Only server-confirmed settlement impact','Permitted action for the current role'],login:'Sign in',how:'How the Deal works'}
 :{e:'交易工作区',t:'进行中的交易，不丢失上下文',p:'公开页面只展示工作区结构，不会把示例冒充真实交易。登录后，实际数据来自获授权的服务器上下文。',h:'工作区展示什么',lead:'平台展示结算依据，但不会在客户端创建金融事件。',state:['具体交易的真实状态','具有已确认权限的参与方','关联事实、条件或文件','仅展示服务器确认的结算影响','当前角色允许的操作'],login:'登录',how:'交易如何进行'};
 return <main className='pc-canonical-public pc-cp-page-deal-flow p7-deal-flow-page'>
  <CanonicalPublicHeader locale={locale}/>
  <section className='pc-cp-section pc-cp-section--soft'>
   <div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.e}</span><h1>{c.t}</h1><p>{c.p}</p></div>
    <CanonicalDealSpine locale={locale} currentIndex={4}/>
   </div>
  </section>
  <section className='pc-cp-section'><div className='pc-cp-container'>
   <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.h}</span><h2>{c.h}</h2><p>{c.lead}</p></div>
   <CanonicalStateLens locale={locale} state='normal' happened={c.state[0]} actor={c.state[1]} basis={c.state[2]} settlement={c.state[3]} next={c.state[4]}/>
   <div className='pc-cp-actions' style={{marginTop:18}}><Link className='pc-cp-button' href={`/platform-v7/login?lang=${locale}`}>{c.login}<ArrowRight size={16}/></Link><Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/how-it-works?lang=${locale}`}>{c.how}</Link></div>
  </div></section>
  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'><CanonicalTrustLedger locale={locale}/></div></section>
  <section className='pc-cp-section pc-cp-section--tight'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale}/>
 </main>;
}
