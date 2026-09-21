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
 eyebrow:'О платформе',heading:'Одна Сделка — один рабочий процесс.',
 lead:'«Прозрачная Цена» связывает рынок и исполнение в одной Сделке. Каждый участник видит только доступные ему данные и действия, а критические шаги можно проверить по роли, документам и источнику факта.',
 domain:'Процент-Агро.рф — публичный домен платформы «Прозрачная Цена».',
 what:'Что объединяет платформа',cards:[
 ['Одна Сделка','Товар, торги, обязательства, доставка, качество, документы, расчёт и закрытие остаются связанными.'],
 ['9 ролей','Каждый участник видит только те данные и действия, которые разрешены его подтверждённой роли.'],
 ['7 этапов','Публичная схема и рабочий экран используют одни и те же этапы; после входа меняются только доступные данные и действия.'],
 ['Контроль фактов','Если источник недоступен или факт не подтверждён, интерфейс показывает это явно и не подменяет значение.'],
 ],
 roles:'9 канонических ролей',trust:'Как устроено доверие',legal:'Правила и документы',
 legalText:'Юридические и информационные материалы вынесены в отдельные страницы. Рабочий интерфейс Сделки не смешивает их с действиями участников.',
 register:'Регистрация',contact:'Контакты',how:'Как проходит Сделка'
},
en:{
 title:'About the platform — Transparent Price',
 description:'Transparent Price connects participants and the full agricultural Deal path: lot, trading, commitments, delivery, acceptance, quality, documents, settlement and closure.',
 eyebrow:'About the platform',heading:'One Deal, one working process.',
 lead:'Transparent Price connects market and execution in one Deal. Each participant sees only the data and actions available to their role, while critical steps can be checked against permissions, documents and source facts.',
 domain:'Процент-Агро.рф is the public domain of the Transparent Price platform.',
 what:'What the platform connects',cards:[
 ['One Deal','Product, trading, commitments, delivery, quality, documents, settlement and closure remain connected.'],
 ['9 roles','Each participant sees only the data and actions allowed by their confirmed role.'],
 ['7 stages','The public explanation and the workspace use the same stages; after sign-in, only available data and actions change.'],
 ['Fact control','When a source is unavailable or a fact is unconfirmed, the interface states that explicitly instead of substituting a value.'],
 ],
 roles:'9 canonical roles',trust:'How trust works',legal:'Rules and documents',
 legalText:'Legal and information materials remain on separate pages. The Deal workspace does not mix them with participant actions.',
 register:'Register',contact:'Contact',how:'How the Deal works'
},
zh:{
 title:'关于平台 — 透明价格',
 description:'透明价格把参与方和农业交易完整路径连接起来：批次、交易、义务、交付、验收、质量、文件、结算与关闭。',
 eyebrow:'关于平台',heading:'一笔交易，一个工作流程。',
 lead:'“透明价格”把市场和履约连接在同一笔交易中。每个参与方只看到本角色允许的数据和操作，关键步骤都能按权限、文件和事实来源核验。',
 domain:'Процент-Агро.рф 是“透明价格”平台的公开域名。',
 what:'平台连接什么',cards:[
 ['一笔交易','商品、交易、义务、交付、质量、文件、结算和关闭保持关联。'],
 ['9 个角色','每个参与方只看到已确认角色允许的数据和操作。'],
 ['7 个阶段','公开说明和工作区使用相同阶段；登录后只会改变可见数据和可执行操作。'],
 ['事实控制','当来源不可用或事实未确认时，界面会明确说明，而不是用替代值冒充。'],
 ],
 roles:'9 个规范角色',trust:'信任如何工作',legal:'规则与文件',
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
