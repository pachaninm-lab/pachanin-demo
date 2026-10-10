import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Условия использования — Прозрачная Цена',
  description:
    'Публичные условия использования цифровой платформы «Прозрачная Цена» для регистрации, работы с организацией и сопровождения агросделок.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/terms',
  },
  robots: {
    index: false,
    follow: true,
  },
};

const BLOCKS = [
  {
    title: 'Назначение платформы',
    body: 'Платформа предоставляет цифровые инструменты для регистрации организаций и пользователей, работы с лотами и предложениями, сопровождения поставки, качества, документов, расчётов и спорных ситуаций. Платформа не является публичной биржей и не заменяет договор между сторонами сделки.',
  },
  {
    title: 'Регистрация и доступ',
    body: 'При регистрации необходимо указывать достоверные сведения. Запрошенный формат участия не предоставляет полномочий автоматически: доступ к организации, роли и разрешённым действиям определяется системой после предусмотренных проверок и согласований.',
  },
  {
    title: 'Учётная запись и безопасность',
    body: 'Пользователь обязан обеспечивать сохранность своих средств входа и не передавать их другим лицам. При подозрении на компрометацию необходимо использовать восстановление доступа или обратиться в поддержку. Платформа вправе ограничить доступ, если это необходимо для защиты учётной записи, организации или сделки.',
  },
  {
    title: 'Сделки, документы и решения сторон',
    body: 'Платформа фиксирует статусы, документы и события исполнения и помогает сторонам работать в едином процессе. Юридическая сила документов, обязательства сторон, банковские решения и требования государственных систем определяются применимым законодательством, договорами и правилами соответствующих организаций.',
  },
  {
    title: 'Внешние сервисы',
    body: 'Отдельные действия могут зависеть от банков, перевозчиков, лабораторий, государственных информационных систем и других внешних участников. Их доступность и решения находятся вне прямого контроля платформы и могут регулироваться отдельными условиями.',
  },
];

const MODULE_LINKS = [
  {
    title: 'Вход и подключение организации',
    note: 'Регистрация, вход и восстановление доступа доступны как единый пользовательский путь.',
    href: '/platform-v7/auth',
  },
  {
    title: 'Банковские операции',
    note: 'Банковские события и связанные с расчётами действия вынесены в отдельную рабочую поверхность.',
    href: '/platform-v7/bank',
  },
  {
    title: 'Состояние сервисов',
    note: 'Отдельная страница показывает доступность сервисов и подключений платформы.',
    href: '/platform-v7/status',
  },
  {
    title: 'Профиль организации',
    note: 'Сведения об организации, участниках и доступах собраны в связанных пользовательских разделах.',
    href: '/platform-v7/profile',
  },
  {
    title: 'Документы и правила',
    note: 'Политика конфиденциальности, безопасность и справочные материалы доступны отдельно.',
    href: '/platform-v7/docs',
  },
];

export default function TermsPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Условия использования</div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7 }}>
          Основные правила регистрации, доступа и работы с цифровой платформой «Прозрачная Цена».
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
            Правила использования применяются к связанным пользовательским и операционным разделам платформы.
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
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Принцип работы</div>
        <div style={{ fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.7 }}>
          Платформа помогает участникам видеть состояние сделки, следующий шаг, документы и события в одном месте. Она не должна подменять решения, которые по закону или договору принимает конкретная сторона, банк, государственный орган или иной уполномоченный участник.
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/privacy' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Политика конфиденциальности
        </Link>
        <Link href='/platform-v7/security' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border, #E4E6EA)', background: '#fff', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, fontWeight: 700 }}>
          Безопасность
        </Link>
      </div>
    </div>
  );
}
