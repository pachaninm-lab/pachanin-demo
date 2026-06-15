import Link from 'next/link';
import {
  Bell,
  Box,
  ClipboardList,
  Eye,
  FlaskConical,
  Headphones,
  Landmark,
  Leaf,
  LockKeyhole,
  Map,
  Scale,
  ShieldCheck,
  ShoppingCart,
  SteeringWheel,
  Truck,
  UserRound,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

type Card = { title: string; text: string; href: string; Icon: LucideIcon };
type Action = { label: string; href: string; Icon: LucideIcon };

const actions: Action[] = [
  { label: 'Выставить партию', href: '/platform-v7/lots/create', Icon: Leaf },
  { label: 'Запрос на закупку', href: '/platform-v7/procurement', Icon: ShoppingCart },
  { label: 'Открытый просмотр', href: '/platform-v7/role-preview', Icon: Eye },
  { label: 'Карта исполнения', href: '/platform-v7/execution-map', Icon: Map },
  { label: 'Мои сделки', href: '/platform-v7/deals', Icon: ClipboardList },
  { label: 'Уведомления', href: '/platform-v7/notifications', Icon: Bell },
];

const roles: Card[] = [
  { title: 'Продавец', text: 'Размещайте зерно и управляйте сделками', href: '/platform-v7/seller', Icon: Leaf },
  { title: 'Покупатель', text: 'Находите зерно и заключайте сделки', href: '/platform-v7/buyer', Icon: ShoppingCart },
  { title: 'Логистика', text: 'Организуйте перевозки и маршруты', href: '/platform-v7/logistics', Icon: Truck },
  { title: 'Водитель', text: 'Выполняйте рейсы и загрузки', href: '/platform-v7/driver/field', Icon: SteeringWheel },
  { title: 'Банк', text: 'Финансируйте сделки без рисков', href: '/platform-v7/bank', Icon: Landmark },
  { title: 'Сюрвейер', text: 'Проводите осмотры и экспертизы', href: '/platform-v7/surveyor', Icon: ShieldCheck },
  { title: 'Оператор', text: 'Сопровождайте сделки и участников', href: '/platform-v7/support/operator', Icon: Headphones },
  { title: 'Руководитель', text: 'Контролируйте процессы и аналитику', href: '/platform-v7/executive', Icon: UserRound },
  { title: 'Элеватор', text: 'Управляйте приёмкой и хранением', href: '/platform-v7/elevator', Icon: Warehouse },
  { title: 'Лаборатория', text: 'Проводите анализ качества и сертификацию', href: '/platform-v7/lab', Icon: FlaskConical },
  { title: 'Комплаенс', text: 'Контролируйте соответствие и документы', href: '/platform-v7/compliance', Icon: LockKeyhole },
  { title: 'Арбитр', text: 'Решайте споры и защищайте интересы', href: '/platform-v7/arbitrator', Icon: Scale },
];

export default function PlatformV7RootPage() {
  return (
    <main data-testid='platform-v7-root-execution-cockpit' className='pc-v7-entry-page pc-v7-entry-exact'>
      <div aria-hidden className='entry-soft' />
      <div aria-hidden className='entry-bg-field' />
      <section className='entry-hero'>
        <h1 className='entry-title'><span>Одна сделка.</span><span>Полный контроль.</span></h1>
        <p className='entry-lead'>Качество, логистика, документы и деньги — в одном прозрачном процессе.</p>
        <Link href='/platform-v7/seller/batches/new' className='entry-primary-action'><span>Создать сделку</span><b aria-hidden>→</b></Link>
        <div className='entry-auth-buttons'>
          <Link href='/platform-v7/login'>Войти</Link>
          <Link href='/platform-v7/register'>Зарегистрироваться</Link>
        </div>
        <div className='entry-function-grid' aria-label='Функции платформы'>{actions.map((item) => <ActionTile key={item.href} item={item} />)}</div>
      </section>
      <section className='entry-roles' aria-label='Личные кабинеты'>
        <h2>Выберите свою роль</h2>
        <div className='entry-role-grid-exact'>{roles.map((role) => <RoleTile key={role.href} role={role} />)}</div>
      </section>
      <section className='entry-trust'>
        <span className='entry-trust-shield'><ShieldCheck size={28} /></span>
        <span className='entry-trust-copy'><strong>Прозрачность на каждом этапе</strong><small>Все участники видят актуальные данные и статус сделки в одном контуре.</small></span>
        <span className='entry-trust-chart' aria-hidden><i /><i /><i /></span>
      </section>
    </main>
  );
}

function ActionTile({ item }: { item: Action }) {
  const Icon = item.Icon;
  return <Link href={item.href} className='entry-function-link'><Icon size={29} strokeWidth={2.3} /><strong>{item.label}</strong></Link>;
}

function RoleTile({ role }: { role: Card }) {
  const Icon = role.Icon;
  return <Link href={role.href} className='entry-role-tile-exact'><Icon size={35} strokeWidth={2.35} /><strong>{role.title}</strong><span>{role.text}</span></Link>;
}
