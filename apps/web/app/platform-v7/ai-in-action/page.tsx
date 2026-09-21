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

const META={"ru":["Гекта в работе — Прозрачная Цена","Гекта помогает разобраться в Сделке по доступным участнику данным: показывает факты, риски, документы и доступные действия."],"en":["Gekta in action — Transparent Price","Gekta helps participants understand a Deal from the data they are allowed to see: facts, risks, documents and available actions."],"zh":["Gekta 实际运行 — 透明价格","Gekta 在可用事实和权限范围内解释交易上下文、文件、物流、质量、结算、风险和允许的下一步。"]} as const;

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
 e:'Гекта AI',t:'Гекта',p:'Контекст. Аналитика. Обоснованные следующие шаги. Гекта работает только с доступными участнику фактами; критическое решение остаётся за человеком и правилами платформы.',
 context:'Данные по Сделке',contextItems:['Стадия и доступные факты','Документы и основания','Логистика и приёмка','Качество и исключения','Финансовые блокеры','История решений'],
 ask:'Что нужно понять сейчас?',cards:[
 ['Что происходит','Свести подтверждённые факты Сделки и показать текущее состояние без выдуманных live-данных.'],
 ['Что блокирует','Объяснить подтверждённый блокер и связанную с ним роль, документ или событие.'],
 ['Какое основание','Показать, на какой источник и условие опирается допустимое действие.'],
 ['Кто действует дальше','Определить следующего ответственного в пределах серверно подтверждённых полномочий.'],
 ['Проверить риски','Собрать доступные факты, ограничения и неподтверждённые места, которые требуют внимания участника.'],
 ['Что влияет на расчёт','Объяснить, какие подтверждённые условия и события могут влиять на расчёт, не создавая финансовое состояние на клиенте.'],
 ],sources:'Источники и границы',sourceRows:[
 ['Сделка','Только контекст, доступный текущему участнику'],
 ['Документы','Только связанные и разрешённые к чтению данные'],
 ['Внешние системы','Только при фактическом подтверждённом источнике'],
 ['Решение','Гекта объясняет; критическое действие не исполняет самостоятельно'],
 ],prompt:'Спроси про контекст, риск или следующий шаг',trust:'Открыть модель доверия',register:'Регистрация'
},
en:{
 e:'Gekta',t:'Understand the Deal without switching between screens.',p:'Gekta brings together Deal data available to the participant and explains what happened, what blocks progress and who needs to act. Critical decisions remain with participants.',
 context:'Deal context',contextItems:['Stage and available facts','Documents and evidence','Logistics and acceptance','Quality and exceptions','Financial blockers','Decision history'],
 ask:'What do you need to understand now?',cards:[
 ['What is happening','Bring together confirmed Deal facts and show current state without fabricated live data.'],
 ['What blocks progress','Explain a confirmed blocker and the related role, document or event.'],
 ['Which basis matters','Show the source and condition supporting the permitted action.'],
 ['Who acts next','Identify the next responsible participant within server-confirmed authority.'],
 ['Check risks','Bring together available facts, constraints and unresolved items that require participant attention.'],
 ['What affects settlement','Explain which confirmed terms and events may affect settlement without creating financial state on the client.'],
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
 ['检查风险','汇总可用事实、限制和仍待确认的事项，供参与方处理。'],
 ['什么影响结算','解释哪些已确认条件和事件可能影响结算，但不在客户端创建金融状态。'],
 ],sources:'来源与边界',sourceRows:[
 ['交易','仅使用当前参与方可访问的上下文'],
 ['文件','仅使用关联且允许读取的数据'],
 ['外部系统','仅在存在真实确认来源时使用'],
 ['决定','Gekta 负责解释，不独立执行关键操作'],
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
      <aside className='pc-cp-gekta-hero-quote'><strong>{locale==='ru'?'«Понимать, что происходит. Видеть, что делать дальше.»':locale==='en'?'“Understand what happened. See what can be done next.”':'“交易每个阶段都更清晰”'}</strong><span>Гекта</span></aside>
    </div>
    <div className='pc-cp-gekta-benefits'>
      {[locale==='ru'?'Работает с доступными данными Сделки':locale==='en'?'Uses Deal data available to you':'基于平台数据',locale==='ru'?'С указанием источников':locale==='en'?'With source references':'标明来源',locale==='ru'?'Учитывает правила и риски':locale==='en'?'Accounts for rules and risk':'考虑规则与风险',locale==='ru'?'Помогает быстрее разобраться в ситуации':locale==='en'?'Helps you understand the situation faster':'帮助更快决策'].map((x,i)=><span key={x}><i>{i+1}</i>{x}</span>)}
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
        <div className='pc-cp-gekta-main-head'><Bot size={28}/><div><span className='pc-cp-eyebrow'>{c.e}</span><h2>{locale==='ru'?'Спросите Гекту о текущей Сделке':locale==='en'?'Ask Gekta about the current Deal':'Gekta 基于你的交易上下文工作'}</h2></div></div>
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
   <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Что Гекта не делает':locale==='en'?'What Gekta does not do':'AI 边界'}</span><h2>{locale==='ru'?'Не назначает права, не меняет статус Сделки и не подменяет источник данных':locale==='en'?'It does not grant authority, change Deal state or replace a data source':'Gekta 不创建权限，也不替代事实来源'}</h2></div>
   <div className='pc-cp-trust-grid'>
    {[['01',locale==='ru'?'Читает только разрешённый контекст':locale==='en'?'Reads only authorised context':'只读取授权上下文'],['02',locale==='ru'?'Отделяет факт от объяснения':locale==='en'?'Separates fact from explanation':'区分事实与解释'],['03',locale==='ru'?'Не заявляет внешнее событие без источника':locale==='en'?'Makes no external-event claim without a source':'没有来源就不声称外部事件'],['04',locale==='ru'?'Критическое решение остаётся контролируемым':locale==='en'?'Critical decisions remain controlled':'关键决定保持受控']].map(([n,t])=><article className='pc-cp-card pc-cp-trust-card' key={n}><i>{n}</i><strong>{t}</strong></article>)}
   </div>
  </div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/ai-in-action'/>
 </main>
}
