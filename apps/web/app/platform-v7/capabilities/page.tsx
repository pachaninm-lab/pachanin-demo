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
ru:{e:'Возможности',t:'Этапы Сделки связаны между собой',p:'Рынок, торги, доставка, качество, документы и расчёт остаются частью одной Сделки. Видно, что уже произошло, что ещё требует подтверждения и кто действует дальше.',items:{
market:['Рынок','Публичные обезличенные лоты с понятным переходом к Сделке.'],trading:['Торги','Результат торгов сразу остаётся связан с выбранным контрагентом и Сделкой.'],commitments:['Обязательства','Условия и ответственность сторон становятся частью исполнения.'],delivery:['Доставка','Логистика и водитель видят свои задачи, сроки и связанные события в общем контуре.'],acceptance:['Приёмка / качество','Факт приёмки и качество влияют на дальнейшее исполнение.'],documents:['Документы','Документы и события остаются привязаны к Сделке и не теряются между этапами.'],settlement:['Документы / расчёт','Финансовый шаг зависит от подтверждённого основания.'],dispute:['Закрытие / спор','Отклонение и спор разбираются по фактам и основаниям.'],trust:['Доверие','Понятно, кто действовал, на каком основании и какое решение было зафиксировано.'],gekta:['Гекта','Объясняет контекст, риск и следующий допустимый шаг.'],roles:['9 ролей','Каждый участник видит только те данные и действия, которые соответствуют его полномочиям.'],history:['История Сделки','Действия и решения сохраняют связь с фактом и участником.']},cta:'Начать регистрацию',more:'Как проходит Сделка'},
en:{e:'Capabilities',t:'Each Deal stage stays connected to the next',p:'Market, trading, delivery, quality, documents and settlement stay attached to the same Deal. You can see what has happened, what still needs confirmation and who acts next.',items:{
market:['Market','Public anonymised lots with a clear path into a Deal.'],trading:['Trading','The trading result stays tied to the selected counterparty and the Deal.'],commitments:['Commitments','Terms and responsibilities become part of execution.'],delivery:['Delivery','Logistics and drivers see their tasks, timing and related events inside the shared Deal flow.'],acceptance:['Acceptance / quality','Acceptance facts and quality affect further execution.'],documents:['Documents','Documents and events remain attached to the Deal instead of getting lost between stages.'],settlement:['Documents / settlement','The financial step depends on confirmed basis.'],dispute:['Closure / dispute','Deviation and dispute are reviewed through facts and evidence.'],trust:['Trust','You can see who acted, why, and which decision was recorded.'],gekta:['Gekta','Explains context, risk and the next permitted step.'],roles:['9 roles','Each participant sees only the data and actions allowed by their authority.'],history:['Deal history','Actions and decisions stay linked to fact and participant.']},cta:'Register',more:'How the Deal works'},
zh:{e:'功能',t:'交易各阶段前后相连',p:'市场、交易、交付、质量、文件和结算始终属于同一笔交易，因此可以看到已经发生什么、还有什么待确认、下一步由谁处理。',items:{
market:['市场','公开匿名批次，并清楚进入具体交易。'],trading:['交易','交易结果始终与所选交易方和具体交易关联。'],commitments:['义务','条件和责任成为履约的一部分。'],delivery:['交付','物流和司机在统一交易流程中看到自己的任务、时间和相关事件。'],acceptance:['验收 / 质量','验收事实和质量影响后续履约。'],documents:['文件','文件和事件始终与交易关联，不会在阶段切换时丢失。'],settlement:['文件 / 结算','金融步骤取决于已确认依据。'],dispute:['关闭 / 争议','偏差和争议根据事实与依据处理。'],trust:['信任','可以看到谁做了什么、依据是什么，以及记录了什么决定。'],gekta:['Gekta','解释上下文、风险和允许的下一步。'],roles:['9 个角色','每个参与方只看到其权限允许的数据和操作。'],history:['交易历史','操作和决定始终与事实和参与方关联。']},cta:'注册',more:'交易如何进行'},
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
  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'><div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Доверие':locale==='en'?'Trust':'信任'}</span><h2>{locale==='ru'?'Полномочия и основания проверяются на каждом этапе':locale==='en'?'Authority and basis are checked at every stage':'每个阶段都核验权限和依据'}</h2></div><CanonicalTrustLedger locale={locale}/></div></section>
  <section className='pc-cp-section pc-cp-section--tight'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale}/>
 </main>;
}
