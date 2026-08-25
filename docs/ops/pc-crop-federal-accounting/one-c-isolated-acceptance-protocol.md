# Протокол изолированной приёмки коннектора 1С

Статус: **PLAN ONLY / NOT EXECUTED / NOT CERTIFIED**

Дата шаблона: 2026-08-25

Основание: Issue #4321, tracking Issue #4607

Этот протокол определяет воспроизводимый gate для будущего `.cfe`. Он не является отчётом о выполнении: точная конфигурация, платформа, лицензированный toolchain, демонстрационная база и собранное расширение отсутствуют.

## Обязательные предварительные условия

Запуск разрешается только когда подтверждены `CERTIFICATION_CATEGORY`, `TARGET_CONFIGURATION`, `TARGET_PLATFORM_VERSION`, `EXTENSION_PURPOSE`, `REGISTERED_IDENTITY`, `SECURITY_PROFILE`, `BSP_AND_SECRET_STORAGE`, `LICENSED_TOOLCHAIN` и маршрут демонстрационного стенда. Для запуска создаётся отдельная изолированная информационная база без реальных данных, персональных данных и реальных реквизитов.

В паспорте запуска фиксируются версия и лицензия платформы, полное имя/редакция/релиз конфигурации, версия БСП, ОС, СУБД только как инфраструктурный факт, версия `.cfe`, SHA-256 всех артефактов, источник сборки и идентификатор изолированного стенда. Прямое подключение коннектора к СУБД не допускается.

Сеть стенда по умолчанию закрыта. Разрешается только локальный или отдельно утверждённый изолированный HTTPS endpoint, который не является production. Внешняя передача fixture запрещена.

## Правило результата

Каждый case имеет статус `PASS`, `FAIL` или `BLOCKED`. `PASS` допустим только при наличии указанных доказательств. Любая ошибка платформы/конфигурации, отсутствие доказательства, неизвестный релиз, утечка чувствительных значений, неоднозначный эффект или изменение чужих данных означает `FAIL` либо `BLOCKED`; это нельзя округлять до успеха.

## Матрица тестов

| Case ID | Проверка | Требуемое доказательство |
| --- | --- | --- |
| `INSTALL-BSP` | Штатная установка в точную конфигурацию с БСП; безопасное хранилище доступно; ошибок применения нет | Видео/скриншоты пути установки, журнал проверки конфигурации, версия БСП, hash `.cfe` |
| `INSTALL-PLATFORM` | Штатная установка в одобренную конфигурацию без БСП через отдельно согласованный provider | Те же сведения плюс решение по provider и отрицательный поиск plaintext |
| `UPDATE` | Обновление предыдущей принятой версии без потери настроек, bindings и чужих данных | До/после версии, backup ID, transcript миграции, повторная регрессия |
| `DISABLE` | Отключение прекращает heartbeat/jobs/эффекты; credential отозван | Network transcript, audit отзыва, отсутствие фоновых вызовов |
| `REMOVE` | Удаление не повреждает типовые данные и чужие расширения, не оставляет credential | Сравнение метаданных/данных, список расширений, audit отзыва |
| `RELEASE-CHANGE` | Работа или безопасный отказ на точной паре релизов конфигурации | Два паспорта среды, протокол обновления, полный regression result |
| `MULTI-EXTENSION` | Совместное подключение с другим независимым расширением | Список расширений, порядок подключения, отсутствие заимствования объектов/состояния |
| `EXCEPTION-CHAIN` | Ошибка коннектора не ломает вызов типовой конфигурации и других расширений | Управляемая инъекция отказа, platform log, неизменённый типовой результат |
| `PAIRING-ONE-TIME` | Код действует один раз и ограниченное время; replay и mismatch отклонены | Серверный audit без plaintext, три transcript: success/replay/mismatch |
| `SECURE-STORAGE` | Machine bearer существует только в утверждённом защищённом хранилище | Описание provider, отрицательный поиск в базе/файлах/настройках/logs |
| `OUTBOUND-HTTPS` | Только pinned host/path, OS trust validation; redirect/другой host отклонены | Packet capture с редактированными значениями, certificate tests, negative cases |
| `NO-INBOUND` | На узле 1С не появляется listener и входящий Internet route не нужен | Список listening sockets, firewall policy, topology diagram |
| `MULTI-ORGANIZATION` | Binding одной организации не разрешает sibling legal entity | Две синтетические организации, allow/deny transcript, server authority audit |
| `UNSUPPORTED-COMMAND` | Неизвестная команда и лишние поля fail closed без бизнес-эффекта | Request/response transcript без payload values, comparison of business objects |
| `ACK-BEFORE-EFFECT` | Бизнес-операция начинается только после durable ACK | Correlated monotonic timeline ACK → effect → result |
| `ACK-AMBIGUOUS` | Неоднозначный ACK не запускает эффект и переводит job в reconciliation | Network fault injection, connector state, server state, absence of object |
| `RESULT-AMBIGUOUS` | Неоднозначный terminal report не становится локальным успехом | Fault injection, stable external evidence, idempotent report replay |
| `OFFLINE-LEASE-EXPIRY` | Offline после lease приводит к expiry/reconciliation; старый bearer не работает | Controlled clock/timeline, deny transcript, no duplicate effect |
| `RECONCILIATION` | Сверка различает подтверждённый эффект, отсутствие эффекта и unknown | Три synthetic scenarios, authorized human audit with fresh MFA |
| `SEVEN-COMMANDS` | Ровно семь canonical commands выполняют разрешённые сценарии; восьмой entrypoint отсутствует | Static inventory, seven transcripts, unsupported-command negative test |
| `NO-DIRECT-DB` | Нет SQL/DB driver/connection string и прямого доступа к СУБД | Source/package scan, process/network observation, architecture review |
| `NO-REAL-DATA` | Стенд и evidence содержат только synthetic fixtures | Fixture manifest, data review, export scan, signed operator checklist |
| `LOG-SECRET-SCRUB` | Logs не содержат bearer, pairing material, payload/requisites | Seeded canary scan across platform/server/OS logs with zero matches |
| `DEMO-WALKTHROUGH` | Полный сценарий воспроизводится по инструкции без участия разработчика | Непрерывная запись, operator checklist, hashes и итоговые synthetic objects |
| `UPGRADE-COEXISTENCE` | После обновления платформы/конфигурации сохраняются coexistence и fail-closed semantics | Before/after inventory, multi-extension regression, exact version evidence |

## Обязательные negative assertions

В каждом применимом тесте дополнительно проверяется отсутствие произвольного RPC, динамического имени процедуры, SQL, дампа базы, unrestricted read, прямого DB-доступа, inbound listener, production credential, production endpoint и реальных данных. `AUTO_POST` остаётся fail closed к созданию черновика, пока отдельная приёмка точной установки и версии не зафиксирована.

## Формат evidence

Для каждого case создаётся каталог `<run-id>/<case-id>/` с `result.json`, сокращённым transcript, hashes и ссылками на визуальные доказательства. `result.json` содержит case ID, start/end UTC, точные версии, SHA-256 `.cfe`, status, operator, environment ID, evidence hashes и список redaction; сами bearer, pairing-коды и payload не сохраняются.

Итоговый manifest подписывает владелец испытаний. Изменение любого файла после запуска аннулирует результат. Переход к официальной подаче разрешается только при `PASS` всех применимых cases и отдельном закрытии юридических и процессных blockers.

## Невыполненное состояние на 2026-08-25

Все 25 cases имеют фактический статус `BLOCKED_NOT_RUN`. Ни один результат этого документа не подтверждает `.cfe`, выполнение в 1С, production или «1С:Совместимо».
