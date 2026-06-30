import Link from 'next/link';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

export function PlatformV7LeadCapture() {
  return (
    <section id='lead-request' className='p7-lead-capture' aria-labelledby='p7-lead-title'>
      <div className='p7-lead-copy'>
        <span className='p7-lead-kicker'><ShieldCheck size={16} /> Заявка на демо</span>
        <h2 id='p7-lead-title'>Оставить заявку на разбор сделки и controlled pilot</h2>
        <p>Короткий вход для рынка, банка, региона или партнёра. Контакт фиксируется как коммерческий лид, передаётся в CRM-контур и получает автоответ с приглашением на демо или прямым контактом менеджера.</p>
        <div className='p7-lead-proof' aria-label='Что будет после заявки'>
          <span><CheckCircle2 size={17} /> источник фиксируется</span>
          <span><CheckCircle2 size={17} /> CRM получает контакт</span>
          <span><CheckCircle2 size={17} /> заявитель получает автоответ</span>
        </div>
      </div>
      <div className='p7-lead-card'>
        <strong>Коммерческая заявка</strong>
        <span>Форма открывается отдельно, без доступа к рабочим кабинетам и без обещания боевых интеграций до проверки сценария.</span>
        <Link href='/platform-v7/contact?type=pilot&source=homepage_lead_form' className='p7-lead-button'>Оставить заявку<ArrowRight size={17} /></Link>
      </div>
      <style>{css}</style>
    </section>
  );
}

const css = `
.p7-lead-capture{max-width:1180px;margin:22px auto 96px;padding:clamp(18px,3vw,26px);display:grid;grid-template-columns:minmax(0,.86fr) minmax(300px,.52fr);gap:18px;border:1px solid rgba(7,22,17,.08);border-radius:32px;background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(240,248,238,.9));box-shadow:0 22px 60px rgba(7,22,17,.09);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#071611}.p7-lead-copy{display:grid;align-content:center;gap:14px;padding:clamp(4px,1vw,12px)}.p7-lead-kicker{display:inline-flex;align-items:center;gap:8px;width:fit-content;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:12px;font-weight:950;letter-spacing:.045em;text-transform:uppercase}.p7-lead-copy h2{margin:0;max-width:680px;font-size:clamp(30px,4vw,52px);line-height:1.02;letter-spacing:-.055em;font-weight:950;text-wrap:balance}.p7-lead-copy p{margin:0;max-width:650px;color:#4e5d56;font-size:16px;line-height:1.5;font-weight:650}.p7-lead-proof{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}.p7-lead-proof span{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 10px;border-radius:999px;background:#fff;color:#203029;font-size:12px;font-weight:900;box-shadow:inset 0 0 0 1px rgba(7,22,17,.08)}.p7-lead-proof svg{color:#087a3b}.p7-lead-card{display:grid;align-content:center;gap:12px;padding:20px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.88);box-shadow:0 16px 38px rgba(7,22,17,.065)}.p7-lead-card strong{font-size:22px;line-height:1.1;letter-spacing:-.04em}.p7-lead-card span{color:#4e5d56;font-size:14px;line-height:1.45;font-weight:650}.p7-lead-button{min-height:52px;border-radius:17px;background:#087a3b;color:#fff!important;font-weight:950;font-size:15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;box-shadow:0 18px 34px rgba(0,122,47,.2)}@media(max-width:980px){.p7-lead-capture{grid-template-columns:1fr;margin:18px 14px 92px;border-radius:28px}.p7-lead-copy h2{font-size:clamp(28px,8vw,38px)}.p7-lead-copy p{font-size:14px}.p7-lead-proof{display:grid}.p7-lead-proof span{justify-content:flex-start}.p7-public-tour-trigger{bottom:max(86px,env(safe-area-inset-bottom))!important}}`;
