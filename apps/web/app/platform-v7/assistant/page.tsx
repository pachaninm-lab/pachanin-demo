import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { AiAssistantPanel } from '@/components/platform-v7/AiAssistantPanel';
import { getAuthProfile } from '@/lib/auth-profile-server';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    title: 'Помощник сделки · Прозрачная Цена',
    description: 'Ролевой ИИ-помощник по доступным сделкам, документам, логистике, деньгам и спорам.',
    eyebrow: 'Персональный контур',
    heading: 'Разговор с платформой на естественном языке',
    body: 'Помощник использует серверную роль, membership и только доступные тебе сделки. Он не видит чужие кабинеты и не меняет критические состояния сделки.',
    boundary: 'Каждый запрос повторно проходит серверную проверку доступа. Денежные, банковские, юридические и арбитражные решения остаются за доменными сервисами и уполномоченными участниками.',
    unavailable: 'Серверный профиль не подтверждён. Помощник останется fail-closed до восстановления сессии.',
  },
  en: {
    title: 'Deal assistant · Transparent Price',
    description: 'Role-scoped AI assistant for accessible deals, documents, logistics, money and disputes.',
    eyebrow: 'Personal scope',
    heading: 'Talk to the platform in natural language',
    body: 'The assistant uses the server role, membership and only deals accessible to you. It cannot see other workspaces or change critical deal state.',
    boundary: 'Every request is authorized again on the server. Money, bank, legal and arbitration decisions remain with domain services and authorized participants.',
    unavailable: 'The server profile is not confirmed. The assistant remains fail-closed until the session is restored.',
  },
  zh: {
    title: '交易助手 · 透明价格',
    description: '面向可访问交易、文件、物流、资金和争议的角色范围 AI 助手。',
    eyebrow: '个人范围',
    heading: '使用自然语言与平台交流',
    body: '助手使用服务器角色、membership 和你可访问的交易，不能查看其他工作区，也不能更改关键交易状态。',
    boundary: '每次请求都会重新进行服务器授权。资金、银行、法律和仲裁决定仍由领域服务和授权参与者完成。',
    unavailable: '服务器档案未确认。会话恢复前，助手保持 fail-closed。',
  },
} as const;

function normalizeLocale(value: string): Locale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale(await getLocale());
  return {
    title: COPY[locale].title,
    description: COPY[locale].description,
    robots: { index: false, follow: false },
  };
}

export default async function PlatformV7AssistantPage() {
  const locale = normalizeLocale(await getLocale());
  const copy = COPY[locale];
  const profile = await getAuthProfile();

  return (
    <main className='p7-ai-page' data-private-ai-assistant='role-scoped' data-profile-available={String(profile.available)}>
      <header className='p7-ai-page-head'>
        <div>
          <span className='p7-ai-page-eyebrow'><Sparkles size={15} aria-hidden='true' /> {copy.eyebrow}</span>
          <h1>{copy.heading}</h1>
          <p>{copy.body}</p>
        </div>
        <aside>
          <ShieldCheck size={22} aria-hidden='true' />
          <strong>{profile.available ? (profile.surfaceRole || profile.role) : 'FAIL_CLOSED'}</strong>
          <span>{profile.available ? copy.boundary : copy.unavailable}</span>
        </aside>
      </header>
      <AiAssistantPanel variant='workspace' />
      <style>{css}</style>
    </main>
  );
}

const css = `
.p7-ai-page{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:28px 0 42px;color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.p7-ai-page-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,360px);gap:24px;align-items:end;margin-bottom:22px}.p7-ai-page-eyebrow{display:inline-flex;align-items:center;gap:7px;color:#087a3b;font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.05em}.p7-ai-page h1{max-width:780px;margin:10px 0 0;font-size:clamp(30px,4vw,52px);line-height:1.03;letter-spacing:-.045em}.p7-ai-page-head>div>p{max-width:760px;margin:14px 0 0;color:#52615b;font-size:16px;line-height:1.55;font-weight:560}.p7-ai-page-head aside{display:grid;grid-template-columns:28px minmax(0,1fr);gap:4px 10px;padding:16px;border:1px solid #cfe0d5;border-radius:14px;background:#f7faf8}.p7-ai-page-head aside svg{grid-row:1/3;color:#087a3b}.p7-ai-page-head aside strong{font-size:13px;line-height:1.3}.p7-ai-page-head aside span{color:#52615b;font-size:11px;line-height:1.45;font-weight:620}@media(max-width:760px){.p7-ai-page{width:min(100% - 24px,1180px);padding-top:18px}.p7-ai-page-head{grid-template-columns:1fr;gap:14px}.p7-ai-page h1{font-size:32px}.p7-ai-page-head>div>p{font-size:14px}}
`;
