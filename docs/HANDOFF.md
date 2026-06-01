# Handoff: ФОТ-планировщик MVP

**Обновлено:** 2026-06-01  
**Репозиторий:** `c:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner`  
**Рабочая папка:** `fot-planner/mvp/frontend/`

> [`NEW-CHAT-PROMPT.md`](NEW-CHAT-PROMPT.md) · [`SESSION-2026-06-01.md`](SESSION-2026-06-01.md) · [`SESSION-2026-05-29.md`](SESSION-2026-05-29.md) · prod: [`ПЛАН-ПРОДОЛЖЕНИЯ.md`](ПЛАН-ПРОДОЛЖЕНИЯ.md)

---

## Запуск

```powershell
cd c:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner\mvp\frontend
npm install
npm run dev
npm run build
```

http://localhost:5174/ (или http://127.0.0.1:5174/)

---

## Сделано (не откатывать)

### Фаза A — import / UI

| # | Что | Где |
|---|-----|-----|
| 1–4 | Safe import, журнал, черновик вакансии, adapter | `snapshotImport.ts`, `operationHistory.ts`, `snapshotAdapter.ts` |
| — | KPI 2 строки, индексация compact, carryover | `PlanningPage`, `AnalyticsSummaryStrip` |

### Фаза C — версии бюджета

- v1 `DRAFT` до «Утвердить бюджет v1»; квартальный `WORKING_DRAFT` → `IN_APPROVAL` → v(N+1); старая `ARCHIVED`.
- `/versions`: история, compare, diff KPI + графики.
- `openVersion` + `repairDataByVersion`.
- Сайдбар: подсказки архив/согласование; Dev: `resetDevPlanToDraft`.

Файлы: `planVersions.ts`, `planVersionDiff.ts`, `planVersionCompare.ts`, `VersionCompareDashboard.tsx`, `VersionsPage.tsx`, `MvpAppContext.tsx`.

### Drawer (готово UI)

- Одна колонка: indigo-блок (слот / орг / параметры) → помесячно (scroll) → green-блок события.
- Шапка: ФИО первым; employee ID только в meta; без бейджа «Черновик».
- Backup: `PositionDrawer.baseline.tsx`.

### Фаза B — логика (начато)

| Что | Где |
|-----|-----|
| Атомарный перевод + каскад удаления | `planOperations.ts` (`transferPairId` в `types.ts`) |
| Увольнение → вакансия (ФОТ не 0) | `applyTerminationToVacancy` |
| Вакансии для перевода по месяцу M | `isVacantForTransferAtMonth`, `intraTransferVacancyHint` |
| Индексации из событий позиций | `collectIndexationBatchesFromPositions` |
| Таблица позиций после событий | `withAppliedEvents` в `PlanningPage` |

### Факт / прогноз (скелет)

- Факт: `employee_id`, `factStore.ts`, `factImport.ts`.
- `/forecast`: YTD + план на оставшиеся месяцы **без** событий плана.

---

## Продуктовые правила

| Тема | Правило |
|------|---------|
| Версии | v(N+1), не overwrite; diff база↔черновик |
| Перевод intra | тот же dept **и** unit; цель вакантна в месяц M |
| Увольнение | `TERMINATION_TO_VACANCY` — слот Vacancy, бюджет сохраняется |
| Прогноз (цель) | факт + события плана до EOY |
| dec→dec | prev>0; 0→X=100%; 0→0=0% |
| limit_flag | только с поля позиции |

---

## Следующий чат (приоритет)

1. **Приёмка фазы B** — перевод, увольнение, откат `transferPairId` (см. `ПЛАН-ПРОДОЛЖЕНИЯ.md` §16).
2. **Шаг 6** — полный прогноз + факт на обзоре/план-факт.
3. Согласования rule-based — после 6.

---

## localStorage

`fot_mvp_plan_versions_meta`, `fot_mvp_plan_data_by_version`, `fot_mvp_fact_by_employee`, `fot_mvp_last_export_snapshot`, `fot_mvp_pre_import_backup`, `fot_mvp_operation_history`, `fot_mvp_plan_version`.

---

## Главные файлы

| Область | Файл |
|---------|------|
| Операции плана | `src/data/planOperations.ts` |
| События / apply | `src/data/planningData.ts` |
| Версии | `src/data/planVersions.ts`, `src/pages/VersionsPage.tsx` |
| Контекст | `src/context/MvpAppContext.tsx` |
| Планирование | `src/pages/PlanningPage.tsx` |
| Drawer | `src/components/PositionDrawer.tsx` |
| Shell | `src/components/AppLayout.tsx` |
| Стили | `src/index.css` |

---

## Правила работы

- Scope: только `mvp/frontend/`.
- Коммиты — только по просьбе.
- PG / API / ИБ — после UI (см. `DATA-INTEGRATION-postgresql-excel-bi.md`).

---

*Промпт для вставки в новый чат — [`NEW-CHAT-PROMPT.md`](NEW-CHAT-PROMPT.md).*
