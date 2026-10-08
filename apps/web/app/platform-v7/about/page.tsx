import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileText, ShieldCheck, UsersRound } from 'lucide-react';
import { getLocale } from 'next-intl/server';
import {
  CANONICAL_ROLES,
  CanonicalBottomNav,
  CanonicalDealSpine,
  CanonicalFooter,
  CanonicalGektaStrip,
  CanonicalPublicHeader,
  CanonicalTrustLedger,
  canonicalPublicLocale,
} from '@/components/platform-v7/PublicCanonicalPrimitives';

const COPY={
ru:{
 title:'О платформе — Прозрачная Цена',
 description:'Для продавцов, покупателей и участников исполнения агросделки: предложения, условия, доставка, качество, документы и расчёт в одном рабочем пространстве.',
 eyebrow:'О платформе',heading:'Продажа, закупка и исполнение — в одной сделке',
 lead:'Продавец и покупатель согласуют условия. Участники доставки, приёмки и проверки качества выполняют свои задачи. В сделке сохраняются документы, ответственные и следующий шаг.',
 what:'Что объединяет платформа',cards:[
 ['Одна сделка','Товар, торги, обязательства, доставка, качество, документы, расчёт и закрытие остаются связанными.'],
 ['9 ролей','Участник видит только данные и действия, доступные его роли и организации.'],
 ['7 этапов','От предложения до закрытия или разбора расхождений — с понятной задачей на каждом этапе.'],
 ['История решений','Важные действия связаны с участником, условием или документом. Можно вернуться к их основанию.'],
 ],
 roles:'Кто участвует в сделке',trust:'Понятно, что согласовано и кто отвечает',legal:'Правила и документы',
 legalText:'Условия использования платформы, обработка персональных данных и документы для ознакомления.',
 register:'Подать заявку',contact:'Связаться с нами',how:'Как проходит сделка',
 application:'Подайте заявку на подключение организации. После проверки заявки мы сообщим о доступе.'
},
en:{
 title:'About the platform — Transparent Price',
 description:'For sellers, buyers and agricultural Deal participants: offers, terms, delivery, quality, documents and settlement in one workspace.',
 eyebrow:'About the platform',heading:'Selling, buying and execution — in one Deal',
 lead:'The seller and buyer agree terms. Delivery, acceptance and quality participants handle their tasks. The Deal keeps documents, responsibilities and the next step together.',
 what:'What the platform connects',cards:[
 ['One Deal','Product, trading, commitments, delivery, quality, documents, settlement and closure remain connected.'],
 ['9 roles','A participant sees only the data and actions allowed for their role and organisation.'],
 ['7 stages','From an offer to closure or a review of discrepancies, with a clear task at each stage.'],
 ['Decision history','Important actions are linked to a participant, condition or document, so their basis can be checked.'],
 ],
 roles:'Who participates in the Deal',trust:'Know what is agreed and who is responsible',legal:'Rules and documents',
 legalText:'Platform terms, personal data handling and documents to review.',
 register:'Apply for access',contact:'Contact us',how:'How the Deal works',
 application:'Apply to connect your organisation. We will let you know about access after reviewing the application.'
},
zh:{
 title:'关于平台 — 透明价格',
 description:'面向卖方、买方及农业交易履约参与方：报价、条款、交付、质量、文件与结算汇集于同一工作区。',
 eyebrow:'关于平台',heading:'销售、采购与履约，贯穿同一笔交易',
 lead:'卖方与买方约定条款，交付、验收和质量检查参与方完成各自的任务。交易中保留相关文件、责任分工及下一步。',
 what:'平台连接什么',cards:[
 ['一笔交易','商品、交易、义务、交付、质量、文件、结算和关闭保持关联。'],
 ['9 个角色','参与方只看到其角色和机构允许的数据与操作。'],
 ['7 个阶段','从供求信息到交易关闭或差异处理，每个阶段都有明确的任务。'],
 ['决定历史','重要操作关联到参与方、条件或文件，以便核查其依据。'],
 ],
 roles:'谁参与交易',trust:'了解已约定的事项及责任分工',legal:'规则与文件',
 legalText:'查阅平台使用条款、个人数据处理规则及相关文件。',
 register:'申请接入',contact:'联系我们',how:'交易如何进行',
 application:'请提交机构接入申请。审核申请后，我们会通知您访问权限的情况。'
}} as const;

export async function generateMetadata():Promise<Metadata>{
 const locale=canonicalPublicLocale(await getLocale());const c=COPY[locale];
 return {title:c.title,description:c.description,alternates:{canonical:'/platform-v7/about',languages:{ru:'/platform-v7/about?lang=ru',en:'/platform-v7/about?lang=en',zh:'/platform-v7/about?lang=zh'}},robots:{index:true,follow:true}};
}

export default async function AboutPage(){
 const locale=canonicalPublicLocale(await getLocale());const c=COPY[locale];
 return <main className='pc-canonical-public p7-about-page'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/about'/>
  <section className='pc-cp-hero' style={{minHeight:'auto'}}>
   <div className='pc-cp-container pc-cp-hero-grid'>
    <div className='pc-cp-hero-copy' style={{minHeight:'auto'}}>
      <span className='pc-cp-eyebrow'>{c.eyebrow}</span><h1>{c.heading}</h1><p>{c.lead}</p>
      <div className='pc-cp-actions'><Link className='pc-cp-button' href={`/platform-v7/register?lang=${locale}`}>{c.register}<ArrowRight size={16} aria-hidden='true'/></Link><Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/how-it-works?lang=${locale}`}>{c.how}</Link></div>
      <p>{c.application}</p>
    </div>
    <aside className='pc-cp-card pc-cp-state-shell'><CanonicalDealSpine locale={locale} currentIndex={null}/></aside>
   </div>
  </section>

  <section className='pc-cp-section'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><h2>{c.what}</h2></div>
    <div className='pc-cp-trust-grid'>
      {c.cards.map(([title,text],index)=>{const Icon=[CheckCircle2,UsersRound,FileText,ShieldCheck][index]!;return <article className='pc-cp-card pc-cp-trust-card' key={title}><i><Icon size={16} aria-hidden='true'/></i><strong>{title}</strong><p>{text}</p></article>})}
    </div>
  </div></section>

  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><h2>{c.roles}</h2></div>
    <div className='pc-cp-hero-proof'>{CANONICAL_ROLES[locale].map(role=><span key={role}>{role}</span>)}</div>
  </div></section>

  <section className='pc-cp-section'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><h2>{c.trust}</h2></div>
    <CanonicalTrustLedger locale={locale}/>
  </div></section>

  <section className='pc-cp-section pc-cp-section--tight'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>

  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><h2>{c.legal}</h2><p>{c.legalText}</p></div>
    <div className='pc-cp-actions'>
      <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/privacy?lang=${locale}`}>{locale==='ru'?'Конфиденциальность':locale==='en'?'Privacy':'隐私'}</Link>
      <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/terms?lang=${locale}`}>{locale==='ru'?'Условия':locale==='en'?'Terms':'条款'}</Link>
      <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/docs?lang=${locale}`}>{locale==='ru'?'Документы':locale==='en'?'Documents':'文件'}</Link>
      <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/contact?lang=${locale}`}>{c.contact}</Link>
    </div>
  </div></section>

  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale}/>
 </main>;
}
