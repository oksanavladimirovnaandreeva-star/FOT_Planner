# AGENTS.md — ФОТ-планировщик

Инструкции для AI-агентов в этом репозитории. Подробности — в `docs/`; здесь только ориентация и жёсткие ограничения.

---

## Проект

Веб-планирование **ФОТ по позициям**: годовой план, квартальные корректировки, план–факт (отложено в пилоте), версии, RBAC (демо на фронте).

**Текущий scope:** только `mvp/frontend/`. PostgreSQL, API, Kaiten-интеграция — **отложены** (фаза 3+).

**Стек:** React 19, TypeScript, Vite 8, React Router 7, Vitest. Без UI-библиотек — кастомный CSS в `index.css`.

**Сценарий пилота (июнь 2026):** годовое планирование **без факта** — `data/planScenario.ts` (`PLAN_SCENARIO_INCLUDES_FACT = false`).

---

## Команды

Рабочая директория: `mvp/frontend/`

```powershell
cd mvp/frontend
npm run dev      # http://localhost:5174/
npm test         # vitest run (176 тестов)
npm run build
npm run lint
```

После изменений в `data/` или бизнес-логике: **`npm test && npm run build`**.

Коммиты и push — **только по явной просьбе пользователя**.

---

## Документация (порядок чтения)

| Приоритет | Файл | Зачем |
|-----------|------|-------|
| 1 | `docs/PRODUCT-MODEL.md` | Продукт, 5 блоков, правила план/факт |
| 2 | `docs/HANDOFF.md` | Что сделано, маршруты, ключевые файлы |
| 3 | `docs/IMPLEMENTATION-STEPS.md` | Чеклист; следующие задачи (F1–F5) |
| 4 | `docs/SECURITY-REQUIREMENTS.md` | ИБ при экспорте, RBAC на API, audit |

**Не читать при старте:** `docs/SESSION-*.md`, `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md` — архив.

---

## Жёсткие продуктовые правила

- **Факт не правит план.** Факт только показывает отклонения (Δ); не создаёт событий и не «чинит» план.
- **«Экономия»** = Δ **план − факт** > 0; **перерасход** = Δ < 0.
- **План–факт** vs **утверждённая** версия (когда сценарий с фактом включён).
- **Сокращение:** с месяца M позиция `Closed`, ФОТ = 0.
- **Декрет:** замещение только `FROM_LIST` или `VACANCY`.
- **Корректировка:** события в черновике только с M<sub>open</sub>; правки — `/planning?mode=correction`.
- **Массовая индексация** — только **C&B** (`cb_admin`); UI — `PlanIndexationSection` (шапка «Позиции»). Лидам — только баннер-инфо, без формы. См. раздел **«Заморожено»** ниже.
- **Новая позиция:** спец. и уровень — только из справочника диапазонов.

---

## Структура кода

```
mvp/frontend/src/
  pages/           # PlanningPage, VersionsPage, LoginPage, …
  components/      # planning/, settings/, drawer/
  data/            # бизнес-логика, store (без React)
  context/         # MvpAppContext
```

**Маршруты:** `/login` · `/` · `/planning` · `/versions` · `/settings` · `/salary-ranges`  
Корректировка: `/planning?mode=correction`. Согласование: `/versions?tab=approval|compare`.

---

## Ключевые модули

| Область | Файлы |
|---------|-------|
| Вход / RBAC | `pages/LoginPage.tsx`, `data/demoPersonas.ts`, `data/demoSessionStore.ts`, `data/personaAccessScope.ts` |
| Версии C&B | `pages/VersionsPage.tsx`, `data/planVersions.ts`, `data/planVersionLifecycle.ts` |
| Планирование | `pages/PlanningPage.tsx`, `components/planning/PlanContextBar.tsx`, `BudgetWorkspacePanel.tsx` |
| Контур / ростер | `buildBudgetContour.ts`, `BudgetContourPanel.tsx`, `demoRosterPins.ts`, `personaRoster.ts`, `demoStorageMigration.ts` |
| Deep-link / пакет | `planningDeepLink.ts`, `budgetPackageWorkflow.ts`, `packageSubmissionStore.ts` |
| Демо-орг | `data/demoOrg.ts`, `data/demoPersonas.ts`, `data/orgStructureStore.ts` |
| Индексация | `components/planning/PlanIndexationSection.tsx`, `MassIndexationCompact.tsx`, `data/planningData.ts` |
| Диапазоны | `pages/SalaryRangesPage.tsx`, `data/salaryRangeData.ts`, `SalaryCatalogAccessPanel.tsx` |
| Сценарий пилота | `data/planScenario.ts`, `data/pilotTestBundle.ts` |
| Согласование | `components/planning/PlanApprovalPanel.tsx`, `data/teamSubmissionStore.ts` |
| Drawer | `components/PositionDrawer.tsx` |

---

## Текущая фаза

**Чекпоинт `pilot-annual-planning`:** персоны, lifecycle бюджета, индексация C&B (рабочая), UI для лидов, **вариант A «Мой бюджет»**, демо-орг ИТ/HR/Продажи, **176 tests**, `DEMO_SEED_VERSION=13`.

**Handoff для нового чата:** `docs/NEW-CHAT-START.md`

**Скилл бюджета/согласования (по запросу):** `.cursor/skills/fot-budget/SKILL.md` — workflow W1, smoke, freeze, правила минимального diff.

**F2 Kaiten** — отложено (вне пилота). **Следующий P0:** W1–W3 согласование end-to-end.

**Не повторять без запроса:** UX-4; визуальный редизайн shell; автоприменение индексации к новым слотам.

PG/API — не начинать без явного запроса.

---

## ⛔ Заморожено — не менять без явного запроса пользователя

Сломано и чинилось многократно. Любой рефакторинг «заодно» здесь — **запрещён**.

| Область | Файлы | Регрессионные тесты |
|---------|-------|---------------------|
| **Право правки / индексация C&B** | `data/planCorrectionWindow.ts` (`resolveCanEditWorkspace`), `pages/PlanningPage.tsx` (`applyIndexationToPlan`, `deleteIndexationBatch`, `canEditWorkspace`) | `planCorrectionWindow.test.ts`, `massIndexation.test.ts` |
| **Массовые операции по всему плану** | `context/MvpAppContext.tsx` (`updateVersionPositions`) — не заменять на `setPositions` для индексации | `massIndexation.test.ts` |
| **UI индексации C&B** | `PlanIndexationSection` + `MassIndexationCompact` в шапке PlanningPage; лидам — только баннер | — |
| **Отображение PERSONA-\*** | `data/positionDisplay.ts` (`formatEmployeeIdForDisplay`) | `positionDisplay.test.ts` |
| **Демо-сид индексации** | `data/demoPlanSeed.ts` (`DEMO_SEED_VERSION`, `attachDemoMassIndexation`) | `demoPlanSeed.test.ts` |
| **Пиннинг лидов на ростер** | `data/demoRosterPins.ts`, `data/personaRoster.ts` | `demoRosterPins.test.ts`, `personaRoster.test.ts` |

**Правило `resolveCanEditWorkspace` (не упрощать):** сначала `isQuarterWorkingDraft` → true; иначе в `correction` без черновика → false; иначе `isAnnualPlanningDraft`. Иначе C&B теряет «Применить»/удаление пакета.

Перед любым касанием этих файлов: прогнать `npm test -- planCorrectionWindow massIndexation positionDisplay demoPlanSeed`.
