# AGENTS.md — ФОТ-планировщик

Инструкции для AI-агентов в этом репозитории. Подробности — в `docs/`; здесь только ориентация и жёсткие ограничения.

---

## Проект

Веб-планирование **ФОТ по позициям** (слотам): годовой план, квартальные корректировки, план–факт, версии, RBAC (демо на фронте).

**Текущий scope:** только `mvp/frontend/`. PostgreSQL, API, Kaiten-интеграция — **отложены** (фаза 3+).

**Стек:** React 19, TypeScript, Vite 8, React Router 7, Vitest. Без UI-библиотек — кастомный CSS в `index.css`.

---

## Команды

Рабочая директория: `mvp/frontend/`

```powershell
cd mvp/frontend
npm run dev      # http://localhost:5174/
npm test         # vitest run
npm run build    # tsc -b && vite build
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

Карта всех docs: `docs/CONTEXT-MAP.md`.

**Не читать при старте:** `docs/SESSION-*.md`, `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md` — архив.

---

## Жёсткие продуктовые правила

Нарушение этих правил = регресс; не «упрощать» без запроса.

- **Факт не правит план.** Факт только показывает отклонения (Δ); не создаёт событий и не «чинит» план.
- **«Экономия»** = Δ **план − факт** > 0 в отчёте; **перерасход** = Δ < 0. Не задача и не триггер корректировки.
- **План–факт** сравнивается с **утверждённой** (актуальной) версией, не с устаревшим baseline.
- **Сокращение:** с месяца M позиция `Closed`, ФОТ = 0 в матрице; нет плана на слоте — нет «экономии с планом».
- **Декрет:** замещение только `FROM_LIST` (сотрудник из списка) или `VACANCY` — **без** «Нового сотрудника».
- **Корректировка:** события в черновике только с M<sub>open</sub> (месяц после текущего квартала); правки черновика — только на `/correction`.
- **Зерно времени:** месяц (конец месяца). Центр модели — **Position**, не Employee.
- **RBAC на фронте** (`userAccess.ts`) — прототип UX; реальная безопасность будет на API + RLS.

---

## Структура кода

```
mvp/frontend/src/
  pages/           # экраны (PlanningPage, CorrectionPage, …)
  components/      # UI; planning/, drawer/ — доменные блоки
  data/            # бизнес-логика, расчёты, store (без React)
  context/         # MvpAppContext — глобальное состояние MVP
  types.ts         # общие типы
```

**Слои:** UI только отображает и собирает ввод; формулы и правила — в `data/*.ts`. Тесты рядом: `*.test.ts`.

**Маршруты:** `/` · `/planning` · `/analytics` · `/versions` · `/settings` · `/salary-ranges`  
Корректировка: `/planning?mode=correction`. Согласование/compare: `/versions?tab=approval|compare`.

---

## Ключевые модули

| Область | Файлы |
|---------|-------|
| Планирование / корректировка | `pages/PlanningPage.tsx`, `data/planWorkspaceMode.ts`, `components/planning/PlanContextBar.tsx` |
| Срезы UI | `components/SliceToolbar.tsx`, `components/OrgSliceMultiSelect.tsx`, `data/persistedOrgSlice.ts` |
| Версии / согласование | `pages/VersionsPage.tsx`, `components/planning/PlanApprovalPanel.tsx`, `CorrectionComparePanel.tsx` |
| План–факт / отклонения | `data/planFactMetrics.ts`, `data/planFactVarianceDrivers.ts`, `pages/DeviationPage.tsx` |
| Экспорт CSV (демо) | `data/exportScopedCsv.ts`, `data/exportAuditLog.ts`, `components/ExportCsvActions.tsx` |
| Консолидация | `pages/ConsolidationPage.tsx`, `data/teamConsolidation.ts`, `data/consolidationNav.ts` |
| Матрица | `components/planning/PlanMonthMatrixPanel.tsx`, `data/planCorrectionWindow.ts` |
| Drawer | `components/PositionDrawer.tsx` |
| RBAC (демо) | `data/userAccess.ts`, `components/DemoRoleSelect.tsx` |
| Демо роль | `components/AppLayout.tsx` — select «Роль (демо)» в sidebar |

**Не трогать без запроса:** `docs/archive/PositionDrawer.baseline.tsx` — архив.

---

## UI-конвенции

- Подписи событий: Пересмотр, Выбытие, Найм, Сокращение, Декрет, Перевод… (`formatEventHistory.eventTypeLabel`).
- Drawer: вкладки «Слот и занятость» · «События и ФОТ»; форма «Событие или изменение».
- Цвета строк/ячеек: занято `#f0fdf4`, вакансия `#fffbeb`, закрыто `#fdf2f8` (`table-row--*`, `plan-matrix__cell--status-*` в `index.css`).

---

## Стиль кода

- Минимальный diff; не рефакторить попутно.
- Следовать существующим паттернам в соседних файлах (именование, типы, структура `data/`).
- Комментарии — только для неочевидной бизнес-логики.
- Тесты добавлять для нетривиальной логики в `data/`; не плодить тривиальные assert'ы.
- Не создавать markdown/docs без запроса.

---

## Текущая фаза

**Чекпоинт `UX-3-workspace-drawer`:** F1, F3–F5 + UX-3, **69 tests**, workspace drawer с таблицей месяцев.

**F2 Kaiten UI** — следующий приоритет (`IMPLEMENTATION-STEPS.md`).

**Не повторять без запроса:** UX-4 (Kaiten modal, compact drawer, MetricHelp); визуальный редизайн shell.

PG/API (#11+) — не начинать без явного запроса.

---

## Дизайн

Макеты (если нужны для UI): `docs/design/annual-budget-planning-app/source/`.
