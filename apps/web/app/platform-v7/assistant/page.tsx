import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { ShieldCheck, Sparkles, Radio } from 'lucide-react';
import { AiAssistantPanel } from '@/components/platform-v7/AiAssistantPanel';
import { getAuthProfile } from '@/lib/auth-profile-server';

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    title: 'Помощник сделки · Прозрачная Цена',
    description: 'Живой ролевой ИИ-помощник по доступным сделкам, документам, логистике, деньгам и спорам.',
    eyebrow: 'Персональный помощник · на связи',
    heading: 'Общайся с платформой как с компетентным сотрудником',
    body: 'Помощник понимает текущий экран, использует серверную роль и доступные сделки, объясняет причину, следующий шаг, ответственный контур, срок, деньги под риском и подтверждённые основания.',
    boundary: 'Он остаётся ИИ, а не человеком: каждый запрос повторно авторизуется, факты берутся из Deal Core, а денежные, юридические и арбитражные решения не выполняются без доменного процесса и полномочий.',
    unavailable: 'Серверный профиль не подтверждён. Помощник останется fail-closed до восстановления сессии.',
    live: 'На связи',
  },
  en: {
    title: 'Deal assistant · Transparent Price',
    description: 'Conversational role-scoped AI assistant for accessible deals, documents, logistics, money and disputes.',
    eyebrow: 'Personal assistant · online',
    heading: 'Talk to the platform like a competent colleague',
    body: 'The assistant understands the current screen and uses the server role and accessible deals to explain the reason, next action, responsible scope, deadline, money at risk and confirmed evidence.',
    boundary: 'It remains an AI, not a human: every request is re-authorized, facts come from Deal Core, and money, legal and arbitration decisions require the authorized domain process.',
    unavailable: 'The server profile is not confirmed. The assistant remains fail-closed until the session is restored.',
    live: 'Online',
  },
  zh: {
    title: '交易助手 · 透明价格',
    description: '面向可访问交易、文件、物流、资金和争议的对话式角色范围 AI 助手。',
    eyebrow: '个人助手 · 在线',
    heading: '像与专业同事交流一样使用平台',
    body: '助手理解当前页面，并使用服务器角色和可访问交易解释原因、下一步、责任范围、期限、资金风险和已确认依据。',
    boundary: '它始终是 AI 而不是人：每次请求都会重新授权，事实来自 Deal Core，资金、法律和仲裁决定必须通过获授权的领域流程。',
    unavailable: '服务器档案未确认。会话恢复前，助手保持 fail-closed。',
    live: '在线',
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
          {profile.available ? <em><Radio size={13} aria-hidden='true' /> {copy.live}</em> : null}
        </aside>
      </header>
      <AiAssistantPanel variant='workspace' />
      <style>{css}</style>
    </main>
  );
}

const css = `
.p7-ai-page{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:28px 0 42px;color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.p7-ai-page-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);gap:24px;align-items:end;margin-bottom:22px}.p7-ai-page-eyebrow{display:inline-flex;align-items:center;gap:7px;color:#087a3b;font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.05em}.p7-ai-page h1{max-width:820px;margin:10px 0 0;font-size:clamp(30px,4vw,52px);line-height:1.03;letter-spacing:-.045em}.p7-ai-page-head>div>p{max-width:800px;margin:14px 0 0;color:#52615b;font-size:16px;line-height:1.55;font-weight:560}.p7-ai-page-head aside{position:relative;display:grid;grid-template-columns:28px minmax(0,1fr);gap:4px 10px;padding:17px;border:1px solid #cfe0d5;border-radius:16px;background:linear-gradient(145deg,#f7faf8,#eef8f2)}.p7-ai-page-head aside>svg{grid-row:1/3;color:#087a3b}.p7-ai-page-head aside strong{font-size:13px;line-height:1.3}.p7-ai-page-head aside span{color:#52615b;font-size:11px;line-height:1.45;font-weight:620}.p7-ai-page-head aside em{grid-column:2;display:inline-flex;align-items:center;gap:5px;width:max-content;margin-top:7px;padding:4px 8px;border-radius:999px;background:#e7f7ed;color:#087a3b;font-size:10px;font-style:normal;font-weight:850;text-transform:uppercase;letter-spacing:.04em}@media(max-width:760px){.p7-ai-page{width:min(100% - 24px,1180px);padding-top:18px}.p7-ai-page-head{grid-template-columns:1fr;gap:14px}.p7-ai-page h1{font-size:32px}.p7-ai-page-head>div>p{font-size:14px}}
`;
