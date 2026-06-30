import type { Metadata } from 'next';
import Link from 'next/link';

const faq = [
  {
    question: 'Можно ли посмотреть платформу без регистрации?',
    answer: 'Да. Для этого используется демонстрационная сделка. Она показывает процесс исполнения без доступа к реальным кабинетам и рабочим данным.',
  },
  {
    question: 'Что происходит после согласования цены?',
    answer: 'Платформа показывает рейс, приёмку, качество, документы, основание для расчёта и спорный контур. Фокус не на поиске контакта, а на исполнении сделки.',
  },
  {
    question: 'Можно ли задать вопрос до подключения?',
    answer: 'Да. Вопрос направляется через форму обращения. Для ответа достаточно указать имя, организацию и контакт.',
  },
  {
    question: 'Кому подходит пилот?',
    answer: 'Покупателям, продавцам, логистике, элеватору, лаборатории, банку или региональному контуру, где важно снизить спорность и связать документы с фактическим исполнением.',
  },
];

export const metadata: Metadata = {
  title: 'Вопросы и ответы по платформе зерновых сделок',
  description: 'Ответы на вопросы о демо-сделке, пилоте, документах, приёмке, качестве, расчётах и подключении к платформе Прозрачная Цена.',
  alternates: { canonical: '/platform-v7/voprosy-otvety' },
};

export default function QuestionsPage() {
  return (
    <main style={{ minHeight: '100svh', padding: '32px 16px', background: '#f6f8f4', color: '#071611' }}>
      <section style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 16 }}>
        <Link href='/platform-v7' style={{ color: '#087a3b', fontWeight: 800, textDecoration: 'none' }}>← Прозрачная Цена</Link>
        <article style={{ border: '1px solid rgba(7,22,17,.08)', borderRadius: 28, background: '#fff', padding: 'clamp(22px,4vw,42px)' }}>
          <p style={{ margin: '0 0 12px', color: '#087a3b', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', fontSize: 12 }}>Вопросы клиентов</p>
          <h1 style={{ margin: 0, fontSize: 'clamp(32px,5vw,56px)', lineHeight: 1, letterSpacing: '-.05em' }}>Раздел для вопросов по платформе и пилоту</h1>
          <p style={{ margin: '18px 0 0', color: '#4e5d56', fontSize: 17, lineHeight: 1.55 }}>Короткие ответы для потенциальных клиентов: как посмотреть демо, как задать вопрос, что делает платформа и где проходит граница текущей готовности.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
            <Link href='/platform-v7/demo' style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 14, background: '#087a3b', color: '#fff', textDecoration: 'none', fontWeight: 800 }}>Посмотреть демо-сделку</Link>
            <Link href='/platform-v7/contact' style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 14, background: '#fff', color: '#087a3b', border: '1px solid rgba(0,122,47,.22)', textDecoration: 'none', fontWeight: 800 }}>Задать вопрос</Link>
          </div>
        </article>
        <section style={{ display: 'grid', gap: 12 }}>
          {faq.map((item) => (
            <article key={item.question} style={{ border: '1px solid rgba(7,22,17,.08)', borderRadius: 22, background: '#fff', padding: 22 }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>{item.question}</h2>
              <p style={{ margin: '10px 0 0', color: '#4e5d56', lineHeight: 1.55 }}>{item.answer}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
