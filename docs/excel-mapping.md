# Mapping колонок Excel → сущности ФОТ-планировщика

Шаблоны CSV лежат в `docs/templates/`. При получении реальной книги Excel — сверить заголовки с этой таблицей.

## Лист «Сотрудники» (`employees.csv`)

| Колонка Excel | Поле системы | Обязательно |
|---------------|--------------|-------------|
| employee_id | Employee.external_id | да |
| full_name | Employee.full_name | нет |
| position_id | Position.external_id | да |
| specialization | Assignment.specialization | да |
| level | Assignment.level | да |
| org_unit_code | OrgUnit.code | да |
| assignment_valid_from | Assignment.valid_from | да |
| assignment_valid_to | Assignment.valid_to | нет |
| base_dec | DecSnapshot.BASE | да* |
| bonus_dec | DecSnapshot.BONUS_PLAN | нет |
| rk_sn_dec | DecSnapshot.RK_SN | нет |
| currency | currency code | нет (RUB) |

## Лист «Позиции» (`positions.csv`)

| Колонка | Поле |
|---------|------|
| position_id | Position.external_id |
| org_unit_code | OrgUnit.code |
| specialization | Position.specialization |
| level | Position.level |
| limit_flag | IN_LIMIT / OVER_LIMIT / UNLIMITED |
| is_vacancy | true/false |

## Лист «Оргструктура» (`org_units.csv`)

| Колонка | Поле |
|---------|------|
| org_unit_code | OrgUnit.code |
| org_unit_name | OrgUnit.name |
| parent_code | OrgUnit.parent (пусто = корень) |

## Лист «Грейд-сетка» (`salary_ranges.csv`)

| Колонка | Поле |
|---------|------|
| specialization | band.specialization |
| level | band.level |
| min_salary | band.min_salary |
| midpoint | band.midpoint |
| max_salary | band.max_salary |
| currency | band.currency |
| effective_from | catalog.valid_from |

## Лист «Факт» (`fact.csv`) — этап 2

| Колонка | Поле |
|---------|------|
| employee_id | Fact.employee_id |
| year | Fact.year |
| month | Fact.month (1-12) |
| article_code | BASE / BONUS_PLAN / … |
| amount | сумма |
| currency | валюта |
