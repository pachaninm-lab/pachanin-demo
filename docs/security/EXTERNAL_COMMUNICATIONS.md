# Опись внешних коммуникаций

Сгенерировано `scripts/security/build-external-communications-inventory.mjs`. Не редактировать вручную.

Назначение, класс данных и поведение при отказе взяты из
`docs/security/external-communications-registry.json`. Места вызовов, переменные
окружения, наличие аутентификации и ограничение по времени измерены по исходникам.

Систем: 10. Мест вызова fetch: 12.

Столбец «вызовов» считает только места вызова `fetch`. Транспорты `node:http`,
`node:https`, `node:net` и `node:tls` обнаруживаются по импорту, потому что вызов
может идти через переменную; для них счёт мест не заявляется.

| Система | Зачем | Класс данных | Аутентификация | При отказе | Транспорт | fetch | Ограничены |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| AI assistant model provider | Ответы ассистента для внутренних пользователей. Хост обязан быть в списке AI_ASSISTANT_ALLOWED_HOSTS. | USER_CONTENT | header | Бросает provider_http_<код>, provider_missing_stream или provider_empty_response; ответ ассистента не выдаётся. | `fetch` | 2 | да |
| ML scoring service | Скоринг и прогнозные оценки. Адрес из ML_SERVICE_URL, по умолчанию внутренний http://ml-service:8001. | BUSINESS_DATA | **НЕТ** | Возвращает null. Отказ ML деградирует до отсутствия оценки, а не до ошибки запроса - вызывающая сторона обязана считать отсутствие оценки нормальным состоянием. **Деградирует молча.** | `fetch` | 1 | да |
| S3-compatible object storage | Чтение и удаление объектов документооборота. Конечная точка обязана быть http или https и полностью сконфигурирована. | DOCUMENTS | header | Бросает ошибку с кодом ответа; объект не считается прочитанным или удалённым. | `fetch` | 2 | да |
| Partner-supplied webhook destinations | ASVS V13.1.1 требует назвать случаи, когда внешний адрес задаёт пользователь. Партнёр регистрирует URL вебхука через partner-API, и приложение потом само туда ходит: при регистрации, из тестовой ручки POST webhooks/:id/test и из диспетчера доставки. Адрес назначения выбирает не платформа. | PARTNER_EVENTS | transport-allowlist | vetDestination бросает ошибку до открытия соединения; доставка не выполняется и адрес не принимается. | `httpRequest`, `httpsRequest` | 0 | да |
| Restricted public Qwen provider | Ограниченный публичный ассистент. Включается только через TAI_RESTRICTED_QWEN_PUBLIC_ENABLED и тот же список разрешённых хостов. | PUBLIC_CONTENT | header | Поток прерывается по AbortSignal; ответ не выдаётся. | `fetch` | 2 | да |
| Role-eligibility registry source | Загрузка выгрузок государственного реестра для проверки права на роль. | REGISTRY_DATA | transport-allowlist | Бросает типизированную ошибку (_HTTPS_REQUIRED, _HOST_NOT_ALLOWLISTED, _CONTENT_TYPE_CHANGED, _RESPONSE_TOO_LARGE); выгрузка не принимается. | `fetch` | 1 | да |
| Outbound SMTP mail server | Отправка писем аутентификации (подтверждение адреса, восстановление доступа) через сконфигурированный SMTP-сервер PC_SMTP_HOST:PC_SMTP_PORT. Соединение открывается напрямую сокетом node:net/node:tls, а не HTTP-клиентом. | PERSONAL_DATA | protocol-session | Ошибка транспорта поднимается вызывающей стороне; письмо не считается отправленным. | `connectTcp`, `connectTls` | 0 | да |
| Telegram Bot API | Публикация маркетинговых сообщений в канал. Конечная точка api.telegram.org. | PUBLIC_CONTENT | url-path-token | Бросает ServiceUnavailableException; публикация не считается выполненной. | `fetch` | 1 | да |
| HashiCorp Vault Transit | Шифрование и расшифровка персональных данных (ПДн) через Transit-ключ grainflow-pdn. Ключ не покидает Vault; приложение никогда не держит ключевой материал. | PERSONAL_DATA | header | Ошибка логируется и пробрасывается: запрос падает. Данные не сохраняются в открытом виде и не отдаются. | `fetch` | 2 | **нет** |
| VK wall.post API | Публикация маркетинговых записей на стену. Конечная точка api.vk.com/method/wall.post. | PUBLIC_CONTENT | request-body-token | Бросает ServiceUnavailableException; публикация не считается выполненной. | `fetch` | 1 | да |

## Адреса, которые задаёт пользователь

V13.1.1 отдельно требует назвать случаи, когда внешний адрес назначения выбирает
конечный пользователь, а не платформа.

- **Partner-supplied webhook destinations** — ASVS V13.1.1 требует назвать случаи, когда внешний адрес задаёт пользователь. Партнёр регистрирует URL вебхука через partner-API, и приложение потом само туда ходит: при регистрации, из тестовой ручки POST webhooks/:id/test и из диспетчера доставки. Адрес назначения выбирает не платформа. Контроль: Исходящий вызов не несёт учётных данных платформы. Защита здесь не аутентификация, а ограничение назначения: схема, отсутствие учётных данных в URL, список разрешённых хостов и политика IP-адресов, применяемые до и во время соединения.

## Модули

### AI assistant model provider (`ai-assistant-provider`)

- `apps/api/src/modules/ai-insights/ai-assistant.service.ts` — транспорт: fetch; вызовов fetch: 2; окружение: `AI_ASSISTANT_ALLOWED_HOSTS`, `AI_ASSISTANT_API_KEY`, `AI_ASSISTANT_BASE_URL`, `AI_ASSISTANT_MAX_TOKENS`, `AI_ASSISTANT_MODEL`, `AI_ASSISTANT_PROVIDER`, `AI_ASSISTANT_TIMEOUT_MS`

### ML scoring service (`ml-scoring`)

- `apps/api/src/modules/ml-client/ml-client.service.ts` — транспорт: fetch; вызовов fetch: 1; окружение: `ML_SERVICE_URL`

### S3-compatible object storage (`object-storage`)

- `apps/api/src/modules/storage/object-storage.adapter.ts` — транспорт: fetch; вызовов fetch: 2; окружение: —

### Partner-supplied webhook destinations (`partner-webhook-destinations`)

- `apps/api/src/common/security/safe-outbound-request.ts` — транспорт: httpRequest, httpsRequest; вызовов fetch: 0; окружение: `PARTNER_WEBHOOK_ALLOWED_HOSTS`

### Restricted public Qwen provider (`restricted-public-qwen`)

- `apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts` — транспорт: fetch; вызовов fetch: 2; окружение: `AI_ASSISTANT_ALLOWED_HOSTS`, `AI_ASSISTANT_API_KEY`, `AI_ASSISTANT_BASE_URL`, `AI_ASSISTANT_MAX_TOKENS`, `AI_ASSISTANT_MODEL`, `AI_ASSISTANT_PROVIDER`, `AI_ASSISTANT_TIMEOUT_MS`, `TAI_RESTRICTED_QWEN_PUBLIC_ENABLED`

### Role-eligibility registry source (`role-eligibility-registry`)

- `apps/api/src/modules/role-eligibility/role-eligibility-security.ts` — транспорт: fetch; вызовов fetch: 1; окружение: —

### Outbound SMTP mail server (`smtp-mail`)

- `apps/api/src/modules/auth-mail/auth-mail-smtp.ts` — транспорт: connectTcp, connectTls; вызовов fetch: 0; окружение: `AUTH_MAIL_TRANSPORT_FILE`, `NODE_ENV`, `PC_MAIL_FROM`, `PC_SMTP_HOST`, `PC_SMTP_PASS`, `PC_SMTP_PORT`, `PC_SMTP_USER`

### Telegram Bot API (`telegram-marketing`)

- `apps/api/src/modules/marketing/connectors/telegram.publisher.ts` — транспорт: fetch; вызовов fetch: 1; окружение: —

### HashiCorp Vault Transit (`vault-transit`)

- `apps/api/src/common/vault/vault-transit.service.ts` — транспорт: fetch; вызовов fetch: 2; окружение: `VAULT_ADDR`, `VAULT_TOKEN`

### VK wall.post API (`vk-marketing`)

- `apps/api/src/modules/marketing/connectors/vk.publisher.ts` — транспорт: fetch; вызовов fetch: 1; окружение: —
