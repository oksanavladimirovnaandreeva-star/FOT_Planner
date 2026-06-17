# Handoff: ФОТ-планировщик MVP

**Обновлено:** 2026-06-14  
**Чекпоинт:** `UX-3-workspace-drawer` (F1–F5 + UX-3, **69 tests**, без F2/Kaiten и UX-4) · git `a33d116`
**Проект:** [`C:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner`](C:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner)  
**Актуальный код:** [`mvp/frontend/`](../mvp/frontend/) — единственный UI в работе. PG/API — после фронта.

**Документы:** [`PRODUCT-MODEL.md`](PRODUCT-MODEL.md) · [`IMPLEMENTATION-STEPS.md`](IMPLEMENTATION-STEPS.md) · [`SECURITY-REQUIREMENTS.md`](SECURITY-REQUIREMENTS.md) · [`NEW-CHAT-PROMPT.md`](NEW-CHAT-PROMPT.md) · [`CONTEXT-MAP.md`](CONTEXT-MAP.md)

**Дизайн (референс):** [`docs/design/annual-budget-planning-app/source/`](../docs/design/annual-budget-planning-app/source/)

---

## Запуск

```powershell
cd C:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner

npm run dev          # из корня → Vite в mvp/frontend
# или
.\scripts\start-web.ps1
```

Откройте URL из терминала (`Local:`). Обычно **http://localhost:5174**.

```powershell
cd mvp\frontend
npm install          # первый раз
npm test             # 69 тестов
npm run build
```

**Данные:** localStorage + sessionStorage (`mvp.orgSlice`). API и PostgreSQL **не нужны**.

**Демо:** роль **admin** → **Настройки** → «Данные» → «Загрузить расширенное демо» (~70 позиций).  
**Смена роли (демо):** выпадающий список **«Роль (демо)»** в сайдбаре (виден у всех ролей) или `/settings`.

---

## Навигация

| Маршрут | Назначение |
|---------|------------|
| `/` | **Обзор и итого** — KPI, `SliceToolbar`, план/факт |
| `/planning` | **Планирование** — позиции, матрица, журнал |
| `/planning?mode=correction` | **Корректировка** (тот же UI, квартальный черновик) |
| `/analytics` | **Аналитика** — план-факт, отклонения, прогноз |
| `/analytics?tab=deviation` | Отклонения + «почему» (драйверы Δ) |
| `/versions` | **Версии** — список, согласование, сравнение |
| `/versions?tab=approval` | Согласование (`PlanApprovalPanel`) |
| `/versions?tab=compare` | Сравнение черновика (`CorrectionComparePanel`) |
| `/versions?tab=consolidation` | Консолидация тимлидов |
| `/settings` | Настройки (полные — admin/director; stub — остальные + смена роли) |
| `/salary-ranges` | Справочники окладов |

**Редиректы:** `/correction` → planning+correction · `/consolidation` → versions · `/plan-vs-actual` → analytics · `/audit` → planning?tab=journal

**Вкладки планирования:** `?tab=positions|matrix|journal` (без approval/compare — они на `/versions`)

**Query для среза из консолидации:** `sliceDept`, `sliceUnit`, `sliceTeam` → PlanningPage применяет org slice.

---

## Продукт (кратко)

| Блок | Суть |
|------|------|
| A Планирование | События → пересчёт плана |
| B Факт | Импорт; **только отклонения**, факт не правит план |
| C Корректировка | С событиями только с M<sub>open</sub> (после квартала) |
| D План–факт | vs **утверждённая** версия; **Δ = план − факт** (+ экономия, − перерасход) |
| E Kaiten | **F2 — не начат** (UI без API) |

**Терминология UI:** **«позиция»** (не «слот»).

---

## Сделано (не откатывать)

### Движок и процесс (#1–#10)
- Версии, `planOperations`, approval, `teamConsolidation`
- Матрица, мульти-employee факт, сокращение → Closed с M
- Квартал: `planCorrectionWindow`, блок событий до M<sub>open</sub>
- RBAC: `userAccess.ts`, freeze лидов
- Корректировка: `planWorkspaceMode`, compare + лимит
- Декрет: `FROM_LIST` | `VACANCY`
- Факт: `factStore`, `factImport`, `occupancyReconciliation`

### UX-3-workspace-drawer (2026-06-14, не откатывать)
- **PositionDrawer** `drawer--workspace`: вкладки **«Слот и занятость»** · **«События и ФОТ»**
- На вкладке ФОТ: история событий, форма сценариев, **таблица по месяцам** (спец, уровень, оклад, премия, итого, CR)
- **PlanningPage:** «Добавить позицию» активна на утверждённом бюджете (роли с правом правки) → авто-переход в квартальный черновик
- **Массовая индексация:** только **C&B** (`cb_admin`); UI — `MassIndexationCompact` в шапке на вкладке «Позиции»; на «Журнале» — только баннер в `PlanContextBar`, без формы
- **Vite** `strictPort: true` на **5174**; `start-web.ps1` убивает старый процесс на порту
- Архив compact-drawer: `docs/archive/PositionDrawer.baseline.tsx` (не подменять основной drawer)

### UX-структура (июнь 2026, без смены shell)
- **PlanContextBar** — один контекстный бар вместо 4–5 баннеров на Planning
- **Согласование / Сравнение** перенесены на `/versions?tab=…`
- **Compact KPI** на Planning (`AnalyticsSummaryStrip planningCompact`)
- **persistedOrgSlice** — sessionStorage `mvp.orgSlice` (Обзор + Planning)
- **planVersionDisplay** — лейблы «Не утверждён», «Черновик корректировки»
- **WorkflowHint** + сброс в Settings
- **Settings nav** — только admin/director; **DemoRoleSelect** в сайдbar для всех
- **SliceToolbar** — единая панель срезов (Обзор, Planning, Аналитика план-факт)
- **Control Tower** (`/versions?tab=approval`): KPI, прогресс сдачи команд, очередь со статус-бейджами, исключения C&B; матрица прав — в collapse

### F1–F5 (фронт продолжение)
| # | Статус | Суть |
|---|--------|------|
| F1 | `[x]` | CSV экспорт плана/факта + `exportAuditLog` в Settings |
| F2 | `[ ]` | Kaiten UI — **следующий приоритет** |
| F3 | `[x]` | Консолидация unit_lead: срез юнита, Δ ФОТ, ссылки в корректировку/compare |
| F4 | `[x]` | Матрица: закрытые месяцы до M<sub>open</sub> (штриховка) |
| F5 | `[x]` | План–факт: **план − факт**, драйверы «почему» (`planFactVarianceDrivers.ts`), multi-on-seat |

### Отклонено пользователем (не повторять без запроса)
- Визуальный редизайн shell: topbar, sidebar 256px, BudgetFlow, перенос KPI в header
- Смешивание UX-3 структуры с UX-4 «как в Figma» в одном PR

---

## План–факт: формула и аналитика

**Единая формула:** `planFactDelta(plan, fact) = plan − fact`

| Знак Δ | Смысл |
|--------|--------|
| **> 0** | Экономия (план выше факта) |
| **< 0** | Перерасход (факт выше плана) |

**Драйверы «почему»** (`planFactVarianceDrivers.ts`): вакансия не закрыта, дешевле/дороже плана, найм на вакансии, нет выплат, двое на позиции. Только отчёт — не триггер корректировки.

---

## Следующий шаг

1. **F2** — Kaiten UI (заявки из позиции/журнала, без API)
2. По желанию: SliceToolbar на Deviation/Forecast; DATA-1 CSV-факт; прогноз на Обзоре
3. **PG/API (#11+)** — только по явному запросу

Стартовый промпт: [`NEW-CHAT-PROMPT.md`](NEW-CHAT-PROMPT.md).

---

## Ключевые файлы

| Область | Путь |
|---------|------|
| Shell | `components/AppLayout.tsx`, `components/DemoRoleSelect.tsx` |
| Срезы UI | `components/SliceToolbar.tsx`, `components/OrgSliceMultiSelect.tsx` |
| Срезы data | `data/orgSliceFilters.ts`, `data/persistedOrgSlice.ts` |
| Планирование | `pages/PlanningPage.tsx`, `components/planning/PlanContextBar.tsx` |
| Версии | `pages/VersionsPage.tsx` |
| Консолидация | `pages/ConsolidationPage.tsx`, `data/teamConsolidation.ts`, `data/consolidationNav.ts` |
| План–факт | `pages/PlanVsActualPage.tsx`, `pages/DeviationPage.tsx` |
| Δ и драйверы | `data/planFactMetrics.ts`, `data/planFactVarianceDrivers.ts` |
| Экспорт | `data/exportPlanCsv.ts`, `data/exportScopedCsv.ts`, `components/ExportCsvActions.tsx` |
| RBAC | `data/userAccess.ts` |
| Матрица | `components/planning/PlanMonthMatrixPanel.tsx`, `data/planCorrectionWindow.ts` |
| Drawer | `components/PositionDrawer.tsx` (workspace + monthly table), `components/drawer/scenarioTypes.ts` |
| Контекст | `context/MvpAppContext.tsx` |
| Стили | `index.css` (`.slice-toolbar`, `.plan-context-bar`, …) |

**Не трогать без запроса:** `docs/archive/PositionDrawer.baseline.tsx`

---

## Архив

`docs/SESSION-*.md`, `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md` — не читать при старте.
