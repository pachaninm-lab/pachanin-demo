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

const META={"ru":["Возможности — Прозрачная Цена","Возможности платформы по всей цепочке агросделки: рынок, торги, исполнение, качество, документы, расчёт, спор, доверие и Гекта."],"en":["Capabilities — Transparent Price","Platform capabilities across the agricultural Deal: market, trading, execution, quality, documents, settlement, dispute, trust and Gekta."],"zh":["功能 — 透明价格","覆盖整笔农业交易的能力：市场、交易、履约、质量、文件、结算、争议、信任与 Gekta。"]} as const;

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
ru:{e:'Возможности',t:'Все этапы Сделки — в одном рабочем процессе',p:'Рынок, исполнение, документы, расчёт и закрытие связаны между собой. Данные не теряются при переходе между этапами.',items:{
market:['Рынок','Обезличенные данные опубликованных лотов.'],trading:['Торги','Торги и выбор контрагента остаются частью конкретной Сделки.'],commitments:['Обязательства','Условия и ответственность сторон остаются связаны с исполнением.'],delivery:['Доставка','Логист и водитель работают только с доступными им данными Сделки.'],acceptance:['Приёмка / качество','Результаты приёмки и качества влияют на дальнейшие действия.'],documents:['Документы','Документы и события остаются привязаны к Сделке на всех этапах.'],settlement:['Документы / расчёт','Действия по расчёту доступны только при подтверждённом основании.'],dispute:['Закрытие / спор','Отклонение и спор разбираются по фактам, документам и основаниям.'],trust:['Доверие','Для важного действия видны полномочия, основание, источник и решение.'],gekta:['Гекта','Помогает понять состояние Сделки, риски и возможные дальнейшие действия.'],roles:['9 ролей','Права определяются сервером после проверки роли и организации.'],history:['История Сделки','История связывает действия и решения с фактами и участниками.']},cta:'Начать регистрацию',more:'Как проходит Сделка'},
en:{e:'Capabilities',t:'Every Deal stage in one working flow',p:'Market, execution, documents, settlement and closure stay connected. Data is not lost between stages.',items:{
market:['Market','Anonymised data from published lots.'],trading:['Trading','Trading and counterparty selection stay part of the Deal.'],commitments:['Commitments','Terms and responsibilities remain tied to execution.'],delivery:['Delivery','Logistics and the driver work only with Deal data available to them.'],acceptance:['Acceptance / quality','Acceptance and quality results affect what happens next.'],documents:['Documents','Documents and events remain tied to the Deal across stages.'],settlement:['Documents / settlement','Settlement actions are available only when there is confirmed basis.'],dispute:['Closure / dispute','Deviation and dispute are reviewed against facts, documents and evidence.'],trust:['Trust','Authority, basis, source and decision remain visible for important actions.'],gekta:['Gekta','Helps users understand Deal state, risk and possible next actions.'],roles:['9 roles','Rights are assigned by the server after role and organisation checks.'],history:['Deal history','History links actions and decisions to facts and participants.']},cta:'Register',more:'How the Deal works'},
zh:{e:'功能',t:'整笔交易在一个工作流程中',p:'市场、履约、文件、结算和关闭保持关联，阶段切换时数据不会丢失。',items:{
market:['市场','已发布批次的公共匿名投影。'],trading:['交易','交易和交易方选择结果始终与具体交易关联。'],commitments:['义务','条件和责任成为履约的一部分。'],delivery:['交付','物流和司机只处理其获准查看的交易数据。'],acceptance:['验收 / 质量','验收事实和质量影响后续履约。'],documents:['文件','文件和事件在各阶段始终与具体交易关联。'],settlement:['文件 / 结算','金融步骤取决于已确认依据。'],dispute:['关闭 / 争议','偏差和争议根据事实与依据处理。'],trust:['信任','重要操作会显示权限、依据、来源和决定。'],gekta:['Gekta','帮助理解交易状态、风险和可能的下一步。'],roles:['9 个角色','角色和机构审核完成后，由服务器确定访问权限。'],history:['交易历史','历史记录把操作和决定与事实及参与方关联起来。']},cta:'注册',more:'交易如何进行'},
} as const;

export default async function CapabilitiesPage(){
 const locale=canonicalPublicLocale(await getLocale()); const c=COPY[locale];
 return <main className='pc-canonical-public'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/capabilities'/>
  <section className='pc-cp-hero' style={{minHeight:460}}>
   <div className='pc-cp-container pc-cp-hero-grid'>
    <div className='pc-cp-hero-copy'><span className='pc-cp-eyebrow'>{c.e}</span><h1 style={{maxWidth:'14ch'}}>{c.t}</h1><p>{c.p}</p><div className='pc-cp-actions'><Link className='pc-cp-button' href={`/platform-v7/register?lang=${locale}`}>{c.cta}<ArrowRight size={16}/></Link><Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/how-it-works?lang=${locale}`}>{c.more}</Link></div></div>
    <div className='pc-cp-card pc-cp-state-shell'><CanonicalDealSpine locale={locale} currentIndex={0}/></div>
   </div>
  </section>
  <section className='pc-cp-section'><div className='pc-cp-container'><div className='pc-cp-capabilities'>
   {CAPABILITIES.map(([Icon,key])=>{const [title,text]=c.items[key];return <article className='pc-cp-card pc-cp-capability' key={key}><Icon size={22}/><strong>{title}</strong><p>{text}</p></article>})}
  </div></div></section>
  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'><div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Доверие':locale==='en'?'Trust':'信任'}</span><h2>{locale==='ru'?'Одинаковые правила на каждом этапе':locale==='en'?'The same rules at every stage':'所有功能共享同一控制原则'}</h2></div><CanonicalTrustLedger locale={locale}/></div></section>
  <section className='pc-cp-section pc-cp-section--tight'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale}/>
 </main>;
}
