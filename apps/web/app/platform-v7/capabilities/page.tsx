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

export const metadata:Metadata={
  title:'Возможности — Прозрачная Цена',
  description:'Возможности платформы по всей цепочке агросделки: рынок, торги, исполнение, качество, документы, расчёт, спор, доверие и Гекта.',
  alternates:{canonical:'/platform-v7/capabilities'},
  robots:{index:true,follow:true},
};

const COPY={
ru:{e:'Возможности',t:'Вся Сделка — в одном рабочем контуре',p:'Не каталог функций ради функций, а связная последовательность: от публичного лота до исполнения, документов, расчёта и закрытия.',items:{
market:['Рынок','Публичная обезличенная проекция опубликованных лотов.'],trading:['Торги','Торги и результат выбора контрагента остаются связаны с конкретной Сделкой.'],commitments:['Обязательства','Условия и ответственность сторон становятся частью исполнения.'],delivery:['Доставка','Логистика и водитель работают в разрешённом им контексте.'],acceptance:['Приёмка / качество','Факт приёмки и качество влияют на дальнейшее исполнение.'],documents:['Документы','Связанные документы и события не теряются между этапами.'],settlement:['Документы / расчёт','Финансовый шаг зависит от подтверждённого основания.'],dispute:['Закрытие / спор','Отклонение и спор разбираются по фактам и основаниям.'],trust:['Доверие','Полномочия, основание, источник и решение — единая модель контроля.'],gekta:['Гекта','Объясняет контекст, риск и следующий допустимый шаг.'],roles:['9 ролей','Ролевые границы задаются сервером, а не публичным выбором интерфейса.'],history:['История Сделки','Действия и решения сохраняют связь с фактом и участником.']},cta:'Начать регистрацию',more:'Как проходит Сделка'},
en:{e:'Capabilities',t:'The whole Deal in one working flow',p:'Not a feature catalogue for its own sake, but a connected sequence from public lot through execution, documents, settlement and closure.',items:{
market:['Market','Public anonymised projection of published lots.'],trading:['Trading','Trading and counterparty selection outcome stay tied to the Deal.'],commitments:['Commitments','Terms and responsibilities become part of execution.'],delivery:['Delivery','Logistics and driver operate in their authorised context.'],acceptance:['Acceptance / quality','Acceptance facts and quality affect further execution.'],documents:['Documents','Documents and events stay connected between stages.'],settlement:['Documents / settlement','The financial step depends on confirmed basis.'],dispute:['Closure / dispute','Deviation and dispute are reviewed through facts and evidence.'],trust:['Trust','Authority, basis, source and decision form one control model.'],gekta:['Gekta','Explains context, risk and the next permitted step.'],roles:['9 roles','Role boundaries come from the server, never from a public UI choice.'],history:['Deal history','Actions and decisions stay linked to fact and participant.']},cta:'Register',more:'How the Deal works'},
zh:{e:'功能',t:'整笔交易在一个工作流程中',p:'不是孤立功能清单，而是从公开批次到履约、文件、结算和关闭的连续流程。',items:{
market:['市场','已发布批次的公共匿名投影。'],trading:['交易','交易和交易方选择结果始终与具体交易关联。'],commitments:['义务','条件和责任成为履约的一部分。'],delivery:['交付','物流和司机在各自授权上下文中工作。'],acceptance:['验收 / 质量','验收事实和质量影响后续履约。'],documents:['文件','文件和事件在各阶段之间保持关联。'],settlement:['文件 / 结算','金融步骤取决于已确认依据。'],dispute:['关闭 / 争议','偏差和争议根据事实与依据处理。'],trust:['信任','权限、依据、来源和决定构成统一控制模型。'],gekta:['Gekta','解释上下文、风险和允许的下一步。'],roles:['9 个角色','角色边界来自服务器，而不是公开界面选择。'],history:['交易历史','操作和决定始终与事实和参与方关联。']},cta:'注册',more:'交易如何进行'},
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
