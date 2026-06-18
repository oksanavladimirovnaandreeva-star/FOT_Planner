# Новый чат — копипаст

**Чекпоинт:** `pilot-annual-planning` · **132 tests** · `git log -1` → см. последний коммит на `main`

Скопируй блок ниже целиком:

```
ФОТ-планировщик — продолжение MVP фронта

Проект: C:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner
Код: только mvp/frontend/ (React 19, TS, Vite, localStorage, без API/PG).

Читай по порядку:
1. AGENTS.md
2. docs/PRODUCT-MODEL.md
3. docs/HANDOFF.md
4. docs/IMPLEMENTATION-STEPS.md

Запуск:
  cd mvp\frontend
  npm run dev          → http://localhost:5174
  npm test             → 132 теста
  npm run build

Вход: /login — персоны (ФИО · роль). Сессия: fot_mvp_demo_persona_id.

Сценарий пилота (июнь 2026):
  • Годовое планирование БЕЗ факта: PLAN_SCENARIO_INCLUDES_FACT = false (data/planScenario.ts)
  • /analytics скрыта, редирект на /planning
  • Пилот: C&B → Настройки → Данные → «Пилот (тяжёлый)» или демо ~40 поз.

Навигация:
  / — обзор (только план) · /planning — план · /versions — версии (C&B) / согласование (лиды)
  Корректировка: /planning?mode=correction
  Согласование: /versions?tab=approval · Сравнение: /versions?tab=compare · Консолидация: /versions?tab=consolidation
  Диапазоны: /salary-ranges

Жёстко (не ломать):
  • факт НЕ правит план; Δ = план − факт (когда включим факт)
  • план–факт vs утверждённая версия
  • массовая индексация — только C&B; лидам — баннер-инфо
  • новая позиция: спец/уровень только из справочника диапазонов
  • PG/API/Kaiten — не начинать без явного запроса

Сделано (НЕ откатывать):
  • Пилот: LoginPage, demoPersonas, personaAccessScope, PlanWorkspaceContext
  • Версии C&B: Бюджет 2026 / N Квартал 2026, reopen/delete v1, planVersionLifecycle
  • Индексация: PlanIndexationSection, история пакетов, удаление с пересчётом (removeIndexationBatchFromPositions)
  • UI для лидов: упрощённые экраны, без факта на обзоре
  • Диапазоны: сортировка по столбцам, доступ по персонам (SalaryCatalogAccessPanel)
  • F1, F3–F5, UX-3, workspace drawer, Control Tower (базовый)

СЛЕДУЮЩАЯ ЗАДАЧА (приоритет пользователя):
  Логика согласований — довести end-to-end:
  • team submission: сдача команды, блокировка правок тимлида (teamSubmissionStore, submissionWorkflowPolicy)
  • /versions?tab=approval — PlanApprovalPanel, правила C&B (planApprovalRules)
  • /versions?tab=consolidation — ConsolidationPage, teamConsolidation
  • Два независимых процесса: lifecycle версий (C&B) vs согласование команд (лиды)
  • Проверить персоны: Вася (team_lead), Сидор (unit_lead), C&B, директор

Ключевые файлы согласований:
  data/teamSubmissionStore.ts, data/submissionWorkflowPolicy.ts, data/teamConsolidation.ts
  components/planning/PlanApprovalPanel.tsx, pages/ConsolidationPage.tsx, pages/VersionsPage.tsx
  data/planApprovalRules.ts, data/planVersions.ts

Отложено:
  • F2 Kaiten UI
  • План–факт (включить planScenario + аналитика)
  • UX-4, PG/API

После правок в data/: npm test && npm run build. Коммиты — только по просьбе.
```

Подробности — `docs/HANDOFF.md`. `SESSION-*` и `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md` не читать при старте.
