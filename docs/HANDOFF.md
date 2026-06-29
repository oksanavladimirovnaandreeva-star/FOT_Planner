# Handoff: ФОТ-планировщик MVP

**Обновлено:** 2026-06-23  
**Чекпоинт:** `pilot-annual-planning` + **вариант A «Мой бюджет»** + **демо-оргструктура ИТ/HR/Продажи** · **176 tests**  
**Последний push:** `99cd5b1` (director budget, contour cards, roster pins, package UX)  
**Проект:** [`mvp/frontend/`](../mvp/frontend/) — единственный UI в работе. PG/API — после фронта.

**Старт нового чата:** [`NEW-CHAT-START.md`](NEW-CHAT-START.md)

**Документы:** [`PRODUCT-MODEL.md`](PRODUCT-MODEL.md) · [`IMPLEMENTATION-STEPS.md`](IMPLEMENTATION-STEPS.md) · [`SECURITY-REQUIREMENTS.md`](SECURITY-REQUIREMENTS.md) · [`ARCHITECTURE-v0.1.md`](ARCHITECTURE-v0.1.md)

---

## Запуск (важно)

```powershell
cd mvp\frontend
npm install          # первый раз
npm run dev          # http://localhost:5174/  ← порт 5174, не 5173
npm test             # 176 тестов
npm run build
```

**Deploy:** https://oksanavladimirovnaandreeva-star.github.io/FOT_Planner/

**Если «не открывается»:** проверить порт **5174**; рабочая папка — `mvp/frontend`, не корень репо.

**Данные:** localStorage + sessionStorage. API и PostgreSQL **не нужны** для пилота.

**Вход:** `/login` — персоны сгруппированы по департамент → юнит → команда (`listLoginPersonaGroups`).

**Сброс демо (обязателен после смены оргструктуры):** `http://localhost:5174/?reset=demo` или C&B → Настройки → «Сбросить пилот / план».

**Версия сида:** `DEMO_SEED_VERSION = 12` в `demoPlanSeed.ts`. При загрузке `MvpAppContext` пересобирает план, если версия устарела **или** в позициях остались старые имена (`Engineering`, `ProductDev`, `Frontend Web`) — см. `demoStorageMigration.ts`.

---

## Сценарий MVP (июнь 2026)

**Годовое планирование без факта:** `PLAN_SCENARIO_INCLUDES_FACT = false` — факт не сидится, `/analytics` → `/planning`.

**Демо-сид по умолчанию:** только **годовой черновик v1** (`buildDemoAnnualVersionState`), без квартального черновика. Сценарий: Пётр (Mobile) сдал → Морозов видит очередь на «Мой бюджет».

---

## Демо-оргструктура (русские имена)

Константы: `data/demoOrg.ts` · дерево: `orgStructureStore.ts` → `DEFAULT_ORG_TREE`.

| Департамент | Юниты | Команды (примеры) |
|-------------|-------|-------------------|
| Департамент ИТ | Юнит А/Б/С, Прямое подчинение | Платформа, Мобильная разработка, Инфраструктура, Качество, … |
| Департамент HR | Операции, Прямое подчинение | Рекрутинг, Обучение и развитие, … |
| Департамент Продаж | Коммерция | Корпоративные продажи, Розница |

**23 персоны** (`demoPersonas.ts`): C&B, 3 директора, 3 юнит-лида ИТ, 16 тимлидов (ИТ/HR/Продажи).

**Состав команд в плане:** `demoPlanSeed.ts` (пул ФИО) + `pinDemoPersonasToRoster` (`demoRosterPins.ts`) — тимлид → юнит-лид → директор на первой занятой позиции.

---

## Навигация

| Маршрут | Назначение |
|---------|------------|
| `/login` | Вход по персоне |
| `/` | Обзор и итого |
| `/planning` | Планирование |
| `/planning?tab=positions&team=Качество` | Планирование с фильтром команды |
| `/planning?unit=Юнит А&leadOnly=unit_lead` | Планирование: срез юнита, только позиция лида |
| `/versions` | Версии (C&B) |
| `/versions?tab=approval` | **Мой бюджет** (лиды) / Согласование |
| `/settings` | Настройки C&B (оргструктура, доступы, диапазоны) |
| `/salary-ranges` | Справочник диапазонов (C&B из планирования; доступы — в Настройках) |

Deep-link из «Мой бюджет»: `planningDeepLink.ts` (`?team=` / `?unit=` / `?department=`).

---

## «Мой бюджет» (вариант A)

| Роль | UI |
|------|-----|
| `team_lead` | `TeamLeadApprovalPanel` |
| `unit_lead` | `BudgetWorkspacePanel` `level="unit"` |
| `director` | `BudgetWorkspacePanel` `level="department"` |
| `cb_admin` / `gd` | Control Tower + консолидация |

**Юнит-лид / директор — секции:**
1. Лента версий (`ApprovalVersionRibbon`)
2. Статус pipeline + пакет (`budgetPackageWorkflow.ts` — когда показывать submit/approve/return)
3. `CorrectionComparePanel` (если есть квартальный черновик)
4. KPI ФОТ (`TeamLeadApprovalKpi`)
5. **«Ваш контур»** — плитки команд (`BudgetContourPanel`): название, тимлид, численность, ссылка «Планирование»
6. Таблица команд (`BudgetTeamsTable`): ФОТ, статус, согласование, «Планирование» → deep-link
7. Изменения по типам + действия пакета (одна отправка — без повторной кнопки после `submitted`)

**Данные:** `buildBudgetPackage.ts`, `resolveBudgetWorkspacePositions.ts`, `packageSubmissionStore.ts`, `teamSubmissionStore.ts`.

**Срез активной персоны:** `resolveActivePersonaOrgScope()` в `demoSessionStore.ts` — приоритет над устаревшими пресетами `demoRoleScopeStore`.

**Позиция лида в плане:** `personaRoster.ts` — сопоставление персоны ↔ строка ростера, фильтр `leadOnly` на `/planning`.

---

## Вход и доступы

- **Login:** `optgroup` по оргструктуре (`listLoginPersonaGroups` в `demoPersonas.ts`).
- **Доступы команд:** Настройки → «Доступы (демо)» — `DemoAccessSettingsPanel`.
- **Доступы к диапазонам:** Настройки → «Доступ к диапазонам (демо)» — `SalaryCatalogAccessPanel`.
- **Кнопка «Диапазоны»** на Планировании — только `cb_admin`.

---

## Индексация, диапазоны, RBAC

Массовая индексация — только C&B. Новая позиция — спец./уровень из справочника. RBAC+scope: `personaAccessScope.ts`, `userAccess.ts`, `submissionWorkflowPolicy.ts`.

---

## Состояние git (2026-06-23)

**В push (`99cd5b1`):** director budget, contour cards, roster pins, package UX.

**Не закоммичено (рабочая копия):** системное выравнивание — `personaRoster.ts`, `planningDeepLink.ts`, `budgetPackageWorkflow.ts` + тесты. **176 tests, build green.** Коммит/push — только по просьбе.

---

## Smoke-чеклист

| # | Персона | Ожидание |
|---|---------|----------|
| 1 | `/?reset=demo` | Сброс localStorage |
| 2 | **Алексей Орлов** (`dir_it`) | Контур → Сидор → планирование, **1 позиция** (своя строка директора) |
| 3 | **Сидор Морозов** (`sidr`) | «Мой бюджет»: ФОТ > 0, 4 плитки команд |
| 4 | **Пётр Сидоров** (`petya`) | Mobile: KPI, сдача команды |
| 5 | Пакет юнита | Submit **один раз**, без повторной кнопки |
| 6 | `npm test && npm run build` | 176 tests, без ошибок |

Дополнительно: **Татьяна Белова** (`tl_qa`) — позиции «Качество», ФОТ > 0.

---

## Готовность к PG/API (аудит 2026-06-23)

### Что уже хорошо ложится на бэкенд

| Слой | Где | Комментарий |
|------|-----|-------------|
| Доменные типы | `types.ts` | `PositionRecord`, `PlannedEvent`, `PlanVersionMeta` — близко к целевой модели |
| Чистая логика | `data/*.ts` | ~50 модулей без React: события, версии, согласование, агрегация бюджета |
| Workflow | `teamSubmissionStore`, `packageSubmissionStore` | Явные фазы и переходы — переносятся в API state machine |
| RBAC+scope | `personaAccessScope`, `submissionWorkflowPolicy` | Прототип целевой модели из `SECURITY-REQUIREMENTS.md` |
| Импорт/экспорт | `snapshotImport`, `exportPlanCsv` | Контракт снимка для миграции и интеграций |
| Тесты | 176 unit-тестов на `data/` | Хорошая база для регрессии при выносе логики на сервер |

### Риски и узкие места

| Риск | Серьёзность | Суть |
|------|-------------|------|
| Нет слоя репозитория/API | **Высокий** | ~15 модулей пишут в `localStorage` напрямую; нет `fetch`, optimistic lock, retry |
| `MvpAppContext` (~1050 строк) | **Высокий** | God-object: hydrate, persist, RBAC, import, lifecycle — сложно подменить на API |
| Пересчёт в клиенте | **Высокий** | `applyEvents` / `monthlyBase[]` в `PositionRecord` — на проде нужен server `recalculate` (см. `ARCHITECTURE-v0.1.md`) |
| Демо-сцепление | **Средний** | `demoPersonas`, `demoRosterPins`, `applyDemoSeedUpgrade` встроены в bootstrap |
| Орг по строкам | **Средний** | `department`/`unit`/`team` как текст в ключах submission — нужны стабильные `org_id` |
| Объём в памяти | **Средний** | Весь план — JSON в localStorage (~5 MB лимит); без пагинации и срезов API |
| Безопасность | **Критично на проде** | Роль в `localStorage` (`userAccess.ts`) — только демо; на API — JWT + RLS |
| Конкурентность | **Высокий** | Нет version/etag, last-write-wins при двух редакторах |
| Дублирование движка | **Средний** | Python `fot_domain/engine.py` (legacy) vs TS `planningData.ts` — нужна синхронизация или один источник |

### Карта persistence (localStorage / sessionStorage)

| Ключ | Модуль | Что на API |
|------|--------|------------|
| `fot_mvp_plan_data_by_version` | `planVersions` | `positions` + `planned_events` + `monthly_plan_lines` |
| `fot_mvp_plan_versions_meta` | `planVersions` | `plan_versions` |
| `mvp.teamSubmissions` | `teamSubmissionStore` | `team_submission` / workflow |
| `mvp.packageSubmissions` | `packageSubmissionStore` | `package_submission` |
| `fot_mvp_fact_by_employee` | `factStore` | `monthly_fact_lines` |
| `fot_mvp_org_tree` | `orgStructureStore` | `org_units` |
| `fot_mvp_demo_persona_*` | `demoSessionStore` | SSO + `users.scope_org` |
| `mvp.orgSlice` | `persistedOrgSlice` (session) | UI preference / query params |

Полный сброс: `mvpStorageReset.ts` (`?reset=demo`).

### Рекомендуемый порядок перед PG (без срочного рефакторинга UI)

1. **F2 Kaiten UI** + **A7 smoke** — A7 закрыт; Kaiten **отложен**.
2. **W1–W3** — полный цикл согласования на демо-орге.
3. **Repository interface** в `data/`: `PlanRepository`, `SubmissionRepository` — сначала `LocalStorage*`, потом `Api*`.
3. **Утончить `MvpAppContext`**: только React-state + вызовы репозиториев.
4. **OpenAPI-контракт** из `types.ts` + snapshot schema; server-side `recalculate`.
5. **Вынести демо** в `demo/` или feature-flag — prod bootstrap без `pinDemoPersonasToRoster`.

**Оценка готовности к PG/API:** фронт **~40%** (домен и UX), интеграционный слой **~5%**. Пилот без бэка — **готов**; production multi-user — **не готов** без фаз 3+.

---

## Следующий шаг (приоритет)

1. **W1–W3** — полный цикл согласования (тимлид → юнит → директор → C&B), [`IMPLEMENTATION-STEPS.md`](IMPLEMENTATION-STEPS.md).
2. Закоммитить стабильный срез (индексация, alignment, docs) — по просьбе.
3. **B1** — Repository interface (`PlanRepository`, `SubmissionRepository`) — подготовка к API без PG.
4. План–факт (`PLAN_SCENARIO_INCLUDES_FACT = true`) — отдельная итерация после согласования.
5. **F2 Kaiten** — отложено, не в пилоте.
6. PG/API — только по явному запросу.

**Не делать без запроса:** UX-4, визуальный редизайн shell, автоприменение индексации к новым слотам.

---

## Ключевые файлы

| Область | Путь |
|---------|------|
| Орг / персоны | `data/demoOrg.ts`, `demoPersonas.ts`, `demoSessionStore.ts`, `demoStorageMigration.ts` |
| Сид / ростер | `data/demoPlanSeed.ts`, `demoVersionSeed.ts`, `demoRosterPins.ts`, `personaRoster.ts` |
| Мой бюджет | `components/planning/BudgetWorkspacePanel.tsx`, `BudgetContourPanel.tsx`, `BudgetTeamsTable.tsx` |
| Агрегация / workflow | `data/buildBudgetPackage.ts`, `budgetPackageWorkflow.ts`, `packageSubmissionStore.ts`, `teamSubmissionStore.ts` |
| Планирование | `pages/PlanningPage.tsx`, `data/planningDeepLink.ts`, `data/planWorkspaceMode.ts` |
| Контекст | `context/MvpAppContext.tsx` |
| Persistence / сброс | `data/planVersions.ts`, `data/mvpStorageReset.ts` |
| Настройки | `pages/SettingsPage.tsx`, `DemoAccessSettingsPanel.tsx`, `SalaryCatalogAccessPanel.tsx` |

**Архив:** `docs/SESSION-*.md`, `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md`
