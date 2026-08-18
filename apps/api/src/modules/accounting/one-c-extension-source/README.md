# Прозрачная Цена — исходники 1С Connector v1

Это source-only срез будущего расширения 1С. Он существует рядом с server protocol, чтобы transport и команда на стороне 1С не были описаны только в ТЗ.

## Что уже является кодом

Три общих модуля расширения:

1. `TransparentPriceConnectorHttp.bsl`
   - только исходящий HTTPS;
   - production host закреплён в коде;
   - системное хранилище доверенных CA;
   - `/connector/v1/pair`, heartbeat, pull jobs, ack/result/fail;
   - redirect запрещён;
   - response size bounded;
   - POST network ambiguity = `UNKNOWN_RESULT`;
   - bearer не принимается из URL/Job и не логируется.

2. `TransparentPriceConnectorCommands.bsl`
   - ровно семь typed commands;
   - проверка job envelope;
   - ACK до бизнес-операции;
   - статический dispatch;
   - external evidence обязателен перед `REPORTED_SUCCESS`.

3. `TransparentPriceConfigurationAdapter.bsl`
   - seam для конкретной конфигурации;
   - пока каждый метод возвращает `UNKNOWN_RESULT / CONFIGURATION_ADAPTER_NOT_IMPLEMENTED`;
   - поэтому наличие transport-кода не превращается в ложную совместимость с БП/КФХ/ERP.

## Что должен добавить compatibility profile

Для каждой реально поддерживаемой конфигурации нужен отдельный принятый profile, который реализует только эти операции:

- `ОбновитьКонтрагента`;
- `СоздатьЧерновикПродажи`;
- `СоздатьЧерновикПокупки`;
- `СоздатьЧерновикИсправления`;
- `ПолучитьСтатусДокумента`;
- `ПередатьСтатусОплаты`;
- `ПолучитьКандидатовСправочника`.

Profile не получает механизм `Выполнить`, `Вычислить`, SQL, dump database или unrestricted read.

`REPORTED_SUCCESS` допустим только когда profile возвращает собственный идентификатор факта/объекта 1С как `externalEvidenceId`.

## Где хранится machine bearer

Эти исходники **не имеют plaintext fallback**.

Конкретная сборка расширения должна подключить provider защищённого хранения. Для конфигураций на БСП использовать безопасное хранилище БСП; для конфигурации без такого механизма отдельный compatibility/security review обязан выбрать защищённый вариант. Обычная константа, регистр сведений, файл, local user setting или журнал регистрации не допускаются.

Pairing code живёт только на время pairing и не заменяет machine credential.

## Как собирать расширение

Эти файлы — тексты общих модулей. Следующий vendor/tooling slice должен сформировать исходный проект расширения (EDT/XML metadata) и получить воспроизводимый `.cfe` с checksum/provenance.

Пока этот шаг не пройден, статус остаётся **SOURCE_ONLY / NOT_ATTESTED**.

## Что нельзя обещать из этого среза

- «работает с любой 1С»;
- «Бухгалтерия предприятия поддержана»;
- «КФХ поддержана»;
- `1С:Совместимо`;
- публикация в 1С:Фреш;
- live customer database;
- production exchange.

## Почему outbound HTTPS — нормальный путь для платформы 1С

Платформа 1С:Предприятие поддерживает обращения к внешним HTTP/HTTPS сервисам и JSON. Официальные материалы 1С также показывают `HTTPСоединение`, `HTTPЗапрос`, `ЗащищенноеСоединениеOpenSSL` и проверку сертификата сервера через доверенные корневые сертификаты ОС.

Источники:

- https://v8.1c.ru/platforma/integraciya/
- https://v8.1c.ru/platforma/rabota-s-http-i-ftp/
- https://v8.1c.ru/platforma/json/
- https://its.1c.ru/db/content/v8std/src/600/i8100669.htm
- https://its.1c.ru/db/content/metod8dev/src/developers/platform/demo/i8105574.htm

Новый обязательный recurring cost: **0 RUB**.
