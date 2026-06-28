# ADR-008: WAF — Coraza + OWASP CRS в Nginx

**Дата:** 2026-06-28  
**Статус:** Accepted  
**Контекст:** ТЗ 11.4 — Защита от атак

## Контекст

GrainFlow обрабатывает финансовые операции и ПДн. Нужна защита от OWASP Top 10 на уровне сетевого периметра, независимо от кода приложения (defence in depth).

## Решение

**WAF: Coraza + OWASP CRS v4 в Nginx (ModSecurity-совместимый)**

Конфигурация в `infra/nginx/`:
- `nginx.conf` — основной конфиг с TLS 1.2/1.3, security headers, rate limiting
- `modsecurity-grainflow.conf` — кастомные правила поверх CRS
- `proxy_params.conf` — параметры проксирования на API

**Paranoia Level 2** — блокирует SQL injection, XSS, Path Traversal без чрезмерного числа ложных срабатываний.

**Rate Limiting (Redis через Nginx):**
- `/api/auth/login`: 5 req/min (burst=2) — после 5 попыток 15-минутный блок (ТЗ 11.4)
- `/api/auth/*`: 5 req/min (burst=5)
- `/api/webhooks/*`: 50 req/s (burst=20)
- `/api/*`: 100 req/s (burst=200)

**Security Headers (ТЗ 11.4 / OWASP):**
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy` с запретом inline scripts
- `X-Frame-Options: DENY` (защита от clickjacking)
- `X-Content-Type-Options: nosniff`

## Альтернативы

| Вариант | Причина отклонения |
|---------|-------------------|
| Kong WAF plugin | Дополнительная лицензия Enterprise, vendor lock-in |
| Cloudflare WAF | Нарушает локализацию данных (152-ФЗ), данные уходят на зарубежные серверы |
| AWS WAF | Не доступен в РФ в полном объёме, нарушает 152-ФЗ |
| Только код приложения | Отсутствует defense in depth; компрометация кода = компрометация всего |

## Последствия

- Coraza поддерживает ModSecurity v3 директивы — OWASP CRS применяется без изменений
- `/metrics` endpoint закрыт по IP (только из monitoring namespace `10.0.0.0/8`)
- `/health`, `/ready` — без rate limit, без WAF check (нужны для K8s probes)
- Кастомные правила `id:10001–10102` не конфликтуют с CRS (CRS использует 900000–999999 и 1–899999)
- WAF логирует в `/var/log/nginx/modsecurity_audit.log` → Loki → Grafana alerting
