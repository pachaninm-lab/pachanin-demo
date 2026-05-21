import Link from 'next/link';

const FLOW_STEPS = [
  { title: 'Создать лот', role: 'Продавец', status: 'партия подготовлена', blocker: 'паспорт и СДИЗ требуют сверки', impact: 'деньги ещё не запрошены', href: '/platform-v7/lots/create', cta: 'Создать лот' },
  { title: 'Получить ставку', role: 'Покупатель', status: 'есть предложение по цене', blocker: 'предложение ещё не принято', impact: 'резерв ещё не открыт', href: '/platform-v7/buyer', cta: 'Открыть ставки' },
  { title: 'Принять предложение', role: 'Продавец', status: 'цена согласована', blocker: 'сделка ещё не создана', impact: 'можно переходить к резерву', href: '/platform-v7/seller', cta: 'Открыть предложения' },
  { title: 'Создать сделку', role: 'Оператор', status: 'сделка собрана', blocker: 'нужен запрос резерва', impact: 'деньги переходят в банковский контур', href: '/platform-v7/control-tower', cta: 'Открыть контроль сделки' },
  { title: 'Запросить резерв', role: 'Банк', status: 'запрос отправлен', blocker: 'ответ банка ожидается', impact: 'выпуск денег ещё невозможен', href: '/platform-v7/bank', cta: 'Открыть банк' },
  { title: 'Подтвердить резерв', role: 'Банк', status: 'резерв подтверждён в тестовом сценарии', blocker: 'требуются логистика и документы', impact: 'резерв виден как контейнер MoneyTree', href: '/platform-v7/bank', cta: 'Открыть MoneyTree' },
  { title: 'Назначить логистику', role: 'Логистика', status: 'рейс назначен', blocker: 'нужны машина и водитель', impact: 'транспортный пакет ещё неполный', href: '/platform-v7/logistics', cta: 'Открыть рейс' },
  { title: 'Закрыть рейс', role: 'Водитель', status: 'рейс проходит field-события', blocker: 'фото, GPS, пломба и вес должны быть отправлены', impact: 'без закрытия рейса выпуск денег блокируется', href: '/platform-v7/driver/field', cta: 'Открыть рейс водителя' },
  { title: 'Подтвердить приёмку', role: 'Элеватор', status: 'вес и пломба зафиксированы', blocker: 'расхождение веса создаёт остановку', impact: 'может появиться удержание', href: '/platform-v7/elevator', cta: 'Открыть приёмку' },
  { title: 'Загрузить лабораторию', role: 'Лаборатория', status: 'качество проверяется', blocker: 'протокол должен быть загружен', impact: 'отклонение качества влияет на спор и удержание', href: '/platform-v7/lab', cta: 'Открыть лабораторию' },
  { title: 'Проверить документы', role: 'Банк / оператор', status: 'пакет документов сверяется', blocker: 'нет подписи или внешнего ответа', impact: 'деньги остаются в резерве до основания', href: '/platform-v7/bank', cta: 'Проверить документы' },
  { title: 'Выпуск или удержание', role: 'Банк', status: 'банк получил основание', blocker: 'спор или ручная проверка могут остановить выпуск', impact: 'банк подтверждает выпуск или удержание', href: '/platform-v7/bank', cta: 'Открыть проверку выпуска' },
  { title: 'Открыть спор', role: 'Арбитр', status: 'сумма под риском выделена', blocker: 'нужны доказательства', impact: 'удержание остаётся до решения', href: '/platform-v7/disputes', cta: 'Открыть спор' },
  { title: 'Закрыть по доказательствам', role: 'Арбитр / оператор', status: 'решение требует основания', blocker: 'без причины спор не закрывается', impact: 'решение объясняет влияние на удержание и выпуск', href: '/platform-v7/disputes', cta: 'Открыть доказательства' },
] as const;

export default function DemoModePage() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section data-testid="platform-v7-demo-flow-hero" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#0F1419' }}>Демо-сценарий исполнения сделки</div>
        <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, maxWidth: 920 }}>
          Отдельный тестовый сценарий на 3–5 минут. Он показывает весь путь зерновой сделки: лот, ставка, сделка, резерв, логистика, рейс, приёмка, лаборатория, документы, выпуск или удержание денег, спор, доказательства и решение. Сценарий не заявляет live-интеграции и не подменяет рабочие кабинеты.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/platform-v7/demo/deals/DL-9103" style={{ padding: '12px 16px', borderRadius: 12, background: '#0A7A5F', color: '#fff', textDecoration: 'none', fontWeight: 800 }}>Запустить демо сделки</Link>
          <Link href="/platform-v7/investor" style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', textDecoration: 'none', fontWeight: 700 }}>Открыть инвесторский режим</Link>
        </div>
      </section>

      <section data-testid="platform-v7-demo-flow" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0F1419' }}>Сквозной маршрут сделки</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 6 }}>Каждый шаг показывает роль, статус, причину остановки, влияние на деньги или документы и следующий переход.</div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {FLOW_STEPS.map((step, index) => (
            <article key={step.title} style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{index + 1}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{step.title}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{step.role}</div>
                  </div>
                </div>
                <Link href={step.href} style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRadius: 10, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', textDecoration: 'none', fontSize: 12, fontWeight: 850 }}>{step.cta}</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
                <Cell label="Статус" value={step.status} />
                <Cell label="Что блокирует" value={step.blocker} />
                <Cell label="Влияние" value={step.impact} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #EEF1F4', borderRadius: 12, padding: 10, background: '#fff' }}>
      <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.055em', fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: '#0F1419', fontWeight: 750 }}>{value}</div>
    </div>
  );
}
