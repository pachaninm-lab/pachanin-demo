import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, HelpCircle, LogIn, MessageSquareText, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';

export const metadata: Metadata = {
  title: 'Задать вопрос — пилот, банк, регион и подключение',
  description:
    'Форма обращения по платформе Прозрачная Цена: публичный разбор сделки, controlled pilot, банковский контур, региональный запуск, роли участников и техническое подключение.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/contact',
  },
  openGraph: {
    title: 'Задать вопрос — Прозрачная Цена',
    description:
      'Связаться по пилоту, подключению организации, банковскому контуру, региональному запуску или техническому взаимодействию с платформой.',
    url: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/contact',
    siteName: 'Прозрачная Цена',
    locale: 'ru_RU',
    type: 'website',
  },
};

type ContactSearchParams = Record<string, string | string[] | undefined>;

const QUESTION_TYPES = [
  ['platform', 'По платформе'],
  ['pilot', 'По пилоту'],
  ['bank_partner', 'Для банка / партнёра'],
  ['region', 'Для региона'],
  ['technical', 'Технический вопрос'],
  ['other', 'Другое'],
] as const;

function isSent(searchParams: ContactSearchParams) {
  const raw = Array.isArray(searchParams.sent) ? searchParams.sent[0] : searchParams.sent;
  return raw === '1' || raw === 'true';
}

export default async function PlatformV7ContactPage({ searchParams }: { searchParams?: Promise<ContactSearchParams> | ContactSearchParams }) {
  const params = await Promise.resolve(searchParams ?? {});
  const sent = isSent(params);

  return (
    <main className='p7-contact-page' data-testid='platform-v7-question-form-page'>
      <style>{css}</style>
      <header className='p7-contact-header' aria-label='Навигация формы обращения'>
        <Link href='/platform-v7' className='p7-contact-brand' aria-label='На главную Прозрачная Цена'>
          <span className='p7-contact-brand-mark'><BrandMark size={42} /></span>
          <span className='p7-contact-brand-copy'><strong>Прозрачная Цена</strong><small>Контур исполнения сделки</small></span>
        </Link>
        <nav className='p7-contact-nav' aria-label='Действия'>
          <Link href='/platform-v7/demo'>Разбор сделки</Link>
          <Link href='/platform-v7/register'>Подключить организацию</Link>
          <Link href='/platform-v7/login'><LogIn size={15} />Войти</Link>
        </nav>
      </header>

      <section className='p7-contact-layout'>
        <div className='p7-contact-copy'>
          <span className='p7-contact-kicker'>Обратная связь</span>
          <h1>Направить обращение по платформе</h1>
          <p>Форма предназначена для вопросов по публичному разбору сделки, пилоту, подключению организации, банковскому контуру, региональному запуску и техническому взаимодействию.</p>
          <div className='p7-contact-cards' aria-label='Назначение формы'>
            <InfoCard icon={<MessageSquareText size={22} />} title='Обращение без регистрации' text='Можно задать вопрос без выбора роли и без входа в рабочий кабинет.' />
            <InfoCard icon={<ShieldCheck size={22} />} title='Только канал связи' text='Форма принимает обращение и контакт для ответа, но не открывает доступ к сделкам.' />
            <InfoCard icon={<HelpCircle size={22} />} title='Подключение отдельно' text='Заявка на подключение организации оформляется через отдельную форму регистрации.' />
          </div>
        </div>

        <section className='p7-contact-form-card' aria-labelledby='p7-contact-form-title'>
          {sent ? (
            <div className='p7-contact-success' role='status'>
              <span><ShieldCheck size={24} /></span>
              <h2 id='p7-contact-form-title'>Обращение отправлено</h2>
              <p>Данные обращения приняты. Ответ будет направлен по указанному контакту при условии его корректности.</p>
              <Link href='/platform-v7/demo'>Вернуться к разбору сделки<ArrowRight size={17} /></Link>
            </div>
          ) : (
            <form method='post' action='/api/platform-v7/inquiries' className='p7-contact-form' aria-labelledby='p7-contact-form-title'>
              <input type='text' name='website' tabIndex={-1} autoComplete='off' aria-hidden='true' className='p7-contact-honeypot' />
              <input type='hidden' name='source' value='platform_v7_contact_page' />
              <h2 id='p7-contact-form-title'>Задать вопрос</h2>
              <p>Укажите тему обращения и контакт для ответа. Не направляйте через форму пароли, ключи доступа, банковские реквизиты и копии документов. Форма не открывает личный кабинет и не создаёт роль — это только вопрос команде платформы.</p>
              <label><span>Тип вопроса</span><select name='type' required defaultValue='platform'>{QUESTION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Имя</span><input name='name' type='text' minLength={2} maxLength={80} placeholder='Фамилия и имя' required /></label>
              <label><span>Организация</span><input name='organization' type='text' maxLength={120} placeholder='При наличии' /></label>
              <label><span>Телефон или email</span><input name='contact' type='text' minLength={5} maxLength={120} placeholder='+7... или email организации' required /></label>
              <label className='p7-contact-full'><span>Сообщение</span><textarea name='message' minLength={20} maxLength={2000} rows={6} placeholder='Опишите вопрос по платформе, пилоту, роли участника, документам, банковскому контуру, региональному запуску или техническому подключению.' required /></label>
              <label className='p7-contact-consent'><input type='checkbox' name='consent' value='yes' required /><span>Согласен на обработку указанных данных для рассмотрения обращения.</span></label>
              <button type='submit'>Отправить обращение<ArrowRight size={17} /></button>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <article className='p7-contact-info-card'>{icon}<strong>{title}</strong><p>{text}</p></article>; }

const css = `
.pc-shell-root-v4:has(.p7-contact-page){--pc-header-offset:0px!important;background:#fbfcf9!important}
.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-header,.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-bottomnav,.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-drawer,.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-pilot-note,.pc-shell-root-v4:has(.p7-contact-page) .pc-v7-role-dock,.pc-shell-root-v4:has(.p7-contact-page) .pc-v7-assistant-widget,.pc-shell-root-v4:has(.p7-contact-page) .p7-mobile-action-rail,.pc-shell-root-v4:has(.p7-contact-page) .p7-mobile-tool-panel{display:none!important}
.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important;background:#fbfcf9!important;min-height:100svh!important}
.p7-contact-page{min-height:100svh;padding:12px clamp(14px,4vw,56px) 42px;color:#071611;background:radial-gradient(circle at 14% 0%,rgba(0,122,47,.12),transparent 30%),radial-gradient(circle at 86% 12%,rgba(196,145,42,.09),transparent 30%),linear-gradient(180deg,#fbfcf9 0%,#f3f7f1 56%,#fff 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.p7-contact-page *{box-sizing:border-box}.p7-contact-page a{color:inherit;text-decoration:none}
.p7-contact-header{position:sticky;top:max(10px,env(safe-area-inset-top));z-index:20;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;min-height:66px;padding:10px 12px 10px 14px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.94);box-shadow:0 16px 38px rgba(7,22,17,.08);backdrop-filter:blur(18px)}
.p7-contact-brand{min-width:0;display:inline-flex;align-items:center;gap:10px;color:#071611}.p7-contact-brand-mark{flex:0 0 42px;display:grid;place-items:center;width:42px;height:42px}.p7-contact-brand-copy{min-width:0;display:block;overflow:hidden}.p7-contact-brand-copy strong{display:block;font-size:18px;line-height:1.04;font-weight:950;letter-spacing:-.035em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.p7-contact-brand-copy small{display:block;margin-top:3px;color:#66736e;font-size:12px;font-weight:680}.p7-contact-nav{display:flex;align-items:center;gap:8px}.p7-contact-nav a{min-height:42px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 14px;border-radius:15px;border:1px solid rgba(7,22,17,.1);font-size:13px;font-weight:900;background:rgba(255,255,255,.86)}.p7-contact-nav a:nth-child(2){color:#fff;background:#087a3b;border-color:#087a3b;box-shadow:0 14px 28px rgba(0,122,47,.18)}
.p7-contact-layout{display:grid;grid-template-columns:minmax(0,.95fr) minmax(340px,.78fr);gap:20px;padding:34px 0 0}.p7-contact-copy,.p7-contact-form-card{border:1px solid rgba(7,22,17,.075);border-radius:32px;background:rgba(255,255,255,.84);box-shadow:0 18px 48px rgba(7,22,17,.07);backdrop-filter:blur(14px)}.p7-contact-copy{padding:clamp(24px,4vw,44px)}.p7-contact-kicker{display:inline-flex;width:fit-content;margin-bottom:14px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;letter-spacing:.055em;text-transform:uppercase}.p7-contact-copy h1{margin:0;max-width:820px;font-size:clamp(34px,5vw,68px);line-height:.99;letter-spacing:-.055em;color:#071611}.p7-contact-copy p,.p7-contact-form p,.p7-contact-success p{margin:16px 0 0;color:#43514b;font-size:16px;line-height:1.5;font-weight:620}.p7-contact-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:26px}.p7-contact-info-card{padding:17px;border:1px solid rgba(7,22,17,.075);border-radius:22px;background:#fff;display:grid;gap:8px;box-shadow:0 12px 30px rgba(7,22,17,.045)}.p7-contact-info-card svg{color:#087a3b}.p7-contact-info-card strong{font-size:16px;font-weight:950;letter-spacing:-.035em}.p7-contact-info-card p{margin:0;color:#61716b;font-size:12.5px;line-height:1.38}.p7-contact-form-card{padding:22px}.p7-contact-form{display:grid;grid-template-columns:1fr 1fr;gap:13px}.p7-contact-form h2,.p7-contact-success h2{grid-column:1/-1;margin:0;font-size:clamp(25px,3vw,38px);line-height:1.05;letter-spacing:-.045em}.p7-contact-form p{grid-column:1/-1;margin:0 0 4px;font-size:13px}.p7-contact-form label{display:grid;gap:6px}.p7-contact-form label span{color:#5e6b66;font-size:12px;font-weight:900}.p7-contact-form input,.p7-contact-form select,.p7-contact-form textarea{width:100%;border:1px solid rgba(7,22,17,.12);border-radius:15px;background:#fff;color:#071611;font:inherit;font-size:14px;font-weight:650;outline:none}.p7-contact-form input,.p7-contact-form select{min-height:46px;padding:0 13px}.p7-contact-form textarea{padding:12px 13px;resize:vertical}.p7-contact-form input:focus,.p7-contact-form select:focus,.p7-contact-form textarea:focus{border-color:rgba(0,122,47,.46);box-shadow:0 0 0 4px rgba(0,122,47,.08)}.p7-contact-full,.p7-contact-consent,.p7-contact-form button{grid-column:1/-1}.p7-contact-consent{display:flex!important;grid-template-columns:none!important;align-items:flex-start;gap:10px;color:#43514b;font-size:13px;line-height:1.35}.p7-contact-consent input{width:auto;min-height:auto;margin-top:2px}.p7-contact-form button{min-height:52px;border:0;border-radius:17px;background:#087a3b;color:#fff;font-weight:950;font-size:15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 18px 34px rgba(0,122,47,.2);cursor:pointer}.p7-contact-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;opacity:0!important}.p7-contact-success{min-height:100%;display:grid;align-content:center;justify-items:start;gap:14px}.p7-contact-success span{display:grid;place-items:center;width:52px;height:52px;border-radius:18px;color:#087a3b;background:rgba(0,122,47,.08)}.p7-contact-success a{min-height:48px;display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;padding:0 16px;border-radius:16px;background:#087a3b;color:#fff!important;font-weight:950}
@media (max-width:980px){.p7-contact-page{padding:8px 12px 34px}.p7-contact-header,.p7-contact-layout{grid-template-columns:1fr}.p7-contact-nav{display:grid;grid-template-columns:1fr 1fr 1fr}.p7-contact-cards{grid-template-columns:1fr}.p7-contact-form{grid-template-columns:1fr}}
@media (max-width:560px){.p7-contact-header{gap:9px;border-radius:22px}.p7-contact-brand-copy small{display:none}.p7-contact-brand-mark{width:40px;height:40px;flex-basis:40px}.p7-contact-brand-copy strong{font-size:16px}.p7-contact-nav{grid-template-columns:1fr}.p7-contact-nav a{min-height:40px;font-size:12.5px}.p7-contact-layout{padding-top:18px}.p7-contact-copy,.p7-contact-form-card{border-radius:26px}.p7-contact-copy{padding:22px 18px}.p7-contact-copy h1{font-size:clamp(32px,9vw,42px)}.p7-contact-copy p{font-size:15px}.p7-contact-form-card{padding:18px}}
`;
