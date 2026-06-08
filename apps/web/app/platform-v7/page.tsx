import Link from 'next/link';

const CHAIN_STEPS = [
  { step: 'Условия',    detail: 'лот · RFQ · сделка' },
  { step: 'Документы',  detail: 'СДИЗ · ЭТрН · акты' },
  { step: 'Логистика',  detail: 'рейс · маршрут · пломба' },
  { step: 'Приёмка',    detail: 'вес · акт · подпись' },
  { step: 'Качество',   detail: 'проба · протокол · ГОСТ' },
  { step: 'Банк',       detail: 'резерв · основание · выпуск' },
  { step: 'Закрытие',   detail: 'расчёт · акт · архив' },
] as const;

const ROLES = [
  {
    title: 'Продавец',
    description: 'Выставляет лот, передаёт документы и получает деньги после подтверждения.',
    href: '/platform-v7/seller',
    access: 'Вход без оплаты',
  },
  {
    title: 'Покупатель',
    description: 'Формирует RFQ, резервирует деньги, принимает товар и закрывает документы.',
    href: '/platform-v7/buyer',
    access: 'Тариф после проверки',
  },
  {
    title: 'Логистика',
    description: 'Управляет рейсами, водителями и транспортными документами.',
    href: '/platform-v7/logistics',
    access: 'По заявке',
  },
  {
    title: 'Водитель',
    description: 'Один текущий рейс и одно следующее действие. Фото, пломба, маршрут.',
    href: '/platform-v7/driver/field',
    access: 'По коду рейса',
  },
  {
    title: 'Элеватор',
    description: 'Принимает товар, фиксирует вес, формирует акт приёмки.',
    href: '/platform-v7/elevator',
    access: 'Партнёрское подключение',
  },
  {
    title: 'Лаборатория',
    description: 'Ведёт пробы, заносит протоколы качества, фиксирует отклонения.',
    href: '/platform-v7/lab',
    access: 'Партнёрское подключение',
  },
  {
    title: 'Банк',
    description: 'Контролирует резерв, проверяет основание для выпуска, работает с журналом.',
    href: '/platform-v7/bank',
    access: 'Партнёрский доступ',
  },
  {
    title: 'Оператор',
    description: 'Центр управления: очередь блокеров, контроль сделок, ручные проверки.',
    href: '/platform-v7/control-tower',
    access: 'Внутренний доступ',
  },
] as const;

export default function PlatformEntryPage() {
  return (
    <main style={styles.page}>
      <HeroSection />
      <ChainSection />
      <RolesSection />
      <AccessSection />
      <IntegrationNote />
    </main>
  );
}

function HeroSection() {
  return (
    <section style={styles.hero}>
      <div style={styles.heroContent}>
        <div style={styles.eyebrow}>Прозрачная Цена · Платформа исполнения</div>
        <h1 style={styles.h1}>
          Цифровой контур исполнения зерновой сделки
        </h1>
        <p style={styles.lead}>
          Условия, документы, логистика, приёмка, качество, деньги, спор и доказательства&nbsp;—
          в одном управляемом процессе.
        </p>
        <div style={styles.ctaRow}>
          <Link href='/platform-v7/lot/create' style={styles.ctaPrimary}>
            Выставить партию
          </Link>
          <Link href='/platform-v7/market-rfq' style={styles.ctaSecondary}>
            Создать запрос на закупку
          </Link>
          <Link href='/platform-v7/roles' style={styles.ctaGhost}>
            Открытый просмотр
          </Link>
          <Link href='/platform-v7/login' style={styles.ctaGhost}>
            Войти
          </Link>
        </div>
      </div>
    </section>
  );
}

function ChainSection() {
  return (
    <section style={styles.chainSection} aria-label='Контур исполнения сделки'>
      <div style={styles.sectionHead}>
        <div style={styles.sectionLabel}>Контур исполнения</div>
        <h2 style={styles.h2}>Каждый шаг контролируется. Деньги не идут без оснований.</h2>
      </div>
      <div style={styles.chainRail}>
        {CHAIN_STEPS.map((item, i) => (
          <div key={item.step} style={styles.chainItem}>
            <div style={styles.chainNum}>{i + 1}</div>
            <div style={styles.chainStep}>{item.step}</div>
            <div style={styles.chainDetail}>{item.detail}</div>
          </div>
        ))}
      </div>
      <div style={styles.chainNote}>
        Каждый переход охраняется условиями: документы, вес, качество, подписи.
        Деньги не меняют состояние без банковского события.
      </div>
    </section>
  );
}

function RolesSection() {
  return (
    <section style={styles.rolesSection} aria-label='Роли платформы'>
      <div style={styles.sectionHead}>
        <div style={styles.sectionLabel}>Роли и доступ</div>
        <h2 style={styles.h2}>Открытый просмотр доступен без регистрации</h2>
        <p style={styles.sectionSub}>
          Рабочий доступ к операционным и партнёрским ролям выдаётся после подключения
          организации или приглашения. Просмотр роли — без ограничений.
        </p>
      </div>
      <div style={styles.roleGrid}>
        {ROLES.map((role) => (
          <RoleCard key={role.title} role={role} />
        ))}
      </div>
    </section>
  );
}

function RoleCard({ role }: { role: typeof ROLES[number] }) {
  return (
    <Link href={role.href} style={styles.roleCard}>
      <div style={styles.roleTitle}>{role.title}</div>
      <div style={styles.roleDesc}>{role.description}</div>
      <div style={styles.roleAccess}>{role.access}</div>
    </Link>
  );
}

function AccessSection() {
  return (
    <section style={styles.accessSection} aria-label='Как получить доступ'>
      <div style={styles.sectionHead}>
        <div style={styles.sectionLabel}>Вход в платформу</div>
        <h2 style={styles.h2}>Незаконченная регистрация не блокирует просмотр</h2>
      </div>
      <div style={styles.accessGrid}>
        <AccessBlock
          title='Продавец'
          note='Вход и создание черновика партии доступны без оплаты.'
          action='Начать без оплаты'
          href='/platform-v7/register'
        />
        <AccessBlock
          title='Покупатель и трейдер'
          note='Тариф определяется после проверки организации и сценария закупки.'
          action='Подать заявку'
          href='/platform-v7/register'
        />
        <AccessBlock
          title='Партнёрские роли'
          note='Элеватор, лаборатория, банк, перевозчик — подключение по договору и доступам.'
          action='Узнать об условиях'
          href='/platform-v7/register'
        />
      </div>
    </section>
  );
}

function AccessBlock({ title, note, action, href }: { title: string; note: string; action: string; href: string }) {
  return (
    <div style={styles.accessBlock}>
      <div style={styles.accessTitle}>{title}</div>
      <p style={styles.accessNote}>{note}</p>
      <Link href={href} style={styles.accessLink}>{action} →</Link>
    </div>
  );
}

function IntegrationNote() {
  return (
    <footer style={styles.integrationNote}>
      Внешние контуры подключаются по договору и доступам. Текущий контур готов к подключению
      внешних систем: банк, ФГИС «Зерно», ЭДО, ЭТрН, GPS-трекинг, лаборатория.
    </footer>
  );
}

const styles = {
  page: {
    display: 'grid',
    gap: 16,
    paddingBottom: 32,
  } as const,

  hero: {
    background: 'var(--p7-color-background-elevated, #fff)',
    border: '1px solid var(--p7-color-border, #D7DEE3)',
    borderRadius: 24,
    padding: '28px 24px',
    boxShadow: 'var(--pc-shadow-sm)',
  } as const,

  heroContent: {
    display: 'grid',
    gap: 16,
    maxWidth: 720,
  } as const,

  eyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase' as const,
    letterSpacing: '.08em',
    color: 'var(--p7-color-brand, #0A7A5F)',
  } as const,

  h1: {
    margin: 0,
    fontSize: 'clamp(28px, 6vw, 48px)',
    lineHeight: 1.05,
    letterSpacing: '-.04em',
    fontWeight: 950,
    color: 'var(--p7-color-text-primary, #0F1419)',
  } as const,

  lead: {
    margin: 0,
    fontSize: 16,
    lineHeight: 1.6,
    color: 'var(--p7-color-text-secondary, #475569)',
    maxWidth: 640,
  } as const,

  ctaRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  } as const,

  ctaPrimary: {
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 48,
    padding: '0 20px',
    borderRadius: 14,
    background: 'var(--p7-color-brand, #0A7A5F)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 900,
    boxShadow: '0 8px 20px rgba(10,122,95,.22)',
    whiteSpace: 'nowrap' as const,
  } as const,

  ctaSecondary: {
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 48,
    padding: '0 18px',
    borderRadius: 14,
    background: 'var(--p7-color-surface-muted, #F2F6F0)',
    border: '1px solid var(--p7-color-border, #D7DEE3)',
    color: 'var(--p7-color-text-primary, #0F1419)',
    fontSize: 14,
    fontWeight: 850,
    whiteSpace: 'nowrap' as const,
  } as const,

  ctaGhost: {
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 44,
    padding: '0 14px',
    borderRadius: 12,
    border: '1px solid var(--p7-color-border, #D7DEE3)',
    color: 'var(--p7-color-text-secondary, #475569)',
    fontSize: 13,
    fontWeight: 850,
    whiteSpace: 'nowrap' as const,
  } as const,

  chainSection: {
    background: 'var(--p7-color-background-elevated, #fff)',
    border: '1px solid var(--p7-color-border, #D7DEE3)',
    borderRadius: 20,
    padding: '24px 20px',
    display: 'grid',
    gap: 20,
  } as const,

  sectionHead: {
    display: 'grid',
    gap: 8,
  } as const,

  sectionLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase' as const,
    letterSpacing: '.08em',
    color: 'var(--p7-color-brand, #0A7A5F)',
  } as const,

  h2: {
    margin: 0,
    fontSize: 'clamp(18px, 3vw, 24px)',
    lineHeight: 1.2,
    fontWeight: 900,
    letterSpacing: '-.025em',
    color: 'var(--p7-color-text-primary, #0F1419)',
  } as const,

  sectionSub: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--p7-color-text-secondary, #475569)',
  } as const,

  chainRail: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: 6,
  } as const,

  chainItem: {
    display: 'grid',
    gap: 5,
    padding: '12px 10px',
    borderRadius: 14,
    background: 'var(--p7-color-surface-muted, #F2F6F0)',
    border: '1px solid var(--p7-color-border, #D7DEE3)',
  } as const,

  chainNum: {
    fontSize: 10,
    fontWeight: 950,
    color: 'var(--p7-color-brand, #0A7A5F)',
    letterSpacing: '.06em',
  } as const,

  chainStep: {
    fontSize: 13,
    fontWeight: 900,
    color: 'var(--p7-color-text-primary, #0F1419)',
    lineHeight: 1.2,
  } as const,

  chainDetail: {
    fontSize: 11,
    color: 'var(--p7-color-text-muted, #667085)',
    lineHeight: 1.4,
  } as const,

  chainNote: {
    fontSize: 13,
    lineHeight: 1.6,
    color: 'var(--p7-color-text-secondary, #475569)',
    padding: '12px 14px',
    borderRadius: 12,
    background: 'var(--p7-color-brand-soft, #E5F4EF)',
    border: '1px solid rgba(10,122,95,.14)',
  } as const,

  rolesSection: {
    display: 'grid',
    gap: 20,
  } as const,

  roleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 10,
  } as const,

  roleCard: {
    textDecoration: 'none',
    display: 'grid',
    gap: 8,
    padding: '16px 14px',
    borderRadius: 16,
    background: 'var(--p7-color-background-elevated, #fff)',
    border: '1px solid var(--p7-color-border, #D7DEE3)',
    boxShadow: 'var(--pc-shadow-sm)',
    transition: 'box-shadow .15s, border-color .15s',
  } as const,

  roleTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: 'var(--p7-color-text-primary, #0F1419)',
    lineHeight: 1.2,
  } as const,

  roleDesc: {
    fontSize: 13,
    lineHeight: 1.55,
    color: 'var(--p7-color-text-secondary, #475569)',
  } as const,

  roleAccess: {
    fontSize: 11,
    fontWeight: 850,
    color: 'var(--p7-color-brand, #0A7A5F)',
    padding: '4px 8px',
    borderRadius: 8,
    background: 'var(--p7-color-brand-soft, #E5F4EF)',
    width: 'fit-content',
  } as const,

  accessSection: {
    display: 'grid',
    gap: 20,
  } as const,

  accessGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 10,
  } as const,

  accessBlock: {
    padding: '18px 16px',
    borderRadius: 16,
    background: 'var(--p7-color-background-elevated, #fff)',
    border: '1px solid var(--p7-color-border, #D7DEE3)',
    display: 'grid',
    gap: 10,
    alignContent: 'start',
  } as const,

  accessTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: 'var(--p7-color-text-primary, #0F1419)',
  } as const,

  accessNote: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: 'var(--p7-color-text-secondary, #475569)',
  } as const,

  accessLink: {
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 900,
    color: 'var(--p7-color-brand, #0A7A5F)',
  } as const,

  integrationNote: {
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--p7-color-text-muted, #667085)',
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid var(--p7-color-border, #D7DEE3)',
    background: 'var(--p7-color-surface-muted, #F2F6F0)',
  } as const,
} satisfies Record<string, React.CSSProperties>;
