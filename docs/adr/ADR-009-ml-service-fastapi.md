# ADR-009: ML Service — отдельный FastAPI сервис с эвристическим fallback

**Статус:** Принято  
**Дата:** 2024-07

## Контекст

Платформа GrainFlow требует ML предсказаний в реальном времени:
- Прогноз цены зерна (Price Predictor)
- Скоринг контрагента 0-100 (Counterparty Scoring)
- Обнаружение мошенничества 0.0-1.0 (Fraud Detector)

NestJS API написан на TypeScript; ML экосистема Python.

## Решение

Отдельный FastAPI микросервис `ml-service` (Python 3.11) с:
1. **LightGBM/scikit-learn** модели, загружаемые из joblib
2. **Эвристический fallback** при отсутствии обученных моделей
3. **HTTP клиент** в NestJS с 5s timeout и graceful degradation
4. **Еженедельное переобучение** через Airflow DAG из PostgreSQL данных

## Альтернативы

| Альтернатива | Причина отклонения |
|---|---|
| ONNX в Node.js | Ограниченная экосистема, нет LightGBM |
| Serverless функции | Холодный старт неприемлем (<100ms) |
| Внешний MLaaS | Latency, data residency, стоимость |
| Встроить в NestJS | Python ML экосистема богаче, изоляция |

## Последствия

**Плюсы:**
- Независимый деплой и масштабирование ML
- Python ML экосистема без компромиссов
- Эвристика гарантирует 100% availability

**Минусы:**
- Дополнительный hop: +1-5ms latency
- Отдельный Docker image и K8s Deployment
- Синхронизация версий моделей (joblib файлы)
