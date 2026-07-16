'use client';

import Link from 'next/link';
import { ArrowRight, HelpCircle, LogIn, MessageSquareText, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';

const questionTypes = [
  ['platform', 'Общий вопрос по платформе'],
  ['pilot', 'Подключение организации'],
  ['bank_partner', 'Банк или партнёр'],
  ['region', 'Региональный запуск'],
  ['technical', 'Техническое подключение'],
  ['other', 'Другое обращение'],
] as const;

function Card({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <article className='p7-contact-info-card'>{icon}<strong>{title}</strong><p>{text}</p></article>;
}

export function ContactClient({ sent }: { sent: boolean }) {
  return (
    <main className='p7-contact-page' data-testid='platform-v7-question-form-page'>
      <style>{css}</style>
      <header className='p7-contact-header'>
        <Link href='/platform-v7' className='p7-contact-brand'>
          <span className='p7-contact-brand-mark'><BrandMark size={40} /></span>
          <span className='p7-contact-brand-copy'><strong>Прозрачная Цена</strong><small>Контур исполнения сделки</small></span>
        </Link>
        <nav className='p7-contact-nav'>
          <Link href='/platform-v7/deal-flow'>Контур сделки</Link>
          <Link href='/platform-v7/register'>Подключить организацию</Link>
          <Link href='/platform-v7/login'><LogIn size={15} />Войти</Link>
        </nav>
      </header>
      <section className='p7-contact-layout'>
        <div className='p7-contact-copy'>
          <span className='p7-contact-kicker'>Официальный канал обращения</span>
          <h1>Обращение по платформе</h1>
          <p>Используйте форму для вопросов о подключении организации, банковском взаимодействии, региональном запуске, ролях участников или технической интеграции.</p>
          <div className='p7-contact-cards'>
            <Card icon={<MessageSquareText size={22} />} title='Без входа в кабинет' text='Форма доступна без авторизации и выбора роли участника.' />
            <Card icon={<ShieldCheck size={22} />} title='Без доступа к рабочим данным' text='Отправка обращения не открывает сделки, документы и закрытые разделы платформы.' />
            <Card icon={<HelpCircle size={22} />} title='Ответ по указанному контакту' text='Контакт используется только для рассмотрения обращения и направления ответа.' />
          </div>
        </div>
        <section className='p7-contact-form-card'>
          {sent ? (
            <div className='p7-contact-success'>
              <span><ShieldCheck size={24} /></span>
              <h2>Обращение принято</h2>
              <p>Ответ будет направлен по указанному телефону или адресу электронной почты после рассмотрения обращения.</p>
              <Link href='/platform-v7/deal-flow'>Вернуться к контуру сделки<ArrowRight size={17} /></Link>
            </div>
          ) : (
            <form method='post' action='/api/platform-v7/inquiries' className='p7-contact-form'>
              <input type='text' name='website' tabIndex={-1} autoComplete='off' aria-hidden='true' className='p7-contact-honeypot' />
              <input type='hidden' name='source' value='platform_v7_contact_page' />
              <h2>Форма обращения</h2>
              <p>Заполните обязательные поля. Укажите только данные, необходимые для связи и рассмотрения обращения.</p>
              <label><span>Тема обращения</span><select name='type' required defaultValue='platform'>{questionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Имя</span><input name='name' type='text' minLength={2} maxLength={80} required /></label>
              <label><span>Организация</span><input name='organization' type='text' maxLength={120} /></label>
              <label><span>Телефон или электронная почта</span><input name='contact' type='text' minLength={5} maxLength={120} required /></label>
              <label className='p7-contact-full'><span>Содержание обращения</span><textarea name='message' maxLength={2000} rows={6} required /></label>
              <label className='p7-contact-consent'><input type='checkbox' name='consent' value='yes' required /><span>Даю согласие на обработку указанных данных для рассмотрения обращения и направления ответа.</span></label>
              <button type='submit'>Отправить обращение<ArrowRight size={17} /></button>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}

const css = `
.p7-contact-page{min-height:100svh;padding:12px clamp(14px,4vw,56px) calc(env(safe-area-inset-bottom) + 42px);color:#071611;background:linear-gradient(180deg,#fbfcf9 0%,#f3f7f1 56%,#fff 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.p7-contact-page *{box-sizing:border-box}.p7-contact-page a{color:inherit;text-decoration:none}.p7-contact-header{position:sticky;top:max(10px,env(safe-area-inset-top));z-index:20;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;min-height:64px;padding:10px 12px 10px 14px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.94);box-shadow:0 16px 38px rgba(7,22,17,.08)}.p7-contact-brand{min-width:0;display:inline-flex;align-items:center;gap:10px}.p7-contact-brand-mark{flex:0 0 40px;display:grid;place-items:center;width:40px;height:40px}.p7-contact-brand-copy strong{display:block;font-size:18px;line-height:1.04;font-weight:950}.p7-contact-brand-copy small{display:block;margin-top:3px;color:#66736e;font-size:12px;font-weight:680}.p7-contact-nav{display:flex;align-items:center;gap:8px}.p7-contact-nav a{min-height:42px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 14px;border-radius:15px;border:1px solid rgba(7,22,17,.1);font-size:13px;font-weight:900;background:rgba(255,255,255,.86)}.p7-contact-nav a:nth-child(2){color:#fff;background:#087a3b;border-color:#087a3b}.p7-contact-layout{display:grid;grid-template-columns:minmax(0,.95fr) minmax(340px,.78fr);gap:20px;padding:34px 0 0}.p7-contact-copy,.p7-contact-form-card{border:1px solid rgba(7,22,17,.075);border-radius:32px;background:rgba(255,255,255,.84);box-shadow:0 18px 48px rgba(7,22,17,.07)}.p7-contact-copy{padding:clamp(24px,4vw,44px)}.p7-contact-kicker{display:inline-flex;width:fit-content;margin-bottom:14px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;text-transform:uppercase}.p7-contact-copy h1{margin:0;max-width:820px;font-size:clamp(34px,5vw,68px);line-height:.99;letter-spacing:-.055em}.p7-contact-copy p,.p7-contact-form p,.p7-contact-success p{margin:16px 0 0;color:#43514b;font-size:16px;line-height:1.5;font-weight:620}.p7-contact-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:26px}.p7-contact-info-card{padding:17px;border:1px solid rgba(7,22,17,.075);border-radius:22px;background:#fff;display:grid;gap:8px}.p7-contact-info-card svg{color:#087a3b}.p7-contact-info-card strong{font-size:16px;font-weight:950}.p7-contact-info-card p{margin:0;color:#61716b;font-size:12.5px;line-height:1.38}.p7-contact-form-card{padding:22px}.p7-contact-form{display:grid;grid-template-columns:1fr 1fr;gap:13px}.p7-contact-form h2,.p7-contact-success h2{grid-column:1/-1;margin:0;font-size:clamp(25px,3vw,38px);line-height:1.05;letter-spacing:-.045em}.p7-contact-form p{grid-column:1/-1;margin:0 0 4px;font-size:13px}.p7-contact-form label{display:grid;gap:6px}.p7-contact-form label span{color:#5e6b66;font-size:12px;font-weight:900}.p7-contact-form input,.p7-contact-form select,.p7-contact-form textarea{width:100%;border:1px solid rgba(7,22,17,.12);border-radius:15px;background:#fff;color:#071611;font:inherit;font-size:16px;font-weight:650;outline:none}.p7-contact-form input,.p7-contact-form select{min-height:46px;padding:0 13px}.p7-contact-form textarea{padding:12px 13px;resize:vertical}.p7-contact-full,.p7-contact-consent,.p7-contact-form button{grid-column:1/-1}.p7-contact-consent{display:flex!important;gap:10px;color:#43514b;font-size:13px;line-height:1.35}.p7-contact-consent input{width:auto;min-height:auto;margin-top:2px}.p7-contact-form button{min-height:52px;border:0;border-radius:17px;background:#087a3b;color:#fff;font-weight:950;font-size:15px;display:inline-flex;align-items:center;justify-content:center;gap:8px}.p7-contact-success{display:grid;gap:12px;place-items:start}.p7-contact-success span{width:48px;height:48px;border-radius:18px;background:rgba(0,122,47,.08);color:#087a3b;display:grid;place-items:center}.p7-contact-success a{display:inline-flex;align-items:center;gap:8px;color:#087a3b;font-weight:950}.p7-contact-honeypot{position:absolute!important;left:-9999px!important}
@media(max-width:920px){.p7-contact-layout{grid-template-columns:1fr}.p7-contact-cards{grid-template-columns:1fr}.p7-contact-form{grid-template-columns:1fr}.p7-contact-nav a:first-child{display:none}}
@media(max-width:560px){.p7-contact-page{padding:10px 10px calc(env(safe-area-inset-bottom) + 28px)}.p7-contact-header{position:sticky;top:max(8px,env(safe-area-inset-top));min-height:64px;border-radius:20px;padding:8px 9px}.p7-contact-brand-mark{width:40px;height:40px;flex-basis:40px}.p7-contact-brand-copy strong{font-size:16px}.p7-contact-brand-copy small{display:none}.p7-contact-nav{gap:6px}.p7-contact-nav a{min-height:38px;padding:0 11px;border-radius:14px;font-size:12px}.p7-contact-nav a:nth-child(2){display:none}.p7-contact-layout{gap:12px;padding-top:16px}.p7-contact-copy,.p7-contact-form-card{border-radius:24px}.p7-contact-copy{padding:18px}.p7-contact-copy h1{font-size:32px}.p7-contact-copy p{font-size:14px;line-height:1.45}.p7-contact-cards{margin-top:16px;gap:8px}.p7-contact-info-card{padding:12px;border-radius:18px}.p7-contact-form-card{padding:12px}.p7-contact-form{gap:10px}.p7-contact-form h2{font-size:25px}.p7-contact-form p{font-size:12px;line-height:1.4}.p7-contact-form input,.p7-contact-form select{min-height:44px}.p7-contact-form textarea{min-height:112px;max-height:210px}.p7-contact-consent{padding:10px;border:1px solid rgba(0,122,47,.16);border-radius:15px;background:#f6fbf8;font-size:12px}.p7-contact-form button{min-height:48px}}
@media(max-width:380px){.p7-contact-copy h1{font-size:29px}.p7-contact-form-card{padding:10px}.p7-contact-form textarea{min-height:96px}.p7-contact-nav a{padding:0 9px}}
`;
