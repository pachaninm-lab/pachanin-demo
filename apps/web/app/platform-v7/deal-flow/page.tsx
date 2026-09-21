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

const META={"ru":["Сделка в работе — Прозрачная Цена","Рабочий экран показывает текущее состояние Сделки, ответственного участника, основание для действия, статус расчёта и доступный следующий шаг."],"en":["Deal in progress — Transparent Price","The workspace shows the current Deal state, the responsible participant, supporting evidence, settlement status and the next available action."],"zh":["进行中的交易 — 透明价格","工作区展示当前交易状态、责任方、操作依据、结算状态和下一步可执行操作。"]} as const;

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

export default async function PlatformV7DealFlowPage(){
 const locale=canonicalPublicLocale(await getLocale());
 const c=locale==='ru'
 ?{e:'Сделка в работе',t:'Рабочий экран Сделки',p:'Публичная страница показывает устройство рабочего экрана без подстановки примерных данных. После входа состояние Сделки приходит с сервера в пределах доступных пользователю прав.',h:'Что показывает рабочий экран',lead:'Платформа показывает основание для расчёта, подтверждённое сервером; банковское событие подтверждается отдельно.',state:['Текущее состояние конкретной Сделки','Участник с подтверждёнными правами','Связанный факт, условие или документ','Подтверждённое сервером влияние на расчёт','Действие, доступное текущей роли'],login:'Войти',how:'Как проходит Сделка'}
 :locale==='en'
 ?{e:'Deal workspace',t:'The Deal workspace',p:'This public page shows how the workspace is organised without presenting sample data as a real Deal. After sign-in, Deal state comes from the server within the user’s permissions.',h:'What the workspace shows',lead:'The platform shows confirmed settlement evidence; the banking event is confirmed separately.',state:['Current state of the specific Deal','Participant with confirmed permissions','Linked fact, condition or document','Server-confirmed settlement impact','Action available to the current role'],login:'Sign in',how:'How the Deal works'}
 :{e:'交易工作区',t:'交易工作区',p:'公开页面只展示工作区如何组织，不会把示例数据当成真实交易。登录后，交易状态由服务器按用户权限提供。',h:'工作区展示什么',lead:'平台展示已确认的结算依据；银行事件单独确认。',state:['具体交易的当前状态','具有已确认权限的参与方','关联事实、条件或文件','服务器确认的结算影响','当前角色可执行的操作'],login:'登录',how:'交易如何进行'};
 return <main className='pc-canonical-public pc-cp-page-deal-flow p7-deal-flow-page'>
  <CanonicalPublicHeader locale={locale}/>
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

      <CanonicalStateLens locale={locale} state='normal' happened={c.state[0]} actor={c.state[1]} basis={c.state[2]} settlement={c.state[3]} next={c.state[4]}/>

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
