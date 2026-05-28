# Handoff: ФОТ-планировщик MVP

**Дата baseline:** 2026-05-28  
**Репозиторий:** `c:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner`  
**Рабочая папка:** `fot-planner/mvp/frontend/` — только она сейчас актуальна.

> **Контекст не обнулялся.** Краткий handoff — этот файл. Полная сессия: [`SESSION-2026-05-28.md`](SESSION-2026-05-28.md). Карта всех документов: [`CONTEXT-MAP.md`](CONTEXT-MAP.md). Длинный roadmap: [`ПЛАН-ПРОДОЛЖЕНИЯ.md`](ПЛАН-ПРОДОЛЖЕНИЯ.md).

---

## Запуск

```powershell
cd c:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner\mvp\frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Браузер: **http://127.0.0.1:5174/**

Сборка: `npm run build`. Если порт занят — убить старый `node`/vite или сменить порт.

---

## Что это

Прототип планирования **ФОТ** на **локальных данных в браузере** (React, без бэкенда, без БД).

- Позиция = «стул» в оргструктуре.
- План на год (12 месяцев), события, пересчёт в `planningData.ts`.
- `limit_flag` на позиции: `IN_LIMIT` / `OVER_LIMIT` / `UNLIMITED` — **только из поля**, не из % лимита. В UI показываются только `IN_LIMIT` и `OVER_LIMIT` (без `UNLIMITED`).
- `slotType`: `carryover` | `new`.
- CR = BASE / mid из справочника диапазонов.
- Dec→dec по BASE: prev>0 — формула; 0→X — 100%; 0→0 — 0%.
- **Факт в UI — заглушка** (колонки «—», `hasFactData: false`).

---

## Зафиксированные решения (baseline 2026-05-28)

### Импорт / экспорт JSON (`MvpAppContext` + панель «Данные» в `AppLayout`)

- `exportCurrentSnapshot()` — снимок плана (`schemaVersion: 1`).
- `inspectSnapshot(payload)` — предпросмотр без применения.
- `importCurrentSnapshot(payload, mode)` — `replace` | `merge`.
- Перед импортом: `backupBeforeImport()` → `localStorage` ключ `fot_mvp_pre_import_backup`.
- Откат: `restoreFromLastExport()`, `restoreFromPreImportBackup()`.
- Валидация: версия схемы, обязательные поля, 12 месяцев, дубликаты `positionId` блокируют импорт.
- Образец: `mvp/frontend/sample-import.schema-v1.json`.
- **Ещё не сделано:** журнал последних ~5 операций импорта/отката в UI.

### KPI-лента (`AnalyticsSummaryStrip`)

- Обзор (`/`): полная лента — YTD, факт/отклонение (заглушка), разбивка лимитов.
- Планирование (`/planning`): одна строка (`singleRow`), без YTD и без среднего CR; без блока «Подробная аналитика».
- Порядок в шапке dec→dec: **% · сумма**; в разбивке лимитов под ним: **сумма · %**.
- Карточки «Позиции» / «Вакансии»: `кол-во · сумма`.
- Over-limit бейдж: светло-фиолетовый (`#ede9fe` / `#7c3aed`).

### Планирование: фильтры и массовые операции

- Фильтры в **одной компактной строке** (`filters-grid--toolbar`): поиск, департамент, юнит, команда, лимит, статус (позиция/вакансия).
- Массовая индексация — по отфильтрованным незакрытым позициям.
- Перенос бюджета вакансий carryover — отдельная панель.

### Drawer (`PositionDrawer.tsx`)

Один скролл:

1. Шапка — роль, ID, орг, лимит, дек→дек, ФОТ год  
2. **Позиция** — оргструктура, роль, слот, лимит  
3. **Событие** — сценарий, поля, «Применить»  
4. **Помесячно** — spec, level, оклад, премия, CR, copy-forward  
5. **История** — список событий, удаление = откат  

Сценарии → события:

| UI | Тип |
|----|-----|
| Пересмотр | `MANUAL_OVERRIDE` |
| Перевод внутри юнита | `TRANSFER` + `PLANNED_HIRE` |
| Перевод в другой департамент | `TRANSFER` |
| Увольнение | `TERMINATION_TO_VACANCY` |
| Сокращение | `CLOSE_POSITION` |
| Декрет | `MANUAL_OVERRIDE` + `SHARED_POSITION` |

**Поведение вакансий (baseline):**

- Новая вакансия наследует существующие батчи индексации (`applyExistingIndexationBatches`).
- Черновик: `applyEventToRecord` сохраняет через `onSaveDraft(..., forceCreate=true)` если позиция ещё не в списке.
- Кнопка удаления вакансии в drawer (с подтверждением).
- Индексация — только на `/planning`; удаление события пересчитывает план от seed.

Откат кода drawer: **`PositionDrawer.baseline.tsx`** (синхронизирован с текущим `PositionDrawer.tsx` на 2026-05-28).  
Подписи истории: `src/components/drawer/formatEventHistory.ts`.

### Оболочка и вёрстка

- Сайдбар ~176px, скроллбар скрыт.
- Контент `max-width: 92rem`, уменьшенные отступы между секциями.
- KPI-карточки — мини-карточки с рамкой.
- `recharts` не использовать; графики на CSS (`PlanLimitCharts`).

---

## Страницы

| URL | Что там |
|-----|---------|
| `/` | Обзор: KPI-лента, фильтры, аналитика, график «План и факт» (стек по лимиту + donut, CSS) |
| `/planning` | KPI-лента, компактные фильтры, таблица, массовые операции, drawer |
| `/salary-ranges` | Диапазоны окладов |
| `/plan-vs-actual` | План и факт (факт пустой) |
| `/deviation` | Отклонения |

Сайдбар: версия плана (mock), режим **оклад / итого ФОТ**. Оболочка: `src/styles/figma-shell.css`.

Дизайн-референс: `docs/design/annual-budget-planning-app/source/`.

---

## Главные файлы

| Область | Файл |
|---------|------|
| Состояние, импорт | `src/context/MvpAppContext.tsx` |
| Панель данных | `src/components/AppLayout.tsx` |
| KPI | `src/components/AnalyticsSummaryStrip.tsx` |
| Планирование | `src/pages/PlanningPage.tsx` |
| Обзор | `src/pages/DashboardPage.tsx` |
| Drawer | `src/components/PositionDrawer.tsx` |
| Baseline drawer | `src/components/PositionDrawer.baseline.tsx` |
| Графики | `src/components/PlanLimitCharts.tsx` |
| Расчёты | `src/data/planningData.ts`, `src/data/dashboardMetrics.ts` |
| Стили | `src/index.css`, `src/styles/figma-shell.css` |
| Типы | `src/types.ts` |

---

## Дорожная карта (строгий порядок)

**Фаза A — инфраструктура данных и UX черновика**

1. **Завершение safe import** — предупреждения/edge cases, явный отчёт в UI после merge.
2. **История операций** — журнал импортов/откатов (~5 записей) в панели «Данные».
3. **UX черновика вакансии** — один путь сохранения, бейджи «Черновик» / «Сохранено».
4. **Подготовка к API** — адаптер снимка без подключения бэкенда.

**Фаза B — продуктовая логика (только после закрытия фазы A)**

5. **Position / Vacancy** — статусы и переходы (занята / вакансия / закрыта), согласование drawer ↔ таблица ↔ события.
6. **Plan / Fact / Forecast** — факт на `/plan-vs-actual`, `/deviation`, обзоре; сначала модель + UI, внешний источник — когда будет.

---

## Не ломать

- Не подключать API/БД без явной задачи пользователя.
- `recharts` не использовать.
- `limit_flag` не выводить из % лимита.
- Коммиты — только по просьбе.
- Требования неясны → сначала вопросы, потом код.

---

## Вне скоупа MVP (не трогать, если не попросили)

- `fot-planner/apps/`
- PostgreSQL, Excel-импорт, BI — черновик: `docs/DATA-INTEGRATION-postgresql-excel-bi.md`

---

*Обновлять этот файл, а не плодить новые handoff.*
