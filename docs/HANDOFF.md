# Handoff: ФОТ-планировщик MVP

**Обновлено:** 2026-06-01  
**Репозиторий:** `c:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner`  
**Scope:** `mvp/frontend/` только. PG/API — после фронта.

**Продукт:** [`PRODUCT-MODEL.md`](PRODUCT-MODEL.md) · **Шаги:** [`IMPLEMENTATION-STEPS.md`](IMPLEMENTATION-STEPS.md) · **Старт чата:** [`NEW-CHAT-PROMPT.md`](NEW-CHAT-PROMPT.md)

---

## Запуск

```powershell
cd c:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner\mvp\frontend
npm run dev    # http://localhost:5174/
npm run build
npm test       # 17 тестов
```

---

## Пять блоков (кратко)

| Блок | Суть |
|------|------|
| A Планирование | События → пересчёт плана; сокращение с M — плана нет |
| B Факт | Импорт; **только отклонения** |
| C Корректировка | С месяца после квартала (Q2→июль) |
| D План–факт | vs **утверждённая** версия |
| E Kaiten | Позже |

**Факт не правит план.** Зерно = конец месяца.

---

## Навигация

| Маршрут | Назначение |
|---------|------------|
| `/planning` | Позиции · **По месяцам** · Журнал · Согласование |
| `/consolidation` | Сводка unit_lead+ |
| `/versions` | Версии |
| `/plan-vs-actual`, `/deviation` | План–факт + баннер baseline |
| `/forecast` | YTD |

---

## Сделано (не откатывать)

- Версии, `planOperations`, approval warn, `teamConsolidation`
- Матрица `/planning?tab=matrix`, мульти-employee факт на position+month
- План–факт: `resolvePlanFactBaseline`, `PlanFactBaselineBanner`
- **Drawer 2 вкладки:** «Слот и занятость» (профиль + `OccupancyTimelineStrip`) · «События и ФОТ» (события + форма + помесячная таблица, колонка «На слоте»)
- Подписи занятости: ФИО / Вакансия / Закрыта (`formatOccupancyMonthLabel`)
- **Декрет:** замещение `FROM_LIST` | `VACANCY` (`maternityReplacementKind`); **без** «Новый сотрудник»
- Headcount: без `Closed`, отдельно «N закрыто»
- **Сокращение (#3):** с M — `Closed`, ФОТ 0 в матрице; помесячно (`isPlanClosedAtMonth`); без Δ на закрытых ячейках
- **Факт (#4):** `monthly_fact_lines` + `tariff_salary`, превью таблицы в «Данные»
- **Квартал (#6):** `resolveCorrectionWindow` — события в черновике только с M<sub>open</sub>
- **Индексация (#7):** баннер пакетов; массовая — admin/unit_lead, не team_lead
- Факт: `employee_id`, reconciliation

---

## Сверка план / факт

| Ситуация | UI |
|----------|-----|
| Двое в факте | Индикатор, без «исправить план» |
| Сокращение | С M нет плана |
| План есть, факт 0 | Только Δ, не задача |
| Факт > план | Перерасход, инфо |

---

## Следующий шаг

**Фаза 1 закрыта.** Далее **#8** в [`IMPLEMENTATION-STEPS.md`](IMPLEMENTATION-STEPS.md) — RBAC (team-only, freeze директора, C&B admin).

---

## Ключевые файлы

| Область | Файл |
|---------|------|
| Планирование | `pages/PlanningPage.tsx` |
| Матрица | `components/planning/PlanMonthMatrixPanel.tsx`, `data/planMonthMatrix.ts` |
| Drawer | `components/PositionDrawer.tsx` |
| Сценарии | `components/drawer/applyScenario.ts`, `scenarioTypes.ts` |
| Занятость | `data/occupancyTimeline.ts` |
| План–факт baseline | `data/planFactBaseline.ts` |
| Факт | `data/factStore.ts`, `factImport.ts` |
| Версии | `data/planVersions.ts`, `context/MvpAppContext.tsx` |

**Архив drawer:** `PositionDrawer.baseline.tsx` — не подмешивать без запроса.

---

## Архив

`SESSION-*.md`, `ПЛАН-ПРОДОЛЖЕНИЯ.md`, `DRAWER-UX.md` — не читать при старте.
