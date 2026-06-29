# План реализации (по шагам)

**Обновлено:** 2026-06-23 · Чекпоинт **pilot-annual-planning + вариант A** · **176 tests** · Продукт: [`PRODUCT-MODEL.md`](PRODUCT-MODEL.md) · Handoff: [`HANDOFF.md`](HANDOFF.md) · Старт чата: [`NEW-CHAT-START.md`](NEW-CHAT-START.md)

`[x]` сделано · `[ ]` дальше · Коммиты — по просьбе · После шага: `npm run build` (+ `npm test` при data/logic)

---

## Фаза 1 — Фронт

| # | Шаг | |
|---|-----|---|
| 1 | Вкладка **По месяцам**: матрица, план + факт + отклонения | `[x]` |
| 2 | Факт: несколько `employee_id` на position+month | `[x]` |
| 3 | Сокращение: с M план = Closed, ФОТ 0 в матрице | `[x]` |
| 4 | Импорт факта: превью `tariff_salary` + lines schema | `[x]` |
| 5 | План–факт: подпись версии сравнения | `[x]` |
| 6 | Окно квартала: блок событий до M<sub>open</sub> (июль) | `[x]` |
| 7 | Индексация C&B: баннер; скрыть массовую для тимлида | `[x]` |

## Фаза 2 — Роли

| 8 | RBAC team / директор freeze / C&B | `[x]` |
| 9 | Режим корректировка = planning + allowedMonths | `[x]` |
| 10 | Compare + лимит при корректировке | `[x]` |

## Фаза 2.5 — UI и handoff

| # | Задача | |
|---|--------|---|
| U1 | Навигация B: 4 пункта, корректировка/консолидация как режимы | `[x]` |
| U2 | Расширенное демо + RBAC-срезы | `[x]` |
| U3 | Мультивыбор срезов | `[x]` |
| U4 | Drawer позиции: workspace + вкладки + таблица месяцев | `[x]` |
| U5 | Нейтральная палитра | `[x]` |
| U6 | Запуск из корня | `[x]` |

## UX-3 структура (без смены shell, июнь 2026)

| # | Задача | |
|---|--------|---|
| UX-3a | PlanContextBar, approval/compare → Versions | `[x]` |
| UX-3b | Compact KPI Planning, persisted org slice | `[x]` |
| UX-3c | DemoRoleSelect в sidebar, Settings nav RBAC | `[x]` |
| UX-3d | SliceToolbar — единая панель срезов | `[x]` |
| UX-3e | planVersionDisplay, workflow hints reset | `[x]` |

## Фронт — продолжение

| # | Задача | |
|---|--------|---|
| F1 | Экспорт CSV + демо audit (`exportAuditLog`) | `[x]` |
| F2 | **Kaiten UI** (найм/ОТиЗ из позиции, без API) | `[~]` **отложено** — вне пилота |
| F3 | Консолидация unit_lead + ссылки корректировка/compare | `[x]` |
| F4 | Матрица: визуально закрытые месяцы до M<sub>open</sub> | `[x]` |
| F5 | План–факт: Δ план−факт, драйверы «почему», multi-on-seat | `[x]` |

## Вариант A — «Мой бюджет» + демо-орг (июнь 2026)

| # | Задача | |
|---|--------|---|
| A1 | `BudgetWorkspacePanel` unit_lead + director | `[x]` код, smoke в браузере — **проверить** |
| A2 | Пакетная сдача `packageSubmissionStore` | `[x]` |
| A3 | Демо-орг ИТ/HR/Продажи, 23 персоны, русские команды | `[x]` |
| A4 | Login optgroup, «Ваш контур» (плитки), deep-link планирования | `[x]` |
| A5 | Миграция localStorage `DEMO_SEED_VERSION=12` | `[x]` |
| A6 | Доступы к диапазонам в Настройках C&B | `[x]` |
| A8 | Выравнивание: `personaRoster`, `planningDeepLink`, `budgetPackageWorkflow` | `[x]` код |
| A7 | **Smoke end-to-end** без нулей в браузере | `[x]` 2026-06-24 Playwright |

## Согласование — полный цикл (следующий P0)

| # | Задача | |
|---|--------|---|
| W1 | Smoke: тимлид → юнит-лид → директор → C&B (команда + пакет юнита/департамента) | `[~]` панель C&B для годового цикла; тест `approvalWorkflowAnnual` |
| W2 | Возврат на доработку + повторная сдача без «залипания» кнопок | `[ ]` |
| W3 | C&B: утверждение годового бюджета v1 после приёма пакета | `[ ]` |

## UX-4 — отложено (не в checkpoint UX-3-workspace-drawer)

| # | Задача | |
|---|--------|---|
| UX-4 | Модалка массовых действий, MetricHelp, UnitLead strip, compact drawer | `[ ]` отложено |

**В checkpoint:** массовая индексация на Planning — **только C&B** (`roleCanApplyMassIndexation`), компактный блок в шапке на вкладке «Позиции»; drawer `drawer--workspace` с таблицей месяцев (см. HANDOFF).

## Фаза 3+ — PG, API, ИБ, инфра

| # | Задача | |
|---|--------|---|
| B1 | OpenAPI-контракт из `types.ts` + snapshot schema | `[ ]` |
| B2 | `PlanRepository` / `SubmissionRepository` (local → API) | `[ ]` |
| B3 | Утончить `MvpAppContext` — только state + repos | `[ ]` |
| B4 | Server `recalculate` (синхрон с `applyEvents` или замена) | `[ ]` |
| B5 | `org_id` вместо строк dept/unit/team в workflow keys | `[ ]` |
| B6 | JWT/SSO + RLS; audit `approval_step_log` | `[ ]` |
| B7 | PG, CSV import server-side, export_log | `[ ]` |
| B8 | Вынести демо-bootstrap (`demoRosterPins`, seed v12) из prod path | `[ ]` |

**ИБ:** [`SECURITY-REQUIREMENTS.md`](SECURITY-REQUIREMENTS.md) · **Аудит готовности:** раздел «Готовность к PG/API» в [`HANDOFF.md`](HANDOFF.md)

**Оценка (2026-06-23):** пилот без бэка — готов; production multi-user — после B1–B8.
