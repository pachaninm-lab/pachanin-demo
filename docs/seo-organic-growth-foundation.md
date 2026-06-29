# SEO / organic growth foundation

Дата: 2026-06-30
Проект: Прозрачная Цена / platform-v7
Статус: controlled pilot / pre-integration

## Что закрывает PR

1. Разблокирует индексацию публичных страниц через `robots.ts`.
2. Заполняет `sitemap.ts` публичными SEO-страницами.
3. Усиливает metadata публичного контура platform-v7.
4. Добавляет публичный раздел вопросов и ответов.
5. Добавляет посадочные страницы для продавцов, покупателей, безопасной сделки и документного контура.

## Важное ограничение

SEO не гарантирует топ органической выдачи. Цель слоя — сделать сайт доступным для индексации, понятным для поисковых систем и пригодным для лидогенерации.

## Публичные маршруты

- `/platform-v7`
- `/platform-v7/demo`
- `/platform-v7/contact`
- `/platform-v7/voprosy-otvety`
- `/platform-v7/prodavtsam`
- `/platform-v7/pokupatelyam`
- `/platform-v7/bezopasnaya-sdelka`
- `/platform-v7/fgis-zerno-i-dokumenty`

## Следующий слой

1. Привязать Search Console и Яндекс.Вебмастер.
2. Проверить индексирование `/robots.txt` и `/sitemap.xml` после деплоя.
3. Добавить 10-20 страниц базы знаний на основе реальных вопросов клиентов.
4. Настроить события аналитики: demo_open, inquiry_submit, register_click.
5. Проверить env для отправки заявок: `RESEND_API_KEY`, `LEAD_TO_EMAIL`, `RESEND_FROM_EMAIL`.
