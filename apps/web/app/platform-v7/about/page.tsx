import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'О проекте — Прозрачная Цена на домене Процент-Агро.рф',
  description:
    'Прозрачная Цена на домене Процент-Агро.рф — controlled pilot / pre-integration контур исполнения зерновой сделки: цена, логистика, приёмка, документы, расчёт, спор и доказательства.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/about',
  },
  openGraph: {
    title: 'О проекте — Прозрачная Цена / Процент Агро',
    description:
      'Проект на домене Процент-Агро.рф не является обычной доской объявлений: фокус — исполнение сделки после цены, документный след, расчёт и доказательства.',
    url: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/about',
    siteName: 'Прозрачная Цена / Процент Агро',
    locale: 'ru_RU',
    type: 'website',
  },
};

const TRUST_LINKS = [
  {
    title: 'Демонстрационная сделка',
    note: 'Публичный proof-of-flow без доступа к рабочим кабинетам и реальным данным.',
    href: '/platform-v7/demo',
  },
  {
    title: 'Документный контур',
    note: 'СДИЗ, ЭДО, транспортные документы, акты, приёмка, качество и доказательства.',
    href: '/platform-v7/docs',
  },
  {
    title: 'Статус сервисов',
    note: 'Честная граница текущей готовности: controlled pilot / pre-integration.',
    href: '/platform-v7/status',
  },
  {
    title: 'Обратная связь',
    note: 'Единый публичный канал для вопросов по пилоту, банку, региону и подключению.',
    href: '/platform-v7/contact',
  },
];

const SEO_LINKS = [
  { title: 'Безопасная зерновая сделка', note: 'Исполнение после цены: рейс, приёмка, документы, расчёт, спор и доказательства.', href: '/platform-v7/secure-grain-deal' },
  { title: 'Логистика зерна', note: 'Рейс, водитель, маршрут, элеватор, контрольные точки и отклонения.', href: '/platform-v7/grain-logistics' },
  { title: 'Качество и приёмка', note: 'Вес, лабораторные показатели, допуски, расхождения и доказательный слой.', href: '/platform-v7/grain-quality' },
  { title: 'Документы сделки', note: 'СДИЗ, ЭДО, транспортные документы, акты и комплектность до расчёта.', href: '/platform-v7/grain-documents' },
  { title: 'Расчёты по сделке', note: 'Основание для оплаты после подтверждённых событий, документов и качества.', href: '/platform-v7/grain-payment' },
  { title: 'ФГИС Зерно и СДИЗ', note: 'Целевой pre-integration контур регуляторного следа и прослеживаемости партии.', href: '/platform-v7/fgis-zerno' },
];

const LEGAL_LINKS = [
  { label: 'Privacy', href: '/platform-v7/privacy' },
  { label: 'Terms', href: '/platform-v7/terms' },
  { label: 'Oferta', href: '/platform-v7/oferta' },
  { label: 'Docs', href: '/platform-v7/docs' },
];

export default function AboutPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>О проекте</div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7 }}>
          Прозрачная Цена — это не витрина объявлений, а цифровой контур исполнения внебиржевой зерновой сделки: от цены и допуска до логистики, приёмки, документов, основания для расчёта, спора и доказательств.
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.7 }}>
          Процент Агро и Процент-Агро.рф используются как публичная доменная связка проекта Прозрачная Цена.
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Что делает система</div>
        <Bullet text='Держит сделку в одном контуре, а не разносит её по чатам, звонкам и разрозненным файлам.' />
        <Bullet text='Показывает следующий шаг, владельца действия и причину блокировки расчёта.' />
        <Bullet text='Связывает логистику, документы, приёмку, качество, банковское основание и спор в одну цепочку.' />
        <Bullet text='Собирает доказательную базу для оператора, банка, комплаенса и разбора расхождений.' />
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Доверие и прозрачность</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7, marginTop: 8 }}>
            Здесь собраны публичные поверхности, которые помогают понять контур без доступа к личным кабинетам и без заявления неподтверждённых live-интеграций.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {TRUST_LINKS.map((item) => (
            <PublicLink key={item.href} item={item} />
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Публичные разделы для поиска</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7, marginTop: 8 }}>
            Эти страницы объясняют поисковикам и рынку, что Процент-Агро — это контур исполнения зерновой сделки, а не обычная доска объявлений.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {SEO_LINKS.map((item) => (
            <PublicLink key={item.href} item={item} />
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Публичный канал связи</div>
        <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7 }}>
          Для вопросов по платформе, controlled pilot, банковскому контуру, региональному запуску или техническому взаимодействию используется форма обращения. Неподтверждённые реквизиты, демо-email и тестовые телефоны на публичной странице не публикуются.
        </div>
        <Link href='/platform-v7/contact' style={{ width: 'fit-content', textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Задать вопрос
        </Link>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Юридический и документный контур</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {LEGAL_LINKS.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', padding: '8px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-secondary, #475569)', fontSize: 12, fontWeight: 800 }}>
              {item.label}
            </Link>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7 }}>
          Эти поверхности нужны не для витрины, а для понятного внешнего контура: право, безопасность, условия работы и документы платформы.
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          На главную
        </Link>
        <Link href='/platform-v7/status' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border, #E4E6EA)', background: '#fff', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, fontWeight: 700 }}>
          Статус сервисов
        </Link>
      </div>
    </div>
  );
}

function PublicLink({ item }: { item: { title: string; note: string; href: string } }) {
  return (
    <Link href={item.href} style={{ textDecoration: 'none', background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{item.title}</div>
      <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6 }}>{item.note}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
    </Link>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.6 }}>
      <span style={{ fontWeight: 900 }}>•</span>
      <span>{text}</span>
    </div>
  );
}
