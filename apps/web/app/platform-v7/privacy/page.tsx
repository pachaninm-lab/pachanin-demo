import type { Metadata } from 'next';
import Link from 'next/link';
import { PrivacyPortalPanel } from '@/components/platform-v7/PrivacyPortalPanel';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности — Прозрачная Цена',
  description:
    'Информация об обработке и защите данных пользователей цифровой платформы «Прозрачная Цена».',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/privacy',
  },
  robots: {
    index: false,
    follow: true,
  },
};

const BLOCKS = [
  {
    title: 'Какие данные используются',
    body: 'Платформа может обрабатывать данные учётной записи и контактов, сведения об организации и полномочиях пользователя, данные сделок и документов, а также технические и защитные журналы, необходимые для работы, аудита и безопасности.',
  },
  {
    title: 'Для чего используются данные',
    body: 'Данные используются для регистрации и проверки доступа, сопровождения сделки, отображения статусов и документов, выполнения пользовательских запросов, предотвращения злоупотреблений, расследования инцидентов и поддержки пользователей.',
  },
  {
    title: 'Ограничение доступа',
    body: 'Доступ к данным ограничивается назначенными полномочиями, организацией пользователя и контекстом выполняемой операции. Платформа применяет серверные проверки доступа и журналирование значимых действий.',
  },
  {
    title: 'Хранение и удаление',
    body: 'Данные хранятся в объёме и в течение срока, необходимого для заявленной цели обработки, исполнения обязательств, обеспечения безопасности и выполнения требований законодательства. По завершении соответствующей цели данные удаляются, обезличиваются либо сохраняются только при наличии правового основания.',
  },
  {
    title: 'Передача внешним участникам',
    body: 'Передача данных банкам, перевозчикам, лабораториям, государственным информационным системам и другим участникам выполняется только когда это необходимо для соответствующей операции и при наличии применимого основания. Платформа не использует продажу персональных данных как способ монетизации.',
  },
  {
    title: 'Реквизиты оператора данных',
    body: 'Юридически значимые реквизиты оператора персональных данных публикуются только после их подтверждения официальными документами. Платформа не подставляет неподтверждённые наименование, ИНН, ОГРН или адрес. До публикации подтверждённых реквизитов запросы по правам субъекта данных можно направлять через встроенный портал ниже.',
  },
];

const DATA_MODULES = [
  {
    title: 'Вход и регистрация',
    note: 'Регистрация, вход и восстановление доступа задают контролируемую точку работы с учётной записью.',
    href: '/platform-v7/auth',
  },
  {
    title: 'Профиль и команда',
    note: 'Сведения об организации, пользователях и доступах отображаются в связанных разделах профиля.',
    href: '/platform-v7/profile',
  },
  {
    title: 'Безопасность',
    note: 'Отдельная страница описывает основные механизмы защиты доступа и действий.',
    href: '/platform-v7/security',
  },
  {
    title: 'Состояние сервисов',
    note: 'Статусный раздел показывает доступность основных сервисов и внешних подключений.',
    href: '/platform-v7/status',
  },
];

export default function PrivacyPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Политика конфиденциальности</div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7 }}>
          Как платформа использует, ограничивает и защищает данные пользователей и организаций.
        </div>
      </section>

      <div style={{ display: 'grid', gap: 12 }}>
        {BLOCKS.map((block) => (
          <section key={block.title} style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{block.title}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.7 }}>{block.body}</div>
          </section>
        ))}
      </div>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Связанные разделы защиты данных</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7, marginTop: 8 }}>
            Доступ, профиль организации, безопасность и состояние сервисов разделены на отдельные пользовательские поверхности.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {DATA_MODULES.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 8, padding: 16, borderRadius: 14, background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{item.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--pc-text-secondary, #475569)' }}>{item.note}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Принцип минимизации</div>
        <div style={{ fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.7 }}>
          Платформа должна использовать только те данные, которые необходимы для конкретной операции, безопасности, доказательности и выполнения законных требований, без избыточного сбора персональной информации.
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', marginBottom: 14 }}>
          Права субъекта персональных данных · 152-ФЗ
        </div>
        <PrivacyPortalPanel />
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/security' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Страница безопасности
        </Link>
        <Link href='/platform-v7/about' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border, #E4E6EA)', background: '#fff', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, fontWeight: 700 }}>
          О проекте
        </Link>
      </div>
    </div>
  );
}
