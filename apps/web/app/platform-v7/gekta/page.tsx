import '@/styles/platform-v7-canonical-public-v1.css';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { ArrowRight, FileText, Sprout, Truck } from 'lucide-react';
import { CanonicalBottomNav, CanonicalFooter, CanonicalPublicHeader, canonicalPublicLocale } from '@/components/platform-v7/PublicCanonicalPrimitives';
import { PublicGektaChatButton } from '@/components/platform-v7/PublicGektaChatButton';

const COPY = {
  ru: {
    meta: 'Гекта — помощник по агровопросам | Прозрачная Цена',
    description: 'Задайте Гекте вопрос о растениеводстве, подготовке агросделки или работе с платформой. Общий чат не открывает доступ к чужим сделкам и документам.',
    eyebrow: 'Помощь в агробизнесе', title: 'Гекта — разберитесь в вопросе',
    lead: 'Спросите о культуре, подготовке отгрузки, приёмке или работе с платформой. Начните с вопроса своими словами.',
    note: 'Без доступа к закрытым данным', noteText: 'В публичном чате Гекта не читает документы вашей организации и не знает состояние конкретной сделки.',
    tasks: 'С чем можно обратиться', topics: [
      ['Растениеводство', 'Общие вопросы о культурах, почве, урожае и сельском хозяйстве.'],
      ['Подготовка сделки', 'Что уточнить перед отгрузкой, проверить при приёмке и подготовить для расчёта.'],
      ['Работа с платформой', 'Как устроены рынок, этапы сделки и заявка на подключение организации.'],
    ],
    ask: 'Начните с одного вопроса', prompts: ['Что проверить перед отгрузкой?', 'На что обратить внимание при приёмке?', 'Какие документы нужны для расчёта?'],
    promptNote: 'Вопрос откроется среди подсказок действующего чата. Вы сможете уточнить его перед отправкой.',
    boundary: 'Важные решения подтверждает участник', boundaryText: 'Ответ помощника не заменяет документы, результаты проверки качества и согласованные условия. Не отправляйте в публичный чат пароли, токены и персональные данные.',
    deal: 'Как Гекта помогает в сделке', join: 'Подать заявку',
  },
  en: {
    meta: 'Gekta — agricultural assistant | Transparent Price',
    description: 'Ask Gekta about crops, preparing an agricultural Deal or using the platform. The public chat does not grant access to private Deals or documents.',
    eyebrow: 'Help with agriculture', title: 'Gekta — work through your question',
    lead: 'Ask about a crop, preparing a shipment, acceptance or using the platform. Start with a question in your own words.',
    note: 'No access to private data', noteText: 'In the public chat, Gekta cannot read your organisation’s documents or know the state of a specific Deal.',
    tasks: 'What you can ask about', topics: [
      ['Crop production', 'General questions about crops, soil, harvests and agriculture.'],
      ['Preparing a Deal', 'What to clarify before loading, review at acceptance and prepare for settlement.'],
      ['Using the platform', 'How the market, Deal stages and organisation application work.'],
    ],
    ask: 'Start with one question', prompts: ['What should I check before loading?', 'What should I look for at acceptance?', 'Which documents are needed for settlement?'],
    promptNote: 'Your question will appear among the suggestions in the existing chat. You can refine it before sending.',
    boundary: 'Participants confirm important decisions', boundaryText: 'An assistant’s answer does not replace documents, quality checks or agreed terms. Do not send passwords, tokens or personal data in the public chat.',
    deal: 'How Gekta helps with a Deal', join: 'Apply for access',
  },
  zh: {
    meta: 'Gekta — 农业助手 | 透明价格',
    description: '向 Gekta 询问作物生产、农业交易准备或平台使用问题。公开聊天不会授予访问私有交易或文件的权限。',
    eyebrow: '农业协助', title: 'Gekta — 帮您梳理问题',
    lead: '询问作物、发货准备、验收或平台使用问题。请用自己的话提出问题。',
    note: '无法访问私有数据', noteText: '在公开聊天中，Gekta 无法读取您的机构文件，也不知道具体交易的实际状态。',
    tasks: '可以咨询哪些问题', topics: [
      ['作物生产', '关于作物、土壤、收获和农业的一般问题。'],
      ['交易准备', '装货前需要明确什么、验收时应检查什么，以及结算前需要准备什么。'],
      ['平台使用', '了解市场、交易阶段和机构接入申请。'],
    ],
    ask: '从一个问题开始', prompts: ['装货前应该检查什么？', '验收时应注意哪些事项？', '结算需要哪些文件？'],
    promptNote: '问题会出现在现有聊天的建议中。您可以在发送前进一步修改。',
    boundary: '重要决定由参与方确认', boundaryText: '助手的回答不能替代文件、质量检查结果或约定条款。请勿在公开聊天中发送密码、令牌或个人数据。',
    deal: 'Gekta 如何协助交易', join: '申请接入',
  },
} as const;
const ICONS = [Sprout, Truck, FileText] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = canonicalPublicLocale(await getLocale()); const c = COPY[locale];
  return { title:c.meta, description:c.description, alternates:{canonical:'/platform-v7/gekta', languages:{ru:'/platform-v7/gekta?lang=ru',en:'/platform-v7/gekta?lang=en',zh:'/platform-v7/gekta?lang=zh'}},robots:{index:true,follow:true} };
}
export default async function GektaEntryPage() {
  const locale = canonicalPublicLocale(await getLocale()); const c = COPY[locale];
  return <main className='pc-canonical-public pc-cp-page-gekta' data-testid='gekta-public-entry'>
    <CanonicalPublicHeader locale={locale} activePath='/platform-v7/gekta' />
    <section className='pc-cp-gekta-public-hero'><div className='pc-cp-container'><div className='pc-cp-gekta-hero-grid'>
      <div className='pc-cp-section-head'><span className='pc-cp-eyebrow'>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.lead}</p><div className='pc-cp-actions'><PublicGektaChatButton locale={locale} variant='section' /></div></div>
      <aside className='pc-cp-gekta-hero-quote'><strong>{c.note}</strong><p>{c.noteText}</p></aside>
    </div></div></section>
    <section className='pc-cp-section'><div className='pc-cp-container'><div className='pc-cp-section-head'><h2>{c.tasks}</h2></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:16,minWidth:0}}>
        {c.topics.map(([title,text],index) => { const Icon = ICONS[index]!; return <article className='pc-cp-card pc-cp-detail-block' key={title}><Icon size={24} aria-hidden='true' /><h3>{title}</h3><p>{text}</p></article>; })}
      </div>
    </div></section>
    <section className='pc-cp-section pc-cp-section--soft'><div className='pc-cp-container'><div className='pc-cp-section-head'><h2>{c.ask}</h2><p>{c.promptNote}</p></div>
      <div style={{display:'grid',gap:12,maxWidth:760}}>{c.prompts.map(prompt => <PublicGektaChatButton key={prompt} locale={locale} variant='section' prompt={prompt} />)}</div>
    </div></section>
    <section className='pc-cp-section'><div className='pc-cp-container'><div className='pc-cp-section-head'><h2>{c.boundary}</h2><p>{c.boundaryText}</p></div><div className='pc-cp-actions'><a className='pc-cp-button' href={`/platform-v7/ai-in-action?lang=${locale}`}>{c.deal}<ArrowRight size={16} aria-hidden='true' /></a><a className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/register?lang=${locale}`}>{c.join}</a></div></div></section>
    <CanonicalFooter locale={locale} /><CanonicalBottomNav locale={locale} active='/platform-v7/gekta' />
  </main>;
}
