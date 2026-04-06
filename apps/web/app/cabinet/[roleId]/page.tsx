import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/app-shell';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../../lib/route-roles';

type RoleInfo = {
  id: string; label: string; description: string; emoji: string;
  primaryLinks: { href: string; label: string }[];
  capabilities: string[];
};

const ROLE_MAP: Record<string, RoleInfo> = {
  FARMER: {
    id: 'FARMER', label: 'Фермер / Продавец', emoji: '🌾', description: 'Создаёт лоты, размещает зерно на торги, подписывает договоры, контролирует отгрузку.',
    primaryLinks: [{ href: '/lots', label: 'Мои лоты' }, { href: '/auctions', label: 'Торги' }, { href: '/deals', label: 'Сделки' }, { href: '/documents', label: 'Документы' }],
    capabilities: ['Создание и публикация лотов', 'Управление аукционами', 'Подпись договора', 'Контроль отгрузки', 'Запрос лабораторного анализа'],
  },
  BUYER: {
    id: 'BUYER', label: 'Покупатель', emoji: '🏢', description: 'Участвует в торгах, подаёт заявки, подписывает договоры, управляет платежами.',
    primaryLinks: [{ href: '/auctions', label: 'Торги' }, { href: '/market-center', label: 'Market Center' }, { href: '/deals', label: 'Сделки' }, { href: '/payments', label: 'Платежи' }],
    capabilities: ['Участие в аукционах', 'Подача заявок', 'Подпись договора', 'Управление предоплатой', 'Акцепт качества'],
  },
  LOGISTICIAN: {
    id: 'LOGISTICIAN', label: 'Логист', emoji: '🗺️', description: 'Планирует маршруты, контролирует рейсы, управляет водителями и транспортом.',
    primaryLinks: [{ href: '/logistics', label: 'Логистика' }, { href: '/dispatch', label: 'Dispatch' }, { href: '/railway', label: 'Маршруты' }],
    capabilities: ['Планирование маршрутов', 'Контроль GPS треков', 'Управление водителями', 'Контроль весовых', 'Инциденты в рейсе'],
  },
  DRIVER: {
    id: 'DRIVER', label: 'Водитель', emoji: '🚛', description: 'Выполняет рейсы, фиксирует чекпоинты, отчитывается о состоянии груза.',
    primaryLinks: [{ href: '/driver-mobile', label: 'Мобильный кабинет' }, { href: '/logistics', label: 'Логистика' }],
    capabilities: ['Подтверждение рейса', 'Фиксация чекпоинтов', 'GPS трекинг', 'Отчёт о прибытии', 'Мобильный офлайн режим'],
  },
  LAB: {
    id: 'LAB', label: 'Лаборатория', emoji: '🧪', description: 'Принимает пробы, проводит анализы, выдаёт протоколы качества.',
    primaryLinks: [{ href: '/lab', label: 'Лаборатория' }, { href: '/lab-mobile', label: 'Мобильный' }],
    capabilities: ['Регистрация проб', 'Проведение анализов', 'Выдача протоколов', 'Работа в поле (офлайн)', 'ФГИС интеграция'],
  },
  ELEVATOR: {
    id: 'ELEVATOR', label: 'Элеватор', emoji: '🏗️', description: 'Управляет приёмкой зерна, весовым контролем, складскими операциями.',
    primaryLinks: [{ href: '/receiving', label: 'Приёмка' }, { href: '/weighbridge', label: 'Весовые' }, { href: '/inventory', label: 'Склад' }],
    capabilities: ['Приёмка грузов', 'Весовой контроль', 'Управление слотами', 'Складская документация', 'GPS отгрузка'],
  },
  ACCOUNTING: {
    id: 'ACCOUNTING', label: 'Бухгалтерия', emoji: '💳', description: 'Контролирует платежи, одобряет hold/release, ведёт финансовый учёт.',
    primaryLinks: [{ href: '/payments', label: 'Платежи' }, { href: '/settlement', label: 'Расчёты' }, { href: '/export-1c', label: '1С экспорт' }],
    capabilities: ['Hold/release платежей', 'Финансовые отчёты', 'Экспорт в 1С', 'Банковские выписки', 'Расчёт комиссий'],
  },
  EXECUTIVE: {
    id: 'EXECUTIVE', label: 'Руководство', emoji: '📊', description: 'Контролирует ключевые показатели, принимает стратегические решения.',
    primaryLinks: [{ href: '/execution-studio', label: 'Execution Studio' }, { href: '/analytics', label: 'Аналитика' }, { href: '/forecasting', label: 'Прогнозы' }],
    capabilities: ['Панель KPI', 'Аналитика и прогнозы', 'Управление сценариями', 'Trust center', 'Антифрод контроль'],
  },
  SUPPORT_MANAGER: {
    id: 'SUPPORT_MANAGER', label: 'Менеджер поддержки', emoji: '🎧', description: 'Ведёт операционные кейсы, разрешает споры, помогает участникам.',
    primaryLinks: [{ href: '/operator-cockpit', label: 'Кокпит оператора' }, { href: '/disputes', label: 'Споры' }, { href: '/support', label: 'Поддержка' }],
    capabilities: ['Ведение кейсов', 'Разрешение споров', 'SLA контроль', 'Ручное вмешательство', 'Мониторинг интеграций'],
  },
  ADMIN: {
    id: 'ADMIN', label: 'Администратор', emoji: '⚙️', description: 'Полный доступ ко всем функциям платформы.',
    primaryLinks: [{ href: '/roles', label: 'Реестр ролей' }, { href: '/operator-cockpit', label: 'Кокпит' }, { href: '/anti-fraud', label: 'Антифрод' }],
    capabilities: ['Полный доступ', 'Управление ролями', 'Системные настройки', 'Аудит', 'Управление интеграциями'],
  },
};

export default function RoleCabinetPage({ params }: { params: { roleId: string } }) {
  const role = ROLE_MAP[params.roleId?.toUpperCase()];
  if (!role) notFound();

  return (
    <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]}
      title="Кабинет роли ограничен"
      subtitle="Кабинет доступен авторизованным пользователям.">
      <AppShell title={`${role.emoji} ${role.label}`} subtitle={role.description}>
        <div className="space-y-6">
          <Breadcrumbs items={[
            { href: '/', label: 'Главная' },
            { href: '/cabinet', label: 'Кабинет' },
            { label: role.label },
          ]} />

          <div className="soft-box">
            <div className="section-title" style={{ marginBottom: 8 }}>Описание роли</div>
            <div>{role.description}</div>
          </div>

          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>Основные модули</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {role.primaryLinks.map((l) => (
                <Link key={l.href} href={l.href} className="soft-box" style={{ flex: '1 1 140px', fontWeight: 700, textDecoration: 'none' }}>
                  {l.label} →
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>Возможности</div>
            <div className="section-stack">
              {role.capabilities.map((c, i) => (
                <div key={i} className="soft-box" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--color-green, #22c55e)', fontWeight: 700 }}>✓</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/cabinet" className="mini-chip">← Все роли</Link>
            <Link href="/roles" className="mini-chip">Role matrix</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
