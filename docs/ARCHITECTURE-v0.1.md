# Архитектура ФОТ-планировщика v0.1

Документ для ориентации при разработке. Обновлено: 2026-06-07.

> **Текущий код:** [`mvp/frontend/`](../mvp/frontend/) · handoff: [`HANDOFF.md`](HANDOFF.md). Ниже — целевая архитектура (включая legacy `apps/api`).

Связанные документы:
- [`HANDOFF.md`](HANDOFF.md) — актуальное состояние MVP
- `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md` — исторический roadmap (`apps/*`)
- `docs/SECURITY-REQUIREMENTS.md` — требования ИБ (RBAC+scope, audit, CSV, MFA, деплой)
- `mvp/docs/baseline-current-state.md` — зафиксированное поведение MVP (индексация, приоритеты событий)

---

## 1. Цель продукта

Веб-планирование на горизонте **месяц → год**:

- штат / headcount / вакансии + ФОТ;
- позиция в оргструктуре с лимитом (carryover / new);
- версии плана и корректировки;
- план/факт (факт из Excel) и сравнение версий.

**Позже:** сценарии (база/оптимист), полноценный workflow согласования.

---

## 2. Зафиксированные решения

| Тема | Решение |
|------|---------|
| Утверждение | Только **admin** |
| План/факт | В UI пользователь **выбирает версию плана** для сравнения |
| Премия | **Абсолют** (₽/мес), не % от оклада |
| Редактирование | Руководитель — draft в своей ветке оргструктуры; после утверждения — **новая версия** (`parent_version_id`) |
| Факт | Excel — источник правды по факту |
| Пересчёт | Полный `recalculate` версии (инкремент — позже, контракт движка не менять) |

---

## 3. Слои

```
UI (дерево, детализация, дашборд, дроверы)
  → только ввод и отображение, без формул ФОТ

Application (версии, права, события, импорт, сравнения)
  → use-cases, статусы плана, RBAC+scope_org, RLS, audit (см. SECURITY-REQUIREMENTS.md)

Domain (позиция, оргструктура, события, статьи)
  → packages/domain/fot_domain/engine.py

Persistence (SQLite / API)
  → planned_events, monthly_plan_lines, monthly_fact_lines
```

**Правило:** суммы в таблицах — только из `monthly_plan_lines` после `recalculate`, не из React.

---

## 4. Источники правды

```
Справочники (грейды/диапазоны)     Оргструктура + позиции
         │                                    │
         └──────────────┬─────────────────────┘
                        ▼
              PlanVersion (год, status, parent_version_id)
                 ├── dec_snapshots (база декабря)
                 ├── planned_events  ← все изменения плана
                 └── monthly_plan_lines ← результат recalc

Факт (Excel) → monthly_fact_lines

Сравнение: выбранная версия плана ↔ факт (версия выбирается в UI)
```

---

## 5. Ядро сущностей

| Сущность | Назначение |
|----------|------------|
| **OrgUnit** | Дерево (редактируемое), RLS |
| **Position** | Слот: оргструктура, лимит, hire_status, вакансия |
| **PositionAssignment** | Сотрудник ↔ позиция, spec/level, valid_from/to |
| **PlanVersion** | Год, label, status, parent для корректировок |
| **PlannedEvent** | Индексация, найм, увольнение, перевод, декрет, … |
| **MonthlyPlanLine** | Результат: position/employee × month × article |
| **MonthlyFactLine** | Факт: employee × month × article |
| **SalaryRangeCatalog** | Грейды/диапазоны (отдельная вкладка) |

**Центр модели — Position**, не Employee. Вакансия = слот без сотрудника (в движке `VACANCY-{position_id}`).

**История** = интервалы `(valid_from, valid_to)` и цепочка событий, не перезапись одной строки.

---

## 6. Статьи ФОТ (текущий набор)

| Код | Смысл |
|-----|--------|
| `BASE` | Оклад |
| `BONUS_PLAN` | Премия (абсолют, по умолчанию 0) |
| `TOTAL` | Итого (BASE + BONUS_PLAN + …) |

**CR** = `BASE / midpoint` из справочника — показатель, не статья ФОТ.

Расширение: новая статья → `ARTICLES` в domain + порядок в TOTAL + recalc, не дублировать в UI.

---

## 7. События (порядок внутри месяца)

Эталон — `packages/domain/fot_domain/engine.py` и `mvp/docs/baseline-current-state.md`:

1. Базоформирующие: `MANUAL_OVERRIDE`, `TARGET_SALARY`, `CLASSIFICATION_CHANGE`, `PLANNED_HIRE`
2. `INDEXATION`
3. Завершающие: `TERMINATION`, `TERMINATION_TO_VACANCY`, `CLOSE_POSITION`, `CANCEL_VACANCY`, `TRANSFER`, `POSITION_CARRYOVER`

Сортировка: `effective_month → priority → created_order`.

Удаление события → полный пересчёт от seed/dec.

---

## 8. Версионность и права

**Статусы:** `DRAFT` → `APPROVED` → `LOCKED` (утверждение/блок — admin).

| Действие | Руководитель (scope) | Admin |
|----------|----------------------|-------|
| Просмотр план/факта | ✓ | ✓ |
| Правки draft | ✓ | ✓ |
| Утверждение / lock | ✗ | ✓ |
| Корректировка (новая версия) | по политике | ✓ |
| Импорт факта, грейды | ✗ | ✓ |

**После APPROVED:** не править in-place → `POST /plans` с `parent_version_id`.

---

## 9. План/факт и версии

- **План/факт:** в UI два контекста — какая **версия плана** для plan-side; факт привязан к `monthly_fact_lines.plan_version_id` (импорт на версию).
- **Сравнение версий:** read-model diff по `monthly_plan_lines` + состав позиций/событий (отдельный endpoint, движок не трогать).

Ключи сопоставления факта (не менять без миграции):
- факт: `(employee_external_id, month, article)`
- план: assignment/position + month + article

---

## 10. Структура репозитория (целевая линия)

```
fot-planner/
  apps/api/           FastAPI, модели, recalc, импорт
  apps/web/           React UI (основной фронт)
  packages/domain/    fot_domain/engine.py — единственный движок формул
  mvp/                песочница UI; не дублировать новую логику в planningData.ts
```

**Риск:** три копии логики (`engine.py`, `recalc.py`, `mvp/.../planningData.ts`). Новые события — только в `packages/domain` + API + `apps/web`.

---

## 11. Правила разработки (антипереписывание)

1. Новое событие → domain → тест → API schema → drawer UI.
2. Новая статья → `ARTICLES` + recalc, не размазать по компонентам.
3. Утверждённую версию не мутировать.
4. Факт не смешивать с планом (отдельные таблицы).
5. Baseline MVP (`mvp/docs/baseline-current-state.md`) — истина для индексации, пока не согласовано иное.

---

## 12. Ближайшие архитектурные задачи

1. ~~`POST /plans/{id}/approve` (admin) + 403 на events при `status !== DRAFT`.~~ — **сделано** (`plan_guard`, `POST /api/v1/plans/{id}/approve`).
2. ~~Селектор версии плана на `/variance` + `GET /plans/compare`.~~ — **сделано** (`/variance` selector, `GET /api/v1/plans/compare`).
3. ~~Кнопка «Корректировка» → новая версия с `parent_version_id`.~~ — **сделано** (`POST /api/v1/plans/{id}/correction`, копия events + dec).
4. Заморозить/убрать дубль TS-движка в `mvp/frontend` в пользу API.
5. Compare versions (read-only diff).

---

## 14. Фаза 3+ — черновик (после UX-4 / пилота)

### 14.1 PostgreSQL, `org_units`, RLS, SSO

```text
SSO/JWT → API (RBAC + scope_org) → PostgreSQL RLS
  org_units · positions · plan_versions · plan_events · monthly_fact_lines · users
```

- `org_units(id, parent_id, type, name, materialized_path)` — дерево dept/unit/team
- `users(id, role, scope_org_unit_id)` — из IdP + атрибуты среза
- RLS: строки `positions` видны, если `team_id ∈ visible_teams(user_id)`
- API минимум: `GET /org-units/tree`, `POST /org-units/import-csv`, `GET/PUT /positions`, `POST /plan-versions/{id}/events`
- MVP `localStorage` роли и `ORG_STRUCTURE.ts` — заменить на API; контракт CSV оргструктуры: `department, unit, team`

### 14.2 Маршрут согласования (#19)

| Сущность | Назначение |
|----------|------------|
| `approval_route_templates` | Граф шагов по типу изменения |
| `approval_route_instances` | Экземпляр на `plan_version_id` |
| `approval_step_log` | actor, step, decision, at — append-only |

UI: `GET /plan-versions/{id}/approval-route` → stepper на `/versions` (наблюдение); действия — `submit` / `approve` / `reject` только на API.

Правила назначения шагов — из `planApprovalRules.ts` (transfer, over_limit, mass indexation, headcount_down) + оргструктура.

### 14.3 Настройка доступов и визуализация (MVP+ → prod)

- **Settings → Доступы (C&B):** матрица роль × permission (`plan.edit`, `fact.import`, `export.run`, `approval.submit`)
- **Versions:** горизонтальный stepper состояний шагов (`pending` / `approved` / `rejected`); журнал из `approval_step_log`
- Фаза 1 (без API): статический stepper из `evaluateDraftApprovalRules`; фаза 2 — данные с сервера

---

## 13. Одна строка-напоминание

> **Позиция + события + версия плана — источник правды; строки ФОТ — только после recalc; факт и сравнения — read-only; admin закрывает версию; все формулы — в `packages/domain`.**
