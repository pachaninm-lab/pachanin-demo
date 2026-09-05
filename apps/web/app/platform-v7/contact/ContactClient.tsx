'use client';

import Link from 'next/link';
import { ArrowRight, HelpCircle, MessageSquareText, ShieldCheck } from 'lucide-react';

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
  back: string;
};

const COPY: Record<Locale, ContactCopy> = {
  ru: {
    kicker: 'Официальный канал обращения',
    title: 'Связаться с платформой',
    lead: 'Используйте форму для вопросов о платформе, партнёрстве, региональном взаимодействии или техническом подключении. Регистрация пользователя находится в отдельном разделе.',
    cards: [
      ['Без входа в кабинет', 'Форма доступна без авторизации и не открывает данные Сделок.'],
      ['Без подмены регистрации', 'Обращение в поддержку не создаёт аккаунт и не назначает роль.'],
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
    back: 'Вернуться к описанию платформы',
  },
  en: {
    kicker: 'Official contact channel',
    title: 'Contact the platform',
    lead: 'Use this form for questions about the platform, partnerships, regional cooperation or technical connection. User registration is a separate flow.',
    cards: [
      ['No account required', 'The form is available without authentication and does not expose Deal data.'],
      ['Not a registration substitute', 'A support inquiry does not create an account or assign a role.'],
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
    back: 'Return to the platform overview',
  },
  zh: {
    kicker: '官方联系渠道',
    title: '联系平台',
    lead: '如有平台、合作、区域协作或技术接入问题，请使用此表单。用户注册是独立流程。',
    cards: [
      ['无需登录', '无需授权即可提交表单，且不会开放交易数据。'],
      ['不替代注册', '支持咨询不会创建账户，也不会分配角色。'],
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

export function ContactClient({ sent, locale }: { sent: boolean; locale: Locale }) {
  const copy = COPY[locale];
  const suffix = `?lang=${locale}`;

  return (
    <main className='p7-contact-page' data-testid='platform-v7-question-form-page'>
      <style>{css}</style>
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
          )}
        </section>
      </section>
    </main>
  );
}

const css = `
.p7-contact-page {
  min-height: 100svh;
  padding: 12px clamp(14px, 4vw, 56px) calc(env(safe-area-inset-bottom) + 42px);
  color: #071611;
  background: linear-gradient(180deg, #fbfcf9 0%, #f3f7f1 56%, #fff 100%);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.p7-contact-page * { box-sizing: border-box; }
.p7-contact-page a { color: inherit; text-decoration: none; }
.p7-contact-layout {
  display: grid;
  grid-template-columns: minmax(0, .95fr) minmax(340px, .78fr);
  gap: 20px;
  padding: 34px 0 0;
}
.p7-contact-copy,
.p7-contact-form-card {
  border: 1px solid rgba(7, 22, 17, .075);
  border-radius: 32px;
  background: rgba(255, 255, 255, .84);
  box-shadow: 0 18px 48px rgba(7, 22, 17, .07);
}
.p7-contact-copy { padding: clamp(24px, 4vw, 44px); }
.p7-contact-kicker {
  display: inline-flex;
  width: fit-content;
  margin-bottom: 14px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(0, 122, 47, .08);
  color: #087a3b;
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}
.p7-contact-copy h1 {
  margin: 0;
  max-width: 820px;
  font-size: clamp(34px, 5vw, 68px);
  line-height: .99;
  letter-spacing: -.055em;
}
.p7-contact-copy p,
.p7-contact-form p,
.p7-contact-success p {
  margin: 16px 0 0;
  color: #43514b;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 620;
}
.p7-contact-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 26px;
}
.p7-contact-info-card {
  display: grid;
  gap: 8px;
  padding: 17px;
  border: 1px solid rgba(7, 22, 17, .075);
  border-radius: 22px;
  background: #fff;
}
.p7-contact-info-card svg { color: #087a3b; }
.p7-contact-info-card strong { font-size: 16px; font-weight: 950; }
.p7-contact-info-card p { margin: 0; color: #61716b; font-size: 12.5px; line-height: 1.38; }
.p7-contact-form-card { padding: 22px; }
.p7-contact-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 13px;
}
.p7-contact-form h2,
.p7-contact-success h2 {
  grid-column: 1 / -1;
  margin: 0;
  font-size: clamp(25px, 3vw, 38px);
  line-height: 1.05;
  letter-spacing: -.045em;
}
.p7-contact-form p { grid-column: 1 / -1; margin: 0 0 4px; font-size: 13px; }
.p7-contact-form label { display: grid; gap: 6px; }
.p7-contact-form label span { color: #5e6b66; font-size: 12px; font-weight: 900; }
.p7-contact-form input,
.p7-contact-form select,
.p7-contact-form textarea {
  width: 100%;
  border: 1px solid rgba(7, 22, 17, .12);
  border-radius: 15px;
  background: #fff;
  color: #071611;
  font: inherit;
  font-size: 16px;
  font-weight: 650;
  outline: none;
}
.p7-contact-form input:focus-visible,
.p7-contact-form select:focus-visible,
.p7-contact-form textarea:focus-visible,
.p7-contact-form button:focus-visible,
.p7-contact-success a:focus-visible {
  outline: 3px solid rgba(8, 122, 59, .26);
  outline-offset: 2px;
}
.p7-contact-form input,
.p7-contact-form select { min-height: 48px; padding: 0 13px; }
.p7-contact-form textarea { min-height: 132px; padding: 12px 13px; resize: vertical; }
.p7-contact-full,
.p7-contact-consent,
.p7-contact-form button { grid-column: 1 / -1; }
.p7-contact-consent {
  display: flex !important;
  align-items: flex-start;
  gap: 10px;
  color: #43514b;
  font-size: 13px;
  line-height: 1.35;
}
.p7-contact-consent input { width: 20px; min-width: 20px; min-height: 20px; margin-top: 1px; }
.p7-contact-form button {
  min-height: 52px;
  border: 0;
  border-radius: 17px;
  background: #087a3b;
  color: #fff;
  font-weight: 950;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
}
.p7-contact-form button:hover { background: #07572e; }
.p7-contact-success { display: grid; gap: 12px; place-items: start; }
.p7-contact-success > span {
  width: 48px;
  height: 48px;
  border-radius: 18px;
  background: rgba(0, 122, 47, .08);
  color: #087a3b;
  display: grid;
  place-items: center;
}
.p7-contact-success a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #087a3b;
  font-weight: 950;
}
.p7-contact-honeypot { position: absolute !important; left: -9999px !important; }

@media (max-width: 920px) {
  .p7-contact-layout { grid-template-columns: 1fr; }
  .p7-contact-cards { grid-template-columns: 1fr; }
  .p7-contact-form { grid-template-columns: 1fr; }
}

@media (max-width: 560px) {
  .p7-contact-page { padding-inline: 10px; padding-bottom: calc(env(safe-area-inset-bottom) + 28px); }
  .p7-contact-layout { gap: 12px; padding-top: 16px; }
  .p7-contact-copy,
  .p7-contact-form-card { border-radius: 24px; }
  .p7-contact-copy { padding: 18px; }
  .p7-contact-copy h1 { font-size: 32px; }
  .p7-contact-copy p { font-size: 14px; line-height: 1.45; }
  .p7-contact-cards { margin-top: 16px; gap: 8px; }
  .p7-contact-info-card { padding: 12px; border-radius: 18px; }
  .p7-contact-form-card { padding: 12px; }
  .p7-contact-form { gap: 10px; }
  .p7-contact-form h2 { font-size: 25px; }
  .p7-contact-form p { font-size: 12px; line-height: 1.4; }
  .p7-contact-form textarea { min-height: 112px; max-height: 210px; }
  .p7-contact-consent { padding: 10px; border: 1px solid rgba(0, 122, 47, .16); border-radius: 15px; background: #f6fbf8; font-size: 12px; }
  .p7-contact-form button { min-height: 48px; }
}

@media (max-width: 380px) {
  .p7-contact-copy h1 { font-size: 29px; }
  .p7-contact-form-card { padding: 10px; }
  .p7-contact-form textarea { min-height: 96px; }
}

@media (prefers-reduced-motion: reduce) {
  .p7-contact-form button { scroll-behavior: auto; }
}

@media (forced-colors: active) {
  .p7-contact-copy,
  .p7-contact-form-card,
  .p7-contact-info-card,
  .p7-contact-form input,
  .p7-contact-form select,
  .p7-contact-form textarea,
  .p7-contact-form button { border: 2px solid ButtonText; }
}
`;
