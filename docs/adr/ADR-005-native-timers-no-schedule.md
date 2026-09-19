# ADR-005: Нативные таймеры вместо @nestjs/schedule

**Статус:** Принято  
**Дата:** 2026-02-15  
**Авторы:** Backend Team  

## Контекст

Платформе нужны периодические задачи: relay outbox, мониторинг сертификатов, авто-отмена сделок. Стандартное решение в NestJS — `@nestjs/schedule` (cron).

## Решение

Используем нативные `setInterval` + lifecycle hooks `OnModuleInit` / `OnModuleDestroy`:

```typescript
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout;

  onModuleInit() {
    this.timer = setInterval(() => this.relay(), 5_000);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }
}
```

## Причина отказа от @nestjs/schedule

1. **Избыточная зависимость** для простых интервалов
2. **Контроль lifecycle** — с нативными таймерами мы явно контролируем старт/стоп
3. **Тестируемость** — легко мокать `setInterval`
4. **Предсказуемость** — нет магии декораторов

## Текущие периодические задачи

| Сервис | Интервал | Задача |
|--------|----------|--------|
| OutboxRelayService | 5 сек | Доставка Outbox events |
| CertificateMonitorService | 1 час | Проверка срока действия УКЭП сертификатов |
| DealAutoService | 1 час | Авто-отмена просроченных сделок (14 дней) |

## Последствия

- `+` Нет внешних зависимостей для cron
- `+` Явный lifecycle management
- `-` Нет distributed locking — при нескольких репликах задача запускается N раз
- **Решение для N реплик:** Redis-based lock или Kubernetes CronJob (Этап 0)
