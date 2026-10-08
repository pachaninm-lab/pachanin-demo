'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, LifeBuoy, LockKeyhole, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';

type UtilityKind = 'security' | 'support';

type Copy = Readonly<{
  brand: string;
  back: string;
  securityNav: string;
  supportNav: string;
  securityKicker: string;
  securityTitle: string;
  securityLead: string;
  securityCards: readonly Readonly<{ title: string; text: string }>[];
  securityBoundaryTitle: string;
  securityBoundaryText: string;
  supportKicker: string;
  supportTitle: string;
  supportLead: string;
  supportFacts: readonly Readonly<{ title: string; text: string }>[];
  formTitle: string;
  formLead: string;
  type: string;
  name: string;
  organization: string;
  contact: string;
  message: string;
  consent: string;
  submit: string;
  submitting: string;
  sentTitle: string;
  sentText: string;
  errorTitle: string;
  errorText: string;
  newMessage: string;
  noSecrets: string;
}>;

const COPY: Record<GektaLocale, Copy> = {
  ru: {
    brand: 'ГЕКТА',
    back: 'Вернуться в Гекту',
    securityNav: 'Данные и безопасность',
    supportNav: 'Поддержка',
    securityKicker: 'ГЕКТА · ДАННЫЕ И БЕЗОПАСНОСТЬ',
    securityTitle: 'Безопасность без выхода из Гекты',
    securityLead: 'Здесь собраны границы именно пользовательского контура Гекты: что хранится в браузере, чего не стоит отправлять и где заканчиваются полномочия ИИ.',
    securityCards: [
      { title: 'Локальная история', text: 'В анонимном режиме история диалогов хранится в этом браузере. Очистить её можно из меню Гекты.' },
      { title: 'Секреты не отправляются в чат', text: 'Не вводи пароли, токены, закрытые ключи и другие секреты. Для рабочих данных используй только разрешённые контуры платформы.' },
      { title: 'ИИ не получает полномочия участника', text: 'Гекта помогает анализировать и объяснять следующий шаг, но не принимает лабораторные, юридические или финансовые решения вместо уполномоченного участника.' },
      { title: 'Недостаток данных виден', text: 'Если данных не хватает, ответ должен отделять подтверждённый факт от вывода, риска и ограничения, а не выдавать гипотезу за факт.' },
    ],
    securityBoundaryTitle: 'Практическое правило',
    securityBoundaryText: 'Для вопроса в Гекте достаточно данных, нужных для анализа задачи. Не прикладывай лишние персональные данные, секреты или реквизиты доступа.',
    supportKicker: 'ГЕКТА · ПОДДЕРЖКА',
    supportTitle: 'Поддержка в одном интерфейсе',
    supportLead: 'Сообщи о проблеме с Гектой, доступом, интерфейсом или подключением. Форма остаётся внутри Гекты и не отправляет тебя на страницу с другим интерфейсом.',
    supportFacts: [
      { title: 'Без входа в кабинет', text: 'Обращение можно отправить без выбора роли и без доступа к рабочим данным.' },
      { title: 'По указанному контакту', text: 'Телефон или электронная почта используются для ответа по обращению.' },
      { title: 'Без секретов', text: 'Не отправляй пароль, токен, ключ MFA или другой секрет. Для диагностики опиши симптом, устройство и шаги воспроизведения.' },
    ],
    formTitle: 'Написать в поддержку',
    formLead: 'Обязательны имя, контакт, содержание обращения и согласие на обработку указанных данных.',
    type: 'Тема',
    name: 'Имя',
    organization: 'Организация',
    contact: 'Телефон или электронная почта',
    message: 'Что произошло',
    consent: 'Даю согласие на обработку указанных данных для рассмотрения обращения и направления ответа.',
    submit: 'Отправить обращение',
    submitting: 'Отправляем…',
    sentTitle: 'Обращение отправлено',
    sentText: 'Ответ будет направлен по указанному контакту после рассмотрения обращения.',
    errorTitle: 'Не удалось отправить',
    errorText: 'Данные сохранены только в форме. Проверь соединение и повтори отправку.',
    newMessage: 'Отправить ещё одно',
    noSecrets: 'Не отправляй секреты, пароли, токены и ключи MFA.',
  },
  en: {
    brand: 'GEKTA',
    back: 'Back to Gekta',
    securityNav: 'Data and security',
    supportNav: 'Support',
    securityKicker: 'GEKTA · DATA & SECURITY',
    securityTitle: 'Security without leaving Gekta',
    securityLead: 'This page explains the boundaries of Gekta’s user-facing surface: what stays in the browser, what should not be sent, and where AI authority ends.',
    securityCards: [
      { title: 'Local anonymous history', text: 'In anonymous mode, conversation history is stored in this browser and can be cleared from the Gekta menu.' },
      { title: 'Do not send secrets', text: 'Do not enter passwords, tokens, private keys or other secrets. Use only authorised platform channels for protected working data.' },
      { title: 'AI has no participant authority', text: 'Gekta can analyse and explain next steps, but it does not make laboratory, legal or financial decisions for authorised participants.' },
      { title: 'Uncertainty stays visible', text: 'When information is insufficient, the answer must separate confirmed facts, conclusions, risks and limitations rather than present a hypothesis as fact.' },
    ],
    securityBoundaryTitle: 'Practical rule',
    securityBoundaryText: 'Share only the information needed to analyse the task. Do not attach unnecessary personal data, secrets or access credentials.',
    supportKicker: 'GEKTA · SUPPORT',
    supportTitle: 'Support in one interface',
    supportLead: 'Report a problem with Gekta, access, the interface or onboarding. The form stays inside Gekta instead of sending you to a different product surface.',
    supportFacts: [
      { title: 'No account required', text: 'You can send a request without selecting a role or opening working data.' },
      { title: 'Reply to your contact', text: 'The phone number or email address is used to reply to the request.' },
      { title: 'No secrets', text: 'Do not send passwords, tokens or MFA keys. For diagnostics, describe the symptom, device and reproduction steps.' },
    ],
    formTitle: 'Contact support',
    formLead: 'Name, contact details, request text and consent are required.',
    type: 'Topic',
    name: 'Name',
    organization: 'Organisation',
    contact: 'Phone or email',
    message: 'What happened',
    consent: 'I consent to the processing of the supplied data for reviewing and replying to this request.',
    submit: 'Send request',
    submitting: 'Sending…',
    sentTitle: 'Request sent',
    sentText: 'A reply will be sent to the contact you provided after the request is reviewed.',
    errorTitle: 'Could not send',
    errorText: 'Your text remains in the form. Check the connection and try again.',
    newMessage: 'Send another request',
    noSecrets: 'Do not send secrets, passwords, tokens or MFA keys.',
  },
  zh: {
    brand: 'GEKTA',
    back: '返回 Gekta',
    securityNav: '数据与安全',
    supportNav: '支持',
    securityKicker: 'GEKTA · 数据与安全',
    securityTitle: '无需离开 Gekta 的安全说明',
    securityLead: '这里说明 Gekta 用户界面的边界：哪些内容保存在浏览器中、哪些内容不应发送，以及 AI 权限在哪里结束。',
    securityCards: [
      { title: '匿名历史保存在本地', text: '匿名模式下，对话历史保存在当前浏览器中，可从 Gekta 菜单中清除。' },
      { title: '不要发送秘密信息', text: '不要输入密码、令牌、私钥或其他秘密信息。受保护的工作数据只能通过获准的平台通道处理。' },
      { title: 'AI 不获得参与者权限', text: 'Gekta 可以分析并解释下一步，但不会代替获授权参与者作出实验室、法律或财务决定。' },
      { title: '不确定性必须可见', text: '数据不足时，回答应区分已确认事实、结论、风险与限制，而不是把假设说成事实。' },
    ],
    securityBoundaryTitle: '实用规则',
    securityBoundaryText: '只提供分析任务所必需的信息。不要附加不必要的个人数据、秘密信息或访问凭据。',
    supportKicker: 'GEKTA · 支持',
    supportTitle: '在同一界面获得支持',
    supportLead: '可报告 Gekta、访问、界面或接入问题。表单保留在 Gekta 内，不会把你带到另一个产品界面。',
    supportFacts: [
      { title: '无需登录', text: '无需选择角色或访问工作数据即可提交请求。' },
      { title: '按所留联系方式回复', text: '电话或电子邮箱仅用于回复本次请求。' },
      { title: '不要发送秘密', text: '不要发送密码、令牌或 MFA 密钥。诊断问题时请描述症状、设备和复现步骤。' },
    ],
    formTitle: '联系支持',
    formLead: '姓名、联系方式、请求内容以及同意处理所提供数据为必填项。',
    type: '主题',
    name: '姓名',
    organization: '组织',
    contact: '电话或电子邮箱',
    message: '发生了什么',
    consent: '我同意处理所提供的数据，以便审查并回复本次请求。',
    submit: '发送请求',
    submitting: '正在发送…',
    sentTitle: '请求已发送',
    sentText: '审查后，回复将发送到你提供的联系方式。',
    errorTitle: '发送失败',
    errorText: '填写内容仍保留在表单中。请检查网络连接后重试。',
    newMessage: '再发送一条',
    noSecrets: '不要发送秘密、密码、令牌或 MFA 密钥。',
  },
};

const TYPE_OPTIONS: Record<GektaLocale, readonly Readonly<[string, string]>[]> = {
  ru: [['platform', 'Вопрос по Гекте'], ['technical', 'Техническая проблема'], ['pilot', 'Доступ или подключение'], ['other', 'Другое']],
  en: [['platform', 'Question about Gekta'], ['technical', 'Technical problem'], ['pilot', 'Access or onboarding'], ['other', 'Other']],
  zh: [['platform', 'Gekta 相关问题'], ['technical', '技术问题'], ['pilot', '访问或接入'], ['other', '其他']],
};

function route(locale: GektaLocale, kind: UtilityKind): string {
  return `${GEKTA_PATHS[locale]}/${kind}`;
}

function GektaUtilityHeader({ locale, kind }: { locale: GektaLocale; kind: UtilityKind }) {
  const copy = COPY[locale];
  return (
    <header className='sticky top-0 z-30 border-b border-emerald-950/10 bg-[#fbfaf5]/95 backdrop-blur'>
      <div className='mx-auto flex min-h-[72px] max-w-6xl items-center gap-3 px-4 sm:px-6'>
        <Link href={GEKTA_PATHS[locale]} className='flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
          <span className='grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-base font-black text-white'>G</span>
          <span className='truncate text-lg font-black tracking-[0.13em] text-slate-950'>{copy.brand}</span>
        </Link>
        <nav className='hidden items-center gap-1 sm:flex' aria-label='Gekta'>
          <Link href={route(locale, 'security')} aria-current={kind === 'security' ? 'page' : undefined} className='inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700'>{copy.securityNav}</Link>
          <Link href={route(locale, 'support')} aria-current={kind === 'support' ? 'page' : undefined} className='inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700'>{copy.supportNav}</Link>
        </nav>
        <Link href={GEKTA_PATHS[locale]} aria-label={copy.back} title={copy.back} className='grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
          <ArrowLeft className='h-5 w-5' aria-hidden='true' />
        </Link>
      </div>
      <nav className='mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-2 sm:hidden' aria-label='Gekta sections'>
        <Link href={route(locale, 'security')} aria-current={kind === 'security' ? 'page' : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${kind === 'security' ? 'bg-emerald-800 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{copy.securityNav}</Link>
        <Link href={route(locale, 'support')} aria-current={kind === 'support' ? 'page' : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${kind === 'support' ? 'bg-emerald-800 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{copy.supportNav}</Link>
      </nav>
    </header>
  );
}

function SecurityPage({ locale }: { locale: GektaLocale }) {
  const copy = COPY[locale];
  return (
    <>
      <section className='mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16'>
        <p className='text-xs font-bold uppercase tracking-[0.18em] text-emerald-800'>{copy.securityKicker}</p>
        <h1 className='mt-4 max-w-4xl text-[36px] font-semibold leading-[1.04] tracking-[-0.035em] text-slate-950 sm:text-6xl'>{copy.securityTitle}</h1>
        <p className='mt-6 max-w-3xl text-[17px] leading-7 text-slate-600 sm:text-lg sm:leading-8'>{copy.securityLead}</p>
        <div className='mt-10 grid gap-4 md:grid-cols-2'>
          {copy.securityCards.map((card, index) => (
            <article key={card.title} className='rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'>
              {index === 0 ? <LockKeyhole className='h-6 w-6 text-emerald-700' aria-hidden='true' /> : index === 1 ? <ShieldCheck className='h-6 w-6 text-emerald-700' aria-hidden='true' /> : index === 2 ? <Sparkles className='h-6 w-6 text-emerald-700' aria-hidden='true' /> : <CheckCircle2 className='h-6 w-6 text-emerald-700' aria-hidden='true' />}
              <h2 className='mt-5 text-xl font-semibold tracking-tight text-slate-950'>{card.title}</h2>
              <p className='mt-3 text-base leading-7 text-slate-600'>{card.text}</p>
            </article>
          ))}
        </div>
        <aside className='mt-6 rounded-3xl border border-emerald-900/10 bg-[#eff5ee] p-6 sm:p-8'>
          <h2 className='text-xl font-semibold text-slate-950'>{copy.securityBoundaryTitle}</h2>
          <p className='mt-3 max-w-3xl text-base leading-7 text-slate-700'>{copy.securityBoundaryText}</p>
        </aside>
        <div className='mt-8 flex flex-wrap gap-3'>
          <Link href={route(locale, 'support')} className='inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700'>{copy.supportNav}<ArrowRight className='h-4 w-4' aria-hidden='true' /></Link>
          <Link href={GEKTA_PATHS[locale]} className='inline-flex min-h-12 items-center rounded-full border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 hover:border-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700'>{copy.back}</Link>
        </div>
      </section>
    </>
  );
}

function SupportPage({ locale }: { locale: GektaLocale }) {
  const copy = COPY[locale];
  const [status, setStatus] = React.useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus('sending');
    try {
      const response = await fetch('/api/platform-v7/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'support_chat',
          type: String(data.get('type') || 'platform'),
          name: String(data.get('name') || ''),
          organization: String(data.get('organization') || ''),
          contact: String(data.get('contact') || ''),
          message: String(data.get('message') || ''),
          consent: data.get('consent') === 'yes' ? 'yes' : '',
          website: String(data.get('website') || ''),
        }),
      });
      if (!response.ok) throw new Error(`support_${response.status}`);
      const result = await response.json().catch(() => null) as { accepted?: boolean; sent?: boolean } | null;
      if (!result?.accepted || !result?.sent) throw new Error('support_not_delivered');
      setStatus('sent');
      form.reset();
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className='mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16'>
      <p className='text-xs font-bold uppercase tracking-[0.18em] text-emerald-800'>{copy.supportKicker}</p>
      <h1 className='mt-4 max-w-4xl text-[36px] font-semibold leading-[1.04] tracking-[-0.035em] text-slate-950 sm:text-6xl'>{copy.supportTitle}</h1>
      <p className='mt-6 max-w-3xl text-[17px] leading-7 text-slate-600 sm:text-lg sm:leading-8'>{copy.supportLead}</p>

      <div className='mt-10 grid gap-4 md:grid-cols-3'>
        {copy.supportFacts.map((card, index) => (
          <article key={card.title} className='rounded-3xl border border-slate-200 bg-white p-5'>
            {index === 0 ? <MessageSquareText className='h-6 w-6 text-emerald-700' aria-hidden='true' /> : index === 1 ? <LifeBuoy className='h-6 w-6 text-emerald-700' aria-hidden='true' /> : <ShieldCheck className='h-6 w-6 text-emerald-700' aria-hidden='true' />}
            <h2 className='mt-4 text-lg font-semibold text-slate-950'>{card.title}</h2>
            <p className='mt-2 text-sm leading-6 text-slate-600'>{card.text}</p>
          </article>
        ))}
      </div>

      <div className='mt-8 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8'>
        {status === 'sent' ? (
          <div role='status' className='max-w-2xl py-4'>
            <span className='grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700'><CheckCircle2 className='h-6 w-6' aria-hidden='true' /></span>
            <h2 className='mt-5 text-2xl font-semibold tracking-tight text-slate-950'>{copy.sentTitle}</h2>
            <p className='mt-3 text-base leading-7 text-slate-600'>{copy.sentText}</p>
            <button type='button' onClick={() => setStatus('idle')} className='mt-6 min-h-12 rounded-full border border-slate-200 px-5 py-3 font-semibold text-slate-800 hover:border-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700'>{copy.newMessage}</button>
          </div>
        ) : (
          <form onSubmit={submit} className='grid gap-4 md:grid-cols-2' data-gekta-support-form='true'>
            <div className='md:col-span-2'>
              <h2 className='text-2xl font-semibold tracking-tight text-slate-950'>{copy.formTitle}</h2>
              <p className='mt-2 text-sm leading-6 text-slate-600'>{copy.formLead}</p>
            </div>
            <input type='text' name='website' tabIndex={-1} autoComplete='off' aria-hidden='true' className='absolute left-[-9999px]' />
            <label className='grid gap-2 text-sm font-semibold text-slate-700'><span>{copy.type}</span><select name='type' defaultValue='platform' required className='min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-[16px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'>{TYPE_OPTIONS[locale].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className='grid gap-2 text-sm font-semibold text-slate-700'><span>{copy.name}</span><input name='name' minLength={2} maxLength={80} required className='min-h-12 rounded-2xl border border-slate-200 px-4 text-[16px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100' /></label>
            <label className='grid gap-2 text-sm font-semibold text-slate-700'><span>{copy.organization}</span><input name='organization' maxLength={120} className='min-h-12 rounded-2xl border border-slate-200 px-4 text-[16px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100' /></label>
            <label className='grid gap-2 text-sm font-semibold text-slate-700'><span>{copy.contact}</span><input name='contact' minLength={5} maxLength={120} required className='min-h-12 rounded-2xl border border-slate-200 px-4 text-[16px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100' /></label>
            <label className='grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2'><span>{copy.message}</span><textarea name='message' rows={6} maxLength={2000} required className='min-h-36 resize-y rounded-2xl border border-slate-200 px-4 py-3 text-[16px] leading-6 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100' /></label>
            <label className='flex min-h-12 items-start gap-3 rounded-2xl border border-emerald-900/10 bg-[#f3f8f3] p-4 text-sm leading-6 text-slate-700 md:col-span-2'><input type='checkbox' name='consent' value='yes' required className='mt-1 h-5 w-5 shrink-0 accent-emerald-800' /><span>{copy.consent}</span></label>
            <p className='text-sm leading-6 text-slate-500 md:col-span-2'>{copy.noSecrets}</p>
            {status === 'error' ? <div role='alert' className='rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 md:col-span-2'><strong className='block'>{copy.errorTitle}</strong><span className='mt-1 block'>{copy.errorText}</span></div> : null}
            <button type='submit' disabled={status === 'sending'} className='inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-6 py-3 font-semibold text-white hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 md:col-span-2'>{status === 'sending' ? copy.submitting : copy.submit}<ArrowRight className='h-4 w-4' aria-hidden='true' /></button>
          </form>
        )}
      </div>
    </section>
  );
}

export function GektaUtilityPage({ locale, kind }: { locale: GektaLocale; kind: UtilityKind }) {
  return (
    <main className='min-h-screen overflow-x-clip bg-[#fbfaf5] text-slate-950' data-gekta-utility-page={kind}>
      <GektaUtilityHeader locale={locale} kind={kind} />
      {kind === 'security' ? <SecurityPage locale={locale} /> : <SupportPage locale={locale} />}
    </main>
  );
}
