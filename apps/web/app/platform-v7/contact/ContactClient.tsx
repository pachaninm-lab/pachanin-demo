'use client';

import Link from 'next/link';
import { ArrowRight, HelpCircle, MessageSquareText, ShieldCheck, TriangleAlert } from 'lucide-react';

type Locale = 'ru' | 'en' | 'zh';

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
  submit: string;
  successTitle: string;
  successText: string;
  errorTitle: string;
  errorText: string;
  back: string;
};

const COPY: Record<Locale, ContactCopy> = {
  ru: {
    kicker: 'Официальный канал обращения',
    title: 'Связаться с платформой',
    lead: 'Используйте форму для вопросов о платформе, партнёрстве, региональном взаимодействии или техническом подключении. Регистрация пользователя находится в отдельном разделе.',
    cards: [
      ['Без входа в кабинет', 'Форма доступна без авторизации и не открывает данные Сделок.'],
      ['Без подмены регистрации', 'Обращение в поддержку не создаёт аккаунт и не назначает роль. Отправка обращения не открывает сделки, документы и закрытые разделы платформы.'],
      ['Ответ по указанному контакту', 'Контакт используется для рассмотрения обращения и направления ответа.'],
    ],
    formTitle: 'Форма обращения',
    formLead: 'Заполните обязательные поля и укажите только данные, необходимые для связи.',
    type: 'Тема обращения',
    name: 'Имя',
    organization: 'Организация',
    contact: 'Телефон или электронная почта',
    message: 'Содержание обращения',
    consent: 'Даю согласие на обработку указанных данных для рассмотрения обращения и направления ответа.',
    submit: 'Отправить обращение',
    successTitle: 'Обращение принято',
    successText: 'Ответ будет направлен по указанному телефону или адресу электронной почты после рассмотрения обращения.',
    errorTitle: 'Обращение не отправлено',
    errorText: 'Проверьте заполненные данные и попробуйте ещё раз. Если ошибка повторяется, свяжитесь с платформой по телефону.',
    back: 'Вернуться к описанию платформы',
  },
  en: {
    kicker: 'Official contact channel',
    title: 'Contact the platform',
    lead: 'Use this form for questions about the platform, partnerships, regional cooperation or technical connection. User registration is a separate flow.',
    cards: [
      ['No account required', 'The form is available without authentication and does not expose Deal data.'],
      ['Not a registration substitute', 'A support inquiry does not create an account, assign a role or open Deal, document or protected workspace access.'],
      ['Reply to your contact', 'The contact details are used to review the inquiry and send a response.'],
    ],
    formTitle: 'Inquiry form',
    formLead: 'Complete the required fields and provide only the data needed to contact you.',
    type: 'Inquiry topic',
    name: 'Name',
    organization: 'Organisation',
    contact: 'Phone or email',
    message: 'Message',
    consent: 'I consent to processing the supplied data to review this inquiry and send a response.',
    submit: 'Send inquiry',
    successTitle: 'Inquiry received',
    successText: 'A response will be sent to the supplied phone number or email address after the inquiry is reviewed.',
    errorTitle: 'Inquiry not sent',
    errorText: 'Check the entered details and try again. If the error continues, contact the platform by phone.',
    back: 'Return to the platform overview',
  },
  zh: {
    kicker: '官方联系渠道',
    title: '联系平台',
    lead: '如有平台、合作、区域协作或技术接入问题，请使用此表单。用户注册是独立流程。',
    cards: [
      ['无需登录', '无需授权即可提交表单，且不会开放交易数据。'],
      ['不替代注册', '支持咨询不会创建账户、分配角色，也不会开放交易、文件或受保护工作区。'],
      ['按所填联系方式回复', '联系方式仅用于处理咨询并发送回复。'],
    ],
    formTitle: '咨询表单',
    formLead: '请填写必填项，并仅提供联系所需的数据。',
    type: '咨询主题',
    name: '姓名',
    organization: '机构',
    contact: '电话或电子邮箱',
    message: '咨询内容',
    consent: '我同意处理所填写的数据，以便审核本次咨询并发送回复。',
    submit: '发送咨询',
    successTitle: '咨询已受理',
    successText: '审核后将通过所填电话或电子邮箱发送回复。',
    errorTitle: '咨询未发送',
    errorText: '请检查所填信息后重试。如果问题仍然存在，请通过电话联系平台。',
    back: '返回平台介绍',
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

function Card({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <article className='p7-contact-info-card'>{icon}<strong>{title}</strong><p>{text}</p></article>;
}

export function ContactClient({ sent, failed, locale }: { sent: boolean; failed: boolean; locale: Locale }) {
  const copy = COPY[locale];
  const suffix = `?lang=${locale}`;

  return (
    <main id='main-content' tabIndex={-1} className='p7-contact-page' data-testid='platform-v7-question-form-page'>
      <section className='p7-contact-layout'>
        <div className='p7-contact-copy'>
          <span className='p7-contact-kicker'>{copy.kicker}</span>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
          <div className='p7-contact-cards'>
            <Card icon={<MessageSquareText size={22} />} title={copy.cards[0][0]} text={copy.cards[0][1]} />
            <Card icon={<ShieldCheck size={22} />} title={copy.cards[1][0]} text={copy.cards[1][1]} />
            <Card icon={<HelpCircle size={22} />} title={copy.cards[2][0]} text={copy.cards[2][1]} />
          </div>
        </div>

        <section className='p7-contact-form-card' aria-label={copy.formTitle}>
          {sent ? (
            <div className='p7-contact-success' role='status'>
              <span><ShieldCheck size={24} aria-hidden='true' /></span>
              <h2>{copy.successTitle}</h2>
              <p>{copy.successText}</p>
              <Link href={`/platform-v7${suffix}`}>{copy.back}<ArrowRight size={17} aria-hidden='true' /></Link>
            </div>
          ) : (
            <>
              {failed ? (
                <div className='p7-contact-error' role='alert'>
                  <TriangleAlert size={22} aria-hidden='true' />
                  <div><strong>{copy.errorTitle}</strong><p>{copy.errorText}</p></div>
                  <a href='tel:+79162778989'>+7 916 277-89-89</a>
                </div>
              ) : null}
              <form method='post' action='/api/platform-v7/inquiries' className='p7-contact-form'>
                <input type='text' name='website' tabIndex={-1} autoComplete='off' aria-hidden='true' className='p7-contact-honeypot' />
                <input type='hidden' name='source' value='platform_v7_contact_page' />
                <input type='hidden' name='locale' value={locale} />
                <h2>{copy.formTitle}</h2>
                <p>{copy.formLead}</p>
                <label>
                  <span>{copy.type}</span>
                  <select name='type' required defaultValue='platform'>
                    {QUESTION_TYPES[locale].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label><span>{copy.name}</span><input name='name' type='text' minLength={2} maxLength={80} required /></label>
                <label><span>{copy.organization}</span><input name='organization' type='text' maxLength={120} /></label>
                <label><span>{copy.contact}</span><input name='contact' type='text' minLength={5} maxLength={120} required /></label>
                <label className='p7-contact-full'><span>{copy.message}</span><textarea name='message' maxLength={2000} rows={6} required /></label>
                <label className='p7-contact-consent'><input type='checkbox' name='consent' value='yes' required /><span>{copy.consent}</span></label>
                <button type='submit'>{copy.submit}<ArrowRight size={17} aria-hidden='true' /></button>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
