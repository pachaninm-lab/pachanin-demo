import Link from 'next/link';
import { ArrowRight, MessageCircleQuestion, PlayCircle, Wheat } from 'lucide-react';

type SeoBlock = {
  title: string;
  text: string;
  bullets?: string[];
};

type SeoFaq = {
  question: string;
  answer: string;
};

type PublicSeoLandingProps = {
  kicker: string;
  title: string;
  description: string;
  blocks: SeoBlock[];
  faq?: SeoFaq[];
};

export function PublicSeoLanding({ kicker, title, description, blocks, faq = [] }: PublicSeoLandingProps) {
  return (
    <main className='p7-seo-page'>
      <style>{css}</style>
      <header className='p7-seo-header' aria-label='Публичная навигация'>
        <Link href='/platform-v7' className='p7-seo-brand' aria-label='Прозрачная Цена'>
          <Wheat size={22} />
          <strong>Прозрачная Цена</strong>
        </Link>
        <nav aria-label='Публичные разделы'>
          <Link href='/platform-v7/demo'>Демо</Link>
          <Link href='/platform-v7/contact'>Вопрос</Link>
        </nav>
      </header>

      <section className='p7-seo-hero'>
        <span>{kicker}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className='p7-seo-actions'>
          <Link className='p7-seo-primary' href='/platform-v7/demo'>
            <PlayCircle size={18} />
            Посмотреть демо-сделку
          </Link>
          <Link className='p7-seo-secondary' href='/platform-v7/contact'>
            <MessageCircleQuestion size={18} />
            Задать вопрос
          </Link>
        </div>
      </section>

      <section className='p7-seo-grid' aria-label='Описание'>
        {blocks.map((block) => (
          <article key={block.title}>
            <h2>{block.title}</h2>
            <p>{block.text}</p>
            {block.bullets && block.bullets.length > 0 ? (
              <ul>
                {block.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            ) : null}
          </article>
        ))}
      </section>

      {faq.length > 0 ? (
        <section className='p7-seo-faq' aria-label='Вопросы и ответы'>
          <h2>Вопросы клиентов</h2>
          {faq.map((item) => (
            <article key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </section>
      ) : null}

      <section className='p7-seo-final' aria-label='Следующее действие'>
        <div>
          <h2>Следующий шаг</h2>
          <p>Оставьте вопрос или запрос на подключение. Рабочие кабинеты доступны только после подключения организации и проверки доступа.</p>
        </div>
        <Link className='p7-seo-primary' href='/platform-v7/contact'>
          Направить вопрос
          <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}

const css = `
.pc-shell-root-v4:has(.p7-seo-page) .pc-v4-header,.pc-shell-root-v4:has(.p7-seo-page) .pc-v4-bottomnav,.pc-shell-root-v4:has(.p7-seo-page) .pc-v4-drawer,.pc-shell-root-v4:has(.p7-seo-page) .pc-v7-role-dock,.pc-shell-root-v4:has(.p7-seo-page) .pc-v7-assistant-widget{display:none!important}.pc-shell-root-v4:has(.p7-seo-page) .pc-v4-main{max-width:none!important;margin:0!important;padding:0!important}.p7-seo-page{min-height:100svh;padding:12px clamp(14px,4vw,56px) 44px;color:#071611;background:linear-gradient(180deg,#fbfcf9,#f3f7f1 56%,#fff);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.p7-seo-page *{box-sizing:border-box}.p7-seo-page a{color:inherit;text-decoration:none}.p7-seo-header{position:sticky;top:10px;z-index:20;display:flex;justify-content:space-between;gap:14px;align-items:center;min-height:62px;padding:10px 14px;border:1px solid rgba(7,22,17,.08);border-radius:24px;background:rgba(255,255,255,.94);box-shadow:0 16px 42px rgba(7,22,17,.08);backdrop-filter:blur(16px)}.p7-seo-brand{display:inline-flex;align-items:center;gap:10px;font-weight:950}.p7-seo-brand svg{color:#087a3b}.p7-seo-header nav{display:flex;gap:8px}.p7-seo-header nav a,.p7-seo-primary,.p7-seo-secondary{min-height:42px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 14px;border-radius:14px;border:1px solid rgba(7,22,17,.1);font-size:13px;font-weight:900}.p7-seo-hero,.p7-seo-grid article,.p7-seo-faq,.p7-seo-final{border:1px solid rgba(7,22,17,.075);border-radius:30px;background:rgba(255,255,255,.84);box-shadow:0 18px 48px rgba(7,22,17,.065)}.p7-seo-hero{margin-top:22px;padding:clamp(24px,4vw,46px)}.p7-seo-hero span{display:inline-flex;margin-bottom:14px;padding:8px 12px;border-radius:999px;background:rgba(0,122,47,.08);color:#087a3b;font-size:11px;font-weight:950;letter-spacing:.055em;text-transform:uppercase}.p7-seo-hero h1{margin:0;max-width:980px;font-size:clamp(34px,5vw,72px);line-height:.99;letter-spacing:-.058em}.p7-seo-hero p,.p7-seo-grid p,.p7-seo-faq p,.p7-seo-final p{margin:16px 0 0;color:#4e5d56;font-size:16px;line-height:1.5;font-weight:640}.p7-seo-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.p7-seo-primary{background:#087a3b;color:#fff!important;border-color:#087a3b}.p7-seo-secondary{background:#fff;color:#087a3b!important;border-color:rgba(0,122,47,.22)}.p7-seo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px}.p7-seo-grid article{padding:22px}.p7-seo-grid h2,.p7-seo-faq h2,.p7-seo-final h2{margin:0;font-size:clamp(24px,2.7vw,38px);line-height:1.05;letter-spacing:-.045em}.p7-seo-grid ul{margin:16px 0 0;padding-left:18px;color:#334239;font-size:14px;line-height:1.45;font-weight:720}.p7-seo-faq{margin-top:14px;padding:24px;display:grid;gap:12px}.p7-seo-faq article{padding:18px;border:1px solid rgba(7,22,17,.07);border-radius:20px;background:#fff}.p7-seo-faq h3{margin:0;font-size:18px}.p7-seo-faq p{margin-top:8px;font-size:14px}.p7-seo-final{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;margin-top:14px;padding:24px}@media(max-width:900px){.p7-seo-page{padding:8px 12px 34px}.p7-seo-header,.p7-seo-final{display:grid;grid-template-columns:1fr}.p7-seo-header nav{display:grid;grid-template-columns:1fr 1fr}.p7-seo-grid{grid-template-columns:1fr}.p7-seo-hero h1{font-size:34px}.p7-seo-actions,.p7-seo-final .p7-seo-primary{display:grid;grid-template-columns:1fr;width:100%}}
`;
