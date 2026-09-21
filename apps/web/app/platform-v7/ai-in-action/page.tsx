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

const META={"ru":["Гекта в работе — Прозрачная Цена","Гекта помогает разобраться в Сделке: документах, логистике, качестве, расчёте и рисках. Показывает доступные варианты действий на основе данных и прав участника."],"en":["Gekta in action — Transparent Price","Gekta helps users understand the Deal: documents, logistics, quality, settlement and risk. It shows available options based on the data and authority the participant actually has."],"zh":["Gekta 实际运行 — 透明价格","Gekta 帮助用户理解交易中的文件、物流、质量、结算和风险，并根据参与方实际可用的数据与权限显示可执行选项。"]} as const;

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
 e:'Помощник по Сделке',t:'Гекта',p:'Гекта собирает доступные факты по Сделке, объясняет риски и показывает варианты дальнейших действий. Решение принимает человек.',
 context:'Данные Сделки',contextItems:['Стадия и доступные факты','Документы и основания','Логистика и приёмка','Качество и исключения','Финансовые блокеры','История решений'],
 ask:'Что нужно понять сейчас?',cards:[
 ['Что происходит','Показать подтверждённые факты по Сделке и её текущее состояние.'],
 ['Что блокирует','Показать, что мешает двигаться дальше, и к какой роли, документу или событию это относится.'],
 ['Какое основание','Показать источник и условие, на которых основано доступное действие.'],
 ['Кто действует дальше','Показать, кто должен действовать дальше в пределах своих полномочий.'],
 ['Проверить риски','Собрать факты, ограничения и то, что ещё требует подтверждения.'],
 ['Что влияет на расчёт','Показать, какие условия и события влияют на расчёт, не меняя его статус в интерфейсе.'],
 ],sources:'Источники и границы',sourceRows:[
 ['Сделка','Только данные, доступные текущему участнику'],
 ['Документы','Только данные Сделки, доступные для чтения'],
 ['Внешние системы','Только после подтверждения внешней системой'],
 ['Решение','Гекта объясняет; критическое действие выполняет уполномоченный участник'],
 ],prompt:'Спроси про Сделку, риск или следующий шаг',trust:'Открыть модель доверия',register:'Регистрация'
},
en:{
 e:'Gekta AI',t:'Deal facts in one place.',p:'Gekta brings together the Deal facts a participant may see, explains what is blocking progress and shows who needs to act next. Critical decisions remain with people.',
 context:'Deal context',contextItems:['Stage and available facts','Documents and evidence','Logistics and acceptance','Quality and exceptions','Financial blockers','Decision history'],
 ask:'What do you need to understand now?',cards:[
 ['What is happening','Show confirmed Deal facts and the current state.'],
 ['What blocks progress','Show what is blocking progress and the related role, document or event.'],
 ['Which basis matters','Show the source and condition behind an available action.'],
 ['Who acts next','Show who needs to act next within their authority.'],
 ['Check risks','Bring together the facts, constraints and items that still need confirmation.'],
 ['What affects settlement','Show which terms and events affect settlement without changing its status in the interface.'],
 ],sources:'Sources and boundaries',sourceRows:[
 ['Deal','Only data available to the current participant'],
 ['Documents','Only Deal data authorised for reading'],
 ['External systems','Only after the external source confirms it'],
 ['Decision','Gekta explains; an authorised participant performs critical actions'],
 ],prompt:'Ask about the Deal, risk or the next step',trust:'Open trust model',register:'Register'
},
zh:{
 e:'Gekta AI',t:'在一个窗口理解交易上下文。',p:'Gekta 汇总参与方有权查看的交易事实，说明阻塞原因，并显示下一责任方。关键决定仍由人员作出。',
 context:'交易上下文',contextItems:['阶段和可用事实','文件和依据','物流和验收','质量和异常','金融阻断','决定历史'],
 ask:'现在需要理解什么？',cards:[
 ['发生了什么','显示已确认的交易事实和当前状态。'],
 ['什么在阻挡','显示阻塞原因及其关联角色、文件或事件。'],
 ['依据是什么','显示可执行操作所依据的来源和条件。'],
 ['下一步谁处理','显示在权限范围内应由谁继续处理。'],
 ['检查风险','汇总事实、限制和仍需确认的事项。'],
 ['什么影响结算','显示哪些条件和事件影响结算，但不在界面中更改其状态。'],
 ],sources:'来源与边界',sourceRows:[
 ['交易','仅使用当前参与方可访问的数据'],
 ['文件','仅使用关联且允许读取的数据'],
 ['外部系统','仅在存在真实确认来源时使用'],
 ['决定','Gekta 负责解释；关键操作由有权限的参与方执行'],
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
      <aside className='pc-cp-gekta-hero-quote'><strong>{locale==='ru'?'«Больше ясности на каждом этапе Сделки»':locale==='en'?'“More clarity at every Deal stage”':'“交易每个阶段都更清晰”'}</strong><span>— Гекта</span></aside>
    </div>
    <div className='pc-cp-gekta-benefits'>
      {[locale==='ru'?'На основе данных платформы':locale==='en'?'Based on platform data':'基于平台数据',locale==='ru'?'С указанием источников':locale==='en'?'With source references':'标明来源',locale==='ru'?'Учитывает правила и риски':locale==='en'?'Accounts for rules and risk':'考虑规则与风险',locale==='ru'?'Помогает принять решение быстрее':locale==='en'?'Helps decide faster':'帮助更快决策'].map((x,i)=><span key={x}><i>{i+1}</i>{x}</span>)}
    </div>
   </div>
  </section>
  <section className='pc-cp-gekta-workspace-section'>
   <div className='pc-cp-container'>
    <div className='pc-cp-gekta-workspace'>
      <aside className='pc-cp-card pc-cp-gekta-panel pc-cp-gekta-context'>
        <Bot size={24}/><h2>{c.context}</h2>
        <span className='pc-cp-chip'><ShieldCheck size={12}/>{locale==='ru'?'Только разрешённые данные':locale==='en'?'Authorised data only':'仅限授权上下文'}</span>
        <ul>{c.contextItems.map(x=><li key={x}>{x}</li>)}</ul>
      </aside>
      <section className='pc-cp-card pc-cp-gekta-panel pc-cp-gekta-main-panel'>
        <div className='pc-cp-gekta-main-head'><Bot size={28}/><div><span className='pc-cp-eyebrow'>{c.e}</span><h2>{locale==='ru'?'Гекта работает только с данными вашей Сделки':locale==='en'?'Gekta works only with your Deal data':'Gekta 只使用你的交易数据'}</h2></div></div>
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
   <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{locale==='ru'?'Граница AI':locale==='en'?'AI boundary':'AI 边界'}</span><h2>{locale==='ru'?'Гекта не создаёт полномочия и не подменяет источник':locale==='en'?'Gekta creates no authority and does not replace a source':'Gekta 不创建权限，也不替代事实来源'}</h2></div>
   <div className='pc-cp-trust-grid'>
    {[['01',locale==='ru'?'Читает только разрешённые данные':locale==='en'?'Reads only authorised data':'只读取授权上下文'],['02',locale==='ru'?'Отделяет факт от объяснения':locale==='en'?'Separates fact from explanation':'区分事实与解释'],['03',locale==='ru'?'Не заявляет внешнее событие без источника':locale==='en'?'Makes no external-event claim without a source':'没有来源就不声称外部事件'],['04',locale==='ru'?'Критическое решение принимает человек':locale==='en'?'People make critical decisions':'关键决定保持受控']].map(([n,t])=><article className='pc-cp-card pc-cp-trust-card' key={n}><i>{n}</i><strong>{t}</strong></article>)}
   </div>
  </div></section>
  <CanonicalFooter locale={locale}/><CanonicalBottomNav locale={locale} active='/platform-v7/ai-in-action'/>
 </main>
}
