'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';
import { GektaBrandMark } from './GektaBrandMark';
import styles from './GektaWorkspace.module.css';

type UtilityKind = 'security' | 'support';

type Copy = Readonly<{
  brand: string;
  back: string;
  securityNav: string;
  supportNav: string;
  securityTitle: string;
  securityLead: string;
  securityCards: readonly Readonly<{ title: string; text: string }>[];
  securityBoundaryTitle: string;
  securityBoundaryText: string;
  supportTitle: string;
  supportLead: string;
  formTitle: string;
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
    brand: 'Гекта',
    back: 'Вернуться в Гекту',
    securityNav: 'Данные и безопасность',
    supportNav: 'Поддержка',
    securityTitle: 'Данные и безопасность',
    securityLead: 'Где хранится история, какие данные можно прикладывать и где нужна проверка специалиста.',
    securityCards: [
      { title: 'Локальная история', text: 'В анонимном режиме история диалогов хранится в этом браузере. Очистить её можно из меню Гекты.' },
      { title: 'Секреты не отправляются в чат', text: 'Не вводи пароли, токены, закрытые ключи и другие секреты. Для рабочих данных используй только разрешённые контуры платформы.' },
      { title: 'ИИ не получает полномочия участника', text: 'Гекта помогает анализировать и объяснять следующий шаг, но не принимает лабораторные, юридические или финансовые решения вместо уполномоченного участника.' },
      { title: 'Недостаток данных виден', text: 'Если данных не хватает, ответ должен отделять подтверждённый факт от вывода, риска и ограничения, а не выдавать гипотезу за факт.' },
    ],
    securityBoundaryTitle: 'Практическое правило',
    securityBoundaryText: 'Для вопроса в Гекте достаточно данных, нужных для анализа задачи. Не прикладывай лишние персональные данные, секреты или реквизиты доступа.',
    supportTitle: 'Поддержка Гекты',
    supportLead: 'Опиши, что произошло. Ответим на почту или телефон, который ты укажешь.',
    formTitle: 'Написать в поддержку',
    type: 'Тема',
    name: 'Имя',
    organization: 'Организация · необязательно',
    contact: 'Телефон или электронная почта',
    message: 'Что произошло',
    consent: 'Даю согласие на обработку указанных данных для рассмотрения обращения и направления ответа.',
    submit: 'Отправить обращение',
    submitting: 'Отправляем…',
    sentTitle: 'Обращение отправлено',
    sentText: 'Ответ будет направлен по указанному контакту после рассмотрения обращения.',
    errorTitle: 'Не удалось отправить',
    errorText: 'Текст остался в форме. Проверь соединение и попробуй снова.',
    newMessage: 'Отправить ещё одно',
    noSecrets: 'Не отправляй секреты, пароли, токены и ключи MFA.',
  },
  en: {
    brand: 'Gekta',
    back: 'Back to Gekta',
    securityNav: 'Data and security',
    supportNav: 'Support',
    securityTitle: 'Data and security',
    securityLead: 'Where your history is stored, what you can attach and when to check with a specialist.',
    securityCards: [
      { title: 'Local anonymous history', text: 'In anonymous mode, conversation history is stored in this browser and can be cleared from the Gekta menu.' },
      { title: 'Do not send secrets', text: 'Do not enter passwords, tokens, private keys or other secrets. Use only authorised platform channels for protected working data.' },
      { title: 'AI has no participant authority', text: 'Gekta can analyse and explain next steps, but it does not make laboratory, legal or financial decisions for authorised participants.' },
      { title: 'Uncertainty stays visible', text: 'When information is insufficient, the answer must separate confirmed facts, conclusions, risks and limitations rather than present a hypothesis as fact.' },
    ],
    securityBoundaryTitle: 'Practical rule',
    securityBoundaryText: 'Share only the information needed to analyse the task. Do not attach unnecessary personal data, secrets or access credentials.',
    supportTitle: 'Gekta support',
    supportLead: 'Tell us what happened. We’ll reply by email or phone using the contact details you provide.',
    formTitle: 'Contact support',
    type: 'Topic',
    name: 'Name',
    organization: 'Organisation · optional',
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
    brand: 'Gekta',
    back: '返回 Gekta',
    securityNav: '数据与安全',
    supportNav: '支持',
    securityTitle: '数据与安全',
    securityLead: '了解历史记录存放位置、可附加的数据，以及何时需要专业人员核实。',
    securityCards: [
      { title: '匿名历史保存在本地', text: '匿名模式下，对话历史保存在当前浏览器中，可从 Gekta 菜单中清除。' },
      { title: '不要发送秘密信息', text: '不要输入密码、令牌、私钥或其他秘密信息。受保护的工作数据只能通过获准的平台通道处理。' },
      { title: 'AI 不获得参与者权限', text: 'Gekta 可以分析并解释下一步，但不会代替获授权参与者作出实验室、法律或财务决定。' },
      { title: '不确定性必须可见', text: '数据不足时，回答应区分已确认事实、结论、风险与限制，而不是把假设说成事实。' },
    ],
    securityBoundaryTitle: '实用规则',
    securityBoundaryText: '只提供分析任务所必需的信息。不要附加不必要的个人数据、秘密信息或访问凭据。',
    supportTitle: 'Gekta 支持',
    supportLead: '请描述遇到的问题。我们会通过你提供的电子邮箱或电话回复。',
    formTitle: '联系支持',
    type: '主题',
    name: '姓名',
    organization: '组织（选填）',
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
      <div className='mx-auto flex min-h-[60px] max-w-5xl items-center gap-3 px-4 sm:min-h-16 sm:px-6'>
        <Link href={GEKTA_PATHS[locale]} className='flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
          <GektaBrandMark size={34} />
          <span className='truncate text-lg font-bold tracking-tight text-slate-950'>{copy.brand}</span>
        </Link>
        <nav className='hidden items-center gap-1 sm:flex' aria-label='Gekta'>
          <Link href={route(locale, 'security')} aria-current={kind === 'security' ? 'page' : undefined} className='inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700'>{copy.securityNav}</Link>
          <Link href={route(locale, 'support')} aria-current={kind === 'support' ? 'page' : undefined} className='inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700'>{copy.supportNav}</Link>
        </nav>
        <Link href={GEKTA_PATHS[locale]} aria-label={copy.back} title={copy.back} className='grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
          <ArrowLeft className='h-5 w-5' aria-hidden='true' />
        </Link>
      </div>
      <nav className='mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-2 sm:hidden' aria-label='Gekta sections'>
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
      <section className='mx-auto max-w-5xl px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-12'>
        <h1 className='max-w-3xl text-balance text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-5xl'>{copy.securityTitle}</h1>
        <p className='mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg'>{copy.securityLead}</p>
        <div className='mt-6 grid gap-3 md:grid-cols-2'>
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
  const receipt = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (status === 'sent') receipt.current?.focus();
  }, [status]);

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
    <section className='mx-auto max-w-[760px] px-4 pb-14 pt-7 sm:px-6 sm:pb-20 sm:pt-12'>
      <h1 className='text-balance text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-5xl'>{copy.supportTitle}</h1>
      <p className='mt-3 max-w-[36rem] text-base leading-7 text-slate-600 sm:text-lg'>{copy.supportLead}</p>

      <div className='mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:mt-7 sm:p-7'>
        {status === 'sent' ? (
          <div role='status' className='max-w-2xl py-4'>
            <span className='grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700'><CheckCircle2 className='h-6 w-6' aria-hidden='true' /></span>
            <h2 ref={receipt} tabIndex={-1} className='mt-5 text-2xl font-semibold tracking-tight text-slate-950'>{copy.sentTitle}</h2>
            <p className='mt-3 text-base leading-7 text-slate-600'>{copy.sentText}</p>
            <button type='button' onClick={() => setStatus('idle')} className='mt-6 min-h-12 rounded-full border border-slate-200 px-5 py-3 font-semibold text-slate-800 hover:border-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700'>{copy.newMessage}</button>
          </div>
        ) : (
          <form aria-label={copy.formTitle} onSubmit={submit} className='grid gap-4 sm:grid-cols-2' data-gekta-support-form='true'>
            <input type='text' name='website' tabIndex={-1} autoComplete='off' aria-hidden='true' className='absolute left-[-9999px]' />
            <div className='grid gap-2 sm:col-span-2'>
              <label htmlFor='gekta-support-message' className='text-sm font-semibold text-slate-700'>{copy.message}</label>
              <textarea name='message' id='gekta-support-message' rows={4} maxLength={2000} required aria-describedby='gekta-support-secret-hint' className='min-h-28 resize-y rounded-xl border border-slate-200 px-3 py-3 text-[16px] leading-6 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100' />
              <p id='gekta-support-secret-hint' className='text-xs leading-5 text-slate-500'>{copy.noSecrets}</p>
            </div>
            <label className='grid gap-2 text-sm font-semibold text-slate-700'><span>{copy.name}</span><input name='name' autoComplete='name' minLength={2} maxLength={80} required className='min-h-12 rounded-xl border border-slate-200 px-3 text-[16px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100' /></label>
            <label className='grid gap-2 text-sm font-semibold text-slate-700'><span>{copy.contact}</span><input name='contact' minLength={5} maxLength={120} required className='min-h-12 rounded-xl border border-slate-200 px-3 text-[16px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100' /></label>
            <label className='grid gap-2 text-sm font-semibold text-slate-700'>
              <span>{copy.type}</span>
              <span className='relative'>
                <select name='type' defaultValue='platform' required className={styles.selectControl}>
                  {TYPE_OPTIONS[locale].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <ChevronDown className='pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500' aria-hidden='true' />
              </span>
            </label>
            <label className='grid gap-2 text-sm font-semibold text-slate-700'><span>{copy.organization}</span><input name='organization' autoComplete='organization' maxLength={120} className='min-h-12 rounded-xl border border-slate-200 px-3 text-[16px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100' /></label>
            <label className='flex min-h-12 items-start gap-3 rounded-xl border border-emerald-900/10 bg-[#f3f8f3] p-3.5 text-sm leading-6 text-slate-700 sm:col-span-2'><input type='checkbox' name='consent' value='yes' required className='mt-1 h-5 w-5 shrink-0 accent-emerald-800' /><span>{copy.consent}</span></label>
            {status === 'error' ? <div role='alert' className='rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:col-span-2'><strong className='block'>{copy.errorTitle}</strong><span className='mt-1 block'>{copy.errorText}</span></div> : null}
            <button type='submit' disabled={status === 'sending'} className='inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 sm:justify-self-start sm:col-span-2'>{status === 'sending' ? copy.submitting : copy.submit}<ArrowRight className='h-4 w-4' aria-hidden='true' /></button>
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
