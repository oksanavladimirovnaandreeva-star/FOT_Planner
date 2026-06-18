# Handoff: ФОТ-планировщик MVP

**Обновлено:** 2026-06-18  
**Чекпоинт:** `pilot-annual-planning` · git `cf462b7`+ · **132 tests**  
**Проект:** [`mvp/frontend/`](../mvp/frontend/) — единственный UI в работе. PG/API — после фронта.

**Документы:** [`PRODUCT-MODEL.md`](PRODUCT-MODEL.md) · [`IMPLEMENTATION-STEPS.md`](IMPLEMENTATION-STEPS.md) · [`SECURITY-REQUIREMENTS.md`](SECURITY-REQUIREMENTS.md) · [`CONTEXT-MAP.md`](CONTEXT-MAP.md)

---

## Запуск

```powershell
cd mvp\frontend
npm install          # первый раз
npm run dev          # http://localhost:5174/
npm test             # 132 теста
npm run build
```

**Данные:** localStorage + sessionStorage. API и PostgreSQL **не нужны**.

**Вход:** `/login` — выбор персоны (ФИО · роль). Сессия в `fot_mvp_demo_persona_id`.

**Пилот:** C&B → **Настройки → Данные** → «Пилот (тяжёлый)» (~520 поз.) или демо ~40 поз.  
**Сброс:** `?reset=demo` в URL или «Сбросить пилот / план» в настройках.

---

## Сценарий MVP (июнь 2026)

**Годовое планирование без факта:** `PLAN_SCENARIO_INCLUDES_FACT = false` в `data/planScenario.ts` — факт не сидится, «Аналитика» скрыта, `/analytics` → `/planning`. План–факт вернём отдельной итерацией.

---

## Навигация

| Маршрут | Назначение |
|---------|------------|
| `/login` | Вход по персоне (демо) |
| `/` | **Обзор и итого** — KPI, план (без факта в текущем сценарии) |
| `/planning` | **Планирование** — позиции, матрица, журнал |
| `/planning?mode=correction` | **Квартальное планирование** (квартальный черновик) |
| `/versions` | **Версии** (C&B) или **Согласование** (лиды) |
| `/versions?tab=approval` | Control Tower согласования |
| `/versions?tab=compare` | Сравнение черновика |
| `/versions?tab=consolidation` | Консолидация тимлидов |
| `/settings` | Настройки (C&B / директор / GD — полные) |
| `/salary-ranges` | Справочник диапазонов окладов |

**Редиректы:** `/correction` → planning+correction · `/consolidation` → versions · `/analytics` → planning (пока сценарий без факта)

**Вкладки планирования:** `?tab=positions|matrix|journal`

---

## Версии (именование)

| Версия | UI-название |
|--------|-------------|
| Первая утверждённая | **Бюджет {год}** |
| Квартальный черновик / опубликованная корректировка | **{n} Квартал {год}** |

C&B: утверждение / открытие бюджета / удаление единственной v1 / создание квартального черновика — `VersionsPage`, `planVersionLifecycle.ts`.

---

## Индексация (массовая, C&B)

- UI: `PlanIndexationSection` на вкладке **Позиции** (под контекстным баром).
- C&B: форма + **таблица истории** с урной на каждый пакет (`MassIndexationCompact`).
- Лиды / остальные: баннер **«Индексация в плане»** со списком всех пакетов (`PlanIndexationBanner`).
- Удаление пакета → `removeIndexationBatchFromPositions` + пересчёт окладов.
- Автоприменение индексации к новым позициям при найме/переводе **отключено**.

---

## Диапазоны окладов

- `/salary-ranges` — таблица с **сортировкой по любому столбцу** (клик по заголовку).
- **Доступ к редактированию** — по персонам (C&B → collapse «Доступ к диапазонам»), `demoSessionStore` + `SalaryCatalogAccessPanel`.
- При **добавлении позиции** — специализация и уровень только из справочника; оклад по умолчанию = мид диапазона.

---

## RBAC (демо)

- Персоны: `demoPersonas.ts`, срезы: `personaAccessScope.ts`, вход: `LoginPage` + `RequireDemoSession`.
- Массовая индексация — только `cb_admin`.
- Версии / импорт / пилот — только C&B.
- Сайдбар: `PlanWorkspaceContext` — **Утверждённый бюджет** vs **Работаем в**.

---

## Сделано (не откатывать)

- F1, F3–F5, UX-3, workspace drawer, Control Tower
- Пилот: персоны, lifecycle бюджета, UI для лидов, производительность аналитики (когда включим факт)
- Индексация: история, удаление, баннер для лидов
- `planScenario.ts` — отключение факта в годовом пилоте

---

## Следующий шаг

1. **Smoke-тест** пилота по всем персонам
2. **F2** — Kaiten UI (без API)
3. Включить **план–факт** (`PLAN_SCENARIO_INCLUDES_FACT = true`) + доработка аналитики
4. **PG/API (#11+)** — только по явному запросу

---

## Ключевые файлы

| Область | Путь |
|---------|------|
| Вход / персоны | `pages/LoginPage.tsx`, `data/demoPersonas.ts`, `data/demoSessionStore.ts` |
| Версии | `pages/VersionsPage.tsx`, `data/planVersions.ts`, `data/planVersionLifecycle.ts` |
| Индексация | `components/planning/PlanIndexationSection.tsx`, `MassIndexationCompact.tsx`, `data/planningData.ts` |
| Сценарий без факта | `data/planScenario.ts` |
| Диапазоны | `pages/SalaryRangesPage.tsx`, `components/settings/SalaryCatalogAccessPanel.tsx` |
| Планирование | `pages/PlanningPage.tsx`, `components/planning/PlanContextBar.tsx` |
| Контекст | `context/MvpAppContext.tsx` |

**Архив:** `docs/SESSION-*.md`, `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md`
