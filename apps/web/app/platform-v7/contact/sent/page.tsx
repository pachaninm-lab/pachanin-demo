import Link from 'next/link';
import { ArrowRight, CheckCircle2, HelpCircle, Wheat } from 'lucide-react';

export default function PlatformV7ContactSentPage() {
  return (
    <main className="p7-contact-sent-page">
      <style>{css}</style>
      <header className="p7-contact-sent-header" aria-label="Навигация после отправки вопроса">
        <Link href="/platform-v7" className="p7-contact-sent-brand" aria-label="На главную Прозрачная Цена"><span><Wheat size={24} /></span><strong>Прозрачная Цена</strong></Link>
      </header>
      <section className="p7-contact-sent-card" aria-labelledby="p7-contact-sent-title">
        <span className="p7-contact-sent-icon"><CheckCircle2 size={34} /></span>
        <span className="p7-contact-sent-kicker">Обращение отправлено</span>
        <h1 id="p7-contact-sent-title">Вопрос принят</h1>
        <p>Мы получили обращение через форму обратной связи. Реальный доступ в личные кабинеты этим действием не создаётся: подключение организации проходит отдельно через проверку и допуск.</p>
        <div className="p7-contact-sent-actions"><Link href="/platform-v7/demo"><HelpCircle size={18} />Посмотреть демо-сделку</Link><Link href="/platform-v7/register" className="primary">Подключить организацию<ArrowRight size={18} /></Link></div>
      </section>
    </main>
  );
}

const css = `
.pc-shell-root-v4:has(.p7-contact-sent-page) { --pc-header-offset: 0px !important; background: #f7faf6 !important; }
.pc-shell-root-v4:has(.p7-contact-sent-page) .pc-v4-header, .pc-shell-root-v4:has(.p7-contact-sent-page) .pc-v4-bottomnav, .pc-shell-root-v4:has(.p7-contact-sent-page) .pc-v4-drawer, .pc-shell-root-v4:has(.p7-contact-sent-page) .pc-v4-pilot-note { display: none !important; }
.pc-shell-root-v4:has(.p7-contact-sent-page) .pc-v4-main { max-width: none !important; margin: 0 !important; padding: 0 20px 34px !important; background: #f7faf6 !important; min-height: 100svh !important; }
.p7-contact-sent-page { width: 100%; max-width: 860px; margin: 0 auto; padding: max(10px, env(safe-area-inset-top)) 0 36px; display: grid; gap: 16px; color: #102019; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.p7-contact-sent-page * { box-sizing: border-box; }
.p7-contact-sent-page a { color: inherit; text-decoration: none; }
.p7-contact-sent-header, .p7-contact-sent-card { border: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.93); box-shadow: 0 16px 38px rgba(15,23,42,.055); }
.p7-contact-sent-header { position: sticky; top: max(8px, env(safe-area-inset-top)); z-index: 30; padding: 13px 14px; border-radius: 26px; backdrop-filter: blur(18px); }
.p7-contact-sent-brand { min-width: 0; display: inline-flex; align-items: center; gap: 10px; font-weight: 930; letter-spacing: -.035em; }
.p7-contact-sent-brand span { width: 42px; height: 42px; display: inline-grid; place-items: center; border-radius: 15px; color: #087a3b; background: rgba(8,122,59,.09); }
.p7-contact-sent-card { min-height: 520px; display: grid; align-content: center; justify-items: center; text-align: center; gap: 14px; border-radius: 30px; padding: clamp(24px, 5vw, 54px); background: radial-gradient(circle at 50% 0, rgba(8,122,59,.12), transparent 36%), rgba(255,255,255,.93); }
.p7-contact-sent-icon { width: 74px; height: 74px; display: inline-grid; place-items: center; border-radius: 24px; color: #087a3b; background: rgba(8,122,59,.09); }
.p7-contact-sent-kicker { width: fit-content; display: inline-flex; padding: 8px 12px; border-radius: 999px; background: rgba(8,122,59,.09); color: #087a3b; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .055em; }
.p7-contact-sent-card h1 { margin: 0; color: #0f1f18; font-size: clamp(38px, 6vw, 64px); line-height: 1.02; letter-spacing: -.06em; font-weight: 950; }
.p7-contact-sent-card p { max-width: 640px; margin: 0; color: #5d6b64; font-size: clamp(15.5px, 2vw, 19px); line-height: 1.5; font-weight: 620; }
.p7-contact-sent-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 10px; } .p7-contact-sent-actions a { min-height: 52px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; border-radius: 16px; border: 1px solid rgba(8,122,59,.22); color: #087a3b; background: #fff; font-weight: 930; } .p7-contact-sent-actions a.primary { color: #fff; background: #087a3b; box-shadow: 0 16px 34px rgba(8,122,59,.20); }
@media (max-width: 620px) { .pc-shell-root-v4:has(.p7-contact-sent-page) .pc-v4-main { padding: 0 12px 28px !important; } .p7-contact-sent-header, .p7-contact-sent-card { border-radius: 24px; } .p7-contact-sent-actions, .p7-contact-sent-actions a { width: 100%; } }
`;
