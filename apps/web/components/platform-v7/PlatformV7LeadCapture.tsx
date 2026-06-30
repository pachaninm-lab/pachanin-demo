'use client';

import { ArrowRight, CheckCircle2, Send, ShieldCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function PlatformV7LeadCapture() {
  const pathname = usePathname();
  const isRequestPage = pathname === '/platform-v7/request' || pathname === '/platform-v7/request/';

  if (!isRequestPage) return null;

  return (
    <section id='lead-request' className='p7-lead-capture' aria-labelledby='p7-lead-title'>
      <div className='p7-lead-copy'>
        <span className='p7-lead-kicker'><ShieldCheck size={16} /> Заявка на демонстрацию</span>
        <h2 id='p7-lead-title'>Заявка на демонстрацию и разбор сделки</h2>
        <p>Официальный канал для запроса демонстрации, обсуждения пилотного проекта, подключения организации, банковского взаимодействия или регионального запуска.</p>
        <div className='p7-lead-proof' aria-label='Порядок рассмотрения заявки'>
          <span><CheckCircle2 size={17} /> заявка регистрируется</span>
          <span><CheckCircle2 size={17} /> контакт используется для ответа</span>
          <span><CheckCircle2 size={17} /> доступ к рабочим данным не предоставляется</span>
        </div>
      </div>

      <form className='p7-lead-card' action='/api/platform-v7/leads' method='post'>
        <input type='hidden' name='source' value='request_page_lead_form' />
        <input type='hidden' name='interest' value='demo' />
        <input type='hidden' name='pagePath' value='/platform-v7/request' />
        <input className='p7-lead-hp' type='text' name='website' tabIndex={-1} autoComplete='off' aria-hidden='true' />

        <strong>Форма заявки</strong>
        <span>Форма предназначена только для предварительного обращения. Она не открывает рабочие кабинеты, сделки, документы и закрытые маршруты платформы.</span>

        <label>
          <em>Имя</em>
          <input name='name' type='text' autoComplete='name' placeholder='Фамилия и имя' minLength={2} required />
        </label>
        <label>
          <em>Организация</em>
          <input name='organization' type='text' autoComplete='organization' placeholder='Наименование организации' minLength={2} required />
        </label>
        <div className='p7-lead-two'>
          <label>
            <em>Email</em>
            <input name='email' type='email' autoComplete='email' placeholder='name@company.ru' />
          </label>
          <label>
            <em>Телефон</em>
            <input name='phone' type='tel' autoComplete='tel' placeholder='+7 ...' />
          </label>
        </div>
        <label>
          <em>Формат участия</em>
          <input name='role' type='text' placeholder='Организация, банк, регион, партнёр' />
        </label>
        <label>
          <em>Комментарий</em>
          <textarea name='message' rows={3} placeholder='Кратко опишите вопрос, сценарий пилота или предполагаемый формат взаимодействия.' />
        </label>
        <label className='p7-lead-consent'>
          <input name='consent' type='checkbox' value='yes' required />
          <span>Даю согласие на обработку указанных данных для рассмотрения заявки и направления ответа.</span>
        </label>
        <button type='submit' className='p7-lead-button'>Отправить заявку<Send size={17} /><ArrowRight size={17} /></button>
      </form>
      <style>{css}</style>
    </section>
  );
}

const css = `
.p7-lead-capture{max-width:1180px;margin:108px auto 96px;padding:clamp(18px,3vw,26px);display:grid;grid-template-columns:minmax(0,.86fr) minmax(320px,.56fr);gap:18px;border:1px solid rgba(7,22,17,.08);border-radius:32px;background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(240,248,238,.9));box-shadow:0 22px 60px rgba(7,22,17,.09);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#071611}.p7-lead-copy{display:grid;align-content:center;gap:14px;padding:clamp(4px,1vw,12px)}.p7-lead-kicker{display:inline-flex;align-items:center;gap:8px;width:fit-content;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:12px;font-weight:950;letter-spacing:.045em;text-transform:uppercase}.p7-lead-copy h2{margin:0;max-width:680px;font-size:clamp(30px,4vw,52px);line-height:1.02;letter-spacing:-.055em;font-weight:840;text-wrap:balance}.p7-lead-copy p{margin:0;max-width:650px;color:#4e5d56;font-size:16px;line-height:1.5;font-weight:650}.p7-lead-proof{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}.p7-lead-proof span{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 10px;border-radius:999px;background:#fff;color:#203029;font-size:12px;font-weight:900;box-shadow:inset 0 0 0 1px rgba(7,22,17,.08)}.p7-lead-proof svg{color:#087a3b}.p7-lead-card{display:grid;align-content:start;gap:11px;padding:20px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.9);box-shadow:0 16px 38px rgba(7,22,17,.065)}.p7-lead-card strong{font-size:22px;line-height:1.1;letter-spacing:-.04em}.p7-lead-card>span{color:#4e5d56;font-size:14px;line-height:1.45;font-weight:650}.p7-lead-card label{display:grid;gap:6px;margin:0}.p7-lead-card label em{font-style:normal;color:#52615a;font-size:12px;font-weight:900}.p7-lead-card input,.p7-lead-card textarea{width:100%;border:1px solid rgba(7,22,17,.12);border-radius:14px;background:#fff;color:#071611;font:750 16px/1.3 Inter,ui-sans-serif,system-ui;padding:12px 13px;outline:none}.p7-lead-card textarea{resize:vertical;min-height:86px}.p7-lead-card input:focus,.p7-lead-card textarea:focus{border-color:rgba(0,122,47,.45);box-shadow:0 0 0 4px rgba(0,122,47,.1)}.p7-lead-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.p7-lead-consent{grid-template-columns:auto 1fr!important;align-items:start;gap:9px!important;color:#4e5d56;font-size:12px;font-weight:800;line-height:1.35}.p7-lead-consent input{width:17px;height:17px;margin-top:1px;padding:0;accent-color:#087a3b}.p7-lead-button{min-height:52px;border:0;border-radius:17px;background:#087a3b;color:#fff!important;font-weight:950;font-size:15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;box-shadow:0 18px 34px rgba(0,122,47,.2);cursor:pointer}.p7-lead-button:hover{transform:translateY(-1px)}.p7-lead-hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important}@media(max-width:980px){.p7-lead-capture{grid-template-columns:1fr;margin:94px 14px 92px;border-radius:28px}.p7-lead-copy h2{font-size:clamp(28px,8vw,38px)}.p7-lead-copy p{font-size:14px}.p7-lead-proof{display:grid}.p7-lead-proof span{justify-content:flex-start}.p7-lead-two{grid-template-columns:1fr}.p7-public-tour-trigger{bottom:max(86px,env(safe-area-inset-bottom))!important}}`;
