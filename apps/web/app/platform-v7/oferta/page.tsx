import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Условия сервиса — Прозрачная Цена',
  description:
    'Информация об условиях использования сервисов цифровой платформы «Прозрачная Цена» и границах ответственности участников.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/oferta',
  },
  robots: {
    index: false,
    follow: true,
  },
};

const BLOCKS = [
  {
    title: 'Предмет условий',
    body: 'Платформа предоставляет доступ к рабочим экранам, статусам, документам, маршрутам, событиям и действиям, связанным с регистрацией организации и сопровождением сделки. Эти условия описывают использование цифрового сервиса и не заменяют договоры между сторонами сделки.',
  },
  {
    title: 'Готовность отдельных функций',
    body: 'Доступность отдельных внешних подключений определяется их фактическим состоянием. Если операция требует ручного подтверждения либо внешний сервис недоступен, интерфейс должен показывать это явно и не выдавать неподтверждённый результат за завершённую операцию.',
  },
  {
    title: 'Обязанности пользователя',
    body: 'Пользователь обязан предоставлять достоверные сведения, действовать в пределах назначенных полномочий, не искажать документы и не обходить предусмотренные проверки. Статус в интерфейсе не должен трактоваться как юридически подтверждённый результат, если соответствующее подтверждение по закону или договору выдаёт внешний участник.',
  },
  {
    title: 'Границы сервиса',
    body: 'Платформа помогает фиксировать статусы, документы и события и удерживать сделку в одном рабочем процессе, но не заменяет правовую экспертизу, банковское решение, регуляторное подтверждение, внутренние процедуры сторон и их договорные обязательства.',
  },
  {
    title: 'Юридически значимые реквизиты',
    body: 'Официальная оферта или иной юридически значимый договор от имени конкретного оператора сервиса может публиковаться только после подтверждения его реквизитов официальными документами. Неподтверждённые наименование, ИНН, ОГРН и адрес не подставляются автоматически.',
  },
];

const MODULE_LINKS = [
  {
    title: 'Вход и подключение организации',
    note: 'Регистрация, вход и восстановление доступа связаны в единый пользовательский путь.',
    href: '/platform-v7/auth',
  },
  {
    title: 'Банковские операции',
    note: 'Банковские события и связанные с расчётами действия отображаются в отдельной рабочей поверхности.',
    href: '/platform-v7/bank',
  },
  {
    title: 'Состояние сервисов',
    note: 'Отдельная страница показывает доступность сервисов и внешних подключений.',
    href: '/platform-v7/status',
  },
  {
    title: 'Профиль организации',
    note: 'Сведения об организации, пользователях и доступах собраны в связанных разделах профиля.',
    href: '/platform-v7/profile',
  },
  {
    title: 'Документы и правила',
    note: 'Условия использования, политика конфиденциальности, безопасность и справочные материалы доступны отдельно.',
    href: '/platform-v7/docs',
  },
];

export default function OfertaPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Условия сервиса</div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7 }}>
          Правила использования цифровых сервисов платформы и границы ответственности участников.
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
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Связанные разделы платформы</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7, marginTop: 8 }}>
            Условия сервиса относятся к связанным пользовательским, документным и операционным разделам платформы.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {MODULE_LINKS.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 8, padding: 16, borderRadius: 14, background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{item.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--pc-text-secondary, #475569)' }}>{item.note}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Принцип достоверности</div>
        <div style={{ fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.7 }}>
          Пользовательский интерфейс должен показывать фактическое состояние операции и не создавать впечатление завершённого внешнего действия, если необходимое подтверждение ещё не получено.
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/terms' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Условия использования
        </Link>
        <Link href='/platform-v7/privacy' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border, #E4E6EA)', background: '#fff', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, fontWeight: 700 }}>
          Политика конфиденциальности
        </Link>
      </div>
    </div>
  );
}
