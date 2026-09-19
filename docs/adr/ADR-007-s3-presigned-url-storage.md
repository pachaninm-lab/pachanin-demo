# ADR-007: S3 Presigned URL для хранения документов

**Дата:** 2026-06-28  
**Статус:** Accepted  
**Контекст:** ТЗ 8.4 — Document Storage Architecture

## Контекст

Платформа хранит юридически значимые документы (договоры, акты, сертификаты качества, ЭТН). Нужна архитектура, которая:
- Не пропускает файлы через API-процесс (нет потребления памяти)
- Обеспечивает проверку прав перед скачиванием
- Поддерживает S3 Versioning и Object Lock (COMPLIANCE mode, 7 лет для подписанных документов)
- Позволяет верифицировать целостность через SHA-256

## Решение

**Загрузка (upload flow):**
1. Клиент запрашивает `POST /api/storage/request-upload` → получает presigned PUT URL (TTL 15 мин) и `fileId`
2. Клиент загружает файл напрямую в S3 по presigned URL (минуя API)
3. Клиент вызывает `POST /api/storage/confirm-upload/:fileId` с SHA-256 → API финализирует запись в БД

**Скачивание (download flow):**
1. Клиент запрашивает `GET /api/storage/download/:fileId` → API проверяет права (RBAC + RLS)
2. API возвращает presigned GET URL (TTL 15 мин)
3. Клиент скачивает напрямую из S3

**S3 Key структура:**
```
uploads/{dealId}/{fileId}.{ext}        — рабочие документы сделки
signed-docs/{dealId}/{fileId}.pdf      — подписанные документы (Object Lock)
evidence/{dealId}/{fileId}.{ext}       — доказательства по спорам
legacy/{fileId}                        — миграция из старого хранилища
```

## Альтернативы

| Вариант | Причина отклонения |
|---------|-------------------|
| Multipart upload через API | Высокое потребление памяти API, bottleneck на больших файлах |
| Base64 в JSON | Overhead 33%, нет поддержки больших файлов, нет версионирования |
| NFS/локальное хранилище | Не масштабируется горизонтально, нет geo-replication |

## Последствия

- **Adapter pattern**: `StorageAdapter` интерфейс — `InMemoryStorageAdapter` в sandbox, `S3StorageAdapter` (aws-sdk-v3 / Yandex Object Storage) в production без изменения бизнес-логики
- Проверка SHA-256 при каждом скачивании — не доверяем S3 ETag (может быть multipart)
- `StorageController` разрешает download только авторизованным пользователям с правами на сделку
- Подписанные документы: после подписания УКЭП S3 Key переносится в `signed-docs/` с Object Lock
