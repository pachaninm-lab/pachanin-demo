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
ru:{e:'Возможности',t:'Что платформа связывает в одной Сделке',p:'Рынок, торги, исполнение, документы и расчёт связаны одной Сделкой; данные и права не теряются между этапами.',items:{
market:['Рынок','Обезличенные опубликованные лоты без закрытых данных продавца.'],trading:['Торги','Ставки и выбранный контрагент остаются привязаны к конкретной Сделке.'],commitments:['Обязательства','Условия и ответственность сторон становятся частью исполнения.'],delivery:['Доставка','Логистика и водитель видят только доступные им данные и действия.'],acceptance:['Приёмка / качество','Факт приёмки и качество влияют на дальнейшее исполнение.'],documents:['Документы','Связанные документы и события не теряются между этапами.'],settlement:['Документы / расчёт','Финансовый шаг зависит от подтверждённого основания.'],dispute:['Закрытие / спор','Отклонение и спор разбираются по фактам и основаниям.'],trust:['Доверие','Полномочия, основание, источник и решение — единая модель контроля.'],gekta:['Гекта','Помогает разобраться в фактах, рисках и следующем доступном действии.'],roles:['9 ролей','Права роли задаёт сервер; выбор роли на публичной странице ничего не меняет.'],history:['История Сделки','Действия и решения сохраняют связь с фактом и участником.']},cta:'Начать регистрацию',more:'Как проходит Сделка'},
en:{e:'Capabilities',t:'What the platform connects in one Deal',p:'Market, trading, execution, documents and settlement stay tied to the same Deal, so data and permissions do not disappear between stages.',items:{
market:['Market','Published anonymised lots without private seller data.'],trading:['Trading','Bids and the selected counterparty stay tied to the specific Deal.'],commitments:['Commitments','Terms and responsibilities become part of execution.'],delivery:['Delivery','Logistics and driver see only the data and actions available to their roles.'],acceptance:['Acceptance / quality','Acceptance facts and quality affect further execution.'],documents:['Documents','Documents and events stay connected between stages.'],settlement:['Documents / settlement','The financial step depends on confirmed basis.'],dispute:['Closure / dispute','Deviation and dispute are reviewed through facts and evidence.'],trust:['Trust','Authority, basis, source and decision form one control model.'],gekta:['Gekta','Helps make sense of facts, risks and the next available action.'],roles:['9 roles','Role permissions come from the server; choosing a role on a public page changes nothing.'],history:['Deal history','Actions and decisions stay linked to fact and participant.']},cta:'Register',more:'How the Deal works'},
zh:{e:'功能',t:'平台如何连接整笔交易',p:'市场、交易、履约、文件和结算始终关联同一笔交易，数据和权限不会在阶段切换时丢失。',items:{
market:['市场','已发布的匿名批次，不展示卖方私有数据。'],trading:['交易','报价和选定交易方始终与具体交易关联。'],commitments:['义务','条件和责任成为履约的一部分。'],delivery:['交付','物流和司机只看到各自角色允许的数据和操作。'],acceptance:['验收 / 质量','验收事实和质量影响后续履约。'],documents:['文件','文件和事件在各阶段之间保持关联。'],settlement:['文件 / 结算','金融步骤取决于已确认依据。'],dispute:['关闭 / 争议','偏差和争议根据事实与依据处理。'],trust:['信任','权限、依据、来源和决定构成统一控制模型。'],gekta:['Gekta','帮助理解事实、风险和下一步可执行操作。'],roles:['9 个角色','角色权限由服务器决定；公开页面选择角色不会改变权限。'],history:['交易历史','操作和决定始终与事实和参与方关联。']},cta:'注册',more:'交易如何进行'},
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
  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'><div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Доверие':locale==='en'?'Trust':'信任'}</span><h2>{locale==='ru'?'Один контрольный принцип для каждой возможности':locale==='en'?'One control principle across every capability':'所有功能共享同一控制原则'}</h2></div><CanonicalTrustLedger locale={locale}/></div></section>
  <section className='pc-cp-section pc-cp-section--tight'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale}/>
 </main>;
}
