// Прозрачная Цена — строгий диспетчер connector protocol v1.
//
// Команда сравнивается только с семью строковыми константами и вызывает только
// заранее известную функцию configuration adapter. Выполнить(), Вычислить(),
// SQL, произвольное имя модуля/метода и широкий доступ к данным отсутствуют.

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
        Возврат ?(Значение = Неопределено, ЗначениеПоУмолчанию, Значение);
    КонецЕсли;
    Возврат ЗначениеПоУмолчанию;
КонецФункции

Функция НовыйРезультатКоманды(Outcome, ResultCode, ExternalEvidenceId = "", ResultState = "", FailureClass = "", EffectState = "")
    Результат = Новый Структура;
    Результат.Вставить("outcome", Outcome);
    Результат.Вставить("resultCode", ResultCode);
    Результат.Вставить("externalEvidenceId", ExternalEvidenceId);
    Результат.Вставить("resultState", ResultState);
    Результат.Вставить("failureClass", FailureClass);
    Результат.Вставить("effectState", EffectState);
    Возврат Результат;
КонецФункции

Функция БезопасныйКод(Код) Экспорт
    Безопасный = TransparentPriceConnectorHttp.БезопасныйМашинныйКод(Код);
    Возврат ?(ПустаяСтрока(Безопасный), "CONNECTOR_ERROR", Безопасный);
КонецФункции

Функция КлючКвитанции(LeaseBearer, ВидКвитанции) Экспорт
    БезопасныйLease = TransparentPriceConnectorHttp.БезопасныйLeaseBearer(LeaseBearer);
    Если БезопасныйLease = Неопределено
        Или ПустаяСтрока(БезопасныйLease)
        Или (ВидКвитанции <> "ack"
            И ВидКвитанции <> "result"
            И ВидКвитанции <> "fail") Тогда
        Возврат "";
    КонецЕсли;
    // Lease UUID уникален для попытки, поэтому ключ детерминирован и стабилен
    // при повторе после неоднозначного сетевого результата.
    Возврат "one-c:" + Лев(БезопасныйLease, 36) + ":" + ВидКвитанции;
КонецФункции

Функция ПроверитьЗадание(Job) Экспорт
    Обязательные = Новый Массив;
    Обязательные.Добавить("id");
    Обязательные.Добавить("command");
    Обязательные.Добавить("payload");
    Обязательные.Добавить("payloadHash");
    Обязательные.Добавить("idempotencyKey");
    Обязательные.Добавить("correlationId");
    Обязательные.Добавить("organizationId");
    Обязательные.Добавить("connectionId");
    Обязательные.Добавить("revision");
    Обязательные.Добавить("attempt");
    Обязательные.Добавить("leaseBearer");
    Обязательные.Добавить("leaseExpiresAt");

    Для Каждого Имя Из Обязательные Цикл
        Если Поле(Job, Имя, Неопределено) = Неопределено Тогда
            Возврат НовыйРезультатКоманды("UNKNOWN_RESULT", "MALFORMED_JOB");
        КонецЕсли;
    КонецЦикла;

    Команда = Поле(Job, "command", "");
    Если РазрешенныеКоманды().Найти(Команда) = Неопределено Тогда
        Возврат НовыйРезультатКоманды(
            "BUSINESS_REJECTION", "COMMAND_NOT_ALLOWED", "", "",
            "BUSINESS_REJECTION", "CONFIRMED_NO_EFFECT");
    КонецЕсли;
    Payload = Поле(Job, "payload", Неопределено);
    Если ТипЗнч(Payload) <> Тип("Структура")
        И ТипЗнч(Payload) <> Тип("Соответствие") Тогда
        Возврат НовыйРезультатКоманды("UNKNOWN_RESULT", "MALFORMED_JOB");
    КонецЕсли;

    Если ПустаяСтрока(TransparentPriceConnectorHttp.БезопасныйИдентификаторURL(Поле(Job, "id", "")))
        Или ПустаяСтрока(TransparentPriceConnectorHttp.БезопасныйИдентификатор(Поле(Job, "idempotencyKey", ""), 240))
        Или ПустаяСтрока(TransparentPriceConnectorHttp.БезопасныйИдентификатор(Поле(Job, "correlationId", ""), 128))
        Или ПустаяСтрока(TransparentPriceConnectorHttp.БезопасныйИдентификатор(Поле(Job, "organizationId", ""), 240))
        Или ПустаяСтрока(TransparentPriceConnectorHttp.БезопасныйИдентификатор(Поле(Job, "connectionId", ""), 240))
        Или ПустаяСтрока(TransparentPriceConnectorHttp.БезопасныйPayloadHash(Поле(Job, "payloadHash", "")))
        Или ПустаяСтрока(TransparentPriceConnectorHttp.БезопасныйLeaseBearer(Поле(Job, "leaseBearer", ""))) Тогда
        Возврат НовыйРезультатКоманды("UNKNOWN_RESULT", "MALFORMED_JOB");
    КонецЕсли;

    Если TransparentPriceConnectorHttp.БезопасноеЦелое(
        Поле(Job, "revision", Неопределено), 9007199254740991) = Неопределено
        Или TransparentPriceConnectorHttp.БезопасноеЦелое(
            Поле(Job, "attempt", Неопределено), 100) = Неопределено Тогда
        Возврат НовыйРезультатКоманды("UNKNOWN_RESULT", "MALFORMED_JOB");
    КонецЕсли;
    LeaseExpiresAt = Поле(Job, "leaseExpiresAt", "");
    Если ТипЗнч(LeaseExpiresAt) <> Тип("Строка")
        Или СтрДлина(LeaseExpiresAt) < 20
        Или СтрДлина(LeaseExpiresAt) > 40
        Или СтрНайти(LeaseExpiresAt, "T") = 0 Тогда
        Возврат НовыйРезультатКоманды("UNKNOWN_RESULT", "LEASE_EXPIRY_INVALID");
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
    Возврат НовыйРезультатКоманды(
        "BUSINESS_REJECTION", "COMMAND_NOT_ALLOWED", "", "",
        "BUSINESS_REJECTION", "CONFIRMED_NO_EFFECT");
КонецФункции

Функция ПовторитьACKПриНеизвестном(Ack, Bearer, JobId, LeaseBearer, IdempotencyKey, PayloadHash, Revision, Attempt, CorrelationId)
    Если Ack.Состояние = "UNKNOWN_RESULT" Или Ack.Состояние = "TRANSIENT_FAILURE" Тогда
        Возврат TransparentPriceConnectorHttp.ПодтвердитьЗадание(
            Bearer, JobId, LeaseBearer, IdempotencyKey, PayloadHash,
            Revision, Attempt, CorrelationId);
    КонецЕсли;
    Возврат Ack;
КонецФункции

Функция ВыполнитьОдинЦикл(Bearer) Экспорт
    ЦиклРезультат = Новый Структура;
    ЦиклРезультат.Вставить("processed", 0);
    ЦиклРезультат.Вставить("unknown", 0);
    ЦиклРезультат.Вставить("rejected", 0);
    ЦиклРезультат.Вставить("transport", "");

    БезопасныйBearer = TransparentPriceConnectorHttp.БезопасныйMachineBearer(Bearer);
    Если БезопасныйBearer = Неопределено Или ПустаяСтрока(БезопасныйBearer) Тогда
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
        Проверка = ПроверитьЗадание(Job);
        Если Проверка.outcome <> "REPORTED_SUCCESS" Тогда
            // Без достоверных id/lease/envelope terminal mutation запрещена.
            ЦиклРезультат.unknown = ЦиклРезультат.unknown + 1;
            Продолжить;
        КонецЕсли;

        JobId = Поле(Job, "id", "");
        CorrelationId = Поле(Job, "correlationId", "");
        LeaseBearer = Поле(Job, "leaseBearer", "");
        PayloadHash = Поле(Job, "payloadHash", "");
        Revision = Поле(Job, "revision", 0);
        Attempt = Поле(Job, "attempt", 0);
        AckKey = КлючКвитанции(LeaseBearer, "ack");
        ResultKey = КлючКвитанции(LeaseBearer, "result");
        FailKey = КлючКвитанции(LeaseBearer, "fail");

        Ack = TransparentPriceConnectorHttp.ПодтвердитьЗадание(
            Bearer, JobId, LeaseBearer, AckKey, PayloadHash,
            Revision, Attempt, CorrelationId);
        Ack = ПовторитьACKПриНеизвестном(
            Ack, Bearer, JobId, LeaseBearer, AckKey, PayloadHash,
            Revision, Attempt, CorrelationId);
        Если Ack.Состояние <> "HTTP_OK" Тогда
            // Никакого бизнес-эффекта до доказанного ACK.
            ЦиклРезультат.unknown = ЦиклРезультат.unknown + 1;
            Продолжить;
        КонецЕсли;

        Попытка
            КомандныйРезультат = ВыполнитьТипизированнуюКоманду(Job);
        Исключение
            КомандныйРезультат = НовыйРезультатКоманды(
                "UNKNOWN_RESULT", "CONFIGURATION_ADAPTER_EXCEPTION", "", "",
                "UNKNOWN_RESULT", "UNKNOWN");
        КонецПопытки;

        Outcome = Поле(КомандныйРезультат, "outcome", "UNKNOWN_RESULT");
        ResultCode = БезопасныйКод(Поле(
            КомандныйРезультат, "resultCode", "CONNECTOR_ERROR"));
        ExternalEvidenceId = Поле(КомандныйРезультат, "externalEvidenceId", "");
        ResultState = Поле(КомандныйРезультат, "resultState", "");

        Если Outcome = "REPORTED_SUCCESS" Тогда
            Если ПустаяСтрока(TransparentPriceConnectorHttp.БезопасныйExternalEvidenceId(ExternalEvidenceId)) Тогда
                Outcome = "UNKNOWN_RESULT";
                ResultCode = "EXTERNAL_EVIDENCE_MISSING";
            ИначеЕсли ResultState <> "CREATED_IN_1C" И ResultState <> "POSTED" Тогда
                Outcome = "UNKNOWN_RESULT";
                ResultCode = "RESULT_STATE_MISSING";
            Иначе
                Отчет = TransparentPriceConnectorHttp.ОтправитьРезультатЗадания(
                    Bearer, JobId, LeaseBearer, ResultKey, PayloadHash,
                    Revision, Attempt, ResultState, ExternalEvidenceId,
                    ResultCode, CorrelationId);
                Если Отчет.Состояние = "UNKNOWN_RESULT"
                    Или Отчет.Состояние = "TRANSIENT_FAILURE" Тогда
                    Отчет = TransparentPriceConnectorHttp.ОтправитьРезультатЗадания(
                        Bearer, JobId, LeaseBearer, ResultKey, PayloadHash,
                        Revision, Attempt, ResultState, ExternalEvidenceId,
                        ResultCode, CorrelationId);
                КонецЕсли;
                Если Отчет.Состояние = "HTTP_OK" Тогда
                    ЦиклРезультат.processed = ЦиклРезультат.processed + 1;
                Иначе
                    ЦиклРезультат.unknown = ЦиклРезультат.unknown + 1;
                КонецЕсли;
                Продолжить;
            КонецЕсли;
        КонецЕсли;

        FailureClass = Поле(КомандныйРезультат, "failureClass", Outcome);
        EffectState = Поле(КомандныйРезультат, "effectState", "");
        Если Outcome = "BUSINESS_REJECTION" И ПустаяСтрока(EffectState) Тогда
            FailureClass = "BUSINESS_REJECTION";
            EffectState = "CONFIRMED_NO_EFFECT";
        ИначеЕсли Outcome = "UNKNOWN_RESULT" Тогда
            FailureClass = "UNKNOWN_RESULT";
            EffectState = "UNKNOWN";
        КонецЕсли;
        Если Не TransparentPriceConnectorHttp.ДопустимыйКлассОтказа(FailureClass)
            Или (EffectState <> "CONFIRMED_NO_EFFECT" И EffectState <> "UNKNOWN") Тогда
            FailureClass = "UNKNOWN_RESULT";
            EffectState = "UNKNOWN";
            ResultCode = "ADAPTER_OUTCOME_REFUSED";
        КонецЕсли;
        Если FailureClass <> "TRANSIENT_NETWORK"
            И FailureClass <> "TRANSIENT_TIMEOUT"
            И FailureClass <> "TRANSIENT_RATE_LIMIT"
            И FailureClass <> "TRANSIENT_PROVIDER_5XX"
            И FailureClass <> "UNKNOWN_RESULT"
            И EffectState <> "CONFIRMED_NO_EFFECT" Тогда
            FailureClass = "UNKNOWN_RESULT";
            EffectState = "UNKNOWN";
            ResultCode = "ADAPTER_EFFECT_AMBIGUOUS";
        КонецЕсли;

        Отчет = TransparentPriceConnectorHttp.ОтправитьОтказЗадания(
            Bearer, JobId, LeaseBearer, FailKey, PayloadHash,
            Revision, Attempt, FailureClass, EffectState,
            ResultCode, CorrelationId);
        Если Отчет.Состояние = "UNKNOWN_RESULT"
            Или Отчет.Состояние = "TRANSIENT_FAILURE" Тогда
            Отчет = TransparentPriceConnectorHttp.ОтправитьОтказЗадания(
                Bearer, JobId, LeaseBearer, FailKey, PayloadHash,
                Revision, Attempt, FailureClass, EffectState,
                ResultCode, CorrelationId);
        КонецЕсли;
        Если Отчет.Состояние = "HTTP_OK"
            И FailureClass = "BUSINESS_REJECTION" Тогда
            ЦиклРезультат.rejected = ЦиклРезультат.rejected + 1;
        Иначе
            ЦиклРезультат.unknown = ЦиклРезультат.unknown + 1;
        КонецЕсли;
    КонецЦикла;

    ЦиклРезультат.transport = "DONE";
    Возврат ЦиклРезультат;
КонецФункции
