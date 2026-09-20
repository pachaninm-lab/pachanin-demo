import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Bot, FileCheck2, Route, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import { getLocale } from 'next-intl/server';
import {
  CanonicalBottomNav,
  CanonicalFooter,
  CanonicalPublicHeader,
  canonicalPublicLocale,
} from '@/components/platform-v7/PublicCanonicalPrimitives';

export const metadata:Metadata={
  title:'Гекта — Прозрачная Цена',
  description:'Гекта объясняет контекст Сделки, документы, логистику, качество, расчёт, риски и допустимый следующий шаг в пределах доступных фактов и полномочий.',
  alternates:{canonical:'/platform-v7/ai-in-action'},robots:{index:true,follow:true},
};

const COPY={
ru:{
 e:'Гекта AI',t:'Контекст Сделки — в одном окне.',p:'Гекта собирает уже доступные участнику факты в понятный контекст: где находится Сделка, что блокирует следующий шаг, какое основание важно и кому нужно действовать. Критическое решение остаётся за человеком и правилами платформы.',
 context:'Контекст Сделки',contextItems:['Стадия и доступные факты','Документы и основания','Логистика и приёмка','Качество и исключения','Финансовые блокеры','История решений'],
 ask:'Что нужно понять сейчас?',cards:[
 ['Что происходит','Свести подтверждённые факты Сделки и показать текущее состояние без выдуманных live-данных.'],
 ['Что блокирует','Объяснить подтверждённый блокер и связанную с ним роль, документ или событие.'],
 ['Какое основание','Показать, на какой источник и условие опирается допустимое действие.'],
 ['Кто действует дальше','Определить следующего ответственного в пределах серверно подтверждённых полномочий.'],
 ],sources:'Источники и границы',sourceRows:[
 ['Сделка','Только контекст, доступный текущему участнику'],
 ['Документы','Только связанные и разрешённые к чтению данные'],
 ['Внешние системы','Только при фактическом подтверждённом источнике'],
 ['Решение','Гекта объясняет; критическое действие не исполняет самостоятельно'],
 ],prompt:'Спроси про контекст, риск или следующий шаг',trust:'Открыть модель доверия',register:'Регистрация'
},
en:{
 e:'Gekta AI',t:'Deal context in one window.',p:'Gekta organises facts already available to the participant into clear context: where the Deal is, what blocks the next step, which basis matters and who needs to act. Critical decisions remain with people and platform rules.',
 context:'Deal context',contextItems:['Stage and available facts','Documents and evidence','Logistics and acceptance','Quality and exceptions','Financial blockers','Decision history'],
 ask:'What do you need to understand now?',cards:[
 ['What is happening','Bring together confirmed Deal facts and show current state without fabricated live data.'],
 ['What blocks progress','Explain a confirmed blocker and the related role, document or event.'],
 ['Which basis matters','Show the source and condition supporting the permitted action.'],
 ['Who acts next','Identify the next responsible participant within server-confirmed authority.'],
 ],sources:'Sources and boundaries',sourceRows:[
 ['Deal','Only context available to the current participant'],
 ['Documents','Only linked data authorised for reading'],
 ['External systems','Only when an actual confirmed source exists'],
 ['Decision','Gekta explains; it does not independently execute critical actions'],
 ],prompt:'Ask about context, risk or the next step',trust:'Open trust model',register:'Register'
},
zh:{
 e:'Gekta AI',t:'在一个窗口理解交易上下文。',p:'Gekta 将参与方已有权限看到的事实整理成清晰上下文：交易处于哪里、什么阻挡下一步、哪个依据重要、谁需要行动。关键决定仍由人员和平台规则控制。',
 context:'交易上下文',contextItems:['阶段和可用事实','文件和依据','物流和验收','质量和异常','金融阻断','决定历史'],
 ask:'现在需要理解什么？',cards:[
 ['发生了什么','汇总已确认交易事实，不使用虚构 live 数据。'],
 ['什么在阻挡','解释已确认阻断及其关联角色、文件或事件。'],
 ['依据是什么','展示允许操作所依赖的来源和条件。'],
 ['下一步谁处理','在服务器确认权限范围内识别下一责任方。'],
 ],sources:'来源与边界',sourceRows:[
 ['交易','仅使用当前参与方可访问的上下文'],
 ['文件','仅使用关联且允许读取的数据'],
 ['外部系统','仅在存在真实确认来源时使用'],
 ['决定','Gekta 负责解释，不独立执行关键操作'],
 ],prompt:'询问上下文、风险或下一步',trust:'打开信任模型',register:'注册'
}} as const;
const ICONS=[Sparkles,ShieldCheck,FileCheck2,Route] as const;

export default async function PublicGektaPage(){
 const locale=canonicalPublicLocale(await getLocale());const c=COPY[locale];
 return <main className='pc-canonical-public'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/ai-in-action'/>
  <section style={{background:'#0b4f3a',color:'#fff',padding:'52px 0 30px'}}>
   <div className='pc-cp-container'>
    <div className='pc-cp-section-head' style={{maxWidth:900}}>
      <span className='pc-cp-eyebrow' style={{color:'#cce3d8'}}>{c.e}</span>
      <h1 style={{color:'#fff'}}>{c.t}</h1><p style={{color:'#d8e8e0'}}>{c.p}</p>
    </div>
    <div className='pc-cp-gekta-workspace'>
      <aside className='pc-cp-card pc-cp-gekta-panel pc-cp-gekta-context'>
        <Bot size={24}/><h2>{c.context}</h2>
        <ul>{c.contextItems.map(x=><li key={x}>{x}</li>)}</ul>
      </aside>
      <section className='pc-cp-card pc-cp-gekta-panel'>
        <span className='pc-cp-eyebrow'>{c.e}</span><h2 style={{fontSize:34,marginTop:6}}>{c.ask}</h2>
        <div className='pc-cp-gekta-cards'>{c.cards.map(([title,text],i)=>{const Icon=ICONS[i]!;return <article className='pc-cp-gekta-action' key={title}><Icon size={19} style={{color:'var(--pc-cp-green)'}}/><strong style={{marginTop:8}}>{title}</strong><p>{text}</p></article>})}</div>
        <div style={{marginTop:14,padding:14,border:'1px solid var(--pc-cp-line)',borderRadius:14,display:'flex',gap:10,alignItems:'center'}}>
          <Bot size={18} style={{color:'var(--pc-cp-green)'}}/><span style={{color:'var(--pc-cp-muted)',fontSize:13}}>{c.prompt}</span>
        </div>
      </section>
      <aside className='pc-cp-card pc-cp-gekta-panel'>
        <span className='pc-cp-eyebrow'>{c.sources}</span><h3 style={{fontSize:24,marginTop:6}}>{c.sources}</h3>
        <div className='pc-cp-gekta-source'>{c.sourceRows.map(([title,text])=><div key={title}><span>{title}</span><strong>{text}</strong></div>)}</div>
        <div className='pc-cp-actions' style={{marginTop:14,display:'grid'}}>
          <Link className='pc-cp-button' href={`/platform-v7/trust?lang=${locale}`}>{c.trust}<ArrowRight size={16}/></Link>
          <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/register?lang=${locale}`}>{c.register}</Link>
        </div>
      </aside>
    </div>
   </div>
  </section>
  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'>
   <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Граница AI':locale==='en'?'AI boundary':'AI 边界'}</span><h2>{locale==='ru'?'Гекта не создаёт полномочия и не подменяет источник':locale==='en'?'Gekta creates no authority and does not replace a source':'Gekta 不创建权限，也不替代事实来源'}</h2></div>
   <div className='pc-cp-trust-grid'>
    {[['01',locale==='ru'?'Читает только разрешённый контекст':locale==='en'?'Reads only authorised context':'只读取授权上下文'],['02',locale==='ru'?'Отделяет факт от объяснения':locale==='en'?'Separates fact from explanation':'区分事实与解释'],['03',locale==='ru'?'Не заявляет внешнее событие без источника':locale==='en'?'Makes no external-event claim without a source':'没有来源就不声称外部事件'],['04',locale==='ru'?'Критическое решение остаётся контролируемым':locale==='en'?'Critical decisions remain controlled':'关键决定保持受控']].map(([n,t])=><article className='pc-cp-card pc-cp-trust-card' key={n}><i>{n}</i><strong>{t}</strong></article>)}
   </div>
  </div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/ai-in-action'/>
 </main>
}
