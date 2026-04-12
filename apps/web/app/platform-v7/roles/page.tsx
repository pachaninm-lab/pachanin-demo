'use client';
import Link from 'next/link';
import type { CSSProperties } from 'react';

const roles = [
  {
    href: '/platform-v7/seller',
    badge: 'SELLER',
    badgeClass: 't7-chip-seller',
    accentColor: 'var(--seller)',
    name: 'Производитель',
    purpose: 'Ожидаемые деньги, лоты и блокеры с первого экрана',
    focus: [
      'Ожидаемые выплаты и что их задерживает',
      'Активные лоты и состояние офферов',
      'Документы, блокирующие release денег',
    ],
    metrics: [
      { v: '18,4 млн', l: 'Ожидается' },
      { v: '3', l: 'Лота открыто' },
      { v: '1', l: 'Блокер' },
    ],
    statusText: 'Нужна подпись',
    statusClass: 't7-chip-warn',
  },
  {
    href: '/platform-v7/buyer',
    badge: 'BUYER',
    badgeClass: 't7-chip-buyer',
    accentColor: 'var(--buyer)',
    name: 'Покупатель',
    purpose: 'Shortlist, ценовая аналитика и контроль качества сделки',
    focus: [
      'Shortlist лотов и ценовая позиция',
      'Соответствие качества и базиса',
      'Статус оплаты и банковское подтверждение',
    ],
    metrics: [
      { v: '12', l: 'В shortlist' },
      { v: '15 200 ₽', l: 'Средняя цена' },
      { v: '24 млн', l: 'Бюджет' },
    ],
    statusText: 'Всё в норме',
    statusClass: 't7-chip-success',
  },
  {
    href: '/platform-v7/driver',
    badge: 'DRIVER',
    badgeClass: 't7-chip-driver',
    accentColor: 'var(--driver)',
    name: 'Водитель',
    purpose: 'Один рейс — один шаг — одно подтверждение',
    focus: [
      'Текущий рейс и маршрут',
      'Подтверждение прибытия и разгрузки',
      'Офлайн-очередь событий',
    ],
    metrics: [
      { v: 'ДОС-2847', l: 'Рейс' },
      { v: '14:30', l: 'ETA' },
      { v: '2', l: 'Offline' },
    ],
    statusText: 'Подтвердить прибытие',
    statusClass: 't7-chip-warn',
  },
  {
    href: '/platform-v7/bank',
    badge: 'BANK',
    badgeClass: 't7-chip-bank',
    accentColor: 'var(--bank)',
    name: 'Банк',
    purpose: 'Reserve, hold, release и callbacks без лишнего шума',
    focus: [
      'Статус резерва и условия удержания',
      'Корректность callback-уведомлений',
      'Основания и готовность для release',
    ],
    metrics: [
      { v: '3,87 млн', l: 'Резерв' },
      { v: '1', l: 'Mismatch' },
      { v: '92%', l: 'Callbacks OK' },
    ],
    statusText: 'Есть mismatch',
    statusClass: 't7-chip-danger',
  },
  {
    href: '/platform-v7/documents',
    badge: 'DOCS',
    badgeClass: 't7-chip-docs',
    accentColor: 'var(--docs)',
    name: 'Документы',
    purpose: 'Комплектность пакета — прямой gate для выпуска денег',
    focus: [
      'Критически необходимые документы сейчас',
      'Документы, блокирующие движение денег',
      'Что скоро потребуется и что в архиве',
    ],
    metrics: [
      { v: '92%', l: 'Полнота' },
      { v: '2', l: 'Ждут загрузки' },
      { v: '1', l: 'Блокирует' },
    ],
    statusText: '1 блокирует release',
    statusClass: 't7-chip-warn',
  },
  {
    href: '/platform-v7/control',
    badge: 'CONTROL',
    badgeClass: 't7-chip-control',
    accentColor: 'var(--control)',
    name: 'Контроль',
    purpose: 'War-room: деньги под риском, доказательства и SLA',
    focus: [
      'Открытые споры и суммы под hold',
      'Evidence pack и авторство событий',
      'SLA, ответственные и следующий шаг',
    ],
    metrics: [
      { v: '1', l: 'Кейс' },
      { v: '624 тыс', l: 'Под hold' },
      { v: '6 дн', l: 'SLA' },
    ],
    statusText: 'Активный спор',
    statusClass: 't7-chip-danger',
  },
] as const;

const quickLinks = [
  { href: '/platform-v7/seller', label: 'Продавец', cls: 't7-chip-seller' },
  { href: '/platform-v7/buyer', label: 'Покупатель', cls: 't7-chip-buyer' },
  { href: '/platform-v7/driver', label: 'Водитель', cls: 't7-chip-driver' },
  { href: '/platform-v7/bank', label: 'Банк', cls: 't7-chip-bank' },
  { href: '/platform-v7/documents', label: 'Документы', cls: 't7-chip-docs' },
  { href: '/platform-v7/control', label: 'Контроль', cls: 't7-chip-control' },
] as const;

export default function RolesPage() {
  return (
    <div className='t7-frame'>
      <div className='t7-stack'>

        {/* HERO */}
        <section className='t7-hero'>
          <div className='t7-eyebrow'>Рабочие места</div>
          <h1 className='t7-h1'>Каждая роль — своя задача, свои данные, своё следующее действие</h1>
          <p className='t7-lead'>
            Не одинаковые меню. Производитель видит деньги и лоты. Банк — резерв и callbacks.
            Водитель — один экран с одним шагом. Контроль — war-room с доказательствами.
          </p>
          {/* Quick access */}
          <div className='roles-quick'>
            {quickLinks.map(({ href, label, cls }) => (
              <Link key={href} href={href} className={`t7-chip ${cls} roles-pill`}>
                {label}
              </Link>
            ))}
          </div>
        </section>

        {/* ROLE CARDS */}
        <div className='roles-grid'>
          {roles.map((role) => (
            <Link key={role.href} href={role.href} className='t7-role roles-card' style={{ '--accent': role.accentColor } as CSSProperties}>
              <div className='t7-rolehead'>
                <span className={`t7-chip ${role.badgeClass}`}>{role.badge}</span>
                <span className={`t7-chip ${role.statusClass}`}>{role.statusText}</span>
              </div>
              <div>
                <h2 className='t7-roletitle'>{role.name}</h2>
                <p className='t7-rolesummary' style={{ marginTop: 6 }}>{role.purpose}</p>
              </div>
              <ul className='t7-rolebullets'>
                {role.focus.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <div className='t7-rolemetrics'>
                {role.metrics.map(({ v, l }) => (
                  <div key={l} className='t7-rolemetric'>
                    <div className='t7-rolemetric-v'>{v}</div>
                    <div className='t7-rolemetric-l'>{l}</div>
                  </div>
                ))}
              </div>
              <div className='t7-cta'>
                Открыть рабочее место
                <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'
                  strokeWidth={2} stroke='currentColor' width={14} height={14} aria-hidden='true'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3' />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {/* BOTTOM HINT */}
        <section className='t7-panel roles-hint'>
          <div className='t7-eyebrow'>Все роли в одной сделке</div>
          <p className='t7-text' style={{ marginTop: 10, maxWidth: '72ch' }}>
            Производитель, покупатель, водитель, банк, документы и контроль работают параллельно
            в одном операционном контуре. Статус каждой роли виден остальным в реальном времени.
          </p>
          <div className='t7-actions'>
            <Link href='/platform-v7/deal' className='t7-btn primary'>Открыть cockpit сделки</Link>
            <Link href='/platform-v7' className='t7-btn ghost'>Вернуться на дашборд</Link>
          </div>
        </section>

      </div>

      <style jsx>{`
        .roles-quick {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 20px;
        }
        .roles-pill {
          min-height: 34px;
          padding: 0 14px;
          font-size: 13px;
          cursor: pointer;
          transition: transform .1s, box-shadow .1s;
        }
        .roles-pill:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(15,23,42,.1);
        }
        .roles-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        .roles-card {
          border-left: 3px solid var(--accent, var(--indigo));
          padding-left: 18px;
        }
        .roles-hint {
          background: linear-gradient(135deg, rgba(79,70,229,.03), rgba(14,165,233,.02));
        }
        @media (max-width: 1199px) {
          .roles-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 767px) {
          .roles-grid { grid-template-columns: 1fr; }
          .roles-quick { gap: 6px; }
        }
      `}</style>
    </div>
  );
}
