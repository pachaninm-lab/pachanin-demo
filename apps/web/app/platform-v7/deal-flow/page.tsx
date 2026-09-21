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

const META={"ru":["Сделка в работе — Прозрачная Цена","Рабочий экран связывает этап, ответственного, основание, расчёт и следующий шаг в одной Сделке."],"en":["Deal in progress — Transparent Price","The workspace connects stage, responsible participant, basis, settlement and the next step in one Deal."],"zh":["进行中的交易 — 透明价格","工作区把阶段、责任方、依据、结算和下一步连接在同一笔交易中。"]} as const;

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
 ?{e:'Сделка в работе',t:'Статус, ответственный и следующий шаг — в одном экране',p:'Публичная страница показывает, как устроен рабочий экран. После входа подставляются только данные Сделки, доступные конкретному участнику.',h:'Что показывает рабочий экран',lead:'Платформа показывает, что влияет на расчёт и почему; финансовый статус нельзя назначить вручную.',state:['Фактическое состояние Сделки','Ответственный участник с подтверждёнными полномочиями','Факт, условие или документ, на котором основано действие','Подтверждённое влияние на расчёт','Доступное действие для текущей роли'],login:'Войти',how:'Как проходит Сделка'}
 :locale==='en'
 ?{e:'Deal workspace',t:'Status, owner and next step in one screen',p:'This public page shows how the workspace is structured. After sign-in, it uses only Deal data available to that participant.',h:'What the workspace shows',lead:'The platform shows what affects settlement and why; financial status cannot be assigned manually.',state:['Actual state of the Deal','Responsible participant with confirmed authority','Fact, condition or document supporting the action','Confirmed settlement impact','Available action for the current role'],login:'Sign in',how:'How the Deal works'}
 :{e:'交易工作区',t:'状态、责任方和下一步都在一个页面',p:'公开页面展示工作区结构；登录后，只使用当前参与方有权查看的交易数据。',h:'工作区展示什么',lead:'平台展示什么影响结算以及原因；金融状态不能手动指定。',state:['交易的真实状态','具有已确认权限的责任方','支持该操作的事实、条件或文件','已确认的结算影响','当前角色可执行的操作'],login:'登录',how:'交易如何进行'};
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
          <span><small>{locale==='ru'?'Статус':locale==='en'?'Status':'状态'}</small><strong>{locale==='ru'?'Подтверждён':locale==='en'?'Confirmed':'已确认'}</strong></span>
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
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Проверяемые факты':locale==='en'?'Verifiable facts':'可核验事实'}</span><h2>{locale==='ru'?'Понятно, кто и на каком основании действует':locale==='en'?'Clear who acts and why':'清楚谁在操作、依据是什么'}</h2></div>
    <CanonicalTrustLedger locale={locale}/>
  </div></section>
  <section className='pc-cp-deal-public-gekta'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale}/>
 </main>;
}
