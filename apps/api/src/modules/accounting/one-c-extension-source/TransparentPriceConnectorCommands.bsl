// Прозрачная Цена — строгий диспетчер команд connector protocol v1.
//
// Здесь нет Выполнить(), Вычислить(), SQL, произвольного имени метода или доступа
// "ко всем данным". Команда сравнивается с семью строковыми константами и только
// затем вызывает заранее известную функцию configuration adapter.

Функция РазрешенныеКоманды() Экспорт
    Команды = Новый Массив;
    Команды.Добавить("UPSERT_COUNTERPARTY");
    Команды.Добавить("CREATE_SALES_DRAFT");
    Команды.Добавить("CREATE_PURCHASE_DRAFT");
    Команды.Добавить("CREATE_CORRECTION_DRAFT");
    Команды.Добавить("GET_DOCUMENT_STATUS");
    Команды.Добавить("PUSH_PAYMENT_STATUS");
    Команды.Добавить("GET_REFERENCE_CANDIDATES");
    Возврат Команды;
КонецФункции

Функция Поле(Объект, ИмяПоля, ЗначениеПоУмолчанию = Неопределено)
    Если Объект = Неопределено Тогда
        Возврат ЗначениеПоУмолчанию;
    КонецЕсли;

    Если ТипЗнч(Объект) = Тип("Структура") Тогда
        Значение = Неопределено;
        Если Объект.Свойство(ИмяПоля, Значение) Тогда
            Возврат Значение;
        КонецЕсли;
        Возврат ЗначениеПоУмолчанию;
    КонецЕсли;

    Если ТипЗнч(Объект) = Тип("Соответствие") Тогда
        Значение = Объект.Получить(ИмяПоля);
        Если Значение = Неопределено Тогда
            Возврат ЗначениеПоУмолчанию;
        КонецЕсли;
        Возврат Значение;
    КонецЕсли;

    Возврат ЗначениеПоУмолчанию;
КонецФункции

Функция НовыйРезультатКоманды(Outcome, ResultCode, ExternalEvidenceId = "")
    Результат = Новый Структура;
    Результат.Вставить("outcome", Outcome);
    Результат.Вставить("resultCode", ResultCode);
    Результат.Вставить("externalEvidenceId", ExternalEvidenceId);
    Возврат Результат;
КонецФункции

Функция БезопасныйКод(Код) Экспорт
    Если ТипЗнч(Код) <> Тип("Строка") Тогда
        Возврат "CONNECTOR_ERROR";
    КонецЕсли;

    Код = ВРег(СокрЛП(Код));
    Если ПустаяСтрока(Код) Или СтрДлина(Код) > 96 Тогда
        Возврат "CONNECTOR_ERROR";
    КонецЕсли;

    Допустимые = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.:-";
    Для Номер = 1 По СтрДлина(Код) Цикл
        Если СтрНайти(Допустимые, Сред(Код, Номер, 1)) = 0 Тогда
            Возврат "CONNECTOR_ERROR";
        КонецЕсли;
    КонецЦикла;

    Возврат Код;
КонецФункции

Функция ПроверитьЗадание(Job) Экспорт
    Обязательные = Новый Массив;
    Обязательные.Добавить("id");
    Обязательные.Добавить("command");
    Обязательные.Добавить("payload");
    Обязательные.Добавить("idempotencyKey");
    Обязательные.Добавить("correlationId");
    Обязательные.Добавить("organizationId");
    Обязательные.Добавить("connectionId");
    Обязательные.Добавить("revision");
    Обязательные.Добавить("attempt");
    Обязательные.Добавить("lease");

    Для Каждого Имя Из Обязательные Цикл
        Если Поле(Job, Имя, Неопределено) = Неопределено Тогда
            Возврат НовыйРезультатКоманды("UNKNOWN_RESULT", "MALFORMED_JOB");
        КонецЕсли;
    КонецЦикла;

    Команда = Поле(Job, "command", "");
    Если РазрешенныеКоманды().Найти(Команда) = Неопределено Тогда
        Возврат НовыйРезультатКоманды("BUSINESS_REJECTION", "COMMAND_NOT_ALLOWED");
    КонецЕсли;

    Если ПустаяСтрока(Поле(Job, "idempotencyKey", ""))
        Или ПустаяСтрока(Поле(Job, "correlationId", ""))
        Или ПустаяСтрока(Поле(Job, "organizationId", ""))
        Или ПустаяСтрока(Поле(Job, "connectionId", ""))
        Или ПустаяСтрока(Поле(Job, "lease", "")) Тогда
        Возврат НовыйРезультатКоманды("UNKNOWN_RESULT", "MALFORMED_JOB");
    КонецЕсли;

    Возврат НовыйРезультатКоманды("REPORTED_SUCCESS", "JOB_SHAPE_VALID", "shape-only");
КонецФункции

Функция ВыполнитьТипизированнуюКоманду(Job) Экспорт
    Проверка = ПроверитьЗадание(Job);
    Если Проверка.outcome <> "REPORTED_SUCCESS" Тогда
        Возврат Проверка;
    КонецЕсли;

    Команда = Поле(Job, "command", "");
    Payload = Поле(Job, "payload", Неопределено);

    // Только статические вызовы. Ни имя модуля, ни имя функции не берётся из Job.
    Если Команда = "UPSERT_COUNTERPARTY" Тогда
        Возврат TransparentPriceConfigurationAdapter.ОбновитьКонтрагента(Payload);
    ИначеЕсли Команда = "CREATE_SALES_DRAFT" Тогда
        Возврат TransparentPriceConfigurationAdapter.СоздатьЧерновикПродажи(Payload);
    ИначеЕсли Команда = "CREATE_PURCHASE_DRAFT" Тогда
        Возврат TransparentPriceConfigurationAdapter.СоздатьЧерновикПокупки(Payload);
    ИначеЕсли Команда = "CREATE_CORRECTION_DRAFT" Тогда
        Возврат TransparentPriceConfigurationAdapter.СоздатьЧерновикИсправления(Payload);
    ИначеЕсли Команда = "GET_DOCUMENT_STATUS" Тогда
        Возврат TransparentPriceConfigurationAdapter.ПолучитьСтатусДокумента(Payload);
    ИначеЕсли Команда = "PUSH_PAYMENT_STATUS" Тогда
        Возврат TransparentPriceConfigurationAdapter.ПередатьСтатусОплаты(Payload);
    ИначеЕсли Команда = "GET_REFERENCE_CANDIDATES" Тогда
        Возврат TransparentPriceConfigurationAdapter.ПолучитьКандидатовСправочника(Payload);
    КонецЕсли;

    // Недостижимо при согласованной ПроверитьЗадание(), но default fail-closed.
    Возврат НовыйРезультатКоманды("BUSINESS_REJECTION", "COMMAND_NOT_ALLOWED");
КонецФункции

Функция ВыполнитьОдинЦикл(Bearer) Экспорт
    ЦиклРезультат = Новый Структура;
    ЦиклРезультат.Вставить("processed", 0);
    ЦиклРезультат.Вставить("unknown", 0);
    ЦиклРезультат.Вставить("rejected", 0);
    ЦиклРезультат.Вставить("transport", "");

    Если ПустаяСтрока(Bearer) Тогда
        ЦиклРезультат.transport = "MACHINE_CREDENTIAL_MISSING";
        Возврат ЦиклРезультат;
    КонецЕсли;

    Получение = TransparentPriceConnectorHttp.ПолучитьЗадания(Bearer);
    Если Получение.Состояние <> "HTTP_OK" Тогда
        ЦиклРезультат.transport = Получение.Состояние;
        Возврат ЦиклРезультат;
    КонецЕсли;

    Jobs = Поле(Получение.Ответ, "jobs", Неопределено);
    Если ТипЗнч(Jobs) <> Тип("Массив") Тогда
        ЦиклРезультат.transport = "MALFORMED_JOBS_RESPONSE";
        Возврат ЦиклРезультат;
    КонецЕсли;

    Для Каждого Job Из Jobs Цикл
        JobId = Поле(Job, "id", "");
        CorrelationId = Поле(Job, "correlationId", "");
        LeaseBearer = Поле(Job, "lease", "");

        Проверка = ПроверитьЗадание(Job);
        Если Проверка.outcome <> "REPORTED_SUCCESS" Тогда
            // Если job shape не позволяет безопасно назвать id/lease, не делаем
            // никакой terminal mutation и ждём серверной lease expiry/reconciliation.
            ЦиклРезультат.unknown = ЦиклРезультат.unknown + 1;
            Продолжить;
        КонецЕсли;

        Ack = TransparentPriceConnectorHttp.ПодтвердитьЗадание(
            Bearer, JobId, LeaseBearer, CorrelationId);
        Если Ack.Состояние <> "HTTP_OK" Тогда
            // Без ACK connector не начинает бизнес-операцию: иначе сервер может
            // одновременно выдать тот же lease другому worker'у.
            ЦиклРезультат.unknown = ЦиклРезультат.unknown + 1;
            Продолжить;
        КонецЕсли;

        Попытка
            КомандныйРезультат = ВыполнитьТипизированнуюКоманду(Job);
        Исключение
            КомандныйРезультат = НовыйРезультатКоманды(
                "UNKNOWN_RESULT", "CONFIGURATION_ADAPTER_EXCEPTION");
        КонецПопытки;

        Outcome = Поле(КомандныйРезультат, "outcome", "UNKNOWN_RESULT");
        ResultCode = БезопасныйКод(Поле(КомандныйРезультат, "resultCode", "CONNECTOR_ERROR"));
        ExternalEvidenceId = Поле(КомандныйРезультат, "externalEvidenceId", "");

        Если Outcome = "REPORTED_SUCCESS" Тогда
            // HTTP 200 от 1С-локального кода не является доказательством. Typed
            // adapter обязан вернуть id реально созданного/найденного объекта 1С.
            Если ПустаяСтрока(ExternalEvidenceId) Тогда
                Outcome = "UNKNOWN_RESULT";
                ResultCode = "EXTERNAL_EVIDENCE_MISSING";
            Иначе
                Отчет = TransparentPriceConnectorHttp.ОтправитьРезультатЗадания(
                    Bearer,
                    JobId,
                    LeaseBearer,
                    ExternalEvidenceId,
                    ResultCode,
                    CorrelationId);
                Если Отчет.Состояние = "HTTP_OK" Тогда
                    ЦиклРезультат.processed = ЦиклРезультат.processed + 1;
                Иначе
                    // Повтор terminal report должен использовать тот же lease и
                    // server idempotency; локально не объявляем успех до ответа.
                    ЦиклРезультат.unknown = ЦиклРезультат.unknown + 1;
                КонецЕсли;
                Продолжить;
            КонецЕсли;
        КонецЕсли;

        Если Outcome = "BUSINESS_REJECTION" Тогда
            Отчет = TransparentPriceConnectorHttp.ОтправитьОтказЗадания(
                Bearer,
                JobId,
                LeaseBearer,
                "BUSINESS_REJECTION",
                ResultCode,
                CorrelationId);
            Если Отчет.Состояние = "HTTP_OK" Тогда
                ЦиклРезультат.rejected = ЦиклРезультат.rejected + 1;
            Иначе
                ЦиклРезультат.unknown = ЦиклРезультат.unknown + 1;
            КонецЕсли;
        Иначе
            Отчет = TransparentPriceConnectorHttp.ОтправитьОтказЗадания(
                Bearer,
                JobId,
                LeaseBearer,
                "UNKNOWN_RESULT",
                ResultCode,
                CorrelationId);
            ЦиклРезультат.unknown = ЦиклРезультат.unknown + 1;
        КонецЕсли;
    КонецЦикла;

    ЦиклРезультат.transport = "DONE";
    Возврат ЦиклРезультат;
КонецФункции
