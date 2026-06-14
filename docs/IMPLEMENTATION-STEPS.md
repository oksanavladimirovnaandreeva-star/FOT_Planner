# План реализации (по шагам)

**Обновлено:** 2026-06-14 · Чекпоинт **UX-3-workspace-drawer** · Продукт: [`PRODUCT-MODEL.md`](PRODUCT-MODEL.md) · Handoff: [`HANDOFF.md`](HANDOFF.md)

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
| F2 | **Kaiten UI** (найм/ОТиЗ из позиции, без API) | `[ ]` |
| F3 | Консолидация unit_lead + ссылки корректировка/compare | `[x]` |
| F4 | Матрица: визуально закрытые месяцы до M<sub>open</sub> | `[x]` |
| F5 | План–факт: Δ план−факт, драйверы «почему», multi-on-seat | `[x]` |

## UX-4 — отложено (не в checkpoint UX-3-workspace-drawer)

| # | Задача | |
|---|--------|---|
| UX-4 | Модалка массовых действий, MetricHelp, UnitLead strip, compact drawer | `[ ]` отложено |

**В checkpoint:** inline массовая индексация на Planning; drawer `drawer--workspace` с таблицей месяцев (см. HANDOFF).

## Фаза 3+ — PG, ИБ, инфра

| 11+ | PG, API, CSV import server-side, export_log, SSO… | `[ ]` |

**ИБ:** [`SECURITY-REQUIREMENTS.md`](SECURITY-REQUIREMENTS.md)
