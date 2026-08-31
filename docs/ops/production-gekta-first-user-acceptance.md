# Production Gekta first-user acceptance

## Назначение

Этот owner-only прогон закрывает первый полный путь бесплатной Гекты на каноническом REG.RU production. Он не подменяет пользовательские ручки прямым SQL и не принимает секрет владельца в CI.

Команда на release issue `#3072`:

```text
/production gekta-first-user current-main
```

Команда принимается только от владельца репозитория. Workflow заново разрешает exact current `main`, требует тот же SHA в публичном `manifest-pc-deploy.json` и прекращает работу, если `main` или production revision меняются во время прогона.

## Что доказывает runner

1. Открывает настоящий `/gekta` в Chromium, принимает текущие условия и получает один живой ответ через production AI path.
2. Получает ещё девять живых streaming-ответов. Каждый одноразовый ticket потребляется durable PostgreSQL admission, после чего тот же server-authoritative entitlement BFF показывает границу **10 бесплатных ответов** и настоящий registration gate.
3. Заполняет `/gekta/register`: имя, обязательный телефон, email, пароль, отдельное принятие условий и отдельное согласие на ПД.
4. Ждёт подтверждённую transactional-mail доставку в защищённом IMAP, открывает одноразовую ссылку и завершает **реальное verification-письмо**.
5. Настраивает обязательную TOTP MFA, не сохраняя setup secret или backup codes в логах и артефактах.
6. Проверяет серверный **30-дневный trial**, а также то, что телефон хранится честно как `DECLARED` — без SMS и без заявления о подтверждении номера.
7. Доказывает импорт истории, серверный поиск по истории и создание проекта.
8. Ждёт видимую owner-церемонию: поиск по телефону, доступ на **7 дней**, затем на **30 дней**, затем **бессрочный доступ**.
9. Выполняет настоящий logout/login с паролем и свежим MFA-кодом и повторно читает server-authoritative историю, проекты и бессрочное право доступа.

Cookie-only накрутка через `reserve/complete` запрещена: PASS требует десять фактически завершённых SSE-ответов с одноразовым durable admission. Так одновременно проверяются реальный generation path, PostgreSQL replay-защита и точная десятиответная граница.

## Owner ceremony

После регистрации workflow публикует на `#3072` только синтетический run-scoped номер вида `+999…` и ссылку на run. В существующей production-сессии `PLATFORM_OWNER` со свежей MFA нужно:

1. открыть `https://процент-агро.рф/gekta/console`;
2. выбрать поиск по телефону и найти синтетический номер;
3. указать причину acceptance и нажать «Доступ на 7 дней»;
4. дождаться на release issue bounded progress-маркера `7_DAYS`;
5. нажать «Доступ на 30 дней» и дождаться progress-маркера `30_DAYS`;
6. нажать «Бессрочный доступ» и дождаться progress-маркера `LIFETIME`.

Runner проверяет результаты из продуктовой сессии пользователя, поэтому визуально нажатая, но не записанная сервером кнопка не считается PASS. Кабинет дополнительно показывает неизменяемый журнал причин и грантов.

## Защищённые границы

- owner/reviewer email, пароль, cookie и TOTP никогда не входят в GitHub Actions;
- mailbox password, регистрационный email, пароль пользователя, verification URL, MFA secret, backup codes и auth cookies не публикуются;
- временный файл с синтетическим телефонным locator имеет mode `0600` и удаляется независимо от результата;
- артефакт содержит только bounded-маркеры, result JSON и SHA-256;
- прямые production SQL, SSH, impersonation, второй auth-контур и обход MFA запрещены;
- SMS-провайдер, billing, эквайринг, НПД и платежи не подключаются; billing остаётся выключенным;
- synthetic acceptance account и его audit/grant history остаются как проверяемое production evidence, а не удаляются задним числом;
- recurring cost этого acceptance — 0 RUB.

## PASS

PASS существует только если одновременно успешны exact-main и exact-deployed guards, реальная почта, MFA, trial, история/поиск/проекты, три owner-гранта, logout/login, redaction scan, публикация bounded artifact и финальная очистка runner material.
