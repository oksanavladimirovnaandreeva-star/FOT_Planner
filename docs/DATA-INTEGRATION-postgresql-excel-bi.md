# Связка Excel → PostgreSQL → приложение → Power BI

Документ для перехода MVP с локальных mock-данных (`mvp/frontend`, localStorage) на PostgreSQL и таблицы из Excel.

**Сейчас:** UI в [`mvp/frontend/`](../mvp/frontend/), без БД.  
**Опора для PG:** `docs/ARCHITECTURE-v0.1.md`, `apps/api/app/models.py`, шаблоны `docs/templates/*.csv`.

> **ИБ:** в проде импорт в приложение — **CSV** (не xlsx), права на импорт по permission, журнал загрузок. Экспорт — только видимый срез + audit. См. [`SECURITY-REQUIREMENTS.md`](SECURITY-REQUIREMENTS.md).

---

## 1. Идея: одна модель, три входа

```
Excel (источник загрузки)  ──импорт──►  PostgreSQL (истина)
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
              FastAPI (recalc)          MVP / Web UI              Power BI
              planned_events            планирование              отчёты
              monthly_plan_lines        план-факт
              monthly_fact_lines
```

**Правило:** в UI и BI не считать ФОТ формулами — только поля из `monthly_plan_lines` / `monthly_fact_lines` после `recalculate`.

---

## 2. Ядро таблиц PostgreSQL (уже в проекте API)

| Таблица | Аналог в Excel / BI | Назначение |
|---------|-------------------|------------|
| `org_units` | Справочник подразделений | Дерево dept / unit / team |
| `positions` | Список позиций (П001…) | Слот, лимит, вакансия |
| `employees` | Сотрудники | E001, ФИО |
| `position_assignments` | Назначения | Кто на какой позиции, spec/level, период |
| `salary_range_catalog` + `salary_range_bands` | Грейд-сетка / диапазоны | spec + level → min/mid/max |
| `plan_versions` | Версия бюджета 2026 | baseline, корректировки |
| `dec_snapshots` | Декабрь прошлого года BASE | База dec→dec |
| `planned_events` | Журнал изменений | Индексация, найм, перенос… |
| `monthly_plan_lines` | План помесячно | position × month × article |
| `monthly_fact_lines` | Факт из Excel | employee × month × article |
| `import_batches` | (создать при миграции) | Аудит загрузок |

Связи:

- `positions.org_unit_id` → `org_units.id`
- `position_assignments.position_id` → `positions.id`
- `position_assignments.employee_id` → `employees.id`
- `monthly_plan_lines.plan_version_id` + `position_id` (+ `employee_id`)
- `monthly_fact_lines.plan_version_id` + `employee_external_id` (ключ как в Excel)

---

## 3. Как положить ваш Excel

### Шаг A — сопоставить листы с шаблонами

В репозитории уже есть CSV-шаблоны импорта:

| Файл шаблона | Что загружать |
|--------------|---------------|
| `docs/templates/org_units.csv` | Оргструктура |
| `docs/templates/positions.csv` | Позиции |
| `docs/templates/employees.csv` | Сотрудники |
| `docs/templates/salary_ranges.csv` | Диапазоны |
| `docs/templates/fact.csv` | Факт помесячно |

Экспортируйте листы Excel в CSV с **теми же колонками** (или добавьте mapping в `apps/api/app/services/import_csv.py`).

### Шаг B — порядок загрузки

1. `org_units`
2. `salary_range_catalog` + bands (год плана)
3. `positions`
4. `employees` + `position_assignments`
5. `dec_snapshots` (дек прошлого года по позиции)
6. Создать `plan_version` (DRAFT)
7. `planned_events` (если есть история) или начать план с seed
8. `POST .../recalculate` — заполнить `monthly_plan_lines`
9. `fact.csv` → `monthly_fact_lines` (отдельно по месяцам)

### Шаг C — PostgreSQL

1. Создать БД `fot_planner`.
2. В `apps/api` переключить `DATABASE_URL` на PostgreSQL (сейчас SQLite для демо).
3. Прогнать Alembic-миграции (следующий инфра-шаг) или один раз поднять схему из `models.py`.

---

## 4. Power BI — как связать с теми же таблицами

### Вариант 1 (рекомендуется): DirectQuery / Import из PostgreSQL

Подключение к тем же таблицам, что и API. В модели BI:

**Измерения (dimensions):**

- `DimOrg` ← `org_units` (иерархия parent_id)
- `DimPosition` ← `positions`
- `DimEmployee` ← `employees`
- `DimDate` ← календарь (год, месяц 1–12)
- `DimLimitFlag` ← IN_LIMIT / OVER_LIMIT
- `DimPlanVersion` ← `plan_versions`

**Факты (facts):**

- `FactPlan` ← `monthly_plan_lines` (amount, article: BASE / BONUS_PLAN / TOTAL)
- `FactActual` ← `monthly_fact_lines`
- `FactBudgetRow` ← view/API `GET /plans/{id}/budget` (если удобнее плоская витрина)

**Связи в BI:**

```
DimDate[Month] ──► FactPlan[month]
DimPosition[position_id] ──► FactPlan[position_id]
DimPlanVersion[id] ──► FactPlan[plan_version_id]
```

План-факт:

```dax
Plan YTD = SUM(FactPlan[amount])
Fact YTD = SUM(FactActual[amount])
Variance = [Fact YTD] - [Plan YTD]
```

Фильтр версии плана — срез `DimPlanVersion[label]` (как в ТЗ: пользователь выбирает версию для сравнения).

### Вариант 2: Excel в BI только как staging

Если пока нет PG в BI:

1. Excel → Power Query → нормализация в те же имена колонок, что в шаблонах.
2. Загрузка в PostgreSQL скриптом / API import.
3. BI подключается уже к PG (один источник правды).

Не держите «боевой» план одновременно в Excel и в PG без синхронизации.

---

## 5. Соответствие экранам MVP

| Экран MVP | Таблицы / API |
|-----------|----------------|
| Обзор | агрегат `monthly_plan_lines` + `monthly_fact_lines`, срез limit_flag |
| Планирование | `positions`, `planned_events`, recalc |
| Диапазоны | `salary_range_bands` |
| План-факт | plan vs fact по org / month |
| Отклонения | variance views |

После подключения API заменить `MvpAppContext` mock на `fetch('/api/v1/...')`.

---

## 6. Практический порядок работ (2–3 недели)

| # | Задача | Результат |
|---|--------|-----------|
| 1 | PostgreSQL + Alembic, `DATABASE_URL` | Схема в PG |
| 2 | Импорт ваших Excel → CSV по шаблонам | Данные в PG |
| 3 | `recalculate` на реальном плане | `monthly_plan_lines` |
| 4 | Импорт факта за 1–2 месяца | План-факт в UI |
| 5 | Витрины / views для BI | Power BI на PG |
| 6 | MVP frontend → API | Один контур с BI |

---

## 7. Что прислать для точного mapping

Чтобы сделать скрипт импорта под **ваши** листы Excel (не демо):

1. Список листов и назначение каждого.
2. Пример 5–10 строк с заголовками (без персональных данных).
3. Как в BI сейчас называются ключи: ID позиции, ID сотрудника, месяц, статья (BASE/премия).
4. Одна выбранная версия плана на 2026.

По ним можно добавить `docs/excel-mapping.md` и доработать `import_csv.py` под прямой импорт.

---

*Связано: `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md` этап 3 (PostgreSQL), `docs/ARCHITECTURE-v0.1.md`.*
