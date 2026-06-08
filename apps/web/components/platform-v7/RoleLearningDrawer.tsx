'use client';

import { useState, useEffect, useCallback } from 'react';

type RoleKey =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'bank'
  | 'operator'
  | 'disputes'
  | 'default';

type RoleContent = {
  title: string;
  intro: string;
  firstSteps: string[];
  commonBlockers: { cause: string; fix: string }[];
  glossary: { term: string; def: string }[];
};

const CONTENT: Record<RoleKey, RoleContent> = {
  seller: {
    title: 'Продавец',
    intro: 'Ваш контур: партия → лот → оффер → сделка → документы → деньги. Деньги выходят после того, как все стороны подтвердили выполнение условий.',
    firstSteps: [
      'Создайте партию: культура, объём, класс, базис поставки.',
      'Добавьте СДИЗ и сертификат качества к партии.',
      'Выставьте лот — система сформирует оффер для покупателей.',
      'После принятия оффера сделка открывается автоматически.',
      'Передайте ЭТрН водителю перед отгрузкой.',
      'После приёмки и подписания актов — деньги освобождаются.',
    ],
    commonBlockers: [
      { cause: 'Деньги не выходят', fix: 'Проверьте акт приёмки и протокол качества — оба должны быть подписаны.' },
      { cause: 'Лот не виден покупателям', fix: 'Статус лота должен быть «Активен». Проверьте комплект документов партии.' },
      { cause: 'СДИЗ отклонён', fix: 'Дата и объём в СДИЗ должны совпадать с лотом. Подпись ЭЦП обязательна.' },
    ],
    glossary: [
      { term: 'СДИЗ', def: 'Сопроводительный документ на зерно и продукты его переработки.' },
      { term: 'ЭТрН', def: 'Электронная транспортная накладная — оформляется на каждый рейс.' },
      { term: 'Базис поставки', def: 'Место и условие передачи товара: CPT элеватор, FCA склад, EXW поле.' },
      { term: 'Резерв денег', def: 'Покупатель блокирует сумму на счёте до выполнения всех условий сделки.' },
    ],
  },
  buyer: {
    title: 'Покупатель',
    intro: 'Ваш контур: RFQ → оффер → резерв денег → сделка → приёмка → документы → закрытие. Деньги резервируются до того, как продавец отгрузит товар.',
    firstSteps: [
      'Создайте RFQ: культура, объём, регион, ценовой диапазон.',
      'Ознакомьтесь с предложениями и выберите подходящий лот.',
      'Подтвердите оффер — система заблокирует деньги.',
      'После прибытия рейса — подтвердите приёмку в системе.',
      'Проверьте протокол качества и акт приёмки.',
      'Закройте сделку — деньги уйдут продавцу автоматически.',
    ],
    commonBlockers: [
      { cause: 'Деньги не освобождены', fix: 'Все документы должны быть подписаны: акт приёмки, протокол качества.' },
      { cause: 'Приёмка заблокирована', fix: 'Ожидайте подтверждения элеватора. Обратитесь через Поддержку, если задержка.' },
      { cause: 'Расхождение веса', fix: 'Элеватор создаёт акт расхождения — подпишите его, чтобы разблокировать контур.' },
    ],
    glossary: [
      { term: 'RFQ', def: 'Request for Quotation — запрос предложений от продавцов.' },
      { term: 'Акт приёмки', def: 'Документ о принятии товара с указанием фактического веса и состояния.' },
      { term: 'Резерв', def: 'Блокировка денег на счёте покупателя до исполнения условий сделки.' },
      { term: 'Удержание', def: 'Сумма, вычитаемая из выплаты при расхождении веса или нарушении качества.' },
    ],
  },
  logistics: {
    title: 'Логистика',
    intro: 'Ваш контур: назначение водителя → рейс → маршрут → контроль пути → прибытие → документы. Вы отвечаете за цепочку от отгрузки до элеватора.',
    firstSteps: [
      'Создайте рейс под сделку: водитель, машина, маршрут.',
      'Убедитесь, что водитель получил ЭТрН и знает маршрут.',
      'Контролируйте отклонения маршрута в реальном времени.',
      'При прибытии — подтвердите рейс закрытым.',
      'Прикрепите транспортные документы к сделке.',
    ],
    commonBlockers: [
      { cause: 'Рейс завис в статусе "В пути"', fix: 'Водитель должен подтвердить прибытие через полевой интерфейс.' },
      { cause: 'ЭТрН не найдена', fix: 'Проверьте привязку ЭТрН к рейсу в разделе «Документы рейса».' },
      { cause: 'Отклонение маршрута', fix: 'Свяжитесь с водителем, зафиксируйте причину в комментарии к рейсу.' },
    ],
    glossary: [
      { term: 'Рейс', def: 'Одна поездка от точки отгрузки до элеватора в рамках сделки.' },
      { term: 'Пломба', def: 'Электронная или физическая пломба на кузов — фиксируется фото в системе.' },
      { term: 'ЭТрН', def: 'Электронная транспортная накладная — привязана к каждому рейсу.' },
    ],
  },
  driver: {
    title: 'Водитель',
    intro: 'Ваш экран: один рейс, одно следующее действие. Всегда понятно, что делать прямо сейчас.',
    firstSteps: [
      'Откройте текущий рейс — там всё, что нужно для работы.',
      'Перед выездом — сфотографируйте пломбу на кузов.',
      'Следуйте маршруту: отклонения фиксируются автоматически.',
      'При прибытии — нажмите «Прибыл на элеватор».',
      'После разгрузки — подтвердите акт приёмки.',
    ],
    commonBlockers: [
      { cause: 'Рейс не открывается', fix: 'Обратитесь к диспетчеру — рейс должен быть назначен на вас.' },
      { cause: 'Нет кнопки «Прибыл»', fix: 'Убедитесь, что GPS включён. Прибытие фиксируется по геолокации.' },
      { cause: 'Фото не загружается', fix: 'Проверьте интернет-соединение. Фото сохраняется в очередь и отправится при связи.' },
    ],
    glossary: [
      { term: 'Пломба', def: 'Физическая или электронная защита кузова — снимается только на элеваторе.' },
      { term: 'ЭТрН', def: 'Ваш главный документ на рейс. Должна быть подписана перед выездом.' },
    ],
  },
  elevator: {
    title: 'Элеватор',
    intro: 'Ваш контур: приёмка рейса → взвешивание → акт расхождения (при необходимости) → подпись. Без вашего акта деньги не выйдут.',
    firstSteps: [
      'Дождитесь прибытия рейса — он появится в очереди приёмки.',
      'Взвесьте товар и внесите фактические данные.',
      'Если вес расходится с накладной — создайте акт расхождения.',
      'Подпишите акт приёмки — это разблокирует контур сделки.',
      'Прикрепите документы элеватора к рейсу.',
    ],
    commonBlockers: [
      { cause: 'Рейс не появился в очереди', fix: 'Логистика должна закрыть рейс со своей стороны. Обратитесь к диспетчеру.' },
      { cause: 'Акт расхождения не принимается', fix: 'Продавец и покупатель должны подписать его со своих контуров.' },
    ],
    glossary: [
      { term: 'Акт расхождения', def: 'Документ при разнице между задекларированным и фактическим весом.' },
      { term: 'Основание для денег', def: 'Подписанный акт приёмки — без него банк не освобождает резерв.' },
    ],
  },
  lab: {
    title: 'Лаборатория',
    intro: 'Ваш контур: проба → анализ → протокол качества → подпись. Ваш протокол определяет, соответствует ли товар условиям сделки.',
    firstSteps: [
      'Получите пробу при приёмке товара на элеваторе.',
      'Проведите анализ по показателям из условий сделки.',
      'Внесите результаты и создайте протокол качества.',
      'Подпишите протокол — он привязывается к акту приёмки.',
      'При отклонении по ГОСТ — зафиксируйте несоответствие в системе.',
    ],
    commonBlockers: [
      { cause: 'Протокол не принимается', fix: 'Проверьте, что все показатели заполнены и подпись ЭЦП действительна.' },
      { cause: 'Отклонение влияет на удержание', fix: 'Система рассчитает удержание автоматически по формуле из условий сделки.' },
    ],
    glossary: [
      { term: 'ГОСТ', def: 'Государственный стандарт качества зерна — регулирует допустимые показатели.' },
      { term: 'Протокол качества', def: 'Результаты лабораторного анализа пробы, привязанные к конкретной партии.' },
      { term: 'Удержание', def: 'Сумма вычета из выплаты при отклонении качества от условий сделки.' },
    ],
  },
  bank: {
    title: 'Банк',
    intro: 'Ваш контур: резерв → ручная проверка → основание → выпуск. Деньги выходят только после полного комплекта подписанных документов.',
    firstSteps: [
      'Проверьте очередь на ручную проверку — только сделки с полным пакетом.',
      'Убедитесь, что акт приёмки, протокол качества и ЭТрН подписаны.',
      'При наличии расхождений — запросите разъяснения через тикет.',
      'Подтвердите основание и выпустите средства.',
    ],
    commonBlockers: [
      { cause: 'Нет основания для выпуска', fix: 'Акт приёмки или протокол качества ещё не подписаны всеми сторонами.' },
      { cause: 'Сделка на стопе', fix: 'Активный спор блокирует выпуск. Дождитесь решения арбитра.' },
    ],
    glossary: [
      { term: 'Резерв', def: 'Заблокированные деньги покупателя — хранятся до выполнения условий.' },
      { term: 'Основание', def: 'Полный пакет подписанных документов, разрешающих выпуск денег.' },
      { term: 'Эскроу', def: 'Трёхсторонний счёт, защищающий интересы обеих сторон.' },
    ],
  },
  operator: {
    title: 'Оператор',
    intro: 'Ваш контур: контроль блокеров → управление контуром → снятие остановок → мониторинг. Вы видите всё, вмешиваетесь только там, где это нужно.',
    firstSteps: [
      'Проверьте дашборд блокеров — критические поднимаются вверх автоматически.',
      'На каждый активный блокер есть ответственный и дедлайн.',
      'Используйте быстрые действия: «Эскалировать», «Назначить», «Снять стоп».',
      'Записи о всех действиях автоматически попадают в аудит-лог.',
    ],
    commonBlockers: [
      { cause: 'Сделка на стопе без причины', fix: 'Найдите незакрытый тикет или неподписанный документ в цепочке.' },
      { cause: 'Ответственный не реагирует', fix: 'Эскалируйте блокер на уровень выше через «Передать руководителю».' },
    ],
    glossary: [
      { term: 'Блокер', def: 'Событие, останавливающее движение сделки вперёд.' },
      { term: 'Аудит-лог', def: 'Неизменяемая хронологическая запись всех действий в контуре.' },
      { term: 'Стоп', def: 'Принудительная пауза сделки — снимается только уполномоченным оператором.' },
    ],
  },
  disputes: {
    title: 'Споры',
    intro: 'Ваш контур: причина спора → доказательства → оценка удержания → решение. Спор блокирует выпуск денег до его закрытия.',
    firstSteps: [
      'Откройте спор, указав точную причину и сумму.',
      'Загрузите все доказательства: фото, документы, переписку.',
      'Система автоматически уведомит арбитра.',
      'Ответьте на запросы арбитра в установленный срок.',
      'После решения — подпишите итоговый акт.',
    ],
    commonBlockers: [
      { cause: 'Спор висит без движения', fix: 'Проверьте, не истёк ли срок ответа на запрос арбитра.' },
      { cause: 'Доказательства не приняты', fix: 'Файлы должны быть подписаны ЭЦП и соответствовать формату (PDF/JPG).' },
    ],
    glossary: [
      { term: 'Арбитр', def: 'Независимый участник, принимающий решение по спору.' },
      { term: 'Папка доказательств', def: 'Структурированный набор документов и медиафайлов по спору.' },
      { term: 'Удержание', def: 'Сумма, оспариваемая в споре — заморожена до его закрытия.' },
    ],
  },
  default: {
    title: 'Справка',
    intro: 'Платформа исполнения зерновой сделки. Каждый участник видит только свой контур и своё следующее действие.',
    firstSteps: [
      'Выберите свою роль в разделе «Роли».',
      'Ознакомьтесь с блокером и следующим действием.',
      'При блокере — обратитесь в Поддержку через кнопку на странице.',
    ],
    commonBlockers: [
      { cause: 'Не вижу своих сделок', fix: 'Убедитесь, что ваша роль активирована. Обратитесь к оператору.' },
    ],
    glossary: [
      { term: 'Контур', def: 'Рабочая область конкретной роли в сделке.' },
      { term: 'Блокер', def: 'Причина, по которой сделка не может двигаться вперёд.' },
    ],
  },
};

type DrawerTab = 'start' | 'blockers' | 'glossary';

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 12px',
        borderRadius: 8,
        border: 'none',
        background: active ? 'var(--p7-color-brand, #0A7A5F)' : 'transparent',
        color: active ? '#fff' : 'var(--p7-color-text-muted, #6B778C)',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
        transition: 'background 0.13s, color 0.13s',
      }}
    >
      {children}
    </button>
  );
}

type Props = {
  role?: RoleKey;
  triggerStyle?: React.CSSProperties;
};

export function RoleLearningDrawer({ role = 'default', triggerStyle }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DrawerTab>('start');
  const content = CONTENT[role] ?? CONTENT.default;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title='Справка по роли'
        aria-label='Справка по роли'
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          border: '1px solid var(--p7-color-border, #E4E6EA)',
          background: 'var(--p7-color-surface, #fff)',
          color: 'var(--p7-color-text-muted, #6B778C)',
          fontSize: 14,
          fontWeight: 900,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          ...triggerStyle,
        }}
      >
        ?
      </button>

      {open && (
        <>
          <div
            onClick={close}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(15,20,25,0.32)',
            }}
          />

          <div
            role='dialog'
            aria-modal='true'
            aria-label={`Справка: ${content.title}`}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 1001,
              width: 'min(420px, 100vw)',
              background: 'var(--p7-color-surface, #fff)',
              borderLeft: '1px solid var(--p7-color-border, #E4E6EA)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.10)',
              overflowY: 'auto',
            }}
          >
            <div style={{
              padding: '16px 18px 14px',
              borderBottom: '1px solid var(--p7-color-border, #E4E6EA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              position: 'sticky',
              top: 0,
              background: 'var(--p7-color-surface, #fff)',
              zIndex: 1,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--p7-color-text-muted, #6B778C)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                  Справка по роли
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--p7-color-text-primary, #0F1419)', letterSpacing: '-0.025em' }}>
                  {content.title}
                </div>
              </div>
              <button
                onClick={close}
                aria-label='Закрыть'
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  border: '1px solid var(--p7-color-border, #E4E6EA)',
                  background: 'transparent',
                  color: 'var(--p7-color-text-muted, #6B778C)',
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '12px 18px 8px', display: 'flex', gap: 4, borderBottom: '1px solid var(--p7-color-border, #E4E6EA)' }}>
              <TabBtn active={tab === 'start'} onClick={() => setTab('start')}>С чего начать</TabBtn>
              <TabBtn active={tab === 'blockers'} onClick={() => setTab('blockers')}>Блокеры</TabBtn>
              <TabBtn active={tab === 'glossary'} onClick={() => setTab('glossary')}>Термины</TabBtn>
            </div>

            <div style={{ padding: '18px', flex: 1, display: 'grid', gap: 16, alignContent: 'start' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--p7-color-text-muted, #6B778C)', lineHeight: 1.65, borderLeft: '3px solid var(--p7-color-brand, #0A7A5F)', paddingLeft: 12 }}>
                {content.intro}
              </p>

              {tab === 'start' && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {content.firstSteps.map((step, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--p7-color-border, #E4E6EA)',
                        background: 'var(--p7-color-background, #F8FAFB)',
                      }}
                    >
                      <span style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: 'var(--p7-color-brand, #0A7A5F)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--p7-color-text-primary, #0F1419)', lineHeight: 1.55 }}>{step}</span>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'blockers' && (
                <div style={{ display: 'grid', gap: 10 }}>
                  {content.commonBlockers.map((b, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: '1px solid var(--p7-color-border, #E4E6EA)',
                        background: 'var(--p7-color-surface, #fff)',
                        display: 'grid',
                        gap: 6,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#B42318' }}>{b.cause}</div>
                      <div style={{ fontSize: 13, color: 'var(--p7-color-text-muted, #6B778C)', lineHeight: 1.55 }}>
                        <span style={{ fontWeight: 800, color: 'var(--p7-color-brand, #0A7A5F)' }}>→ </span>
                        {b.fix}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'glossary' && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {content.glossary.map((g, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--p7-color-border, #E4E6EA)',
                        background: 'var(--p7-color-background, #F8FAFB)',
                        display: 'grid',
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--p7-color-brand, #0A7A5F)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{g.term}</span>
                      <span style={{ fontSize: 13, color: 'var(--p7-color-text-primary, #0F1419)', lineHeight: 1.5 }}>{g.def}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
