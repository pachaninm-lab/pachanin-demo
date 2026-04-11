'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SCREENS: Record<string, { eyebrow: string; title: string; body: string; actions: Array<{ href: string; label: string; primary?: boolean }>; tiles: Array<{ href: string; kpi: string; label: string; hint: string; tone: 'warning' | 'info' | 'success' | 'danger'; chip: string }> }> = {
  '/platform-v4': {
    eyebrow: 'Операционный штаб',
    title: 'Сделка — главный объект платформы',
    body: 'Первый экран должен вести в рабочие очереди, а не в декоративный дашборд. Деньги, документы, качество и спор встроены в движение сделки.',
    actions: [
      { href: '/platform-v4/deal', label: 'Открыть сделку', primary: true },
      { href: '/platform-v4/roles', label: 'Выбрать роль' },
      { href: '/platform-v4/bank', label: 'Открыть деньги' }
    ],
    tiles: [
      { href: '/platform-v4/deal', kpi: '2', label: 'Сделки требуют действия', hint: 'owner + blocker + next action', tone: 'warning', chip: 'нужно действие' },
      { href: '/platform-v4/buyer', kpi: '3', label: 'Лота готовы к shortlist', hint: 'buyer-side queue', tone: 'success', chip: 'готово' },
      { href: '/platform-v4/bank', kpi: '1', label: 'Mismatch в money rail', hint: 'reserve / hold / release', tone: 'danger', chip: 'mismatch' },
      { href: '/platform-v4/control', kpi: '2', label: 'События в контроле', hint: 'quality delta + incident', tone: 'info', chip: 'под контролем' }
    ]
  },
  '/platform-v4/deal': {
    eyebrow: 'Tesla-screen сделки',
    title: 'Текущий этап, owner, blocker, деньги и next action — в одном экране',
    body: 'Карточка сделки должна быть единым центром управления, а не набором разрозненных разделов.',
    actions: [
      { href: '/platform-v4/bank', label: 'Открыть деньги', primary: true },
      { href: '/platform-v4/documents', label: 'Открыть документы' },
      { href: '/platform-v4/control', label: 'Открыть контроль' }
    ],
    tiles: [
      { href: '/platform-v4/receiving', kpi: '1', label: 'Blocker по приёмке', hint: 'нет акта приёмки', tone: 'warning', chip: 'blocker' },
      { href: '/platform-v4/bank', kpi: '250k', label: 'Спорная часть на hold', hint: 'money impact', tone: 'warning', chip: 'hold' },
      { href: '/platform-v4/control', kpi: '92%', label: 'Evidence pack собран', hint: 'документы + GPS + quality', tone: 'info', chip: 'evidence' },
      { href: '/platform-v4/lab', kpi: '1', label: 'Quality delta открыт', hint: 'влияет на final release', tone: 'info', chip: 'quality' }
    ]
  },
  '/platform-v4/buyer': {
    eyebrow: 'Role-first · buyer',
    title: 'Покупатель видит не каталог, а переход из оффера в исполнимую сделку',
    body: 'Первый сценарий — выбрать оффер, подтвердить source of funds и понять, что может остановить release.',
    actions: [
      { href: '/platform-v4/funding', label: 'Подтвердить оплату', primary: true },
      { href: '/platform-v4/bank', label: 'Открыть safe deal' },
      { href: '/platform-v4/deal', label: 'Открыть сделку' }
    ],
    tiles: [
      { href: '/platform-v4/funding', kpi: '2', label: 'Оффера ждут source of funds', hint: 'без этого сделка не стартует', tone: 'warning', chip: 'needs action' },
      { href: '/platform-v4/documents', kpi: '1', label: 'Комплект блокирует запуск', hint: 'документы — gate', tone: 'warning', chip: 'gate' },
      { href: '/platform-v4/bank', kpi: '3', label: 'Money rail виден заранее', hint: 'reserve / hold / release', tone: 'info', chip: 'visible' },
      { href: '/platform-v4/deal', kpi: '1', label: 'Сделка ready to launch', hint: 'после funds check', tone: 'success', chip: 'ready' }
    ]
  },
  '/platform-v4/seller': {
    eyebrow: 'Role-first · seller',
    title: 'Продавец возвращается сюда ради действий и денег, а не ради карточек ради карточек',
    body: 'Создать лот, выбрать оффер, открыть сделку, увидеть blockers по деньгам и документам.',
    actions: [
      { href: '/platform-v4/seller/new-lot', label: 'Создать лот', primary: true },
      { href: '/platform-v4/deal', label: 'Открыть сделку' },
      { href: '/platform-v4/documents', label: 'Открыть документы' }
    ],
    tiles: [
      { href: '/platform-v4/seller/new-lot', kpi: '12', label: 'Активных лотов', hint: 'быстрый вход в создание', tone: 'success', chip: 'lots' },
      { href: '/platform-v4/deal', kpi: '7', label: 'Сделок в исполнении', hint: 'центр управления', tone: 'info', chip: 'deals' },
      { href: '/platform-v4/bank', kpi: '18,4M', label: 'Ожидаемые деньги', hint: 'видны через money rail', tone: 'warning', chip: 'money' },
      { href: '/platform-v4/documents', kpi: '3', label: 'Пакета блокируют release', hint: 'не PDF-архив', tone: 'warning', chip: 'docs' }
    ]
  },
  '/platform-v4/driver': {
    eyebrow: 'Mobile-first · driver',
    title: 'Один рейс. Один экран. Один обязательный шаг.',
    body: 'Водитель не должен получать уменьшенный десктоп. Только маршрут, текущую задачу, фотофиксацию и кнопку проблемы.',
    actions: [
      { href: '/platform-v4/driver', label: 'Я на месте', primary: true },
      { href: '/platform-v4/logistics', label: 'Открыть рейс' },
      { href: '/platform-v4/control', label: 'Сообщить проблему' }
    ],
    tiles: [
      { href: '/platform-v4/driver', kpi: '18:40', label: 'ETA на площадку', hint: 'следующий шаг — прибытие', tone: 'warning', chip: 'current task' },
      { href: '/platform-v4/driver', kpi: '2', label: 'События в offline queue', hint: 'ничего не теряется', tone: 'info', chip: 'queued' },
      { href: '/platform-v4/control', kpi: '1', label: 'Кнопка инцидента', hint: 'one tap to owner', tone: 'success', chip: 'issue' },
      { href: '/platform-v4/logistics', kpi: 'GPS', label: 'Точки идут в evidence', hint: 'связано со сделкой', tone: 'info', chip: 'tracking' }
    ]
  },
  '/platform-v4/bank': {
    eyebrow: 'Role-first · bank',
    title: 'Reserve → hold → partial release → final release → mismatch / return',
    body: 'Банк видит только readiness, callbacks, beneficiaries, release conditions и исключения. Никакого маркетинга.',
    actions: [
      { href: '/platform-v4/bank', label: 'Открыть release queue', primary: true },
      { href: '/platform-v4/deal', label: 'Открыть сделку' },
      { href: '/platform-v4/control', label: 'Открыть dispute case' }
    ],
    tiles: [
      { href: '/platform-v4/bank', kpi: '7,1M', label: 'Reserve подтверждён', hint: 'деньги привязаны к сделке', tone: 'success', chip: 'reserve' },
      { href: '/platform-v4/bank', kpi: '250k', label: 'Спорная часть на hold', hint: 'до качества и документов', tone: 'warning', chip: 'hold' },
      { href: '/platform-v4/bank', kpi: '6,85M', label: 'Ready for partial release', hint: 'после события', tone: 'info', chip: 'release' },
      { href: '/platform-v4/control', kpi: '1', label: 'Mismatch требует сверки', hint: 'fail closed', tone: 'danger', chip: 'mismatch' }
    ]
  }
};

export function PlatformV4CommandLayer() {
  const pathname = usePathname();
  const screen = SCREENS[pathname || ''];
  if (!screen) return null;

  return (
    <section className="pc-v4-command">
      <div className="pc-v4-command-card">
        <div className="pc-v4-command-eyebrow">{screen.eyebrow}</div>
        <div className="pc-v4-command-title">{screen.title}</div>
        <div className="pc-v4-command-body">{screen.body}</div>
        <div className="pc-v4-command-actions">
          {screen.actions.map((action) => (
            <Link key={action.href + action.label} href={action.href} className={`pc-v4-command-action${action.primary ? ' primary' : ''}`}>
              {action.label}
            </Link>
          ))}
        </div>
        <div className="pc-v4-command-grid">
          {screen.tiles.map((tile) => (
            <Link key={tile.href + tile.label} href={tile.href} className="pc-v4-command-tile">
              <div className="pc-v4-command-kpi">{tile.kpi}</div>
              <div className="pc-v4-command-label">{tile.label}</div>
              <div className="pc-v4-command-hint">{tile.hint}</div>
              <div className={`pc-v4-command-chip ${tile.tone}`}>{tile.chip}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
