'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, HelpCircle, MessageSquareText, ShieldCheck, TriangleAlert } from 'lucide-react';

type Locale = 'ru' | 'en' | 'zh';
type SubmissionState = 'idle' | 'sending' | 'sent' | 'failed' | 'unknown';
type ContactCopy = {
  kicker: string;
  title: string;
  lead: string;
  cards: readonly [readonly [string, string], readonly [string, string], readonly [string, string]];
  formTitle: string;
  formLead: string;
  type: string;
  name: string;
  organization: string;
  contact: string;
  message: string;
  consent: string;
  policy: string;
  phone: string;
  submit: string;
  sending: string;
  successTitle: string;
  successText: string;
  errorTitle: string;
  errorText: string;
  unknownTitle: string;
  unknownText: string;
  back: string;
};

const COPY: Record<Locale, ContactCopy> = {
  ru: {
    kicker: 'Подключение и сотрудничество',
    title: 'Связаться с нами',
    lead: 'Задайте вопрос о платформе, подключении организации или сотрудничестве.',
    cards: [
      ['О платформе', 'Поможем разобраться в возможностях и порядке работы.'],
      ['Подключение', 'Уточните, как подать заявку и какие сведения подготовить.'],
      ['Сотрудничество', 'Расскажите о вашей организации и предложении.'],
    ],
    formTitle: 'Отправить обращение',
    formLead: 'Укажите контакт для ответа. Обязательные поля отмечены звёздочкой.',
    type: 'Тема обращения',
    name: 'Имя',
    organization: 'Организация',
    contact: 'Телефон или электронная почта',
    message: 'Содержание обращения',
    consent: 'Даю согласие на обработку указанных данных для рассмотрения обращения и направления ответа.',
    policy: 'Политика конфиденциальности',
    phone: 'Связаться по телефону',
    submit: 'Отправить обращение',
    sending: 'Отправляем…',
    successTitle: 'Обращение отправлено',
    successText: 'Для ответа используем указанный вами контакт.',
    errorTitle: 'Обращение не отправлено',
    errorText: 'Проверьте данные и повторите попытку. Введённый текст сохранён в форме. Также можно связаться с нами по телефону.',
    unknownTitle: 'Отправка не подтверждена',
    unknownText: 'Не удалось получить подтверждение. Введённый текст сохранён в форме. Позвоните нам перед повторной отправкой, чтобы не создать дубликат.',
    back: 'На главную',
  },
  en: {
    kicker: 'Access and cooperation',
    title: 'Contact us',
    lead: 'Ask about the platform, connecting your organisation or working together.',
    cards: [
      ['About the platform', 'Get help with its capabilities and how it works.'],
      ['Access', 'Find out how to apply and which information to prepare.'],
      ['Cooperation', 'Tell us about your organisation and proposal.'],
    ],
    formTitle: 'Send an inquiry',
    formLead: 'Provide a contact for our reply. Required fields are marked with an asterisk.',
    type: 'Inquiry topic',
    name: 'Name',
    organization: 'Organisation',
    contact: 'Phone or email',
    message: 'Message',
    consent: 'I consent to processing the supplied data to review this inquiry and send a response.',
    policy: 'Privacy policy',
    phone: 'Contact us by phone',
    submit: 'Send inquiry',
    sending: 'Sending…',
    successTitle: 'Inquiry sent',
    successText: 'We will use the contact details you provided to reply.',
    errorTitle: 'Inquiry not sent',
    errorText: 'Check the details and try again. Your text remains in the form. You can also contact us by phone.',
    unknownTitle: 'Submission not confirmed',
    unknownText: 'We could not obtain confirmation. Your text remains in the form. Please call before sending again to avoid a duplicate.',
    back: 'Home',
  },
  zh: {
    kicker: '接入与合作',
    title: '联系我们',
    lead: '咨询平台、机构接入或合作事宜。',
    cards: [
      ['关于平台', '了解平台功能及使用流程。'],
      ['接入', '了解如何申请，以及需要准备哪些信息。'],
      ['合作', '介绍您的机构和合作建议。'],
    ],
    formTitle: '提交咨询',
    formLead: '请提供用于回复的联系方式。必填项以星号标注。',
    type: '咨询主题',
    name: '姓名',
    organization: '机构',
    contact: '电话或电子邮箱',
    message: '咨询内容',
    consent: '我同意处理所填写的数据，以便审核本次咨询并发送回复。',
    policy: '隐私政策',
    phone: '电话联系',
    submit: '发送咨询',
    sending: '正在发送…',
    successTitle: '咨询已发送',
    successText: '我们将通过您提供的联系方式回复。',
    errorTitle: '咨询未发送',
    errorText: '请检查信息后重试。已填写的内容保留在表单中，您也可以通过电话联系我们。',
    unknownTitle: '尚未确认发送结果',
    unknownText: '未能获得发送确认。已填写的内容保留在表单中。请在再次发送前电话联系，以免重复提交。',
    back: '首页',
  },
};

const QUESTION_TYPES: Record<Locale, readonly (readonly [string, string])[]> = {
  ru: [
    ['platform', 'Общий вопрос по платформе'],
    ['pilot', 'Помощь с подключением организации'],
    ['bank_partner', 'Банк или партнёр'],
    ['region', 'Региональное взаимодействие'],
    ['technical', 'Техническое подключение'],
    ['other', 'Другое обращение'],
  ],
  en: [
    ['platform', 'General platform question'],
    ['pilot', 'Organisation connection assistance'],
    ['bank_partner', 'Bank or partner'],
    ['region', 'Regional cooperation'],
    ['technical', 'Technical connection'],
    ['other', 'Other inquiry'],
  ],
  zh: [
    ['platform', '平台一般问题'],
    ['pilot', '机构接入协助'],
    ['bank_partner', '银行或合作伙伴'],
    ['region', '区域协作'],
    ['technical', '技术接入'],
    ['other', '其他咨询'],
  ],
};

function Card({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <article className='p7-contact-info-card'>{icon}<strong>{title}</strong><p>{text}</p></article>;
}

export function ContactClient({ sent, failed, locale }: { sent: boolean; failed: boolean; locale: Locale }) {
  const copy = COPY[locale];
  const suffix = `?lang=${locale}`;
  const [state, setState] = useState<SubmissionState>(sent ? 'sent' : failed ? 'failed' : 'idle');
  const inFlight = useRef(false);
  const completed = useRef(sent);
  const dirty = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sending = state === 'sending';

  useEffect(() => {
    // A locale/document navigation must not silently discard entered details.
    // Keep the draft only in the current form; never in a URL or browser storage.
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => {
      window.removeEventListener('beforeunload', guard);
      controller.current?.abort();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || completed.current) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = Object.fromEntries(
      ['type', 'name', 'organization', 'contact', 'message', 'consent', 'website', 'source', 'locale']
        .map((key) => [key, String(data.get(key) ?? '')]),
    );
    inFlight.current = true;
    dirty.current = true;
    setState('sending');
    const request = new AbortController();
    controller.current = request;
    const timer = window.setTimeout(() => request.abort(), 20_000);
    try {
      const response = await fetch('/api/platform-v7/inquiries', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: request.signal,
      });
      const result: unknown = await response.json().catch(() => null);
      const body = result && typeof result === 'object' && !Array.isArray(result)
        ? result as Record<string, unknown> : null;
      if (response.ok && body?.accepted === true && body.sent === true && body.delivered === true) {
        completed.current = true;
        dirty.current = false;
        setState('sent');
      } else {
        // An HTTP 200/accepted-only response is not delivery confirmation.
        setState(body?.accepted === false || body?.sent === false ? 'failed' : 'unknown');
      }
    } catch {
      // A timeout may occur after sending. Never automatically retry a mutation.
      setState('unknown');
    } finally {
      window.clearTimeout(timer);
      controller.current = null;
      inFlight.current = false;
    }
  }

  return (
    <main id='main-content' tabIndex={-1} className='p7-contact-page' data-testid='platform-v7-question-form-page'>
      <section className='p7-contact-layout'>
        <div className='p7-contact-copy'>
          <span className='p7-contact-kicker'>{copy.kicker}</span>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
          <p>{copy.phone}: <a href='tel:+79162778989' style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>+7 916 277-89-89</a></p>
          <div className='p7-contact-cards'>
            <Card icon={<MessageSquareText size={22} aria-hidden='true' />} title={copy.cards[0][0]} text={copy.cards[0][1]} />
            <Card icon={<ShieldCheck size={22} aria-hidden='true' />} title={copy.cards[1][0]} text={copy.cards[1][1]} />
            <Card icon={<HelpCircle size={22} aria-hidden='true' />} title={copy.cards[2][0]} text={copy.cards[2][1]} />
          </div>
        </div>

        <section className='p7-contact-form-card' aria-label={copy.formTitle}>
          {state === 'sent' ? (
            <div className='p7-contact-success' role='status'>
              <span><ShieldCheck size={24} aria-hidden='true' /></span>
              <h2>{copy.successTitle}</h2>
              <p>{copy.successText}</p>
              <Link href={`/platform-v7${suffix}`}>{copy.back}<ArrowRight size={17} aria-hidden='true' /></Link>
            </div>
          ) : (
            <>
              {state === 'failed' || state === 'unknown' ? (
                <div className='p7-contact-error' role='alert' id='contact-submit-error'>
                  <TriangleAlert size={22} aria-hidden='true' />
                  <div><strong>{state === 'unknown' ? copy.unknownTitle : copy.errorTitle}</strong><p>{state === 'unknown' ? copy.unknownText : copy.errorText}</p></div>
                </div>
              ) : null}
              <form ref={formRef} method='post' action='/api/platform-v7/inquiries' onSubmit={submit}
                onChange={() => { dirty.current = true; }} className='p7-contact-form'
                aria-busy={sending} aria-describedby={state === 'failed' || state === 'unknown' ? 'contact-submit-error' : undefined}>
                <input type='text' name='website' tabIndex={-1} autoComplete='off' aria-hidden='true' className='p7-contact-honeypot' />
                <input type='hidden' name='source' value='platform_v7_contact_page' />
                <input type='hidden' name='locale' value={locale} />
                <h2>{copy.formTitle}</h2>
                <p>{copy.formLead}</p>
                <label>
                  <span>{copy.type} *</span>
                  <select name='type' required defaultValue='platform' disabled={sending}>
                    {QUESTION_TYPES[locale].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label><span>{copy.name} *</span><input name='name' type='text' autoComplete='name' minLength={2} maxLength={80} required disabled={sending} /></label>
                <label><span>{copy.organization}</span><input name='organization' type='text' autoComplete='organization' maxLength={120} disabled={sending} /></label>
                <label><span>{copy.contact} *</span><input name='contact' type='text' inputMode='email' autoComplete='email' autoCapitalize='none' spellCheck={false} minLength={5} maxLength={120} required disabled={sending} /></label>
                <label className='p7-contact-full'><span>{copy.message} *</span><textarea name='message' maxLength={2000} rows={6} required disabled={sending} /></label>
                <label className='p7-contact-consent'><input type='checkbox' name='consent' value='yes' required disabled={sending} /><span>{copy.consent} <Link href={`/platform-v7/privacy${suffix}`} target='_blank' rel='noopener noreferrer'>{copy.policy}</Link></span></label>
                <button type='submit' disabled={sending}>{sending ? copy.sending : copy.submit}<ArrowRight size={17} aria-hidden='true' /></button>
                {sending ? <p role='status'>{copy.sending}</p> : null}
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
