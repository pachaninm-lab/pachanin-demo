import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, Bot, Calculator, FileCheck2, Route, Search, ShieldCheck } from 'lucide-react';
import { getLocale } from 'next-intl/server';
import {
  CanonicalBottomNav,
  CanonicalFooter,
  CanonicalPublicHeader,
  canonicalPublicLocale,
} from '@/components/platform-v7/PublicCanonicalPrimitives';

const META={"ru":["Гекта в работе — Прозрачная Цена","Гекта объясняет контекст Сделки, документы, логистику, качество, расчёт, риски и допустимый следующий шаг в пределах доступных фактов и полномочий."],"en":["Gekta in action — Transparent Price","Gekta explains Deal context, documents, logistics, quality, settlement, risks and the next permitted step within available facts and authority."],"zh":["Gekta 实际运行 — 透明价格","Gekta 在可用事实和权限范围内解释交易上下文、文件、物流、质量、结算、风险和允许的下一步。"]} as const;

export async function generateMetadata():Promise<Metadata>{
  const locale=canonicalPublicLocale(await getLocale());
  const copy=META[locale];
  return {
    title:copy[0],
    description:copy[1],
    alternates:{
      canonical:'/platform-v7/ai-in-action',
      languages:{
        ru:'/platform-v7/ai-in-action?lang=ru',
        en:'/platform-v7/ai-in-action?lang=en',
        zh:'/platform-v7/ai-in-action?lang=zh',
      },
    },
    robots:{index:true,follow:true},
  };
}

const COPY={
ru:{
 e:'Гекта',t:'Гекта',p:'Гекта помогает быстро разобраться в Сделке: собирает доступные факты, показывает блокеры, находит связанные документы и объясняет возможный следующий шаг; критическое решение остаётся за человеком и правилами платформы.',
 context:'Контекст Сделки',contextItems:['Стадия и доступные факты','Документы и основания','Логистика и приёмка','Качество и исключения','Финансовые блокеры','История решений'],
 ask:'Что нужно понять сейчас?',cards:[
 ['Что происходит','Собрать подтверждённые факты и коротко показать текущее состояние Сделки.'],
 ['Что блокирует','Показать причину блокировки и связанный с ней документ, событие или ответственного.'],
 ['На чём основано действие','Показать источник, документ или условие, которое разрешает действие.'],
 ['Кто действует дальше','Показать следующего ответственного среди участников с подтверждёнными правами.'],
 ['Проверить риски','Выделить ограничения и неподтверждённые данные, на которые стоит обратить внимание.'],
 ['Что влияет на расчёт','Показать подтверждённые условия и события, которые могут изменить расчёт.'],
 ],sources:'Источники и границы',sourceRows:[
 ['Сделка','Только контекст, доступный текущему участнику'],
 ['Документы','Только связанные и разрешённые к чтению данные'],
 ['Внешние системы','Только при фактическом подтверждённом источнике'],
 ['Решение','Гекта объясняет; критическое действие не исполняет самостоятельно'],
 ],prompt:'Спроси про контекст, риск или следующий шаг',trust:'Открыть модель доверия',register:'Регистрация'
},
en:{
 e:'Gekta',t:'Gekta',p:'Gekta helps users understand the Deal quickly: it brings together available facts, shows blockers, finds related documents and explains a possible next step. The participant makes the decision.',
 context:'Deal context',contextItems:['Stage and available facts','Documents and evidence','Logistics and acceptance','Quality and exceptions','Financial blockers','Decision history'],
 ask:'What do you need to understand now?',cards:[
 ['What is happening','Bring together confirmed facts and summarise the current Deal state.'],
 ['What blocks progress','Show the cause of the blocker and the related document, event or responsible participant.'],
 ['What supports the action','Show the source, document or condition that permits the action.'],
 ['Who acts next','Show the next responsible participant among users with confirmed authority.'],
 ['Check risks','Highlight constraints and unconfirmed data that need attention.'],
 ['What affects settlement','Show confirmed terms and events that may change settlement.'],
 ],sources:'Sources and boundaries',sourceRows:[
 ['Deal','Only context available to the current participant'],
 ['Documents','Only linked data authorised for reading'],
 ['External systems','Only when an actual confirmed source exists'],
 ['Decision','Gekta explains the options but does not execute a critical action by itself'],
 ],prompt:'Ask about context, risk or the next step',trust:'Open trust model',register:'Register'
},
zh:{
 e:'Gekta',t:'Gekta',p:'Gekta 帮助快速看懂交易：汇总可用事实、指出阻断、找到相关文件，并说明可能的下一步。最终决定由参与方作出。',
 context:'交易上下文',contextItems:['阶段和可用事实','文件和依据','物流和验收','质量和异常','金融阻断','决定历史'],
 ask:'现在需要理解什么？',cards:[
 ['发生了什么','汇总已确认事实，并简要说明当前交易状态。'],
 ['什么在阻挡','说明阻断原因及相关文件、事件或责任方。'],
 ['操作依据','展示允许操作的来源、文件或条件。'],
 ['下一步谁处理','在已确认权限的参与方中指出下一责任方。'],
 ['检查风险','突出限制和仍待确认、需要关注的数据。'],
 ['什么影响结算','展示可能改变结算的已确认条件和事件。'],
 ],sources:'来源与边界',sourceRows:[
 ['交易','仅使用当前参与方可访问的上下文'],
 ['文件','仅使用关联且允许读取的数据'],
 ['外部系统','仅在存在真实确认来源时使用'],
 ['决定','Gekta 解释可选方案，但不会自行执行关键操作'],
 ],prompt:'询问上下文、风险或下一步',trust:'打开信任模型',register:'注册'
}} as const;
const ICONS=[Search,ShieldCheck,BarChart3,FileCheck2,Calculator,Route] as const;

export default async function PublicGektaPage(){
 const locale=canonicalPublicLocale(await getLocale());const c=COPY[locale];
 return <main className='pc-canonical-public pc-cp-page-gekta'>
  <CanonicalPublicHeader locale={locale} activePath='/platform-v7/gekta'/>
  <section className='pc-cp-gekta-public-hero'>
   <div className='pc-cp-container'>
    <div className='pc-cp-gekta-hero-grid'>
      <div className='pc-cp-section-head'>
        <span className='pc-cp-eyebrow'>{c.e}</span>
        <h1>{c.t}<span> AI</span></h1><p>{c.p}</p>
      </div>
      <aside className='pc-cp-gekta-hero-quote'><strong>{locale==='ru'?'Разобраться в Сделке без поиска по разным экранам.':locale==='en'?'Understand the Deal without hunting across screens.':'不用在多个页面之间查找，也能看懂交易。'}</strong><span>— Гекта</span></aside>
    </div>
    <div className='pc-cp-gekta-benefits'>
      {[locale==='ru'?'Работает с данными платформы':locale==='en'?'Works with platform data':'使用平台数据',locale==='ru'?'С указанием источников':locale==='en'?'With source references':'标明来源',locale==='ru'?'Не скрывает неопределённость':locale==='en'?'Keeps uncertainty visible':'明确显示不确定性',locale==='ru'?'Не принимает решение за пользователя':locale==='en'?'Does not decide for the user':'不替用户作决定'].map((x,i)=><span key={x}><i>{i+1}</i>{x}</span>)}
    </div>
   </div>
  </section>
  <section className='pc-cp-gekta-workspace-section'>
   <div className='pc-cp-container'>
    <div className='pc-cp-gekta-workspace'>
      <aside className='pc-cp-card pc-cp-gekta-panel pc-cp-gekta-context'>
        <Bot size={24}/><h2>{c.context}</h2>
        <span className='pc-cp-chip'><ShieldCheck size={12}/>{locale==='ru'?'Только разрешённый контекст':locale==='en'?'Authorised context only':'仅限授权上下文'}</span>
        <ul>{c.contextItems.map(x=><li key={x}>{x}</li>)}</ul>
      </aside>
      <section className='pc-cp-card pc-cp-gekta-panel pc-cp-gekta-main-panel'>
        <div className='pc-cp-gekta-main-head'><Bot size={28}/><div><span className='pc-cp-eyebrow'>{c.e}</span><h2>{locale==='ru'?'Спросите Гекту о текущей Сделке':locale==='en'?'Ask Gekta about the current Deal':'向 Gekta 询问当前交易'}</h2></div></div>
        <div className='pc-cp-gekta-cards'>{c.cards.map(([title,text],i)=>{const Icon=ICONS[i]!;return <article className='pc-cp-gekta-action' key={title}><Icon size={19}/><strong>{title}</strong><p>{text}</p></article>})}</div>
        <div className='pc-cp-gekta-prompts'>{[
          c.prompt,
          locale==='ru'?'Какие риски при приёмке?':locale==='en'?'What are the acceptance risks?':'验收有什么风险？',
          locale==='ru'?'Что влияет на расчёт?':locale==='en'?'What affects settlement?':'什么影响结算？',
          locale==='ru'?'Какие основания доступны?':locale==='en'?'Which evidence is available?':'有哪些依据？',
          locale==='ru'?'Кто должен действовать дальше?':locale==='en'?'Who should act next?':'下一步谁处理？',
          locale==='ru'?'Что ещё требует подтверждения?':locale==='en'?'What still needs confirmation?':'还有什么待确认？',
        ].map(x=><span key={x}>{x}<ArrowRight size={13}/></span>)}</div>
        <div className='pc-cp-gekta-composer'><Bot size={18}/><span>{c.prompt}</span><button type='button' aria-label={locale==='ru'?'Отправить запрос':locale==='en'?'Send query':'发送查询'}><ArrowRight size={17}/></button></div>
      </section>
      <aside className='pc-cp-card pc-cp-gekta-panel pc-cp-gekta-sources-panel'>
        <span className='pc-cp-eyebrow'>{c.sources}</span><h3>{c.sources}</h3>
        <div className='pc-cp-gekta-source'>{c.sourceRows.map(([title,text])=><div key={title}><span>{title}</span><strong>{text}</strong></div>)}</div>
        <div className='pc-cp-gekta-stage-list'><strong>{locale==='ru'?'Этапы, которые Гекта может объяснить':locale==='en'?'Stages Gekta can explain':'Gekta 可解释的阶段'}</strong><span>{locale==='ru'?'Качество':locale==='en'?'Quality':'质量'}</span><span>{locale==='ru'?'Расчёт':locale==='en'?'Settlement':'结算'}</span><span>{locale==='ru'?'Логистика':locale==='en'?'Logistics':'物流'}</span></div>
        <div className='pc-cp-actions'>
          <Link className='pc-cp-button' href={`/platform-v7/trust?lang=${locale}`}>{c.trust}<ArrowRight size={16}/></Link>
        </div>
      </aside>
    </div>
   </div>
  </section>
  <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'>
   <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Границы Гекты':locale==='en'?'Gekta boundaries':'Gekta 的边界'}</span><h2>{locale==='ru'?'Что Гекта делает и чего не делает':locale==='en'?'What Gekta does — and does not do':'Gekta 能做什么，不能做什么'}</h2></div>
   <div className='pc-cp-trust-grid'>
    {[['01',locale==='ru'?'Читает только разрешённый контекст':locale==='en'?'Reads only authorised context':'只读取授权上下文'],['02',locale==='ru'?'Отделяет факт от объяснения':locale==='en'?'Separates fact from explanation':'区分事实与解释'],['03',locale==='ru'?'Не заявляет внешнее событие без источника':locale==='en'?'Makes no external-event claim without a source':'没有来源就不声称外部事件'],['04',locale==='ru'?'Критическое решение остаётся контролируемым':locale==='en'?'Critical decisions remain controlled':'关键决定保持受控']].map(([n,t])=><article className='pc-cp-card pc-cp-trust-card' key={n}><i>{n}</i><strong>{t}</strong></article>)}
   </div>
  </div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/ai-in-action'/>
 </main>
}
