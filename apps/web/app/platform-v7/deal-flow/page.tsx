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
  canonicalPublicLocale,
} from '@/components/platform-v7/PublicCanonicalPrimitives';

const META={"ru":["Контур Сделки — Прозрачная Цена","Как рабочий экран Сделки связывает этап, участника, основание, расчёт и следующий шаг без вымышленных production-данных."],"en":["Deal workspace — Transparent Price","How the Deal workspace connects stage, participant, basis, settlement and the next step without fabricated production data."],"zh":["交易工作区 — 透明价格","交易工作区如何在不虚构生产数据的前提下关联阶段、参与方、依据、结算和下一步。"]} as const;

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
 ?{e:'Сделка в работе',t:'Сделка в работе',p:'Публичная страница показывает структуру рабочего экрана без вымышленных данных. После входа фактическое состояние приходит из разрешённого серверного контекста.',h:'Что показывает рабочий экран',lead:'Платформа показывает основание для расчёта, но не создаёт финансовое событие на клиенте.',state:['Фактическое состояние конкретной Сделки','Участник с подтверждёнными полномочиями','Связанный факт, условие или документ','Только серверно подтверждённое влияние на расчёт','Разрешённое действие для текущей роли'],login:'Войти',how:'Как проходит Сделка'}
 :locale==='en'
 ?{e:'Deal workspace',t:'A Deal in progress without losing context',p:'This public page shows the structure of the workspace but never presents an example as a real Deal. After sign-in, actual data comes from authorised server context.',h:'What the workspace shows',lead:'The platform shows settlement basis but does not create a financial event on the client.',state:['Actual state of the specific Deal','Participant with confirmed authority','Linked fact, condition or document','Only server-confirmed settlement impact','Permitted action for the current role'],login:'Sign in',how:'How the Deal works'}
 :{e:'交易工作区',t:'进行中的交易，不丢失上下文',p:'公开页面只展示工作区结构，不会把示例冒充真实交易。登录后，实际数据来自获授权的服务器上下文。',h:'工作区展示什么',lead:'平台展示结算依据，但不会在客户端创建金融事件。',state:['具体交易的真实状态','具有已确认权限的参与方','关联事实、条件或文件','仅展示服务器确认的结算影响','当前角色允许的操作'],login:'登录',how:'交易如何进行'};
 return <main className='pc-canonical-public pc-cp-page-deal-flow p7-deal-flow-page'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/how-it-works'/>
  <section className='pc-cp-deal-public-hero'>
   <div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.e}</span><h1>{c.t}</h1><p>{c.p}</p></div>
    <div className='pc-cp-deal-mobile-summary' aria-label={locale==='ru'?'Краткая карточка Сделки':locale==='en'?'Deal summary':'交易摘要'}>
      <div className='pc-cp-deal-mobile-summary-media' aria-hidden='true'><Wheat size={24}/></div>
      <div><strong>{locale==='ru'?'Данные Сделки защищены':locale==='en'?'Deal data is protected':'交易数据受保护'}</strong><span>{locale==='ru'?'Приёмка / качество':locale==='en'?'Acceptance / quality':'验收 / 质量'}</span></div>
      <span className='pc-cp-chip pc-cp-chip--ok'>{locale==='ru'?'В работе':locale==='en'?'In progress':'进行中'}</span>
    </div>
    <CanonicalDealSpine locale={locale} currentIndex={4}/>
   </div>
  </section>

  <section className='pc-cp-deal-public-body'>
   <div className='pc-cp-container pc-cp-deal-public-layout'>
    <aside className='pc-cp-card pc-cp-deal-public-lot'>
      <div className='pc-cp-deal-public-lot-media' aria-hidden='true'><Wheat size={26}/></div>
      <span className='pc-cp-chip'><LockKeyhole size={12}/>{locale==='ru'?'Данные защищены':locale==='en'?'Protected data':'受保护数据'}</span>
      <h2>{locale==='ru'?'Карточка лота':locale==='en'?'Lot card':'批次卡片'}</h2>
      <dl>
       <div><dt>{locale==='ru'?'Культура':locale==='en'?'Crop':'作物'}</dt><dd>—</dd></div>
       <div><dt>{locale==='ru'?'Объём':locale==='en'?'Volume':'数量'}</dt><dd>—</dd></div>
       <div><dt>{locale==='ru'?'Регион':locale==='en'?'Region':'地区'}</dt><dd>—</dd></div>
       <div><dt>{locale==='ru'?'Контрагент':locale==='en'?'Counterparty':'交易对手'}</dt><dd>—</dd></div>
       <div><dt>{locale==='ru'?'Расчёт':locale==='en'?'Settlement':'结算'}</dt><dd>—</dd></div>
      </dl>
      <p>{locale==='ru'?'Фактические значения доступны только участнику с подтверждёнными полномочиями.':locale==='en'?'Actual values are available only to a participant with confirmed authority.':'实际值仅向具有已确认权限的参与方开放。'}</p>
      <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/login?lang=${locale}`}>{c.login}</Link>
    </aside>

    <div className='pc-cp-deal-public-main'>
      <header className='pc-cp-card pc-cp-deal-public-stage'>
        <div><span className='pc-cp-eyebrow'>{locale==='ru'?'Текущий этап':locale==='en'?'Current stage':'当前阶段'}</span><h2>{locale==='ru'?'Приёмка / качество':locale==='en'?'Acceptance / quality':'验收 / 质量'}</h2><p>{c.lead}</p></div>
        <div className='pc-cp-deal-public-stage-facts'>
          <span><small>{locale==='ru'?'Срок':locale==='en'?'Timing':'期限'}</small><strong>{locale==='ru'?'Из Сделки':locale==='en'?'From Deal':'来自交易'}</strong></span>
          <span><small>{locale==='ru'?'Ответственный':locale==='en'?'Responsible':'责任方'}</small><strong>{locale==='ru'?'По полномочиям':locale==='en'?'By authority':'按权限'}</strong></span>
          <span><small>{locale==='ru'?'Статус':locale==='en'?'Status':'状态'}</small><strong>{locale==='ru'?'Серверный':locale==='en'?'Server-issued':'服务器确认'}</strong></span>
        </div>
      </header>

      <CanonicalStateLens
        locale={locale}
        state={null}
        happened={c.state[0]}
        actor={c.state[1]}
        basis={c.state[2]}
        settlement={c.state[3]}
        next={c.state[4]}
      />

      <div className='pc-cp-actions pc-cp-deal-public-actions'>
        <Link className='pc-cp-button' href={`/platform-v7/login?lang=${locale}`}>{c.login}<ArrowRight size={16}/></Link>
        <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/how-it-works?lang=${locale}`}>{c.how}</Link>
      </div>
    </div>
   </div>
  </section>

  <section className='pc-cp-deal-public-trust'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Реестр доверия':locale==='en'?'Trust ledger':'信任账本'}</span><h2>{locale==='ru'?'На основе фактов':locale==='en'?'Built on facts':'基于事实'}</h2></div>
    <CanonicalTrustLedger locale={locale}/>
  </div></section>
  <section className='pc-cp-deal-public-gekta'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale}/>
 </main>;
}
