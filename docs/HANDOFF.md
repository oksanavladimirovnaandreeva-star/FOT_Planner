# Handoff: ФОТ-планировщик MVP

**Обновлено:** 2026-06-19  
**Чекпоинт:** `pilot-annual-planning` + **вариант A «Мой бюджет»** + **демо-оргструктура ИТ/HR/Продажи** · **162 tests**  
**Проект:** [`mvp/frontend/`](../mvp/frontend/) — единственный UI в работе. PG/API — после фронта.

**Старт нового чата:** [`NEW-CHAT-START.md`](NEW-CHAT-START.md)

**Документы:** [`PRODUCT-MODEL.md`](PRODUCT-MODEL.md) · [`IMPLEMENTATION-STEPS.md`](IMPLEMENTATION-STEPS.md) · [`SECURITY-REQUIREMENTS.md`](SECURITY-REQUIREMENTS.md)

---

## Запуск (важно)

```powershell
cd mvp\frontend
npm install          # первый раз
npm run dev          # http://localhost:5174/  ← порт 5174, не 5173
npm test             # 162 теста
npm run build
```

**Если «не открывается»:** проверить порт **5174**; рабочая папка — `mvp/frontend`, не корень репо.

**Данные:** localStorage + sessionStorage. API и PostgreSQL **не нужны**.

**Вход:** `/login` — персоны сгруппированы по департамент → юнит → команда (`listLoginPersonaGroups`).

**Сброс демо (обязателен после смены оргструктуры):** `http://localhost:5174/?reset=demo` или C&B → Настройки → «Сбросить пилот / план».

**Версия сида:** `DEMO_SEED_VERSION = 11` в `demoPlanSeed.ts`. При загрузке `MvpAppContext` пересобирает план, если версия устарела **или** в позициях остались старые имена (`Engineering`, `ProductDev`, `Frontend Web`) — см. `demoStorageMigration.ts`.

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

**15 персон** (`demoPersonas.ts`): 3 директора, 3 юнит-лида ИТ, 8 тимлидов, C&B.

**Состав команд в плане:** `demoPlanSeed.ts` (пул ФИО) + `pinDemoPersonasToRoster` (тимлиды/лиды на первой занятой позиции команды).

---

## Навигация

| Маршрут | Назначение |
|---------|------------|
| `/login` | Вход по персоне |
| `/` | Обзор и итого |
| `/planning` | Планирование |
| `/planning?tab=positions&team=Качество` | Планирование с фильтром команды |
| `/versions` | Версии (C&B) |
| `/versions?tab=approval` | **Мой бюджет** (лиды) / Согласование |
| `/settings` | Настройки C&B (оргструктура, доступы, диапазоны) |
| `/salary-ranges` | Справочник диапазонов (C&B из планирования; доступы — в Настройках) |

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
2. Статус pipeline + пакет
3. `CorrectionComparePanel` (если есть квартальный черновик)
4. KPI ФОТ (`TeamLeadApprovalKpi`)
5. **«Ваш контур»** — плитки команд (`BudgetContourPanel`): название, тимлид, численность, ссылка «Планирование»
6. Таблица команд (`BudgetTeamsTable`): ФОТ, статус, согласование, «Планирование» → `planTeamPlanningPath(team)`
7. Изменения по типам + действия пакета

**Данные:** `buildBudgetPackage.ts`, `resolveBudgetWorkspacePositions.ts`, `packageSubmissionStore.ts`.

**Срез активной персоны:** `resolveActivePersonaOrgScope()` в `demoSessionStore.ts` — приоритет над устаревшими пресетами `demoRoleScopeStore`.

---

## Вход и доступы

- **Login:** `optgroup` по оргструктуре (`listLoginPersonaGroups` в `demoPersonas.ts`).
- **Доступы команд:** Настройки → «Доступы (демо)» — `DemoAccessSettingsPanel`.
- **Доступы к диапазонам:** Настройки → «Доступ к диапазонам (демо)» — `SalaryCatalogAccessPanel` (убрано с `/salary-ranges` и с Планирования для не-C&B).
- **Кнопка «Диапазоны»** на Планировании — только `cb_admin`.

---

## Индексация, диапазоны, RBAC

Без изменений по смыслу — см. предыдущий handoff. Массовая индексация — только C&B. Новая позиция — спец./уровень из справочника.

---

## Сделано в сессии (2026-06-18…19), не закоммичено

Всё в рабочей копии git (ветка без единого коммита на этот блок — **нужен коммит по просьбе**).

| Область | Файлы / суть |
|---------|----------------|
| Демо-орг ИТ/HR/Продажи | `demoOrg.ts`, `orgStructureStore.ts`, `demoPersonas.ts`, `demoRoleScopeStore.ts` |
| Годовой сид + Mobile events | `demoVersionSeed.ts`, `DEMO_SEED_VERSION=11` |
| Мой бюджет | `BudgetWorkspacePanel`, `BudgetTeamsTable`, `BudgetChangesByType`, `buildBudgetPackage.ts` |
| Контур (плитки) | `BudgetContourPanel`, `buildBudgetContour.ts`, `teamRosterSummary.ts`, `demoRosterPins.ts` |
| Миграция localStorage | `demoStorageMigration.ts`, `MvpAppContext.applyDemoSeedUpgrade` |
| Login optgroup | `LoginPage.tsx`, `listLoginPersonaGroups` |
| Planning team deep-link | `planTeamPlanningPath`, `PlanningPage` + `?team=` |
| Журнал «Суть изменения» | `eventJournal.formatApprovalJournalSummary` |
| Настройки диапазонов | `SettingsPage` + `SalaryCatalogAccessPanel` |

**Тесты:** 162 passed · **build:** green (на момент handoff).

---

## Известные проблемы / что проверить в новом чате

1. **Пользователь видел нули и пустые экраны** — типично из-за старого localStorage (`ProductDev` vs `Юнит А`). Лечение: `?reset=demo` или авто-миграция v11 после F5. **Smoke обязателен** под персонами: `tl_qa` (Белова), `sidr` (Морозов), `petya` (Mobile).
2. **Локальный dev** — порт **5174**; при занятом порте Vite покажет другой — смотреть вывод терминала.
3. **Не всё проверено вручную в браузере** после последних правок контура и миграции.
4. **IMPLEMENTATION-STEPS.md** — дата и блок «вариант A» устарели частично (см. NEW-CHAT-START).

---

## Следующий шаг (приоритет)

1. **Smoke + стабилизация демо** — один сценарий end-to-end без нулей; зафиксировать коммитом.
2. **F2** — Kaiten UI (без API), [`IMPLEMENTATION-STEPS.md`](IMPLEMENTATION-STEPS.md).
3. План–факт (`PLAN_SCENARIO_INCLUDES_FACT = true`) — отдельная итерация.
4. PG/API — только по явному запросу.

**Не делать без запроса:** UX-4, визуальный редизайн shell, автоприменение индексации к новым слотам.

---

## Ключевые файлы

| Область | Путь |
|---------|------|
| Орг / персоны | `data/demoOrg.ts`, `demoPersonas.ts`, `demoSessionStore.ts`, `demoStorageMigration.ts` |
| Сид плана | `data/demoPlanSeed.ts`, `demoVersionSeed.ts`, `demoRosterPins.ts` |
| Мой бюджет | `components/planning/BudgetWorkspacePanel.tsx`, `BudgetContourPanel.tsx`, `BudgetTeamsTable.tsx` |
| Агрегация | `data/buildBudgetPackage.ts`, `resolveBudgetWorkspacePositions.ts`, `packageSubmissionStore.ts` |
| Планирование | `pages/PlanningPage.tsx`, `data/planWorkspaceMode.ts` |
| Контекст | `context/MvpAppContext.tsx` |
| Настройки | `pages/SettingsPage.tsx`, `DemoAccessSettingsPanel.tsx`, `SalaryCatalogAccessPanel.tsx` |

**Архив:** `docs/SESSION-*.md`, `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md`
