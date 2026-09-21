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

const META={"ru":["Гекта в работе — Прозрачная Цена","Гекта объясняет доступные участнику факты Сделки, связанные документы, риски и следующий шаг в пределах его полномочий."],"en":["Gekta in action — Transparent Price","Gekta explains the Deal facts and documents available to the participant, including risks and the next permitted step."],"zh":["Gekta 实际运行 — 透明价格","Gekta 根据参与方可访问的交易事实和文件，说明风险以及允许的下一步。"]} as const;

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
 e:'Аграрный интеллект',t:'Разобраться в Сделке по фактам',p:'Гекта показывает, на каком этапе Сделка, что мешает двигаться дальше, какие риски требуют внимания и кто отвечает за следующий шаг.',
 context:'Данные Сделки',contextItems:['Стадия и доступные факты','Документы и основания','Логистика и приёмка','Качество и исключения','Финансовые блокеры','История решений'],
 ask:'Что нужно понять сейчас?',cards:[
 ['Что происходит','Показать подтверждённые факты и коротко объяснить текущее состояние Сделки.'],
 ['Что мешает двигаться дальше','Показать причину остановки и связанный с ней документ, событие или участника.'],
 ['На чём основан следующий шаг','Показать факт, документ или условие, на которое опирается доступное действие.'],
 ['Кто действует дальше','Показать следующего ответственного с учётом подтверждённых полномочий.'],
 ['Где риск','Показать ограничения, отклонения и неподтверждённые места, которые нужно проверить.'],
 ['Что влияет на расчёт','Объяснить, какие условия и события могут менять основание для финансового шага.'],
 ],sources:'Источники и границы',sourceRows:[
 ['Сделка','Только данные Сделки, доступные текущему участнику'],
 ['Документы','Только связанные и разрешённые к чтению данные'],
 ['Внешние системы','Только при фактическом подтверждённом источнике'],
 ['Решение','Гекта объясняет варианты; действие и ответственность остаются за участником'],
 ],prompt:'Спроси, что происходит, где риск или что делать дальше',trust:'Открыть модель доверия',register:'Регистрация'
},
en:{
 e:'Agricultural intelligence',t:'Understand the Deal through the facts',p:'Gekta shows where the Deal stands, what is blocking progress, which risks need attention and who is responsible for the next action.',
 context:'Deal data',contextItems:['Stage and available facts','Documents and evidence','Logistics and acceptance','Quality and exceptions','Financial blockers','Decision history'],
 ask:'What do you need to understand now?',cards:[
 ['What is happening','Review the confirmed facts and explain the current Deal state in plain language.'],
 ['What blocks progress','Show the reason progress stopped and the related document, event or participant.'],
 ['What supports the next step','Show the fact, document or condition behind the available action.'],
 ['Who acts next','Show the next responsible participant based on confirmed authority.'],
 ['Where is the risk','List constraints, deviations and unresolved items that need checking.'],
 ['What affects settlement','Explain which terms and events may change the basis for the next financial step.'],
 ],sources:'Sources and boundaries',sourceRows:[
 ['Deal','Only Deal data available to the current participant'],
 ['Documents','Only linked data authorised for reading'],
 ['External systems','Only when an actual confirmed source exists'],
 ['Decision','Gekta explains the options; action and accountability stay with the participant'],
 ],prompt:'Ask what is happening, where the risk is or what to do next',trust:'Open trust model',register:'Register'
},
zh:{
 e:'农业智能',t:'按事实看懂一笔交易',p:'Gekta 会显示交易进行到哪里、什么阻挡进展、哪些风险需要关注，以及下一步由谁处理。',
 context:'交易数据',contextItems:['阶段和可用事实','文件和依据','物流和验收','质量和异常','金融阻断','决定历史'],
 ask:'现在需要理解什么？',cards:[
 ['发生了什么','查看已确认事实并解释当前交易状态。'],
 ['什么在阻挡','说明进展停止的原因，以及相关文件、事件或参与方。'],
 ['下一步依据是什么','展示支持可用操作的事实、文件或条件。'],
 ['下一步谁处理','根据已确认权限显示下一责任方。'],
 ['风险在哪里','列出限制、偏差和仍待确认的事项。'],
 ['什么影响结算','解释哪些条件和事件可能改变下一金融步骤的依据。'],
 ],sources:'来源与边界',sourceRows:[
 ['交易','仅使用当前参与方可访问的交易数据'],
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
      <aside className='pc-cp-gekta-hero-quote'><strong>{locale==='ru'?'Сначала факты. Потом следующий шаг.':locale==='en'?'Facts first. Then the next action.':'先看事实，再决定下一步。'}</strong><span>{locale==='ru'?'Факты · риски · ответственность':locale==='en'?'Facts · risk · responsibility':'事实 · 风险 · 责任'}</span></aside>
    </div>
    <div className='pc-cp-gekta-benefits'>
      {[locale==='ru'?'Работает с данными платформы':locale==='en'?'Works with platform data':'使用平台数据',locale==='ru'?'С указанием источников':locale==='en'?'With source references':'标明来源',locale==='ru'?'Учитывает правила и риски':locale==='en'?'Accounts for rules and risk':'考虑规则与风险',locale==='ru'?'Собирает факты Сделки в одном экране':locale==='en'?'Keeps the Deal facts in one view':'把交易事实集中在一个视图中'].map((x,i)=><span key={x}><i>{i+1}</i>{x}</span>)}
    </div>
   </div>
  </section>
  <section className='pc-cp-gekta-workspace-section'>
   <div className='pc-cp-container'>
    <div className='pc-cp-gekta-workspace'>
      <aside className='pc-cp-card pc-cp-gekta-panel pc-cp-gekta-context'>
        <Bot size={24}/><h2>{c.context}</h2>
        <span className='pc-cp-chip'><ShieldCheck size={12}/>{locale==='ru'?'Только разрешённые данные':locale==='en'?'Authorised data only':'仅限授权数据'}</span>
        <ul>{c.contextItems.map(x=><li key={x}>{x}</li>)}</ul>
      </aside>
      <section className='pc-cp-card pc-cp-gekta-panel pc-cp-gekta-main-panel'>
        <div className='pc-cp-gekta-main-head'><Bot size={28}/><div><span className='pc-cp-eyebrow'>{c.e}</span><h2>{locale==='ru'?'Гекта работает с доступными тебе данными Сделки':locale==='en'?'Gekta works with the Deal data you can access':'Gekta 使用你有权访问的交易数据'}</h2></div></div>
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
    {[['01',locale==='ru'?'Читает только разрешённые данные Сделки':locale==='en'?'Reads only authorised Deal data':'只读取授权交易数据'],['02',locale==='ru'?'Отделяет факт от объяснения':locale==='en'?'Separates fact from explanation':'区分事实与解释'],['03',locale==='ru'?'Не заявляет внешнее событие без источника':locale==='en'?'Makes no external-event claim without a source':'没有来源就不声称外部事件'],['04',locale==='ru'?'Решение и ответственность остаются за участником':locale==='en'?'Decisions and accountability stay with the participant':'决定和责任仍由参与方承担']].map(([n,t])=><article className='pc-cp-card pc-cp-trust-card' key={n}><i>{n}</i><strong>{t}</strong></article>)}
   </div>
  </div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/ai-in-action'/>
 </main>
}
