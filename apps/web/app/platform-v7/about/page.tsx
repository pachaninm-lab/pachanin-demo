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
 description:'Прозрачная Цена связывает участников и весь путь агросделки: лот, торги, обязательства, доставка, приёмка, качество, документы, расчёт и закрытие.',
 eyebrow:'О платформе',heading:'Одна система — от рынка до закрытия Сделки.',
 lead:'«Прозрачная Цена» связывает рынок, исполнение, качество, документы и расчёт в одной Сделке. Каждый участник видит свой рабочий контур, а важные действия остаются привязаны к фактам, полномочиям и основаниям.',
 domain:'Процент-Агро.рф — публичный домен платформы «Прозрачная Цена».',
 what:'Что объединяет платформа',cards:[
 ['Одна Сделка','Товар, торги, обязательства, доставка, качество, документы, расчёт и закрытие остаются связанными.'],
 ['9 ролей','Каждый участник видит только те задачи и данные, которые нужны его роли и подтверждённым полномочиям.'],
 ['7 этапов','Один и тот же путь — от лота до закрытия; меняются только ответственный, доступные действия и факты.'],
 ['Проверяемые факты','Если источник недоступен или факт ещё не подтверждён, платформа говорит об этом прямо и не подставляет примерные данные.'],
 ],
 roles:'9 ролей в одной Сделке',trust:'Как устроено доверие',legal:'Правила и документы',
 legalText:'Правила, условия и политика конфиденциальности вынесены отдельно, чтобы рабочий экран Сделки оставался понятным и не смешивал справочную информацию с действиями.',
 register:'Регистрация',contact:'Контакты',how:'Как проходит Сделка'
},
en:{
 title:'About the platform — Transparent Price',
 description:'Transparent Price connects participants and the full agricultural Deal path: lot, trading, commitments, delivery, acceptance, quality, documents, settlement and closure.',
 eyebrow:'About the platform',heading:'One system from market to Deal closure.',
 lead:'Transparent Price connects market, execution, quality, documents and settlement in one Deal. Each participant sees a focused workspace, while important actions stay tied to facts, authority and evidence.',
 domain:'Процент-Агро.рф is the public domain of the Transparent Price platform.',
 what:'What the platform connects',cards:[
 ['One Deal','Product, trading, commitments, delivery, quality, documents, settlement and closure remain connected.'],
 ['9 roles','Each participant sees only the tasks and data required by their role and confirmed authority.'],
 ['7 stages','The path stays the same from lot to closure; only the responsible participant, available actions and facts change.'],
 ['Verifiable facts','If a source is unavailable or a fact is not confirmed yet, the platform says so plainly instead of filling the gap with sample data.'],
 ],
 roles:'9 roles in one Deal',trust:'How trust works',legal:'Rules and documents',
 legalText:'Rules, terms and privacy information stay on separate pages so the Deal workspace remains focused on the work participants need to do.',
 register:'Register',contact:'Contact',how:'How the Deal works'
},
zh:{
 title:'关于平台 — 透明价格',
 description:'透明价格把参与方和农业交易完整路径连接起来：批次、交易、义务、交付、验收、质量、文件、结算与关闭。',
 eyebrow:'关于平台',heading:'一套系统，从市场一直到交易关闭。',
 lead:'“透明价格”把市场、履约、质量、文件和结算连接在同一笔交易中。每个参与方都有清晰的工作区，重要操作始终与事实、权限和依据关联。',
 domain:'Процент-Агро.рф 是“透明价格”平台的公开域名。',
 what:'平台连接什么',cards:[
 ['一笔交易','商品、交易、义务、交付、质量、文件、结算和关闭保持关联。'],
 ['9 个角色','每个参与方只看到其角色和已确认权限所需的任务与数据。'],
 ['7 个阶段','从批次到关闭使用同一条交易路径；变化的是责任方、可用操作和事实。'],
 ['可核验事实','来源不可用或事实尚未确认时，平台会直接说明，不会用示例数据填补空缺。'],
 ],
 roles:'一笔交易中的 9 个角色',trust:'信任如何工作',legal:'规则与文件',
 legalText:'法律和信息材料放在独立页面；交易工作区不会把这些内容与参与方操作混在一起。',
 register:'注册',contact:'联系',how:'交易如何进行'
}} as const;

export async function generateMetadata():Promise<Metadata>{
 const locale=canonicalPublicLocale(await getLocale());const c=COPY[locale];
 return {title:c.title,description:c.description,alternates:{canonical:'/platform-v7/about',languages:{ru:'/platform-v7/about?lang=ru',en:'/platform-v7/about?lang=en',zh:'/platform-v7/about?lang=zh'}},robots:{index:true,follow:true}};
}

export default async function AboutPage(){
 const locale=canonicalPublicLocale(await getLocale());const c=COPY[locale];
 return <main className='pc-canonical-public p7-about-page'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/about'/>
  <section className='pc-cp-hero' style={{minHeight:520}}>
   <div className='pc-cp-container pc-cp-hero-grid'>
    <div className='pc-cp-hero-copy'>
      <span className='pc-cp-eyebrow'>{c.eyebrow}</span><h1>{c.heading}</h1><p>{c.lead}</p><small style={{color:'var(--pc-cp-muted)'}}>{c.domain}</small>
      <div className='pc-cp-actions'><Link className='pc-cp-button' href={`/platform-v7/register?lang=${locale}`}>{c.register}<ArrowRight size={16}/></Link><Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/how-it-works?lang=${locale}`}>{c.how}</Link></div>
    </div>
    <aside className='pc-cp-card pc-cp-state-shell'><CanonicalDealSpine locale={locale} currentIndex={0}/></aside>
   </div>
  </section>

  <section className='pc-cp-section'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.what}</span><h2>{c.what}</h2></div>
    <div className='pc-cp-trust-grid'>
      {c.cards.map(([title,text],index)=>{const Icon=[CheckCircle2,UsersRound,FileText,ShieldCheck][index]!;return <article className='pc-cp-card pc-cp-trust-card' key={title}><i><Icon size={16}/></i><strong>{title}</strong><p>{text}</p></article>})}
    </div>
  </div></section>

  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.roles}</span><h2>{c.roles}</h2></div>
    <div className='pc-cp-hero-proof'>{CANONICAL_ROLES[locale].map(role=><span key={role}>{role}</span>)}</div>
  </div></section>

  <section className='pc-cp-section'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.trust}</span><h2>{c.trust}</h2></div>
    <CanonicalTrustLedger locale={locale}/>
  </div></section>

  <section className='pc-cp-section pc-cp-section--tight'><div className='pc-cp-container'><CanonicalGektaStrip locale={locale}/></div></section>

  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'>
    <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.legal}</span><h2>{c.legal}</h2><p>{c.legalText}</p></div>
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
