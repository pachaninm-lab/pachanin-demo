# Platform V7 controlled test access

## Назначение

Этот контур используется владельцем платформы для ручной проверки бизнес-кабинетов до подключения production identity/API/PostgreSQL. Он не является источником production-полномочий и не заменяет persistent users, memberships, MFA и Staff Access Control Plane.

## Доступ

- вход выполняется через `/platform-v7/open`;
- логин, пароль и ключ подписи сессии хранятся только в environment variables хостинга;
- пароль и ключ запрещено фиксировать в репозитории, issue, PR и логах;
- пользователь выбирает только тестовое представление одной из 12 бизнес-ролей;
- срок HttpOnly-сессии ограничен;
- тестовый доступ не должен использоваться для реальных банковских, лабораторных, юридически значимых или арбитражных действий.

## Production boundary

После ввода production auth/API/PostgreSQL тестовый gate должен быть отключён. Реальный доступ владельца выполняется через персональный пользовательский аккаунт, MFA, `PLATFORM_OWNER`, CONTROL_PLANE и VIEW_AS с аудитом actual actor/effective subject.
