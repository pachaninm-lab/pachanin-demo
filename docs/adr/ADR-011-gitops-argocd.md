# ADR-011: GitOps с ArgoCD для Kubernetes деплоя

**Статус:** Принято  
**Дата:** 2024-07

## Контекст

Платформа федерального масштаба требует:
- Воспроизводимые деплои (infrastructure as code)
- Аудируемые изменения (git history = deploy history)
- Автоматическое восстановление при drift
- Zero-downtime rolling updates

## Решение

ArgoCD GitOps:
- **App-of-Apps паттерн**: один root Application управляет всеми
- **Auto-sync** с `selfHeal=true` — drift исправляется автоматически
- **Helm values** разделены на `values.yaml` (default) + `values-production.yaml`
- **Image tag** передаётся через Argo parameters при каждом релизе

## Процесс релиза

```
1. Merge to main
2. CI build → push image to registry с SHA тегом
3. CI update Helm values image.tag → commit to infra repo
4. ArgoCD обнаруживает изменение → начинает rolling update
5. Health checks → автоматический rollback при ошибке
```

## Альтернативы

| Альтернатива | Причина отклонения |
|---|---|
| Flux CD | ArgoCD лучше UI и multi-cluster support |
| Jenkins/GitLab CI push | Push модель менее безопасна (кластер доступен из CI) |
| Helm plugin для CI | Нет drift detection и self-healing |
| Ручные деплои | Неприемлемо для production |

## Последствия

**Плюсы:**
- Полный аудит всех деплоев в git
- Self-healing при любом дрейфе состояния
- Pull модель — CI не имеет доступа к K8s

**Минусы:**
- Дополнительный компонент (ArgoCD) в кластере
- Обновление image tag требует коммита в infra repo
