# Старт нового чата — ФОТ-планировщик

Скопируй блок ниже в **первое сообщение** нового чата.

---

## Сообщение для агента (copy-paste)

```
Продолжаем ФОТ-планировщик — только mvp/frontend.

Прочитай: docs/HANDOFF.md, docs/NEW-CHAT-START.md, AGENTS.md.

Последний push: 99cd5b1 (director budget, contour cards, roster pins, package UX).
В рабочей копии НЕ закоммичено: системная выравнивание — personaRoster.ts, planningDeepLink.ts, budgetPackageWorkflow.ts + тесты (176 tests, build green). Коммит/push — только по моей просьбе.

Сценарий: годовое планирование без факта (PLAN_SCENARIO_INCLUDES_FACT=false). DEMO_SEED_VERSION=12. Сброс демо: ?reset=demo или C&B → Настройки.

Dev: cd mvp/frontend && npm run dev → http://localhost:5174/
Deploy: https://oksanavladimirovnaandreeva-star.github.io/FOT_Planner/

Smoke: dir_it (Орлов) → контур → Сидор → 1 позиция; sidr — «Мой бюджет» с ФОТ; package submit — один раз, без повторной кнопки.

Ключевые модули (новое): personaRoster.ts, planningDeepLink.ts, budgetPackageWorkflow.ts, demoRosterPins.ts (пиннинг тимлид→юнит-лид→директор).

Скилл бюджета: @fot-budget или «по скиллу fot-budget» — workflow согласования, smoke, freeze.
```

---

## Быстрый smoke-чеклист

| # | Действие | Ожидание |
|---|----------|----------|
| 1 | `cd mvp/frontend` → `npm run dev` | `http://localhost:5174/` |
| 2 | Открыть `/?reset=demo` | Сброс localStorage |
| 3 | Login → **Алексей Орлов** (`dir_it`) | Контур → Сидор → планирование, 1 позиция (директор) |
| 4 | Login → **Сидор Морозов** (`sidr`) | Мой бюджет: плитки 4 команд, ФОТ > 0 |
| 5 | Login → **Пётр Сидоров** (`petya`) | Mobile: KPI, сдача команды |
| 6 | Пакет юнита | Submit один раз, без повторной кнопки |
| 7 | `npm test && npm run build` | 176 tests, без ошибок |

Дополнительно: **Татьяна Белова** (`tl_qa`) — «Качество», позиции и ФОТ > 0.

---

## Дальнейший план

| Приоритет | Задача | Где |
|-----------|--------|-----|
| P0 | **Согласование W1–W3** end-to-end (team → unit → director → C&B) | IMPLEMENTATION-STEPS |
| P1 | Коммит стабильного среза (по просьбе) | git |
| P2 | Repository layer B1 (LocalStorage → API) | HANDOFF «Готовность к PG/API» |
| P3 | План–факт: `PLAN_SCENARIO_INCLUDES_FACT = true` | planScenario.ts |
| — | F2 Kaiten | **отложено** |
| — | PG/API | только по явному запросу |

---

## Ключевые файлы (последние сессии)

**Новые (uncommitted / не в 99cd5b1):**  
`personaRoster.ts`, `planningDeepLink.ts`, `budgetPackageWorkflow.ts`,  
`personaRoster.test.ts`, `planningDeepLink.test.ts`, `budgetPackageWorkflow.test.ts`, `planningNavigation.test.ts`.

**В push 99cd5b1 и ранее:**  
`BudgetWorkspacePanel.tsx`, `BudgetContourPanel.tsx`, `demoRosterPins.ts`,  
`buildBudgetPackage.ts`, `packageSubmissionStore.ts`, `demoStorageMigration.ts`, …

---

## Что не делать

- Не менять `.cursor/plans/*` без запроса.
- Не коммитить `.playwright-mcp/`, `tmp-*`, `annual-eval/`, посторонние скрипты.
- Не добавлять UI-библиотеки.
- Не начинать PG/API без явного запроса.
- Dev-порт **5174**, рабочая папка `mvp/frontend`.
