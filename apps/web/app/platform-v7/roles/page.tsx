import Link from 'next/link';

const ROLE_CARDS = [
  {
    title: 'Продавец',
    focus: 'Партия, СДИЗ, документы, отгрузка, получение денег.',
    blocker: 'документы партии или основание для денег',
    action: 'Проверить готовность партии',
    href: '/platform-v7/seller',
    tone: '#0A7A5F',
    surface: '#ECFDF5',
  },
  {
    title: 'Покупатель',
    focus: 'RFQ, оффер, резерв, качество, приёмка, документы.',
    blocker: 'качество, вес или неполный комплект документов',
    action: 'Открыть закупочный контур',
    href: '/platform-v7/buyer',
    tone: '#2563EB',
    surface: '#EFF6FF',
  },
  {
    title: 'Логистика',
    focus: 'Рейс, водитель, маршрут, пломба, фото, события пути.',
    blocker: 'отклонение маршрута или нет полевого подтверждения',
    action: 'Проверить рейсы',
    href: '/platform-v7/logistics',
    tone: '#7C3AED',
    surface: '#F5F3FF',
  },
  {
    title: 'Водитель',
    focus: 'Один текущий рейс и одно следующее действие.',
    blocker: 'нет фото пломбы или события прибытия',
    action: 'Открыть текущий рейс',
    href: '/platform-v7/driver/field',
    tone: '#475569',
    surface: '#F8FAFC',
    fieldMode: true,
  },
  {
    title: 'Элеватор',
    focus: 'Приёмка, вес, акт расхождения, основание для денег.',
    blocker: 'не создан акт расхождения',
    action: 'Зафиксировать приёмку',
    href: '/platform-v7/elevator',
    tone: '#B45309',
    surface: '#FFFBEB',
    fieldMode: true,
  },
  {
    title: 'Лаборатория',
    focus: 'Проба, протокол качества, отклонение и влияние на удержание.',
    blocker: 'нет финального протокола качества',
    action: 'Внести протокол',
    href: '/platform-v7/lab',
    tone: '#0369A1',
    surface: '#F0F9FF',
    fieldMode: true,
  },
  {
    title: 'Банк',
    focus: 'Резерв, удержание, ручная проверка, основание для выпуска.',
    blocker: 'основание не подтверждено документами',
    action: 'Открыть денежный шлюз',
    href: '/platform-v7/bank',
    tone: '#0F172A',
    surface: '#F8FAFC',
  },
  {
    title: 'Споры',
    focus: 'Причина спора, доказательства, сумма удержания, решение.',
    blocker: 'неполная папка доказательств',
    action: 'Собрать доказательства',
    href: '/platform-v7/disputes',
    tone: '#B42318',
    surface: '#FEF2F2',
  },
  {
    title: 'Поддержка',
    focus: 'Операционные блокеры, SLA, ответственные, снятие остановок.',
    blocker: 'ответственный не выполнил действие',
    action: 'Открыть центр поддержки',
    href: '/platform-v7/support/operator',
    tone: '#4F46E5',
    surface: '#EEF2FF',
  },
  {
    title: 'Руководитель',
    focus: 'Деньги под риском, блокеры, сделки, SLA и зрелость пилота.',
    blocker: 'критический блокер держит деньги',
    action: 'Открыть карту контроля',
    href: '/platform-v7/executive',
    tone: '#111827',
    surface: '#F3F4F6',
  },
] as const;

const CONTROL_LINKS = [
  { title: 'Центр управления', href: '/platform-v7/control-tower' },
  { title: 'Сюрвейер', href: '/platform-v7/surveyor' },
  { title: 'Арбитр', href: '/platform-v7/arbitrator' },
  { title: 'Комплаенс', href: '/platform-v7/compliance' },
  { title: 'Денежный шлюз', href: '/platform-v7/bank/release-safety' },
  { title: 'Сделка GR-2048', href: '/platform-v7/deals/grain-release' },
] as const;

const shell = {
  display: 'grid',
  gap: 14,
  padding: '4px 0 24px',
  color: 'var(--p7-color-text-primary)',
} as const;

const panel = {
  background: 'var(--p7-color-surface)',
  border: '1px solid var(--p7-color-border)',
  borderRadius: 24,
  boxShadow: 'var(--pc-shadow-sm)',
} as const;

function MiniFact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <span style={{ color: 'var(--p7-color-text-muted)', fontSize: 11, fontWeight: 850, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <strong style={{ color: 'var(--p7-color-text-primary)', fontSize: 13, lineHeight: 1.35 }}>{value}</strong>
    </div>
  );
}

export default function PlatformV7RolesPage() {
  return (
    <main data-platform-v7-role-cockpit-selector='true' style={shell}>
      <section style={{ ...panel, padding: 20, display: 'grid', gap: 14, background: 'linear-gradient(135deg, var(--p7-color-surface) 0%, var(--p7-color-background) 62%, var(--p7-color-brand-soft) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 8, maxWidth: 760 }}>
            <div style={{ width: 42, height: 4, borderRadius: 999, background: 'var(--p7-color-brand)' }} />
            <h1 style={{ margin: 0, color: 'var(--p7-color-text-primary)', fontSize: 'clamp(30px, 7vw, 48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 }}>
              Ролевой пульт сделки
            </h1>
            <p style={{ margin: 0, color: 'var(--p7-color-text-muted)', fontSize: 15, lineHeight: 1.55 }}>
              Выбор роли — это не витрина кабинетов. Каждая роль ведёт к своему фокусу, блокеру и одному главному действию в контуре исполнения сделки.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 8, minWidth: 210 }}>
            <MiniFact label='активная логика' value='роль → блокер → действие' />
            <MiniFact label='field mode' value='водитель / элеватор / лаборатория' />
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }} aria-label='Основные роли сделки'>
        {ROLE_CARDS.map((role) => (
          <Link
            key={role.href}
            href={role.href}
            style={{
              ...panel,
              minHeight: 278,
              textDecoration: 'none',
              padding: 18,
              display: 'grid',
              gap: 14,
              background: role.surface,
              color: 'var(--p7-color-text-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ width: 42, height: 4, borderRadius: 999, background: role.tone }} />
              {role.fieldMode ? (
                <span style={{ border: `1px solid ${role.tone}`, borderRadius: 999, color: role.tone, padding: '4px 8px', fontSize: 11, fontWeight: 850 }}>
                  single-action
                </span>
              ) : null}
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <h2 style={{ margin: 0, color: 'var(--p7-color-text-primary)', fontSize: 28, lineHeight: 1.08, fontWeight: 950 }}>{role.title}</h2>
              <p style={{ margin: 0, color: 'var(--p7-color-text-muted)', fontSize: 14, lineHeight: 1.48 }}>{role.focus}</p>
            </div>

            <div style={{ display: 'grid', gap: 10, marginTop: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, borderTop: '1px solid color-mix(in srgb, var(--p7-color-border) 76%, transparent)', paddingTop: 12 }}>
                <MiniFact label='главный блокер' value={role.blocker} />
                <MiniFact label='следующее действие' value={role.action} />
              </div>
              <div style={{ minHeight: 46, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', background: role.tone, color: '#fff', fontSize: 14, fontWeight: 900, textAlign: 'center' }}>
                {role.action}
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section style={{ ...panel, padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ color: 'var(--p7-color-text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Контрольные контуры
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CONTROL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} style={{ textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '9px 13px', borderRadius: 999, background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)', color: 'var(--p7-color-text-primary)', fontSize: 13, fontWeight: 850 }}>
              {link.title}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
