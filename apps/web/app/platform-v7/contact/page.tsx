import Link from 'next/link';
import { ArrowRight, HelpCircle, LogIn, MessageSquareText, ShieldCheck, Wheat } from 'lucide-react';

const QUESTION_TYPES = [
  'По платформе',
  'По пилоту',
  'Для банка / партнёра',
  'Для региона',
  'Технический вопрос',
  'Другое',
] as const;

export default function PlatformV7ContactPage() {
  return (
    <main className="p7-contact-page">
      <style>{css}</style>
      <header className="p7-contact-header" aria-label="Навигация формы вопроса">
        <Link href="/platform-v7" className="p7-contact-brand" aria-label="На главную Прозрачная Цена"><span><Wheat size={24} /></span><strong>Прозрачная Цена</strong></Link>
        <nav className="p7-contact-actions" aria-label="Действия"><Link href="/platform-v7/demo">Демо</Link><Link href="/platform-v7/login"><LogIn size={15} />Войти</Link></nav>
      </header>

      <section className="p7-contact-hero" aria-labelledby="p7-contact-title">
        <span className="p7-contact-kicker"><HelpCircle size={15} /> Обратная связь</span>
        <h1 id="p7-contact-title">Задать вопрос по платформе</h1>
        <p>Напишите вопрос по платформе, пилоту, ролям, расчётам, банковскому контуру или подключению. Это отдельная форма: она не заменяет заявку на подключение организации.</p>
        <div className="p7-contact-hero-actions"><Link href="/platform-v7/register" className="p7-contact-primary">Подключить организацию<ArrowRight size={18} /></Link><Link href="/platform-v7/demo" className="p7-contact-secondary">Посмотреть демо-сделку</Link></div>
      </section>

      <section className="p7-contact-layout" aria-label="Форма и пояснения">
        <form name="platform-v7-question" method="POST" action="/platform-v7/contact/sent" data-netlify="true" data-netlify-honeypot="bot-field" className="p7-question-form">
          <input type="hidden" name="form-name" value="platform-v7-question" />
          <p className="p7-honeypot"><label>Не заполняйте это поле <input name="bot-field" tabIndex={-1} autoComplete="off" /></label></p>

          <div className="p7-form-head"><MessageSquareText size={22} /><div><strong>Вопрос без регистрации</strong><span>Минимум полей. Данные нужны только для ответа.</span></div></div>

          <label>
            <span>Тип вопроса</span>
            <select name="question_type" required defaultValue="">
              <option value="" disabled>Выберите тип вопроса</option>
              {QUESTION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <div className="p7-form-grid">
            <label><span>Имя</span><input name="name" required minLength={2} maxLength={80} placeholder="Как к вам обращаться" /></label>
            <label><span>Организация</span><input name="organization" maxLength={120} placeholder="Необязательно" /></label>
          </div>

          <label>
            <span>Телефон или email</span>
            <input name="contact" required minLength={5} maxLength={120} inputMode="email" placeholder="Телефон или рабочая почта" />
          </label>

          <label>
            <span>Сообщение</span>
            <textarea name="message" required minLength={20} maxLength={2000} rows={7} placeholder="Опишите вопрос, роль, сделку, пилот или партнёрский контур" />
          </label>

          <label className="p7-consent"><input type="checkbox" name="consent" required /> <span>Согласен на обработку данных для ответа на обращение.</span></label>

          <button type="submit">Отправить вопрос</button>
          <p className="p7-form-note">Форма использует Netlify Forms и не создаёт сессию, роль или доступ в личный кабинет.</p>
        </form>

        <aside className="p7-contact-panel" aria-label="Что можно спросить">
          <span className="p7-contact-kicker"><ShieldCheck size={15} /> Контекст вопроса</span>
          <h2>Что лучше указать</h2>
          <ul>
            <li>какая у вас роль: продавец, покупатель, банк, регион, логистика;</li>
            <li>что хотите проверить: пилот, расчёты, документы, спор, подключение;</li>
            <li>есть ли конкретная сделка, культура, объём, регион или банк;</li>
            <li>нужен ли демонстрационный проход для команды.</li>
          </ul>
          <div className="p7-contact-split"><Link href="/platform-v7/demo">Открыть демо</Link><Link href="/platform-v7/register">Подключить организацию</Link></div>
        </aside>
      </section>
    </main>
  );
}

const css = `
.pc-shell-root-v4:has(.p7-contact-page) { --pc-header-offset: 0px !important; background: #f7faf6 !important; }
.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-header, .pc-shell-root-v4:has(.p7-contact-page) .pc-v4-bottomnav, .pc-shell-root-v4:has(.p7-contact-page) .pc-v4-drawer, .pc-shell-root-v4:has(.p7-contact-page) .pc-v4-pilot-note { display: none !important; }
.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-main { max-width: none !important; margin: 0 !important; padding: 0 20px 34px !important; background: #f7faf6 !important; min-height: 100svh !important; }
.p7-contact-page { width: 100%; max-width: 1060px; margin: 0 auto; padding: max(10px, env(safe-area-inset-top)) 0 36px; display: grid; gap: 16px; color: #102019; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.p7-contact-page * { box-sizing: border-box; }
.p7-contact-page a { color: inherit; text-decoration: none; }
.p7-contact-header, .p7-contact-hero, .p7-question-form, .p7-contact-panel { border: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.93); box-shadow: 0 16px 38px rgba(15,23,42,.055); }
.p7-contact-header { position: sticky; top: max(8px, env(safe-area-inset-top)); z-index: 30; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 13px 14px; border-radius: 26px; backdrop-filter: blur(18px); }
.p7-contact-brand { min-width: 0; display: inline-flex; align-items: center; gap: 10px; font-weight: 930; letter-spacing: -.035em; }
.p7-contact-brand span { width: 42px; height: 42px; display: inline-grid; place-items: center; border-radius: 15px; color: #087a3b; background: rgba(8,122,59,.09); }
.p7-contact-actions { display: flex; gap: 8px; } .p7-contact-actions a { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 13px; border: 1px solid rgba(15,23,42,.10); border-radius: 15px; background: rgba(255,255,255,.86); font-size: 13px; font-weight: 880; }
.p7-contact-hero { display: grid; gap: 12px; padding: clamp(22px, 4vw, 34px); border-radius: 28px; background: radial-gradient(circle at 88% 10%, rgba(8,122,59,.11), transparent 34%), rgba(255,255,255,.93); }
.p7-contact-kicker { width: fit-content; display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 999px; background: rgba(8,122,59,.09); color: #087a3b; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .055em; }
.p7-contact-hero h1 { margin: 0; max-width: 780px; color: #0f1f18; font-size: clamp(34px, 5vw, 58px); line-height: 1.02; letter-spacing: -.055em; font-weight: 950; }
.p7-contact-hero p { max-width: 760px; margin: 0; color: #5d6b64; font-size: clamp(15.5px, 2vw, 19px); line-height: 1.5; font-weight: 620; }
.p7-contact-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
.p7-contact-primary, .p7-contact-secondary { min-height: 52px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; border-radius: 16px; font-weight: 930; }
.p7-contact-primary { color: #fff !important; background: #087a3b; box-shadow: 0 16px 34px rgba(8,122,59,.20); }
.p7-contact-secondary { color: #087a3b !important; background: #fff; border: 1px solid rgba(8,122,59,.22); }
.p7-contact-layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
.p7-question-form, .p7-contact-panel { border-radius: 28px; padding: 22px; display: grid; gap: 14px; }
.p7-form-head { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 20px; background: rgba(8,122,59,.06); color: #087a3b; } .p7-form-head strong { display: block; color: #102019; font-size: 18px; font-weight: 950; letter-spacing: -.03em; } .p7-form-head span { display: block; margin-top: 3px; color: #66736e; font-size: 13px; line-height: 1.4; font-weight: 650; }
.p7-question-form label { display: grid; gap: 6px; color: #102019; font-size: 13px; font-weight: 850; }
.p7-question-form label > span { color: #5f6d66; }
.p7-question-form input, .p7-question-form select, .p7-question-form textarea { width: 100%; border: 1px solid rgba(15,23,42,.10); border-radius: 15px; background: rgba(255,255,255,.96); color: #102019; font: inherit; font-size: 15px; font-weight: 620; outline: none; box-shadow: inset 0 1px 0 rgba(15,23,42,.03); }
.p7-question-form input, .p7-question-form select { min-height: 48px; padding: 0 13px; } .p7-question-form textarea { resize: vertical; padding: 13px; line-height: 1.5; }
.p7-question-form input:focus, .p7-question-form select:focus, .p7-question-form textarea:focus { border-color: rgba(8,122,59,.42); box-shadow: 0 0 0 4px rgba(8,122,59,.10); }
.p7-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.p7-consent { display: flex !important; grid-template-columns: none !important; flex-direction: row; gap: 10px !important; align-items: flex-start; font-size: 13px !important; line-height: 1.45; } .p7-consent input { width: 18px; min-width: 18px; height: 18px; min-height: 18px; margin-top: 2px; }
.p7-question-form button { min-height: 54px; border: 0; border-radius: 17px; background: #087a3b; color: #fff; font-size: 15px; font-weight: 950; cursor: pointer; box-shadow: 0 16px 34px rgba(8,122,59,.18); }
.p7-form-note { margin: 0; color: #66736e; font-size: 12.5px; line-height: 1.45; font-weight: 650; }
.p7-honeypot { display: none; }
.p7-contact-panel h2 { margin: 8px 0 0; color: #102019; font-size: 30px; line-height: 1.05; letter-spacing: -.045em; font-weight: 950; }
.p7-contact-panel ul { margin: 0; padding-left: 20px; display: grid; gap: 10px; color: #526059; font-size: 14px; line-height: 1.45; font-weight: 650; }
.p7-contact-split { display: grid; grid-template-columns: 1fr; gap: 8px; } .p7-contact-split a { min-height: 46px; display: inline-flex; align-items: center; justify-content: center; border-radius: 15px; border: 1px solid rgba(8,122,59,.22); color: #087a3b; background: rgba(8,122,59,.04); font-size: 13px; font-weight: 900; }
@media (max-width: 820px) { .pc-shell-root-v4:has(.p7-contact-page) .pc-v4-main { padding: 0 12px 28px !important; } .p7-contact-header { border-radius: 23px; padding: 11px; } .p7-contact-actions a { min-height: 40px; padding: 0 11px; font-size: 12.5px; } .p7-contact-layout { grid-template-columns: 1fr; } .p7-question-form, .p7-contact-panel, .p7-contact-hero { border-radius: 24px; padding: 18px; } .p7-contact-hero-actions, .p7-contact-primary, .p7-contact-secondary { width: 100%; } .p7-form-grid { grid-template-columns: 1fr; } }
@media (max-width: 390px) { .p7-contact-brand strong { font-size: 15px; } .p7-contact-actions a:first-child { display: none; } .p7-contact-hero h1 { font-size: 31px; } }
`;
