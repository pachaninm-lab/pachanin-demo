import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { ArrowRight, Bot, FileCheck2, PackageCheck, Truck } from 'lucide-react';
import { CanonicalBottomNav, CanonicalFooter, CanonicalPublicHeader, canonicalPublicLocale } from '@/components/platform-v7/PublicCanonicalPrimitives';
import { PublicGektaChatButton } from '@/components/platform-v7/PublicGektaChatButton';

const COPY = {
  ru: {
    meta:'Гекта в сделке — Прозрачная Цена',description:'Вопросы перед отгрузкой, при приёмке и подготовке расчёта. Гекта помогает разобраться; доступ к документам конкретной сделки требует подтверждённых полномочий.',
    e:'Помощник по Сделке',t:'Разберитесь в сделке с Гектой',p:'Документы, вопросы по качеству и следующий шаг — в одном разговоре. Гекта помогает сформулировать вопросы и разобраться в порядке действий; решение остаётся за человеком.',
    context:'Данные Сделки',contextNote:'Только разрешённые данные: для вопроса о конкретной сделке сначала нужен доступ к ней. Публичный чат не показывает её фактическое состояние.',
    ask:'Что нужно уточнить?',cards:[
      ['Перед отгрузкой','Какие условия, сроки и документы следует проверить до передачи продукции.'],
      ['При приёмке','На какие показатели обратить внимание и как описать выявленное расхождение.'],
      ['Перед расчётом','Какие согласованные условия и подтверждения следует проверить.'],
    ],
    prompts:['Что проверить перед отгрузкой?','На что обратить внимание при приёмке?','Какие документы нужны для расчёта?'],
    promptNote:'Спросите про сделку, риски или следующий шаг. Выберите вопрос, чтобы открыть его среди подсказок действующего чата, или задайте свой.',
    sources:'Доступ и подтверждения',sourceRows:[
      ['Сделка','Только данные, доступные текущему участнику'],
      ['Документы','Только данные Сделки, доступные для чтения'],
      ['Внешние системы','Только после подтверждения внешней системой'],
      ['Решение','Гекта объясняет; критическое действие выполняет уполномоченный участник'],
    ],
    boundary:'Важные решения подтверждает участник',boundaryText:'Ответ помощника не изменяет условия сделки, результаты приёмки или статус расчёта. До входа обсуждаются общие вопросы — без чтения закрытых документов.',
    trust:'Как защищены данные',entry:'Другие вопросы Гекте',login:'Войти',
  },
  en: {
    meta:'Gekta in a Deal — Transparent Price',description:'Questions before loading, at acceptance and before settlement. Gekta helps you understand the process; specific Deal documents require confirmed access.',
    e:'Deal assistant',t:'Work through Deal questions with Gekta',p:'Documents, quality questions and the next step — in one conversation. Gekta helps frame questions and understand the process; the participant makes the decision.',
    context:'Deal data',contextNote:'Authorised data only: questions about a specific Deal require permitted access to it. The public chat does not display its actual state.',
    ask:'What needs clarification?',cards:[
      ['Before loading','Which terms, deadlines and documents should be checked before handing over the produce.'],
      ['At acceptance','Which indicators need attention and how to describe a discrepancy.'],
      ['Before settlement','Which agreed conditions and confirmations should be checked.'],
    ],
    prompts:['What should I check before loading?','What should I look for at acceptance?','Which documents are needed for settlement?'],
    promptNote:'Ask about the Deal, risk or the next step. Choose a question to open it among the suggestions in the existing chat, or ask your own.',
    sources:'Access and confirmations',sourceRows:[
      ['Deal','Only data available to the current participant'],
      ['Documents','Only Deal data authorised for reading'],
      ['External systems','Only after the external source confirms it'],
      ['Decision','Gekta explains; an authorised participant performs critical actions'],
    ],
    boundary:'Participants confirm important decisions',boundaryText:'The assistant’s answer does not change Deal terms, acceptance results or settlement status. Before sign-in, the chat handles general questions without reading private documents.',
    trust:'How data is protected',entry:'Other questions for Gekta',login:'Sign in',
  },
  zh: {
    meta:'交易中的 Gekta — 透明价格',description:'咨询装货前、验收时和结算准备中的问题。Gekta 协助理解流程；访问具体交易文件需要已确认的权限。',
    e:'交易助手',t:'与 Gekta 一起梳理交易问题',p:'在同一段对话中讨论文件、质量问题和下一步。Gekta 帮助明确问题和理解流程，决定仍由参与方作出。',
    context:'交易数据',contextNote:'仅限授权数据：询问具体交易前，需要先获得相应的访问权限。公开聊天不显示具体交易的实际状态。',
    ask:'需要明确什么？',cards:[
      ['装货前','交付产品前应核查哪些条件、期限和文件。'],
      ['验收时','应关注哪些指标，以及如何描述发现的差异。'],
      ['结算前','应检查哪些约定条件和确认材料。'],
    ],
    prompts:['装货前应该检查什么？','验收时应注意哪些事项？','结算需要哪些文件？'],
    promptNote:'询问交易、风险或下一步。选择问题后，它会出现在现有聊天的建议中；您也可以自行提问。',
    sources:'访问与确认',sourceRows:[
      ['交易','仅使用当前参与方可访问的数据'],
      ['文件','只读取授权数据，不访问其他参与方的文件'],
      ['外部系统','仅在存在真实确认来源时使用'],
      ['决定','Gekta 负责解释；关键操作由有权限的参与方执行'],
    ],
    boundary:'关键决定由人作出',boundaryText:'助手的回答不会更改交易条款、验收结果或结算状态。登录前仅讨论一般问题，不读取私有文件。',
    trust:'数据如何受到保护',entry:'向 Gekta 咨询其他问题',login:'登录',
  },
} as const;
const ICONS = [Truck, PackageCheck, FileCheck2] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = canonicalPublicLocale(await getLocale()); const c = COPY[locale];
  return {title:c.meta,description:c.description,alternates:{canonical:'/platform-v7/ai-in-action',languages:{ru:'/platform-v7/ai-in-action?lang=ru',en:'/platform-v7/ai-in-action?lang=en',zh:'/platform-v7/ai-in-action?lang=zh'}},robots:{index:true,follow:true}};
}
export default async function GektaInDealPage() {
  const locale = canonicalPublicLocale(await getLocale()); const c = COPY[locale];
  return <main className='pc-canonical-public pc-cp-page-gekta' data-testid='gekta-deal-explanation'>
    <CanonicalPublicHeader locale={locale} activePath='/platform-v7/gekta' />
    <section className='pc-cp-gekta-public-hero'><div className='pc-cp-container'><div className='pc-cp-gekta-hero-grid'>
      <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.e}</span><h1>{c.t}</h1><p>{c.p}</p><div className='pc-cp-actions'><PublicGektaChatButton locale={locale} variant='section' /></div></div>
      <aside className='pc-cp-gekta-hero-quote'><strong>{c.boundary}</strong><p>{c.contextNote}</p></aside>
    </div></div></section>
    <section className='pc-cp-gekta-workspace-section'><div className='pc-cp-container'><div className='pc-cp-gekta-workspace'>
      <aside className='pc-cp-card pc-cp-gekta-panel pc-cp-gekta-context'><Bot size={24} aria-hidden='true' /><h2>{c.context}</h2><p>{c.contextNote}</p><a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/login?lang=${locale}`}>{c.login}</a></aside>
      <section className='pc-cp-card pc-cp-gekta-panel pc-cp-gekta-main-panel'>
        <div className='pc-cp-section-head'><h2>{c.ask}</h2></div>
        <div className='pc-cp-gekta-cards'>{c.cards.map(([title,text],index) => {const Icon = ICONS[index]!;return <article className='pc-cp-gekta-action' key={title}><Icon size={22} aria-hidden='true' /><h3>{title}</h3><p>{text}</p></article>;})}</div>
        <p>{c.promptNote}</p><div className='pc-cp-gekta-prompts'>{c.prompts.map(prompt => <PublicGektaChatButton key={prompt} locale={locale} variant='section' prompt={prompt} />)}</div>
      </section>
      <aside className='pc-cp-card pc-cp-gekta-panel pc-cp-gekta-sources-panel'><h2>{c.sources}</h2><div className='pc-cp-gekta-source'>{c.sourceRows.map(([title,text]) => <div key={title}><span>{title}</span><strong>{text}</strong></div>)}</div><div className='pc-cp-actions'><a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/trust?lang=${locale}`}>{c.trust}<ArrowRight size={16} aria-hidden='true' /></a></div></aside>
    </div></div></section>
    <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'><div className='pc-cp-section-head'><h2>{c.boundary}</h2><p>{c.boundaryText}</p></div><a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/gekta?lang=${locale}`}>{c.entry}<ArrowRight size={16} aria-hidden='true' /></a></div></section>
    <CanonicalFooter locale={locale} /><CanonicalBottomNav locale={locale} active='/platform-v7/ai-in-action' />
  </main>;
}
