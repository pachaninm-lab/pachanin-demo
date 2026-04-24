---
name: Agent task
description: Маленькая безопасная задача для агентного прохода
title: "agent: <epic> — <short task>"
labels: ["agent-task"]
body:
  - type: dropdown
    id: agent
    attributes:
      label: Agent
      options:
        - Agent 01 — Data Layer
        - Agent 02 — Runtime QA
        - Agent 03 — PR Gatekeeper
        - Agent 04 — E01 Queue Manager
        - Agent 05 — Release Reporter
    validations:
      required: true
  - type: input
    id: scope
    attributes:
      label: Scope
      description: 1–3 файла максимум
      placeholder: apps/web/components/v7r/DealsOverviewRuntime.tsx
    validations:
      required: true
  - type: textarea
    id: goal
    attributes:
      label: Goal
      description: Что должно измениться
    validations:
      required: true
  - type: textarea
    id: forbidden
    attributes:
      label: Do not touch
      description: Что нельзя менять в этом проходе
      value: |
        - UI и тексты не менять
        - форму данных не менять
        - большие компоненты не переписывать целиком
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance
      value: |
        - [ ] Read before write выполнен
        - [ ] Изменено не больше 3 файлов
        - [ ] Поведение экрана не изменено
        - [ ] web/API/API-ovdc success
    validations:
      required: true
---
