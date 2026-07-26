type WidenCopy<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? readonly WidenCopy<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: WidenCopy<T[Key]> }
      : T;

const copies = {
  "ru": {
    "nav": {
      "difference": "Отличия",
      "functions": "Функционал",
      "deal": "Сделка в работе",
      "roles": "Выгоды",
      "tai": "TAI",
      "trust": "Доверие"
    },
    "heroDeal": {
      "sampleLabel": "Демонстрационный сценарий",
      "product": "Пшеница · 1 200 тонн",
      "route": "Краснодарский край → Ростовская область",
      "status": "В исполнении",
      "stageLabel": "Текущий этап",
      "stage": "Приёмка и качество",
      "deviationLabel": "Отклонение",
      "deviation": "Показатель белка ниже условия договора",
      "ownerLabel": "Ответственный",
      "owner": "Покупатель",
      "actionLabel": "Следующий шаг",
      "action": "Подтвердить пересчёт или открыть разногласие",
      "settlementLabel": "Готовность расчёта",
      "settlement": "Ожидает решения",
      "proof": "Действия, документы и решения сохраняются в единой истории Сделки."
    },
    "proof": [
      {
        "label": "Единый объект",
        "text": "Все события связаны с одной Сделкой"
      },
      {
        "label": "Ролевой доступ",
        "text": "Каждый участник видит только доступные действия"
      },
      {
        "label": "Проверяемая история",
        "text": "Решение связано с участником и основанием"
      },
      {
        "label": "TAI внутри процесса",
        "text": "ИИ находит отклонение, но не подменяет полномочия"
      }
    ],
    "difference": {
      "eyebrow": "Ключевое отличие",
      "title": "Маркетплейс помогает договориться. Прозрачная Цена помогает исполнить",
      "lead": "Сравнивается модель продукта, а не конкретный конкурент. Работа не заканчивается после выбора контрагента и цены.",
      "headers": [
        "Критерий",
        "Типичный каталог / marketplace",
        "Прозрачная Цена"
      ],
      "rows": [
        {
          "criterion": "Главный результат",
          "typical": "Контакт сторон и согласованные условия.",
          "platform": "Исполненная и закрытая Сделка с проверяемой историей."
        },
        {
          "criterion": "Объект управления",
          "typical": "Объявление, заявка или заказ.",
          "platform": "Условия, роли, события, документы и решения одной Сделки."
        },
        {
          "criterion": "После цены",
          "typical": "Переход в почту, таблицы и внешние системы.",
          "platform": "Поставка, приёмка, качество, документы, спор и готовность расчёта продолжаются в одном процессе."
        },
        {
          "criterion": "Ответственность",
          "typical": "Часто определяется вне системы.",
          "platform": "Отклонение связано с ответственным, основанием, сроком и допустимым действием."
        },
        {
          "criterion": "ИИ",
          "typical": "Поиск, рекомендации или общий чат.",
          "platform": "TAI анализирует конкретную Сделку, источники и ролевые ограничения."
        },
        {
          "criterion": "Доказательства",
          "typical": "Переписка и отдельные файлы.",
          "platform": "Версии, события, решения и основания связаны с одной Сделкой."
        }
      ],
      "boundary": "Платформа не заявляет, что заменяет ERP, банк, лабораторию или логистическую систему. Она связывает их действия вокруг единого объекта Сделки.",
      "moreLabel": "Показать все отличия"
    },
    "functions": {
      "eyebrow": "Функционал платформы",
      "title": "Все ключевые этапы агросделки — в одной рабочей системе",
      "lead": "Восемь групп функций связаны не с каталогом модулей, а с результатом исполнения Сделки.",
      "items": [
        {
          "index": "01",
          "title": "Цена",
          "text": "Предложения, допуск и торги.",
          "result": "Зафиксированные коммерческие условия."
        },
        {
          "index": "02",
          "title": "Сделка",
          "text": "Договор, роли, версии условий и полномочия.",
          "result": "Понятные обязанности каждого участника."
        },
        {
          "index": "03",
          "title": "Поставка",
          "text": "Заявка, транспорт, маршрут, водитель и контрольные точки.",
          "result": "Подтверждённая история движения партии."
        },
        {
          "index": "04",
          "title": "Приёмка",
          "text": "Вес, качество, лаборатория, расхождения и повторные проверки.",
          "result": "Проверяемый итог исполнения."
        },
        {
          "index": "05",
          "title": "Документы",
          "text": "Связь документа с событием и партией, версии, комплектность и подписи.",
          "result": "Основание не теряется в переписке."
        },
        {
          "index": "06",
          "title": "Деньги",
          "text": "Финансовый сценарий, удержания, частичные расчёты, возвраты и сверка.",
          "result": "Видно, что разрешает или останавливает готовность расчёта."
        },
        {
          "index": "07",
          "title": "Спор",
          "text": "Позиции сторон, доказательства, сроки и решение.",
          "result": "Спор рассматривается по одной версии фактов."
        },
        {
          "index": "08",
          "title": "Контроль",
          "text": "TAI, аналитика, API, ERP/1С, логистика, лаборатория и финансы.",
          "result": "Единый контроль без замены существующих систем."
        }
      ],
      "summaryTitle": "Одна Сделка связывает функции между собой",
      "summaryText": "Событие в поставке меняет приёмку, документы, риск, доступное действие и готовность расчёта.",
      "moreLabel": "Показать все 8 функций",
      "resultLabel": "Результат"
    },
    "process": {
      "eyebrow": "Путь Сделки",
      "title": "После согласования цены — шесть фаз исполнения",
      "lead": "Полный путь не перегружает интерфейс: пользователю всегда видны текущая фаза, основание перехода и следующий шаг.",
      "phases": [
        {
          "index": "01",
          "title": "Условия",
          "text": "Товар, объём, качество, базис и допуск.",
          "result": "Готовность к выбору стороны."
        },
        {
          "index": "02",
          "title": "Выбор стороны",
          "text": "Предложения, торги и фиксация цены.",
          "result": "Согласованные коммерческие условия."
        },
        {
          "index": "03",
          "title": "Обязательства",
          "text": "Договор, участники, документы и финансовый сценарий.",
          "result": "Сделка готова к исполнению."
        },
        {
          "index": "04",
          "title": "Поставка",
          "text": "Транспорт, маршрут, рейс и события.",
          "result": "Партия доставлена."
        },
        {
          "index": "05",
          "title": "Приёмка",
          "text": "Вес, качество, лаборатория и решения по расхождениям.",
          "result": "Подтверждён итог исполнения."
        },
        {
          "index": "06",
          "title": "Расчёт и закрытие",
          "text": "Готовность расчёта, удержания, спор и завершение обязательств.",
          "result": "Сделка закрыта."
        }
      ],
      "fullPathLabel": "Полная модель",
      "fullPathText": "19 этапов от условий и допуска до логистики, лаборатории, расчёта, спора, доказательств и аналитики.",
      "moreLabel": "Показать все 6 фаз",
      "resultLabel": "Результат фазы",
      "stagesLabel": "Показать 19 этапов"
    },
    "demo": {
      "eyebrow": "Сделка в работе",
      "title": "Один процесс показывает норму, отклонение и спор",
      "lead": "Смена состояния обновляет факты, ответственного, допустимые действия и готовность расчёта. Сценарий демонстрационный.",
      "statesLabel": "Состояние демонстрационной Сделки",
      "roleLabel": "Перспектива",
      "role": "Покупатель",
      "stageLabel": "Фазы Сделки",
      "stages": [
        "Условия",
        "Выбор стороны",
        "Обязательства",
        "Поставка",
        "Приёмка",
        "Расчёт и закрытие"
      ],
      "states": [
        {
          "key": "normal",
          "tab": "Норма",
          "status": "Условия выполнены",
          "title": "Поставка подтверждена",
          "summary": "Вес, качество и комплект документов соответствуют согласованным условиям.",
          "kpis": [
            {
              "label": "Вес",
              "value": "1 200,4 т · подтверждён"
            },
            {
              "label": "Белок",
              "value": "12,1% · в допуске"
            },
            {
              "label": "Документы",
              "value": "Комплект подтверждён"
            }
          ],
          "events": [
            {
              "meta": "Сегодня, 09:42",
              "title": "Приёмка завершена",
              "text": "Вес и партия связаны с актом приёмки."
            },
            {
              "meta": "Сегодня, 09:51",
              "title": "Лаборатория передала протокол",
              "text": "Результат соответствует версии договора."
            },
            {
              "meta": "Сегодня, 10:03",
              "title": "Основание расчёта собрано",
              "text": "Проверены события, документы и полномочия."
            }
          ],
          "actionTitle": "Готово к проверке финансового сценария",
          "actionText": "Окончательное действие выполняет уполномоченный участник или подключённая финансовая система.",
          "actionCta": "Открыть основание"
        },
        {
          "key": "deviation",
          "tab": "Отклонение",
          "status": "Требуется решение",
          "title": "Показатель качества ниже условия",
          "summary": "Белок 11,2% при договорном минимуме 12,0%. Протокол и версия договора сопоставлены.",
          "kpis": [
            {
              "label": "Отклонение",
              "value": "−0,8 п.п."
            },
            {
              "label": "Ответственный",
              "value": "Покупатель"
            },
            {
              "label": "Готовность расчёта",
              "value": "Ожидает решения"
            }
          ],
          "events": [
            {
              "meta": "Сегодня, 10:04",
              "title": "Получен протокол №318",
              "text": "Результат связан с пробой и партией."
            },
            {
              "meta": "Сегодня, 10:06",
              "title": "TAI сопоставил условия",
              "text": "Показано отклонение, источник и уверенность."
            },
            {
              "meta": "Срок: сегодня",
              "title": "Назначено допустимое действие",
              "text": "Пересчёт, повторная проверка или открытие разногласия."
            }
          ],
          "actionTitle": "Решение остаётся за покупателем",
          "actionText": "TAI не меняет договор и не разрешает расчёт самостоятельно.",
          "actionCta": "Посмотреть варианты"
        },
        {
          "key": "dispute",
          "tab": "Спор / нет данных",
          "status": "Недостаточная уверенность",
          "title": "Источники противоречат друг другу",
          "summary": "Две версии протокола содержат разные результаты; актуальность документа не подтверждена.",
          "kpis": [
            {
              "label": "Версии",
              "value": "2 протокола"
            },
            {
              "label": "Уверенность TAI",
              "value": "Недостаточная"
            },
            {
              "label": "Готовность расчёта",
              "value": "Остановлена"
            }
          ],
          "events": [
            {
              "meta": "Сегодня, 10:07",
              "title": "Обнаружен конфликт версий",
              "text": "Ни один результат не скрыт."
            },
            {
              "meta": "Сегодня, 10:08",
              "title": "TAI воздержался от вывода",
              "text": "Показаны источники конфликта и недостающие данные."
            },
            {
              "meta": "Срок: завтра",
              "title": "Требуется процедура разногласия",
              "text": "Назначены стороны, срок и перечень доказательств."
            }
          ],
          "actionTitle": "Расчёт не готов до разрешения спора",
          "actionText": "Система сохраняет позиции и доказательства, но не выносит решение автоматически.",
          "actionCta": "Открыть спор"
        }
      ],
      "openDeal": "Открыть полный сценарий Сделки"
    },
    "roles": {
      "eyebrow": "Одна платформа для всех",
      "title": "Одна версия фактов — разные полномочия и выгоды",
      "lead": "Каждый участник видит ту же Сделку, но только свои данные, ответственность и допустимые действия.",
      "groups": [
        {
          "title": "Продавец",
          "subroles": "Производитель · торговый дом",
          "see": "Путь партии, документы и блокер расчёта.",
          "do": "Передаёт документ, отвечает на отклонение, подтверждает пересчёт или позицию.",
          "get": "Проверяемое основание готовности или остановки расчёта."
        },
        {
          "title": "Покупатель",
          "subroles": "Закупщик · переработчик · агрохолдинг",
          "see": "Поставку, качество, комплект документов и последствия отклонения.",
          "do": "Принимает результат, запрашивает проверку, подтверждает пересчёт или открывает спор.",
          "get": "Контролируемую приёмку и защиту от оплаты неподтверждённого результата."
        },
        {
          "title": "Исполнение",
          "subroles": "Логист · водитель · элеватор · лаборатория · сюрвейер",
          "see": "Свои рейсы, точки контроля, документы и исключения.",
          "do": "Подтверждает событие, передаёт протокол или сообщает отклонение.",
          "get": "Ясную ответственность и доказательство выполнения."
        },
        {
          "title": "Контроль и финансы",
          "subroles": "Банк · оператор · комплаенс · арбитр · руководитель",
          "see": "Риск, источник, историю решения, SLA и границы полномочий.",
          "do": "Проверяет, эскалирует или действует в пределах собственных полномочий.",
          "get": "Управляемые исключения и проверяемое основание действия."
        }
      ],
      "benefits": [
        {
          "title": "Скорость",
          "text": "Меньше ручных переходов между почтой, таблицами и кабинетами."
        },
        {
          "title": "Деньги",
          "text": "Видно, что подтверждает или останавливает готовность расчёта."
        },
        {
          "title": "Риск",
          "text": "Отклонение связано с источником до необратимого действия."
        },
        {
          "title": "Контроль",
          "text": "Понятно, кто, когда, почему и в пределах каких полномочий действовал."
        }
      ],
      "scenarioTitle": "Проверьте одну Сделку с позиции конкретной роли",
      "scenarioLead": "Двенадцать ролей используют общую версию фактов; переключение меняет только доступное действие.",
      "labels": {
        "see": "Что видит",
        "do": "Что делает",
        "get": "Что получает"
      }
    },
    "tai": {
      "eyebrow": "Transparent Agro Intelligence",
      "title": "TAI — интеллектуальный слой конкретной Сделки",
      "lead": "Он понимает роли, этапы, документы и правила платформы. Ответ разделяет факт, вывод, риск и недостающие данные.",
      "capabilities": [
        {
          "title": "Эксперт по платформе",
          "text": "Объясняет процесс, роль, доступное действие и ограничения."
        },
        {
          "title": "Анализ Сделки",
          "text": "Находит отклонение, зависимость, ответственного и влияние."
        },
        {
          "title": "Документы и качество",
          "text": "Сопоставляет договор, версии, протоколы и события."
        },
        {
          "title": "Риски и следующий шаг",
          "text": "Показывает варианты и воздерживается при нехватке данных."
        }
      ],
      "principles": [
        "Показывает источник, дату и уверенность.",
        "Работает только в пределах прав текущей роли.",
        "Не меняет Сделку и не действует без подтверждения."
      ],
      "analysisLabel": "TAI · анализ Сделки",
      "state": "Высокая уверенность · демонстрационный сценарий",
      "rows": [
        {
          "label": "Факт",
          "value": "Протокол лаборатории: белок 11,2%. Договор: не менее 12,0%."
        },
        {
          "label": "Вывод",
          "value": "Результат не соответствует условию приёмки по текущей версии договора."
        },
        {
          "label": "Риск",
          "value": "Готовность расчёта нельзя подтвердить до решения уполномоченного участника."
        },
        {
          "label": "Следующий шаг",
          "value": "Покупателю: пересчёт, повторная проверка или открытие разногласия."
        }
      ],
      "sources": [
        "Договор · версия 4",
        "Протокол №318 · версия 2",
        "Событие приёмки"
      ],
      "limit": "Граница: TAI не определяет качество вместо лаборатории, не меняет договор, не разрешает платёж и не выносит юридическое решение.",
      "cta": "Посмотреть TAI подробнее",
      "sourcesLabel": "Источники"
    },
    "trust": {
      "eyebrow": "Доверие и контроль",
      "title": "Безопасность и интеграции объяснены без технического тумана",
      "lead": "Бизнес видит, кто имеет доступ, кто может действовать, как сохраняется история и что происходит при ошибке внешней системы.",
      "items": [
        {
          "title": "Ролевой доступ",
          "text": "Участник видит только доступные данные и действия."
        },
        {
          "title": "Проверяемая история",
          "text": "Решения, основания и версии сохраняются в Сделке."
        },
        {
          "title": "Честные ошибки интеграций",
          "text": "Недоставленное событие не превращается в подтверждённый факт."
        },
        {
          "title": "Границы полномочий",
          "text": "TAI и внешняя система не действуют вместо участника."
        }
      ],
      "integrationTitle": "Статусы интеграций",
      "statusBadge": "Без fake-live",
      "headers": [
        "Система",
        "Сценарий",
        "Честная граница",
        "Публичный статус"
      ],
      "integrations": [
        {
          "system": "ERP / 1С",
          "scenario": "Данные Сделки и документы",
          "boundary": "Нужны API и настройка конкретной организации",
          "status": "Подтверждается при подключении"
        },
        {
          "system": "Логистика",
          "scenario": "Рейс и события перевозки",
          "boundary": "Источник статуса остаётся у логистической системы",
          "status": "По выбранному партнёру"
        },
        {
          "system": "Лаборатория",
          "scenario": "Протокол качества",
          "boundary": "TAI не заменяет измерение и подпись лаборатории",
          "status": "Требует адаптера"
        },
        {
          "system": "Банк",
          "scenario": "События финансового сценария",
          "boundary": "Платёж выполняет только уполномоченная финансовая система",
          "status": "Требует отдельного подключения"
        }
      ],
      "metrics": [
        {
          "value": "12",
          "label": "ролей в одном контуре"
        },
        {
          "value": "19",
          "label": "этапов полной модели Сделки"
        },
        {
          "value": "3",
          "label": "языка интерфейса"
        }
      ],
      "architectureNote": "Целевой российский контур: private cloud и on-premise без обязательной зависимости от зарубежных AI API. Эксплуатационная зрелость и интеграции подтверждаются только фактическими результатами.",
      "ladderTitle": "Лестница доказательств",
      "ladder": [
        "Реализовано",
        "Проверено",
        "Интегрировано",
        "Подключено",
        "Эксплуатируется",
        "Измерен эффект"
      ],
      "publicationRule": "Ни один уровень нельзя подменять другим: локальный тест не становится production-результатом, а «готово к настройке» — статусом «подключено».",
      "cta": "Обсудить подключение"
    },
    "faq": {
      "eyebrow": "Коротко о главном",
      "title": "Частые вопросы",
      "items": [
        {
          "question": "Это marketplace или система исполнения?",
          "answer": "Платформа включает согласование условий, но её ключевая задача — провести Сделку через поставку, качество, документы, решение отклонений и готовность расчёта."
        },
        {
          "question": "Нужно ли заменять 1С и другие системы?",
          "answer": "Нет. Прозрачная Цена связывает действия существующих систем вокруг единого объекта Сделки и честно показывает статус интеграции."
        },
        {
          "question": "Кто принимает окончательные решения?",
          "answer": "Только уполномоченный участник или подключённая система в пределах согласованного сценария. TAI объясняет, но не подменяет полномочия."
        },
        {
          "question": "Как подключаются участники?",
          "answer": "Сначала определяется задача и роль организации, затем участники и интеграции, после чего формируется план подключения."
        }
      ]
    }
  },
  "en": {
    "nav": {
      "difference": "Why it is different",
      "functions": "Capabilities",
      "deal": "Deal in action",
      "roles": "Value by role",
      "tai": "TAI",
      "trust": "Trust"
    },
    "heroDeal": {
      "sampleLabel": "Demonstration scenario",
      "product": "Wheat · 1,200 tonnes",
      "route": "Krasnodar Krai → Rostov Oblast",
      "status": "In execution",
      "stageLabel": "Current stage",
      "stage": "Acceptance and quality",
      "deviationLabel": "Deviation",
      "deviation": "Protein result is below the contract requirement",
      "ownerLabel": "Responsible party",
      "owner": "Buyer",
      "actionLabel": "Next step",
      "action": "Confirm recalculation or open a discrepancy",
      "settlementLabel": "Settlement readiness",
      "settlement": "Awaiting a decision",
      "proof": "Actions, documents and decisions remain in one verifiable Deal history."
    },
    "proof": [
      {
        "label": "One object",
        "text": "Every event is linked to the same Deal"
      },
      {
        "label": "Role-based access",
        "text": "Each participant sees only permitted actions"
      },
      {
        "label": "Verifiable history",
        "text": "Each decision is tied to a participant and evidence"
      },
      {
        "label": "TAI in the process",
        "text": "AI finds deviations without taking over authority"
      }
    ],
    "difference": {
      "eyebrow": "Key difference",
      "title": "A marketplace helps parties agree. Transparent Price helps them execute",
      "lead": "This compares product models, not a named competitor. Work does not stop after a counterparty and price are selected.",
      "headers": [
        "Criterion",
        "Typical catalogue / marketplace",
        "Transparent Price"
      ],
      "rows": [
        {
          "criterion": "Primary outcome",
          "typical": "Contact between parties and agreed terms.",
          "platform": "An executed and closed Deal with a verifiable history."
        },
        {
          "criterion": "Managed object",
          "typical": "Listing, request or order.",
          "platform": "Terms, roles, events, documents and decisions of one Deal."
        },
        {
          "criterion": "After price selection",
          "typical": "Work moves to email, spreadsheets and external systems.",
          "platform": "Delivery, acceptance, quality, documents, dispute and settlement readiness continue in one process."
        },
        {
          "criterion": "Accountability",
          "typical": "Often established outside the system.",
          "platform": "A deviation is tied to its owner, evidence, deadline and permitted action."
        },
        {
          "criterion": "AI",
          "typical": "Search, recommendations or a general chat.",
          "platform": "TAI analyses a specific Deal, its sources and role constraints."
        },
        {
          "criterion": "Evidence",
          "typical": "Messages and separate files.",
          "platform": "Versions, events, decisions and supporting grounds stay linked to one Deal."
        }
      ],
      "boundary": "The platform does not claim to replace ERP, banking, laboratory or logistics systems. It connects their actions around one Deal object.",
      "moreLabel": "Show all differences"
    },
    "functions": {
      "eyebrow": "Platform capabilities",
      "title": "Every critical stage of an agricultural Deal in one operating system",
      "lead": "Eight capability groups are organised around the outcome of Deal execution, not a catalogue of modules.",
      "items": [
        {
          "index": "01",
          "title": "Price",
          "text": "Offers, admission rules and bidding.",
          "result": "Commercial terms are fixed."
        },
        {
          "index": "02",
          "title": "Deal",
          "text": "Contract, roles, term versions and authority.",
          "result": "Each participant has clear obligations."
        },
        {
          "index": "03",
          "title": "Delivery",
          "text": "Request, transport, route, driver and control points.",
          "result": "A confirmed history of lot movement."
        },
        {
          "index": "04",
          "title": "Acceptance",
          "text": "Weight, quality, laboratory, discrepancies and rechecks.",
          "result": "A verifiable execution outcome."
        },
        {
          "index": "05",
          "title": "Documents",
          "text": "Links to events and lots, versions, completeness and signatures.",
          "result": "Evidence is not lost in correspondence."
        },
        {
          "index": "06",
          "title": "Money",
          "text": "Financial scenario, holds, partial settlement, returns and reconciliation.",
          "result": "It is clear what enables or blocks settlement readiness."
        },
        {
          "index": "07",
          "title": "Dispute",
          "text": "Party positions, evidence, deadlines and decisions.",
          "result": "The dispute is reviewed against one version of facts."
        },
        {
          "index": "08",
          "title": "Control",
          "text": "TAI, analytics, API, ERP/1C, logistics, laboratories and finance.",
          "result": "Unified control without replacing existing systems."
        }
      ],
      "summaryTitle": "One Deal connects all capabilities",
      "summaryText": "A delivery event changes acceptance, documents, risk, the permitted action and settlement readiness.",
      "moreLabel": "Show all 8 capabilities",
      "resultLabel": "Outcome"
    },
    "process": {
      "eyebrow": "Deal path",
      "title": "Six execution phases after price agreement",
      "lead": "The complete path does not overload the interface: the current phase, transition evidence and next step remain visible.",
      "phases": [
        {
          "index": "01",
          "title": "Terms",
          "text": "Product, volume, quality, basis and tolerance.",
          "result": "Ready to select a party."
        },
        {
          "index": "02",
          "title": "Party selection",
          "text": "Offers, bidding and price fixation.",
          "result": "Commercial terms are agreed."
        },
        {
          "index": "03",
          "title": "Obligations",
          "text": "Contract, participants, documents and financial scenario.",
          "result": "The Deal is ready for execution."
        },
        {
          "index": "04",
          "title": "Delivery",
          "text": "Transport, route, trip and events.",
          "result": "The lot is delivered."
        },
        {
          "index": "05",
          "title": "Acceptance",
          "text": "Weight, quality, laboratory and discrepancy decisions.",
          "result": "Execution outcome is confirmed."
        },
        {
          "index": "06",
          "title": "Settlement and closure",
          "text": "Settlement readiness, holds, dispute and completion of obligations.",
          "result": "The Deal is closed."
        }
      ],
      "fullPathLabel": "Complete model",
      "fullPathText": "19 stages from terms and admission through logistics, laboratory, settlement, dispute, evidence and analytics.",
      "moreLabel": "Show all 6 phases",
      "resultLabel": "Phase outcome",
      "stagesLabel": "Show all 19 stages"
    },
    "demo": {
      "eyebrow": "Deal in action",
      "title": "One process shows normal execution, a deviation and a dispute",
      "lead": "Changing the state updates facts, the responsible party, permitted actions and settlement readiness. This is a demonstration scenario.",
      "statesLabel": "Demonstration Deal state",
      "roleLabel": "Perspective",
      "role": "Buyer",
      "stageLabel": "Deal phases",
      "stages": [
        "Terms",
        "Party selection",
        "Obligations",
        "Delivery",
        "Acceptance",
        "Settlement and closure"
      ],
      "states": [
        {
          "key": "normal",
          "tab": "Normal",
          "status": "Terms fulfilled",
          "title": "Delivery confirmed",
          "summary": "Weight, quality and the document set match the agreed terms.",
          "kpis": [
            {
              "label": "Weight",
              "value": "1,200.4 t · confirmed"
            },
            {
              "label": "Protein",
              "value": "12.1% · within tolerance"
            },
            {
              "label": "Documents",
              "value": "Set confirmed"
            }
          ],
          "events": [
            {
              "meta": "Today, 09:42",
              "title": "Acceptance completed",
              "text": "Weight and lot are linked to the acceptance act."
            },
            {
              "meta": "Today, 09:51",
              "title": "Laboratory submitted the protocol",
              "text": "The result matches the current contract version."
            },
            {
              "meta": "Today, 10:03",
              "title": "Settlement evidence assembled",
              "text": "Events, documents and authority have been checked."
            }
          ],
          "actionTitle": "Ready for financial-scenario verification",
          "actionText": "The final action is performed by an authorised participant or connected financial system.",
          "actionCta": "Open the evidence"
        },
        {
          "key": "deviation",
          "tab": "Deviation",
          "status": "Decision required",
          "title": "Quality result is below the requirement",
          "summary": "Protein is 11.2% against a contractual minimum of 12.0%. The protocol and contract version have been matched.",
          "kpis": [
            {
              "label": "Deviation",
              "value": "−0.8 pp"
            },
            {
              "label": "Responsible party",
              "value": "Buyer"
            },
            {
              "label": "Settlement readiness",
              "value": "Awaiting decision"
            }
          ],
          "events": [
            {
              "meta": "Today, 10:04",
              "title": "Protocol No. 318 received",
              "text": "The result is linked to the sample and lot."
            },
            {
              "meta": "Today, 10:06",
              "title": "TAI matched the terms",
              "text": "The deviation, source and confidence are shown."
            },
            {
              "meta": "Due today",
              "title": "A permitted action is assigned",
              "text": "Recalculation, recheck or opening a discrepancy."
            }
          ],
          "actionTitle": "The decision remains with the buyer",
          "actionText": "TAI does not change the contract or authorise settlement by itself.",
          "actionCta": "Review the options"
        },
        {
          "key": "dispute",
          "tab": "Dispute / missing data",
          "status": "Insufficient confidence",
          "title": "Sources contradict each other",
          "summary": "Two protocol versions contain different results; the current document has not been confirmed.",
          "kpis": [
            {
              "label": "Versions",
              "value": "2 protocols"
            },
            {
              "label": "TAI confidence",
              "value": "Insufficient"
            },
            {
              "label": "Settlement readiness",
              "value": "Paused"
            }
          ],
          "events": [
            {
              "meta": "Today, 10:07",
              "title": "Version conflict detected",
              "text": "Neither result is hidden."
            },
            {
              "meta": "Today, 10:08",
              "title": "TAI abstained",
              "text": "Conflicting sources and missing data are shown."
            },
            {
              "meta": "Due tomorrow",
              "title": "Discrepancy procedure required",
              "text": "Parties, deadline and required evidence are assigned."
            }
          ],
          "actionTitle": "Settlement is not ready until the dispute is resolved",
          "actionText": "The system retains positions and evidence but does not make the decision automatically.",
          "actionCta": "Open the dispute"
        }
      ],
      "openDeal": "Open the complete Deal scenario"
    },
    "roles": {
      "eyebrow": "One platform for every participant",
      "title": "One version of facts — different authority and value",
      "lead": "Every participant sees the same Deal, but only their own data, responsibilities and permitted actions.",
      "groups": [
        {
          "title": "Seller",
          "subroles": "Producer · trading house",
          "see": "The lot path, documents and settlement blocker.",
          "do": "Submits a document, responds to a deviation and confirms a recalculation or position.",
          "get": "A verifiable basis for settlement readiness or pause."
        },
        {
          "title": "Buyer",
          "subroles": "Procurement · processor · agribusiness group",
          "see": "Delivery, quality, document completeness and deviation consequences.",
          "do": "Accepts the result, requests a check, confirms recalculation or opens a dispute.",
          "get": "Controlled acceptance and protection against paying for an unconfirmed result."
        },
        {
          "title": "Execution",
          "subroles": "Logistics · driver · elevator · laboratory · surveyor",
          "see": "Their trips, control points, documents and exceptions.",
          "do": "Confirms an event, submits a protocol or reports a deviation.",
          "get": "Clear accountability and proof of execution."
        },
        {
          "title": "Control and finance",
          "subroles": "Bank · operator · compliance · arbitrator · executive",
          "see": "Risk, source, decision history, SLA and authority boundaries.",
          "do": "Verifies, escalates or acts within its own authority.",
          "get": "Governed exceptions and a verifiable basis for action."
        }
      ],
      "benefits": [
        {
          "title": "Speed",
          "text": "Fewer manual hand-offs between email, spreadsheets and separate portals."
        },
        {
          "title": "Money",
          "text": "It is clear what confirms or blocks settlement readiness."
        },
        {
          "title": "Risk",
          "text": "A deviation is linked to its source before an irreversible action."
        },
        {
          "title": "Control",
          "text": "It is clear who acted, when, why and within which authority."
        }
      ],
      "scenarioTitle": "Review one Deal from a specific role",
      "scenarioLead": "Twelve roles use one version of facts; switching roles changes only the permitted action.",
      "labels": {
        "see": "What they see",
        "do": "What they do",
        "get": "What they gain"
      }
    },
    "tai": {
      "eyebrow": "Transparent Agro Intelligence",
      "title": "TAI is the intelligence layer of a specific Deal",
      "lead": "It understands platform roles, stages, documents and rules. Its answer separates facts, conclusions, risks and missing data.",
      "capabilities": [
        {
          "title": "Platform expert",
          "text": "Explains the process, role, permitted action and limitations."
        },
        {
          "title": "Deal analysis",
          "text": "Finds a deviation, dependency, responsible party and impact."
        },
        {
          "title": "Documents and quality",
          "text": "Matches contract terms, versions, protocols and events."
        },
        {
          "title": "Risks and next step",
          "text": "Shows options and abstains when data is insufficient."
        }
      ],
      "principles": [
        "Shows the source, date and confidence.",
        "Works only within the current role’s permissions.",
        "Does not change the Deal or act without confirmation."
      ],
      "analysisLabel": "TAI · Deal analysis",
      "state": "High confidence · demonstration scenario",
      "rows": [
        {
          "label": "Fact",
          "value": "Laboratory protocol: protein 11.2%. Contract: minimum 12.0%."
        },
        {
          "label": "Conclusion",
          "value": "The result does not meet the acceptance term in the current contract version."
        },
        {
          "label": "Risk",
          "value": "Settlement readiness cannot be confirmed before an authorised participant decides."
        },
        {
          "label": "Next step",
          "value": "Buyer: recalculate, request a recheck or open a discrepancy."
        }
      ],
      "sources": [
        "Contract · version 4",
        "Protocol No. 318 · version 2",
        "Acceptance event"
      ],
      "limit": "Boundary: TAI does not determine quality instead of the laboratory, change the contract, authorise payment or make a legal decision.",
      "cta": "Explore TAI",
      "sourcesLabel": "Sources"
    },
    "trust": {
      "eyebrow": "Trust and control",
      "title": "Security and integrations without technical fog",
      "lead": "Business users can see who has access, who may act, how the history is retained and what happens when an external system fails.",
      "items": [
        {
          "title": "Role-based access",
          "text": "A participant sees only permitted data and actions."
        },
        {
          "title": "Verifiable history",
          "text": "Decisions, evidence and versions remain in the Deal."
        },
        {
          "title": "Honest integration failures",
          "text": "An undelivered event never becomes a confirmed fact."
        },
        {
          "title": "Authority boundaries",
          "text": "TAI and external systems do not act instead of a participant."
        }
      ],
      "integrationTitle": "Integration statuses",
      "statusBadge": "No fake-live status",
      "headers": [
        "System",
        "Scenario",
        "Honest boundary",
        "Public status"
      ],
      "integrations": [
        {
          "system": "ERP / 1C",
          "scenario": "Deal data and documents",
          "boundary": "Requires APIs and configuration for a specific organisation",
          "status": "Confirmed during connection"
        },
        {
          "system": "Logistics",
          "scenario": "Trip and transport events",
          "boundary": "The logistics system remains the source of status",
          "status": "Depends on the selected partner"
        },
        {
          "system": "Laboratory",
          "scenario": "Quality protocol",
          "boundary": "TAI does not replace measurement or laboratory signature",
          "status": "Requires an adapter"
        },
        {
          "system": "Bank",
          "scenario": "Financial-scenario events",
          "boundary": "Payment is performed only by an authorised financial system",
          "status": "Requires a separate connection"
        }
      ],
      "metrics": [
        {
          "value": "12",
          "label": "roles in one framework"
        },
        {
          "value": "19",
          "label": "stages in the complete Deal model"
        },
        {
          "value": "3",
          "label": "interface languages"
        }
      ],
      "architectureNote": "Target Russian framework: private cloud and on-premise without mandatory dependence on foreign AI APIs. Operational maturity and integrations are stated only when supported by verified results.",
      "ladderTitle": "Evidence ladder",
      "ladder": [
        "Implemented",
        "Verified",
        "Integrated",
        "Connected",
        "In production use",
        "Measured impact"
      ],
      "publicationRule": "No level may be substituted for another: a local test is not a production result, and “ready to configure” is not “connected”.",
      "cta": "Discuss connection"
    },
    "faq": {
      "eyebrow": "The essentials",
      "title": "Frequently asked questions",
      "items": [
        {
          "question": "Is this a marketplace or an execution system?",
          "answer": "The platform includes agreement of terms, but its primary task is to carry the Deal through delivery, quality, documents, deviation handling and settlement readiness."
        },
        {
          "question": "Do we need to replace 1C and other systems?",
          "answer": "No. Transparent Price connects the actions of existing systems around one Deal object and shows the real integration status."
        },
        {
          "question": "Who makes final decisions?",
          "answer": "Only an authorised participant or connected system acting within the agreed scenario. TAI explains but does not take over authority."
        },
        {
          "question": "How are participants connected?",
          "answer": "First the organisation’s task and role are defined, then participants and integrations, after which a connection plan is prepared."
        }
      ]
    }
  },
  "zh": {
    "nav": {
      "difference": "产品差异",
      "functions": "平台能力",
      "deal": "交易运行",
      "roles": "角色价值",
      "tai": "TAI",
      "trust": "信任"
    },
    "heroDeal": {
      "sampleLabel": "演示场景",
      "product": "小麦 · 1,200 吨",
      "route": "克拉斯诺达尔边疆区 → 罗斯托夫州",
      "status": "履约中",
      "stageLabel": "当前阶段",
      "stage": "验收与质量",
      "deviationLabel": "偏差",
      "deviation": "蛋白质指标低于合同要求",
      "ownerLabel": "责任方",
      "owner": "买方",
      "actionLabel": "下一步",
      "action": "确认重算或发起异议",
      "settlementLabel": "结算准备度",
      "settlement": "等待决定",
      "proof": "操作、文件与决定保存在同一笔交易的可核验历史中。"
    },
    "proof": [
      {
        "label": "统一对象",
        "text": "所有事件都关联到同一笔交易"
      },
      {
        "label": "按角色访问",
        "text": "每个参与方只看到获准的操作"
      },
      {
        "label": "可核验历史",
        "text": "每项决定都关联参与方与依据"
      },
      {
        "label": "流程内的 TAI",
        "text": "AI 发现偏差，但不取代参与方权限"
      }
    ],
    "difference": {
      "eyebrow": "核心差异",
      "title": "撮合平台帮助达成约定，“透明价格”帮助完成履约",
      "lead": "这里比较的是产品模式，而不是某个具体竞争者。选定交易对手和价格之后，工作并未结束。",
      "headers": [
        "标准",
        "典型目录 / 撮合平台",
        "透明价格"
      ],
      "rows": [
        {
          "criterion": "主要结果",
          "typical": "双方建立联系并达成条件。",
          "platform": "交易完成并关闭，且具有可核验历史。"
        },
        {
          "criterion": "管理对象",
          "typical": "信息、申请或订单。",
          "platform": "同一笔交易的条件、角色、事件、文件与决定。"
        },
        {
          "criterion": "价格确定之后",
          "typical": "工作转移到邮件、表格和外部系统。",
          "platform": "交付、验收、质量、文件、争议与结算准备度继续处于同一流程。"
        },
        {
          "criterion": "责任",
          "typical": "通常在系统外确定。",
          "platform": "偏差关联责任方、依据、期限和允许的操作。"
        },
        {
          "criterion": "AI",
          "typical": "搜索、推荐或通用聊天。",
          "platform": "TAI 分析具体交易、来源与角色限制。"
        },
        {
          "criterion": "证据",
          "typical": "消息和分散文件。",
          "platform": "版本、事件、决定与依据都关联到同一笔交易。"
        }
      ],
      "boundary": "平台不宣称取代 ERP、银行、实验室或物流系统，而是围绕统一交易对象连接这些系统的操作。",
      "moreLabel": "显示全部差异"
    },
    "functions": {
      "eyebrow": "平台功能",
      "title": "农产品交易的关键阶段位于同一工作系统",
      "lead": "八组功能围绕交易履约结果组织，而不是简单罗列模块。",
      "items": [
        {
          "index": "01",
          "title": "价格",
          "text": "报价、准入条件与竞价。",
          "result": "商业条件得到固定。"
        },
        {
          "index": "02",
          "title": "交易",
          "text": "合同、角色、条件版本与权限。",
          "result": "每个参与方的义务清晰。"
        },
        {
          "index": "03",
          "title": "交付",
          "text": "申请、运输、路线、司机与控制点。",
          "result": "形成批次移动的确认历史。"
        },
        {
          "index": "04",
          "title": "验收",
          "text": "重量、质量、实验室、差异与复检。",
          "result": "履约结果可核验。"
        },
        {
          "index": "05",
          "title": "文件",
          "text": "关联事件和批次、版本、完整性与签名。",
          "result": "依据不会丢失在往来沟通中。"
        },
        {
          "index": "06",
          "title": "资金",
          "text": "财务场景、暂扣、部分结算、退款与对账。",
          "result": "明确什么允许或阻止结算准备。"
        },
        {
          "index": "07",
          "title": "争议",
          "text": "各方立场、证据、期限与决定。",
          "result": "基于同一版本事实审查争议。"
        },
        {
          "index": "08",
          "title": "控制",
          "text": "TAI、分析、API、ERP/1C、物流、实验室与财务。",
          "result": "统一控制而不替代现有系统。"
        }
      ],
      "summaryTitle": "同一笔交易连接所有功能",
      "summaryText": "交付事件会同步改变验收、文件、风险、允许的操作与结算准备度。",
      "moreLabel": "显示全部 8 项功能",
      "resultLabel": "结果"
    },
    "process": {
      "eyebrow": "交易路径",
      "title": "价格确定后的六个履约阶段",
      "lead": "完整路径不会使界面过载：当前阶段、流转依据与下一步始终清晰可见。",
      "phases": [
        {
          "index": "01",
          "title": "条件",
          "text": "商品、数量、质量、交付基础与容差。",
          "result": "可进入交易方选择。"
        },
        {
          "index": "02",
          "title": "选择交易方",
          "text": "报价、竞价与价格固定。",
          "result": "商业条件达成一致。"
        },
        {
          "index": "03",
          "title": "义务",
          "text": "合同、参与方、文件与财务场景。",
          "result": "交易可进入履约。"
        },
        {
          "index": "04",
          "title": "交付",
          "text": "运输、路线、车次与事件。",
          "result": "批次完成交付。"
        },
        {
          "index": "05",
          "title": "验收",
          "text": "重量、质量、实验室与差异决定。",
          "result": "履约结果得到确认。"
        },
        {
          "index": "06",
          "title": "结算与关闭",
          "text": "结算准备度、暂扣、争议与义务完成。",
          "result": "交易关闭。"
        }
      ],
      "fullPathLabel": "完整模型",
      "fullPathText": "从条件和准入，到物流、实验室、结算、争议、证据与分析，共 19 个阶段。",
      "moreLabel": "显示全部 6 个阶段",
      "resultLabel": "阶段结果",
      "stagesLabel": "显示全部 19 个阶段"
    },
    "demo": {
      "eyebrow": "交易运行",
      "title": "同一流程展示正常履约、偏差与争议",
      "lead": "切换状态会更新事实、责任方、允许的操作与结算准备度。以下为演示场景。",
      "statesLabel": "演示交易状态",
      "roleLabel": "视角",
      "role": "买方",
      "stageLabel": "交易阶段",
      "stages": [
        "条件",
        "选择交易方",
        "义务",
        "交付",
        "验收",
        "结算与关闭"
      ],
      "states": [
        {
          "key": "normal",
          "tab": "正常",
          "status": "条件已满足",
          "title": "交付已确认",
          "summary": "重量、质量与文件组合均符合已约定条件。",
          "kpis": [
            {
              "label": "重量",
              "value": "1,200.4 吨 · 已确认"
            },
            {
              "label": "蛋白质",
              "value": "12.1% · 在容差内"
            },
            {
              "label": "文件",
              "value": "组合已确认"
            }
          ],
          "events": [
            {
              "meta": "今天 09:42",
              "title": "验收完成",
              "text": "重量和批次已关联验收单。"
            },
            {
              "meta": "今天 09:51",
              "title": "实验室提交报告",
              "text": "结果符合当前合同版本。"
            },
            {
              "meta": "今天 10:03",
              "title": "结算依据已汇集",
              "text": "事件、文件与权限均已检查。"
            }
          ],
          "actionTitle": "可进入财务场景检查",
          "actionText": "最终操作由获授权参与方或已接入的金融系统执行。",
          "actionCta": "查看依据"
        },
        {
          "key": "deviation",
          "tab": "偏差",
          "status": "需要决定",
          "title": "质量指标低于要求",
          "summary": "蛋白质为 11.2%，合同最低要求为 12.0%。报告与合同版本已完成匹配。",
          "kpis": [
            {
              "label": "偏差",
              "value": "−0.8 个百分点"
            },
            {
              "label": "责任方",
              "value": "买方"
            },
            {
              "label": "结算准备度",
              "value": "等待决定"
            }
          ],
          "events": [
            {
              "meta": "今天 10:04",
              "title": "收到第 318 号报告",
              "text": "结果已关联样品和批次。"
            },
            {
              "meta": "今天 10:06",
              "title": "TAI 对照交易条件",
              "text": "偏差、来源与置信度已显示。"
            },
            {
              "meta": "今天到期",
              "title": "已指定允许的操作",
              "text": "重算、复检或发起异议。"
            }
          ],
          "actionTitle": "决定仍由买方作出",
          "actionText": "TAI 不会自行修改合同或批准结算。",
          "actionCta": "查看选项"
        },
        {
          "key": "dispute",
          "tab": "争议 / 数据不足",
          "status": "置信度不足",
          "title": "不同来源相互矛盾",
          "summary": "两个报告版本包含不同结果，当前有效文件尚未确认。",
          "kpis": [
            {
              "label": "版本",
              "value": "2 份报告"
            },
            {
              "label": "TAI 置信度",
              "value": "不足"
            },
            {
              "label": "结算准备度",
              "value": "已暂停"
            }
          ],
          "events": [
            {
              "meta": "今天 10:07",
              "title": "发现版本冲突",
              "text": "任何结果都不会被隐藏。"
            },
            {
              "meta": "今天 10:08",
              "title": "TAI 保留结论",
              "text": "冲突来源和缺失数据已显示。"
            },
            {
              "meta": "明天到期",
              "title": "需要启动异议程序",
              "text": "参与方、期限与证据清单已指定。"
            }
          ],
          "actionTitle": "争议解决前不可确认结算准备",
          "actionText": "系统保存各方立场与证据，但不会自动作出决定。",
          "actionCta": "打开争议"
        }
      ],
      "openDeal": "打开完整交易场景"
    },
    "roles": {
      "eyebrow": "所有参与方共用一个平台",
      "title": "同一版本事实，不同权限与价值",
      "lead": "每个参与方看到同一笔交易，但只看到自身数据、责任与允许的操作。",
      "groups": [
        {
          "title": "卖方",
          "subroles": "生产者 · 贸易公司",
          "see": "批次路径、文件与结算阻塞项。",
          "do": "提交文件、回应偏差并确认重算或立场。",
          "get": "结算准备或暂停的可核验依据。"
        },
        {
          "title": "买方",
          "subroles": "采购方 · 加工企业 · 农业集团",
          "see": "交付、质量、文件完整性与偏差影响。",
          "do": "接受结果、请求复检、确认重算或发起争议。",
          "get": "受控验收，并避免为未经确认的结果付款。"
        },
        {
          "title": "履约",
          "subroles": "物流 · 司机 · 粮库 · 实验室 · 检验机构",
          "see": "自身车次、控制点、文件与异常。",
          "do": "确认事件、提交报告或上报偏差。",
          "get": "清晰责任与履约证明。"
        },
        {
          "title": "控制与财务",
          "subroles": "银行 · 运营 · 合规 · 仲裁 · 管理层",
          "see": "风险、来源、决定历史、SLA 与权限边界。",
          "do": "核验、升级处理或在自身权限内操作。",
          "get": "受控异常处理和可核验操作依据。"
        }
      ],
      "benefits": [
        {
          "title": "速度",
          "text": "减少在邮件、表格与不同系统之间的人工交接。"
        },
        {
          "title": "资金",
          "text": "明确什么确认或阻止结算准备。"
        },
        {
          "title": "风险",
          "text": "在不可逆操作之前，将偏差关联到其来源。"
        },
        {
          "title": "控制",
          "text": "明确谁在何时、为何并在何种权限范围内进行了操作。"
        }
      ],
      "scenarioTitle": "从具体角色查看同一笔交易",
      "scenarioLead": "十二种角色共用同一版本事实；切换角色只改变允许的操作。",
      "labels": {
        "see": "查看内容",
        "do": "执行操作",
        "get": "获得价值"
      }
    },
    "tai": {
      "eyebrow": "Transparent Agro Intelligence",
      "title": "TAI 是具体交易的智能层",
      "lead": "它理解平台角色、阶段、文件与规则，并在回答中区分事实、结论、风险与缺失数据。",
      "capabilities": [
        {
          "title": "平台专家",
          "text": "解释流程、角色、允许的操作与限制。"
        },
        {
          "title": "交易分析",
          "text": "发现偏差、依赖关系、责任方与影响。"
        },
        {
          "title": "文件与质量",
          "text": "对照合同条件、版本、报告与事件。"
        },
        {
          "title": "风险与下一步",
          "text": "展示选项，并在数据不足时保留结论。"
        }
      ],
      "principles": [
        "显示来源、日期与置信度。",
        "只在当前角色权限范围内工作。",
        "未经确认不会修改交易或执行操作。"
      ],
      "analysisLabel": "TAI · 交易分析",
      "state": "高置信度 · 演示场景",
      "rows": [
        {
          "label": "事实",
          "value": "实验室报告：蛋白质 11.2%。合同：不低于 12.0%。"
        },
        {
          "label": "结论",
          "value": "当前结果不符合现行合同版本的验收条件。"
        },
        {
          "label": "风险",
          "value": "获授权参与方作出决定前，不能确认结算准备度。"
        },
        {
          "label": "下一步",
          "value": "买方：重算、请求复检或发起异议。"
        }
      ],
      "sources": [
        "合同 · 第 4 版",
        "第 318 号报告 · 第 2 版",
        "验收事件"
      ],
      "limit": "边界：TAI 不代替实验室确定质量，不修改合同，不批准付款，也不作出法律决定。",
      "cta": "进一步了解 TAI",
      "sourcesLabel": "来源"
    },
    "trust": {
      "eyebrow": "信任与控制",
      "title": "以清晰业务语言说明安全与集成",
      "lead": "业务用户可以看到谁有访问权、谁可以操作、历史如何保存，以及外部系统发生错误时如何处理。",
      "items": [
        {
          "title": "按角色访问",
          "text": "参与方只看到获准的数据与操作。"
        },
        {
          "title": "可核验历史",
          "text": "决定、依据与版本保存在交易中。"
        },
        {
          "title": "真实呈现集成错误",
          "text": "未送达事件不会被显示为已确认事实。"
        },
        {
          "title": "权限边界",
          "text": "TAI 和外部系统不会代替参与方操作。"
        }
      ],
      "integrationTitle": "集成状态",
      "statusBadge": "无虚假在线状态",
      "headers": [
        "系统",
        "场景",
        "真实边界",
        "公开状态"
      ],
      "integrations": [
        {
          "system": "ERP / 1C",
          "scenario": "交易数据与文件",
          "boundary": "需要针对具体机构配置 API",
          "status": "接入时确认"
        },
        {
          "system": "物流",
          "scenario": "车次与运输事件",
          "boundary": "物流系统仍是状态来源",
          "status": "取决于选定合作方"
        },
        {
          "system": "实验室",
          "scenario": "质量报告",
          "boundary": "TAI 不替代测量和实验室签名",
          "status": "需要适配器"
        },
        {
          "system": "银行",
          "scenario": "财务场景事件",
          "boundary": "付款只能由获授权金融系统执行",
          "status": "需要单独接入"
        }
      ],
      "metrics": [
        {
          "value": "12",
          "label": "个角色位于统一闭环"
        },
        {
          "value": "19",
          "label": "个完整交易阶段"
        },
        {
          "value": "3",
          "label": "种界面语言"
        }
      ],
      "architectureNote": "目标俄罗斯技术闭环：支持私有云与本地部署，不强制依赖境外 AI API。运行成熟度与集成仅在取得可核验结果后说明。",
      "ladderTitle": "证据等级",
      "ladder": [
        "已实现",
        "已验证",
        "已集成",
        "已接入",
        "生产使用中",
        "效果已测量"
      ],
      "publicationRule": "不得用一个等级替代另一个等级：本地测试不等于生产结果，“可配置”也不等于“已接入”。",
      "cta": "讨论机构接入"
    },
    "faq": {
      "eyebrow": "核心问题",
      "title": "常见问题",
      "items": [
        {
          "question": "这是撮合平台还是履约系统？",
          "answer": "平台包含条件协商，但核心任务是让交易继续经过交付、质量、文件、偏差处理与结算准备。"
        },
        {
          "question": "需要替换 1C 和其他系统吗？",
          "answer": "不需要。“透明价格”围绕统一交易对象连接现有系统的操作，并如实显示集成状态。"
        },
        {
          "question": "谁作出最终决定？",
          "answer": "只有获授权参与方或已接入系统可在约定场景内作出决定。TAI 负责解释，但不会取代权限。"
        },
        {
          "question": "如何接入参与方？",
          "answer": "首先确定机构任务与角色，再确定参与方和集成范围，随后形成接入计划。"
        }
      ]
    }
  }
} as const;

export type PlatformV7HomeStoryCopy = WidenCopy<(typeof copies)['ru']>;

export function getPlatformV7HomeStoryCopy(locale: string): PlatformV7HomeStoryCopy {
  return (locale === 'en' ? copies.en : locale === 'zh' ? copies.zh : copies.ru) as PlatformV7HomeStoryCopy;
}
