import Link from 'next/link';
import {
  Box,
  ClipboardList,
  Eye,
  FileCheck,
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

type RoleCard = {
  readonly title: string;
  readonly text: string;
  readonly href: string;
  readonly Icon: LucideIcon;
};

type FunctionLink = {
  readonly label: string;
  readonly href: string;
  readonly Icon: LucideIcon;
};

const primaryRoles: readonly RoleCard[] = [
  { title: 'Продавец', text: 'Размещайте зерно и управляйте сделками', href: '/platform-v7/seller', Icon: Leaf },
  { title: 'Покупатель', text: 'Находите зерно и заключайте сделки', href: '/platform-v7/buyer', Icon: ShoppingCart },
  { title: 'Логистика', text: 'Организуйте перевозки и маршруты', href: '/platform-v7/logistics', Icon: Truck },
  { title: 'Водитель', text: 'Выполняйте рейсы и загрузки', href: '/platform-v7/driver/field', Icon: SteeringWheel },
  { title: 'Банк', text: 'Финансируйте сделки без лишних рисков', href: '/platform-v7/bank', Icon: Landmark },
  { title: 'Сюрвейер', text: 'Проводите осмотры и экспертизы', href: '/platform-v7/surveyor', Icon: ShieldCheck },
  { title: 'Оператор', text: 'Сопровождайте сделки и участников', href: '/platform-v7/support/operator', Icon: Headphones },
  { title: 'Руководитель', text: 'Контролируйте процессы и аналитику', href: '/platform-v7/executive', Icon: UserRound },
];

const extraRoles: readonly RoleCard[] = [
  { title: 'Элеватор', text: 'Приёмка, вес и отгрузка', href: '/platform-v7/elevator', Icon: Warehouse },
  { title: 'Лаборатория', text: 'Анализы и качество', href: '/platform-v7/lab', Icon: FlaskConical },
  { title: 'Комплаенс', text: 'Допуск, риски и правила', href: '/platform-v7/compliance', Icon: LockKeyhole },
  { title: 'Арбитр', text: 'Споры и доказательства', href: '/platform-v7/arbitrator', Icon: Scale },
];

const functions: readonly FunctionLink[] = [
  { label: 'Регистрация', href: '/platform-v7/register', Icon: UserRound },
  { label: 'Войти', href: '/platform-v7/login', Icon: LockKeyhole },
  { label: 'Выставить партию', href: '/platform-v7/lots/create', Icon: Box },
  { label: 'Запрос на закупку', href: '/platform-v7/procurement', Icon: ClipboardList },
  { label: 'Открытый просмотр', href: '/platform-v7/role-preview', Icon: Eye },
  { label: 'Карта исполнения', href: '/platform-v7/execution-map', Icon: Map },
];

export default function PlatformV7RootPage() {
  return (
    <main data-testid='platform-v7-root-execution-cockpit' className='pc-v7-entry-page pc-v7-entry-exact'>
      <style>{entryCss}</style>

      <div aria-hidden='true' className='entry-mobile-bg field' />
      <div aria-hidden='true' className='entry-mobile-bg elevator' />
      <div aria-hidden='true' className='entry-mobile-bg route' />
      <div aria-hidden='true' className='entry-soft' />

      <section className='entry-hero' aria-label='Главный экран'>
        <h1 className='entry-title'><span>Одна сделка.</span><span>Полный контроль.</span></h1>
        <p className='entry-lead'>Качество, логистика, документы и деньги — в одном прозрачном процессе.</p>
        <Link href='/platform-v7/seller/batches/new' className='entry-primary-action'>
          <span>Создать сделку</span>
          <b aria-hidden='true'>→</b>
        </Link>
        <div className='entry-function-grid' aria-label='Функции платформы'>
          {functions.map((item) => <FunctionTile key={item.href} item={item} />)}
        </div>
      </section>

      <section className='entry-roles' aria-label='Выберите свою роль'>
        <h2>Выберите свою роль</h2>
        <div className='entry-role-grid-exact'>
          {primaryRoles.map((role) => <RoleTile key={role.href} role={role} />)}
        </div>
        <details className='entry-more-roles-exact'>
          <summary>Ещё роли</summary>
          <div>{extraRoles.map((role) => <RoleRow key={role.href} role={role} />)}</div>
        </details>
      </section>

      <section className='entry-trust' aria-label='Прозрачность'>
        <span className='entry-trust-shield'><ShieldCheck size={28} /></span>
        <span className='entry-trust-copy'><strong>Прозрачность на каждом этапе</strong><small>Все участники видят актуальные данные и статус сделки в одном контуре.</small></span>
        <span className='entry-trust-chart' aria-hidden='true'><i /><i /><i /></span>
      </section>
    </main>
  );
}

function RoleTile({ role }: { readonly role: RoleCard }) {
  const Icon = role.Icon;
  return (
    <Link href={role.href} className='entry-role-tile-exact'>
      <Icon size={31} strokeWidth={2.4} />
      <strong>{role.title}</strong>
      <span>{role.text}</span>
    </Link>
  );
}

function RoleRow({ role }: { readonly role: RoleCard }) {
  const Icon = role.Icon;
  return (
    <Link href={role.href} className='entry-role-row-exact'>
      <Icon size={28} strokeWidth={2.3} />
      <strong>{role.title}</strong>
      <span>{role.text}</span>
    </Link>
  );
}

function FunctionTile({ item }: { readonly item: FunctionLink }) {
  const Icon = item.Icon;
  return (
    <Link href={item.href} className='entry-function-link'>
      <Icon size={21} strokeWidth={2.3} />
      <strong>{item.label}</strong>
    </Link>
  );
}

const entryCss = `
.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-top>button.pc-v4-iconbtn:first-child,.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-drawer{display:none!important}.pc-shell-root-v4:has(.pc-v7-entry-exact) .pc-v4-top{grid-template-columns:minmax(0,1fr) auto!important}.pc-v7-entry-exact{--green:#008B2E;--deep:#061A16;position:relative;min-height:calc(100dvh - var(--pc-header-offset,98px));overflow:hidden;padding:0 18px 44px;display:flex;flex-direction:column;align-items:center;background:#fff;color:var(--deep);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',Inter,system-ui,sans-serif}.entry-mobile-bg{position:absolute;pointer-events:none;opacity:.035;filter:blur(.7px);z-index:0}.entry-mobile-bg.field{left:-60px;right:-60px;bottom:70px;height:220px;transform:rotate(-5deg);background:repeating-linear-gradient(105deg,rgba(0,139,46,.78) 0 18px,rgba(198,147,32,.55) 18px 36px)}.entry-mobile-bg.elevator{right:12px;top:88px;width:126px;height:178px;background:rgba(15,23,42,.25);clip-path:polygon(18% 100%,18% 30%,30% 30%,30% 12%,70% 12%,70% 30%,82% 30%,82% 100%)}.entry-mobile-bg.route{left:34px;right:24px;top:250px;height:124px;border-top:9px solid rgba(0,139,46,.45);border-right:9px solid rgba(0,139,46,.28);border-radius:0 72px 0 0;transform:rotate(-9deg)}.entry-soft{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.99),rgba(255,255,255,.965) 52%,rgba(250,253,250,.99));pointer-events:none}.entry-hero,.entry-roles,.entry-trust{position:relative;z-index:1;width:min(100%,430px);margin-left:auto;margin-right:auto}.entry-hero{display:grid;gap:16px;padding-top:12px}.entry-title{margin:0;display:grid;gap:2px;max-width:370px;font-size:clamp(38px,10vw,46px);line-height:.94;letter-spacing:-.07em;font-weight:950;color:#061A16}.entry-title span:last-child{color:var(--green);white-space:nowrap}.entry-lead{margin:0;max-width:360px;color:#5F6874;font-size:clamp(16.5px,4.35vw,18px);line-height:1.48;font-weight:560;letter-spacing:-.022em}.entry-primary-action{min-height:62px;width:100%;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:14px;padding:0 26px;color:#fff;text-decoration:none;background:linear-gradient(180deg,#00A83B,#008B2E);box-shadow:0 16px 34px rgba(0,139,46,.22);font-size:18px;font-weight:900}.entry-primary-action b{margin-left:auto;font-size:31px;line-height:1;font-weight:760}.entry-function-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.entry-function-link{min-width:0;min-height:58px;border-radius:15px;border:1px solid rgba(15,23,42,.075);background:rgba(255,255,255,.92);box-shadow:0 8px 20px rgba(15,23,42,.045);color:#061A16;text-decoration:none;display:grid;justify-items:center;align-content:center;gap:5px;text-align:center}.entry-function-link svg{color:var(--green)}.entry-function-link strong{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.8px;line-height:1.1;font-weight:820;letter-spacing:-.02em}.entry-roles{margin-top:18px;display:grid;gap:12px}.entry-roles h2{margin:0;font-size:19px;line-height:1.16;font-weight:920;letter-spacing:-.038em;color:#061A16}.entry-role-grid-exact{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;width:100%;min-width:0}.entry-role-tile-exact{min-width:0;width:100%;min-height:118px;padding:13px 5px 10px;border-radius:15px;border:1px solid rgba(15,23,42,.065);background:rgba(255,255,255,.94);box-shadow:0 10px 22px rgba(15,23,42,.055);color:#061A16;text-decoration:none;display:grid!important;grid-template-columns:1fr!important;justify-items:center;align-content:start;gap:7px;text-align:center}.entry-role-tile-exact svg{color:var(--green)}.entry-role-tile-exact strong{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#061A16;font-size:12.1px;line-height:1.05;font-weight:920;letter-spacing:-.035em}.entry-role-tile-exact span{color:#66717C;font-size:10.1px;line-height:1.22;font-weight:560}.entry-more-roles-exact{display:block;margin-top:0}.entry-more-roles-exact summary{cursor:pointer;min-height:36px;display:flex;align-items:center;color:#0F2A23;font-size:13px;font-weight:900;list-style:none}.entry-more-roles-exact summary::-webkit-details-marker{display:none}.entry-more-roles-exact>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding-bottom:4px}.entry-role-row-exact{min-height:72px;padding:10px;border-radius:14px;background:#fff;border:1px solid rgba(15,23,42,.07);text-decoration:none;color:#061A16;display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:8px}.entry-role-row-exact svg{grid-row:1/span 2;color:#008B2E}.entry-role-row-exact strong{font-size:12.8px;line-height:1.1;font-weight:900}.entry-role-row-exact span{font-size:10.6px;line-height:1.2;color:#66717C}.entry-trust{margin-top:16px;min-height:90px;display:grid;grid-template-columns:auto minmax(0,1fr) 58px;align-items:center;gap:13px;padding:13px;border-radius:18px;background:linear-gradient(180deg,rgba(241,252,244,.9),rgba(255,255,255,.94));border:1px solid rgba(0,139,46,.11);box-shadow:0 10px 24px rgba(15,23,42,.052)}.entry-trust-shield{width:48px;height:48px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(180deg,#19B84D,#008B2E);box-shadow:0 9px 20px rgba(0,139,46,.22)}.entry-trust-copy{display:grid;gap:3px}.entry-trust-copy strong{font-size:14.6px;line-height:1.12;font-weight:920}.entry-trust-copy small{color:#5F6874;font-size:12px;line-height:1.34;font-weight:560}.entry-trust-chart{width:58px;height:34px;display:flex;align-items:end;gap:5px;opacity:.65}.entry-trust-chart i{display:block;width:12px;border-radius:5px 5px 3px 3px;background:var(--green)}.entry-trust-chart i:nth-child(1){height:13px;opacity:.35}.entry-trust-chart i:nth-child(2){height:22px;opacity:.55}.entry-trust-chart i:nth-child(3){height:31px}
@media(max-width:389px){.pc-v7-entry-exact{padding-left:14px;padding-right:14px}.entry-title{font-size:38px}.entry-function-grid{gap:7px}.entry-function-link strong{font-size:10.2px}.entry-role-grid-exact{gap:8px!important}.entry-role-tile-exact{min-height:112px!important;padding-left:4px!important;padding-right:4px!important}.entry-role-tile-exact strong{font-size:11.4px!important}.entry-role-tile-exact span{font-size:9.55px!important}.entry-trust-chart{display:none}}
@media(min-width:641px){.entry-mobile-bg,.entry-soft{display:none}.pc-v7-entry-exact{display:block;min-height:calc(100dvh - var(--pc-header-offset,98px));padding:24px 42px 42px;background:linear-gradient(180deg,#FFFCF6,#fff 56%,#FEFCF7)}.entry-hero{width:auto;max-width:1200px;margin:0 auto}.entry-title{font-size:72px;max-width:760px}.entry-lead{font-size:21px;max-width:620px}.entry-function-grid{grid-template-columns:repeat(6,minmax(0,1fr));max-width:760px}.entry-roles{width:auto;max-width:1200px;margin:28px auto 0}.entry-role-grid-exact{grid-template-columns:repeat(8,minmax(0,1fr))!important}.entry-more-roles-exact>div{grid-template-columns:repeat(4,minmax(0,1fr))}.entry-trust{width:auto;max-width:1200px;margin:24px auto 0}}
`;
