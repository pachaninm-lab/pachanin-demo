// Прозрачная Цена — seam между общим connector protocol и конкретной конфигурацией 1С.
//
// Этот reference-модуль НАМЕРЕННО НЕ ПРИТВОРЯЕТСЯ совместимым с БП/КФХ/ERP.
// Пока для конкретного профиля нет acceptance, каждая бизнес-команда возвращает
// UNKNOWN_RESULT/CONFIGURATION_ADAPTER_NOT_IMPLEMENTED. Это не ошибка транспорта
// и не повод рисовать в платформе "создано в 1С".

Функция НеРеализовано(Команда) Экспорт
    Результат = Новый Структура;
    Результат.Вставить("outcome", "UNKNOWN_RESULT");
    Результат.Вставить("resultCode", "CONFIGURATION_ADAPTER_NOT_IMPLEMENTED");
    Результат.Вставить("externalEvidenceId", "");
    Результат.Вставить("command", Команда);
    Возврат Результат;
КонецФункции

// Configuration-specific discovery is deliberately a separate seam. Different
// 1C solutions keep legal entities in different application objects, so a
// universal query here would be a hidden "works with every 1C" claim.
//
// An accepted compatibility profile must return:
//   ready = Истина
//   configurationName
//   configurationVersion
//   databaseInstanceId     -- stable opaque id, NOT a connection string
//   organizations[]        -- guid, inn, kpp, name
//
// Until such profile exists pairing stays closed.
Функция ПолучитьПрофильDiscovery() Экспорт
    Результат = Новый Структура;
    Результат.Вставить("ready", Ложь);
    Результат.Вставить("resultCode", "CONFIGURATION_DISCOVERY_NOT_IMPLEMENTED");
    Результат.Вставить("configurationName", "");
    Результат.Вставить("configurationVersion", "");
    Результат.Вставить("databaseInstanceId", "");
    Результат.Вставить("organizations", Новый Массив);
    Возврат Результат;
КонецФункции

Функция ОбновитьКонтрагента(Payload) Экспорт
    Возврат НеРеализовано("UPSERT_COUNTERPARTY");
КонецФункции

Функция СоздатьЧерновикПродажи(Payload) Экспорт
    Возврат НеРеализовано("CREATE_SALES_DRAFT");
КонецФункции

Функция СоздатьЧерновикПокупки(Payload) Экспорт
    Возврат НеРеализовано("CREATE_PURCHASE_DRAFT");
КонецФункции

Функция СоздатьЧерновикИсправления(Payload) Экспорт
    Возврат НеРеализовано("CREATE_CORRECTION_DRAFT");
КонецФункции

Функция ПолучитьСтатусДокумента(Payload) Экспорт
    Возврат НеРеализовано("GET_DOCUMENT_STATUS");
КонецФункции

Функция ПередатьСтатусОплаты(Payload) Экспорт
    Возврат НеРеализовано("PUSH_PAYMENT_STATUS");
КонецФункции

Функция ПолучитьКандидатовСправочника(Payload) Экспорт
    Возврат НеРеализовано("GET_REFERENCE_CANDIDATES");
КонецФункции
