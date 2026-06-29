import { ArrowRight } from 'lucide-react';

export function PublicQuestionBlock() {
  return (
    <section id='question' className='entry-question-section' aria-labelledby='entry-question-title'>
      <style>{css}</style>
      <div className='entry-question-copy'>
        <span>Обратная связь</span>
        <h2 id='entry-question-title'>Задать вопрос по платформе</h2>
        <p>Обращение можно направить без регистрации. Форма не предоставляет доступ к личным кабинетам, сделкам и закрытым маршрутам платформы.</p>
      </div>
      <form method='post' action='/api/platform-v7/inquiries' className='entry-question-form' aria-label='Форма обращения'>
        <input type='text' name='website' tabIndex={-1} autoComplete='off' aria-hidden='true' className='entry-honeypot' />
        <input type='hidden' name='source' value='platform_v7_root' />
        <label><span>Тип вопроса</span><select name='type' required defaultValue='platform'><option value='platform'>По платформе</option><option value='pilot'>По пилоту</option><option value='bank_partner'>Для банка / партнёра</option><option value='region'>Для региона</option><option value='technical'>Технический вопрос</option><option value='other'>Другое</option></select></label>
        <label><span>Имя</span><input name='name' type='text' minLength={2} maxLength={80} placeholder='Фамилия и имя' required /></label>
        <label><span>Телефон или email</span><input name='contact' type='text' minLength={5} maxLength={120} placeholder='+7... или email организации' required /></label>
        <label><span>Организация</span><input name='organization' type='text' maxLength={120} placeholder='При наличии' /></label>
        <label className='entry-question-full'><span>Сообщение</span><textarea name='message' minLength={20} maxLength={2000} rows={5} placeholder='Опишите вопрос по платформе, пилоту, роли участника, документам, расчётам или техническому подключению.' required /></label>
        <label className='entry-question-consent'><input type='checkbox' name='consent' value='yes' required /><span>Согласен на обработку указанных данных для рассмотрения обращения.</span></label>
        <button type='submit'>Отправить обращение<ArrowRight size={17} /></button>
      </form>
    </section>
  );
}

const css = `
.entry-question-section{display:grid;grid-template-columns:minmax(0,.52fr) minmax(360px,.48fr);gap:22px;align-items:start;margin:18px clamp(18px,4vw,56px);padding:clamp(22px,3vw,34px);border:1px solid rgba(7,22,17,.075);border-radius:32px;background:rgba(255,255,255,.86);box-shadow:0 18px 48px rgba(7,22,17,.065)}
.entry-question-copy span{display:inline-flex;width:fit-content;margin-bottom:12px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;letter-spacing:.055em;text-transform:uppercase}
.entry-question-copy h2{margin:0;font-size:clamp(26px,3.1vw,44px);line-height:1.05;letter-spacing:-.045em}
.entry-question-copy p{margin:12px 0 0;max-width:680px;color:#5c6962;font-size:15.5px;line-height:1.45;font-weight:650}
.entry-question-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.entry-question-form label{display:grid;gap:6px}.entry-question-form label span{color:#66736e;font-size:12px;font-weight:900}
.entry-question-form input,.entry-question-form select,.entry-question-form textarea{width:100%;border:1px solid rgba(7,22,17,.12);border-radius:15px;background:#fff;color:#071611;font:inherit;font-size:14px;font-weight:650;outline:none}
.entry-question-form input,.entry-question-form select{min-height:46px;padding:0 13px}.entry-question-form textarea{padding:12px 13px;resize:vertical}
.entry-question-full,.entry-question-consent,.entry-question-form button{grid-column:1/-1}.entry-question-consent{display:flex!important;gap:10px;color:#4e5d56;font-size:13px;line-height:1.35}.entry-question-consent input{width:auto;min-height:auto;margin-top:2px}
.entry-question-form button{min-height:52px;border:0;border-radius:17px;background:#087a3b;color:#fff;font-weight:950;font-size:15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.entry-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;opacity:0!important}
@media(max-width:980px){.entry-question-section{grid-template-columns:1fr;margin:14px;padding:20px;border-radius:26px}.entry-question-form{grid-template-columns:1fr}.entry-question-copy h2{font-size:clamp(27px,8vw,36px)}}
@media(max-width:420px){.entry-question-section{margin-left:0;margin-right:0}}
`;
