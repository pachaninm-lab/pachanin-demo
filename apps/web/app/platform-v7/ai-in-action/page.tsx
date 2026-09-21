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
 e:'Аграрный интеллект',t:'Понять Сделку быстрее',p:'Гекта собирает доступные факты в понятную картину: где находится Сделка, что мешает следующему шагу, какие риски требуют внимания и кто должен действовать дальше.',
 context:'Контекст Сделки',contextItems:['Стадия и доступные факты','Документы и основания','Логистика и приёмка','Качество и исключения','Финансовые блокеры','История решений'],
 ask:'Что нужно понять сейчас?',cards:[
 ['Что происходит','Собрать подтверждённые факты и коротко объяснить текущее состояние Сделки.'],
 ['Что мешает двигаться дальше','Показать причину остановки и связанный с ней документ, событие или участника.'],
 ['На чём основан следующий шаг','Показать факт, документ или условие, на которое опирается доступное действие.'],
 ['Кто действует дальше','Показать следующего ответственного с учётом подтверждённых полномочий.'],
 ['Где риск','Собрать ограничения, отклонения и неподтверждённые места, которые стоит проверить.'],
 ['Что влияет на расчёт','Объяснить, какие условия и события могут менять основание для финансового шага.'],
 ],sources:'Источники и границы',sourceRows:[
 ['Сделка','Только контекст, доступный текущему участнику'],
 ['Документы','Только связанные и разрешённые к чтению данные'],
 ['Внешние системы','Только при фактическом подтверждённом источнике'],
 ['Решение','Гекта объясняет варианты; действие и ответственность остаются за участником'],
 ],prompt:'Спроси, что происходит, где риск или что делать дальше',trust:'Открыть модель доверия',register:'Регистрация'
},
en:{
 e:'Agricultural intelligence',t:'Understand the Deal faster',p:'Gekta turns the facts available to you into a clear picture: where the Deal stands, what blocks progress, which risks need attention and who needs to act next.',
 context:'Deal context',contextItems:['Stage and available facts','Documents and evidence','Logistics and acceptance','Quality and exceptions','Financial blockers','Decision history'],
 ask:'What do you need to understand now?',cards:[
 ['What is happening','Pull confirmed facts together and explain the current Deal state in plain language.'],
 ['What blocks progress','Show the reason progress stopped and the related document, event or participant.'],
 ['What supports the next step','Show the fact, document or condition behind the available action.'],
 ['Who acts next','Show the next responsible participant based on confirmed authority.'],
 ['Where is the risk','Bring together constraints, deviations and unresolved items worth checking.'],
 ['What affects settlement','Explain which terms and events may change the basis for the next financial step.'],
 ],sources:'Sources and boundaries',sourceRows:[
 ['Deal','Only context available to the current participant'],
 ['Documents','Only linked data authorised for reading'],
 ['External systems','Only when an actual confirmed source exists'],
 ['Decision','Gekta explains the options; action and accountability stay with the participant'],
 ],prompt:'Ask what is happening, where the risk is or what to do next',trust:'Open trust model',register:'Register'
},
zh:{
 e:'农业智能',t:'更快看懂一笔交易',p:'Gekta 把你有权查看的事实整理成清晰图景：交易进行到哪里、什么阻挡进展、哪些风险需要关注、下一步谁处理。',
 context:'交易上下文',contextItems:['阶段和可用事实','文件和依据','物流和验收','质量和异常','金融阻断','决定历史'],
 ask:'现在需要理解什么？',cards:[
 ['发生了什么','汇总已确认事实，并用清晰语言解释当前交易状态。'],
 ['什么在阻挡','说明进展停止的原因，以及相关文件、事件或参与方。'],
 ['下一步依据是什么','展示支持可用操作的事实、文件或条件。'],
 ['下一步谁处理','根据已确认权限显示下一责任方。'],
 ['风险在哪里','汇总限制、偏差和仍待确认的事项，帮助参与方优先检查。'],
 ['什么影响结算','解释哪些条件和事件可能改变下一金融步骤的依据。'],
 ],sources:'来源与边界',sourceRows:[
 ['交易','仅使用当前参与方可访问的上下文'],
 ['文件','仅使用关联且允许读取的数据'],
 ['外部系统','仅在存在真实确认来源时使用'],
 ['决定','Gekta 解释可用选项；操作和责任仍由参与方承担'],
 ],prompt:'询问发生了什么、风险在哪里或下一步怎么做',trust:'打开信任模型',register:'注册'
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
        <h1>{c.t}</h1><p>{c.p}</p>
      </div>
      <aside className='pc-cp-gekta-hero-quote'><strong>{locale==='ru'?'Ясно, что происходит. Понятно, что делать дальше.':locale==='en'?'See what is happening. Know what to do next.':'看清发生了什么，知道下一步怎么做。'}</strong><span>{locale==='ru'?'Контекст · риски · следующий шаг':locale==='en'?'Context · risk · next step':'上下文 · 风险 · 下一步'}</span></aside>
    </div>
    <div className='pc-cp-gekta-benefits'>
      {[locale==='ru'?'Работает с данными платформы':locale==='en'?'Works with platform data':'使用平台数据',locale==='ru'?'С указанием источников':locale==='en'?'With source references':'标明来源',locale==='ru'?'Учитывает правила и риски':locale==='en'?'Accounts for rules and risk':'考虑规则与风险',locale==='ru'?'Сокращает время на разбор контекста':locale==='en'?'Cuts time spent piecing context together':'减少整理交易上下文的时间'].map((x,i)=><span key={x}><i>{i+1}</i>{x}</span>)}
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
        <div className='pc-cp-gekta-main-head'><Bot size={28}/><div><span className='pc-cp-eyebrow'>{c.e}</span><h2>{locale==='ru'?'Гекта работает с контекстом вашей Сделки':locale==='en'?'Gekta works with your Deal context':'Gekta 基于你的交易上下文工作'}</h2></div></div>
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
   <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Границы Гекты':locale==='en'?'What Gekta does — and does not do':'Gekta 能做什么、不能做什么'}</span><h2>{locale==='ru'?'Гекта объясняет — решение остаётся за участником':locale==='en'?'Gekta explains the options; the participant remains in control':'Gekta 负责解释，决定仍由参与方作出'}</h2></div>
   <div className='pc-cp-trust-grid'>
    {[['01',locale==='ru'?'Читает только разрешённый контекст':locale==='en'?'Reads only authorised context':'只读取授权上下文'],['02',locale==='ru'?'Отделяет факт от объяснения':locale==='en'?'Separates fact from explanation':'区分事实与解释'],['03',locale==='ru'?'Не заявляет внешнее событие без источника':locale==='en'?'Makes no external-event claim without a source':'没有来源就不声称外部事件'],['04',locale==='ru'?'Решение и ответственность остаются за участником':locale==='en'?'Decisions and accountability stay with the participant':'决定和责任仍由参与方承担']].map(([n,t])=><article className='pc-cp-card pc-cp-trust-card' key={n}><i>{n}</i><strong>{t}</strong></article>)}
   </div>
  </div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/ai-in-action'/>
 </main>
}
