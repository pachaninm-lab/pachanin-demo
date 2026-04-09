import Link from 'next/link';

const ROLE_CARDS = [
  ['Фермер / Продавец', 'farmer@demo.ru', 'Объективная цена, buyer offers, переход в сделку', '/canon/market', 'Цена и допуск'],
  ['Покупатель', 'buyer@demo.ru', 'Исполнение сделки, приёмка, документы, деньги', '/canon/deals', 'Execution rail'],
  ['Бухгалтерия', 'accounting@demo.ru', 'Hold, release, callback, money-ready', '/canon/finance', 'Деньги'],
  ['Логистика / Операции', 'logistic@demo.ru', 'Рейсы, ETA, handoff, слот и отклонения', '/canon/operations', 'Логистика'],
  ['Лаборатория', 'lab@demo.ru', 'Протоколы, отклонения, retest, price impact', '/canon/quality', 'Качество'],
  ['Оператор / Контроль', 'operator@demo.ru', 'Блокеры, эскалации, спор, queue ownership', '/canon/control', 'Контроль'],
  ['Руководитель', 'executive@demo.ru', 'KPI, узкие места, контур денег и зрелость', '/canon/analytics2', 'Управление'],
  ['Элеватор / Приёмка', 'elevator@demo.ru', 'Очередь, весовая, выгрузка, handoff', '/canon/receiving2', 'Приёмка'],
  ['Водитель / Mobile', 'driver@demo.ru', 'Чекпоинты, ETA, GPS, offline, geofence', '/canon/mobile2', 'Mobile'],
  ['Администратор', 'admin@demo.ru', 'Доступы, компании, аудит, готовность контура', '/canon/admin', 'Администрирование'],
] as const;

const EXECUTION_RAIL = [
  ['1', 'Цена и допуск', 'Рыночный экран, buyer offers, согласование базы сделки'],
  ['2', 'Сделка', 'Единый рабочий объект со статусами, следующими действиями и блокерами'],
  ['3', 'Логистика', 'Рейсы, ETA, слоты, чекпоинты, handoff в приёмку'],
  ['4', 'Приёмка и качество', 'Весовая, лаборатория, протокол, отклонения и retest'],
  ['5', 'Документы и деньги', 'Пакет документов, money-ready, hold / release / callback'],
  ['6', 'Спор и доказательства', 'Operator queue, эскалации, audit trail и набор доказательств'],
] as const;

const INVESTOR_BLOCKS = [
  ['Контур сделки', 'Не витрина и не доска объявлений, а цифровой контур исполнения внебиржевой зерновой сделки.'],
  ['Контур денег', 'Платёжный статус зависит от событий сделки, документов, callback и отсутствия открытого спора.'],
  ['Контур доказательств', 'Каждое действие должно иметь владельца, время, статус и основание для проверки.'],
  ['Контур симуляции', 'До live-интеграций показываются управляемые симуляции критичных сценариев и исключений.'],
] as const;

const SCENARIOS = [
  ['Симулятор критичных сценариев', '/canon/simulator', 'Опоздавший bank callback, missing document, geofence deviation, no-show, quality retest, dispute open/resolve'],
  ['Статус интеграций', '/canon/integrations', 'Сбер, ФГИС «Зерно», ЭДО, КЭП, GPS, 1С, readiness по каждому контуру'],
  ['Control Center', '/canon', 'Единая карта всех модулей и быстрый доступ к ключевым кабинетам'],
  ['Role-first вход', '/canon/roles', 'Быстрый вход в любую роль без лишних шагов'],
] as const;

function cardStyle() {
  return {
    textDecoration: 'none',
    color: 'inherit',
    background: 'linear-gradient(180deg, rgba(11,18,32,.98) 0%, rgba(9,14,27,.98) 100%)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 28,
    padding: 20,
    display: 'block',
    boxShadow: '0 16px 60px rgba(0,0,0,.28)',
  } as const;
}

export default function DemoPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, rgba(30,64,175,.18) 0%, rgba(5,9,20,1) 28%, rgba(4,7,15,1) 100%)', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 56px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <section style={{ padding: '18px 0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Прозрачная Цена · Investor Demo</div>
              <h1 style={{ margin: 0, fontSize: 54, lineHeight: 1.02, fontWeight: 900, letterSpacing: '-0.03em', maxWidth: 980 }}>
                Готовый demo-контур исполнения зерновой сделки для показа инвестору
              </h1>
              <p style={{ margin: '16px 0 0', color: '#94a3b8', fontSize: 18, lineHeight: 1.6, maxWidth: 980 }}>
                Цена и допуск → сделка → логистика → приёмка → документы → деньги → спор → доказательства. Не маркетплейс и не доска объявлений, а управляемый контур исполнения сделки с симуляциями критичных сценариев до live-интеграций.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/canon/roles" style={{ textDecoration: 'none', background: '#22c55e', color: '#03120a', borderRadius: 18, padding: '14px 18px', fontWeight: 800, fontSize: 15 }}>Открыть роли</Link>
              <Link href="/canon/simulator" style={{ textDecoration: 'none', background: 'rgba(255,255,255,.04)', color: '#f8fafc', border: '1px solid rgba(255,255,255,.12)', borderRadius: 18, padding: '14px 18px', fontWeight: 800, fontSize: 15 }}>Открыть симуляции</Link>
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1.3fr .9fr', gap: 16, marginTop: 10 }}>
          <div style={{ ...cardStyle(), minHeight: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>Executive overview</div>
                <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.05, marginTop: 10 }}>Почему это выглядит как готовая платформа, а не как набор экранов</div>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid rgba(34,197,94,.35)', color: '#22c55e', fontSize: 13, fontWeight: 800 }}>Controlled pilot / sandbox-ready</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginTop: 20 }}>
              {[
                ['10', 'Ролей входа'],
                ['6', 'Критичных сценариев'],
                ['8', 'Этапов контура'],
                ['1', 'Единый Control Center'],
              ].map(([value, label]) => (
                <div key={label} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 22, padding: 16, minHeight: 122, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 16, background: 'rgba(34,197,94,.12)' }} />
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{value}</div>
                    <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 6 }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12, marginTop: 14 }}>
              {INVESTOR_BLOCKS.map(([title, text]) => (
                <div key={title} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 22, padding: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
                  <div style={{ marginTop: 8, color: '#8ea0b7', fontSize: 14, lineHeight: 1.55 }}>{text}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...cardStyle(), minHeight: 320 }}>
            <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>Fast investor path</div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.08, marginTop: 10 }}>Куда вести инвестора в первые 3 минуты</div>
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              {SCENARIOS.map(([title, href, text]) => (
                <Link key={title} href={href} style={{ ...cardStyle(), borderRadius: 22, padding: 16, background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
                  <div style={{ marginTop: 8, color: '#8ea0b7', fontSize: 14, lineHeight: 1.5 }}>{text}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section style={{ marginTop: 16, ...cardStyle() }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>Execution rail</div>
              <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.08, marginTop: 10 }}>Полный маршрут сделки от цены до доказательств</div>
            </div>
            <Link href="/canon" style={{ textDecoration: 'none', color: '#22c55e', fontWeight: 800 }}>Открыть Control Center →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 12, marginTop: 18 }}>
            {EXECUTION_RAIL.map(([num, title, text]) => (
              <div key={num} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 24, padding: 16, minHeight: 180 }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(34,197,94,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontWeight: 900 }}>{num}</div>
                <div style={{ marginTop: 14, fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>{title}</div>
                <div style={{ marginTop: 8, color: '#8ea0b7', fontSize: 14, lineHeight: 1.5 }}>{text}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>Role map</div>
              <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.08, marginTop: 10 }}>Полностью кликабельный вход в каждую роль</div>
            </div>
            <div style={{ color: '#8ea0b7', fontSize: 14 }}>Каждая карточка сразу открывает рабочий кабинет через demo-auth</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
            {ROLE_CARDS.map(([title, email, text, href, tag]) => (
              <a key={title} href={`/api/auth/demo?email=${encodeURIComponent(email)}&to=${encodeURIComponent(href)}`} style={cardStyle()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 18, background: 'rgba(34,197,94,.14)' }} />
                  <div style={{ padding: '7px 10px', borderRadius: 999, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.16)', color: '#22c55e', fontSize: 12, fontWeight: 800 }}>{tag}</div>
                </div>
                <div style={{ marginTop: 18, fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
                <div style={{ marginTop: 8, color: '#8ea0b7', fontSize: 14, lineHeight: 1.55 }}>{text}</div>
                <div style={{ marginTop: 16, color: '#22c55e', fontSize: 13, fontWeight: 800 }}>Открыть кабинет →</div>
              </a>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={cardStyle()}>
            <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>What investor should see</div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.08, marginTop: 10 }}>Насыщенность без лжи о зрелости</div>
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              {[
                'Единый контрольный центр вместо разрозненных экранов',
                'Платёжный контур, завязанный на события сделки',
                'Симуляции до live-интеграций без fake-green обещаний',
                'Прямой переход из каждой роли в рабочий сценарий',
                'Ясный маршрут сделки и понятный следующий шаг',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 10, background: '#22c55e', marginTop: 6 }} />
                  <div style={{ color: '#dbe6f3', fontSize: 15, lineHeight: 1.55 }}>{item}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>Demo truth</div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.08, marginTop: 10 }}>Как это правильно позиционировать на показе</div>
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              {[
                ['Статус', 'Сильная предпилотная сборка, готовая к controlled pilot и live-подключениям по контурам.'],
                ['Интеграции', 'Часть экранов и сценариев работает как sandbox / partial / manual simulation и это показано честно.'],
                ['Смысл demo', 'Показать, как платформа удерживает сделку внутри цифрового контура и снижает спорность.'],
                ['Что продавать инвестору', 'Не дизайн ради дизайна, а управляемый execution rail с money-control и evidence-control.'],
              ].map(([title, text]) => (
                <div key={title} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 20, padding: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
                  <div style={{ marginTop: 8, color: '#8ea0b7', fontSize: 14, lineHeight: 1.55 }}>{text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
