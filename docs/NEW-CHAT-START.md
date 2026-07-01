# Старт нового чата — ФОТ-планировщик

Скопируй блок ниже в **первое сообщение** нового чата.

---

## Сообщение для агента (copy-paste)

```
Продолжаем ФОТ-планировщик — только mvp/frontend, по скиллу @fot-budget.

Прочитай: docs/NEW-CHAT-START.md, docs/HANDOFF.md, AGENTS.md.

Последние коммиты:
- 15f2e6b — budget UX, vacancy flow, annual approval
- 750cb59 — SalaryBandHint (компонент + data + CSS), в формы НЕ подключён

НЕ закоммичено (рабочая копия, 189 tests, build green):
- UX-шум: PlanContextBar (1 баннер + «Подробнее»), дедуп индексации лидов, таблица/drawer/login/«Мой бюджет»
- KPI: TeamLeadApprovalKpi + AnalyticsSummaryStrip — дек→дек в долях прироста (formatGrowthShareLine)
- positionDisplay: id лидов только в drawer, positionScenarioHints (в drawer ещё не выведены)
Коммит/push — только по моей просьбе.

Сценарий: годовое планирование без факта (PLAN_SCENARIO_INCLUDES_FACT=false).
DEMO_SEED_VERSION=13. Сброс: ?reset=demo или C&B → Настройки.

Dev: cd mvp/frontend && npm run dev → http://localhost:5174/
Deploy: https://oksanavladimirovnaandreeva-star.github.io/FOT_Planner/

Задача нового чата: продолжить UI/UX roadmap (см. «Оставшиеся пункты» ниже).
Жёстко: НЕ ломать функционал, НЕ трогать freeze (индексация C&B, resolveCanEditWorkspace, MassIndexationCompact).

Smoke: ?reset=demo → petya (Mobile KPI + сдача) → sidr (пакет) → dir_it (контур).
```

---

## Что уже сделано (UX, не в push)

| Область | Сделано |
|---------|---------|
| **Мой бюджет** | Меньше дублей статуса/версии/контура; KPI как карточки analytics-strip; дек→дек в **долях** прироста |
| **Планирование — баннеры** | `PlanContextBar`: 1 главный + «Подробнее (N)»; «команда сдана» внутри бара; у лидов убран второй `PlanIndexationSection` |
| **Таблица** | Без «· В штате», без `N соб.`, `(P…)` у тимлида/юнит-лида; сценарные плашки убраны из таблицы |
| **Drawer** | `positionScenarioHints` в data — **показ в drawer не подключён** |
| **Логин** | C&B без повтора роли на кнопке |
| **Вакансии** | Модалка/drawer (коммит 15f2e6b) |
| **Метрики** | `formatGrowthShareLine` — доля% · сумма ₽ (без YoY +883% на агрегате) |

**Не сделано / слабый эффект:** sticky-обёртка `SliceToolbar` + KPI в одной полосе; `SalaryBandHint` в модалке/drawer; in-app confirm; inbox «Ждут (N)»; a11y строк таблицы.

---

## Оставшиеся пункты UI/UX (roadmap)

### Этап 1 — закрыть текущий срез (~0.5 дня)

| # | Задача | Файлы | Риск |
|---|--------|-------|------|
| 1.1 | **Закоммитить** uncommitted UX + KPI | см. git status | — |
| 1.2 | **Drawer:** показать `positionScenarioHints` (Временная замена / Нет переноса) | `PositionDrawer.tsx`, `positionDisplay.ts` | Низкий |
| 1.3 | **Sticky:** обёртка `SliceToolbar` + `AnalyticsSummaryStrip` на вкладке «Позиции» | `PlanningPage.tsx`, `index.css` | Низкий |

### Этап UX-A — шум и дубли (1–2 дня, display-only)

| # | Задача | Где |
|---|--------|-----|
| A1 | Единый блок «Статус» тимлида: бейдж + кто вернул + комментарий + CTA в одной карточке | `TeamLeadApprovalPanel.tsx` |
| A2 | Юнит-лид: сжать pipeline + прогресс «3/4 команд» (без дубля статуса) | `BudgetWorkspacePanel.tsx` |
| A3 | QA-бейджи / редкие meta — только drawer или hover | `PlanningPage.tsx`, `PositionIdentityCell` |
| A4 | Breadcrumb drill-down на `/versions?tab=approval` | `VersionsPage.tsx` |

### Этап UX-B — in-app confirm (2–3 дня)

Заменить `window.confirm` / `prompt` на inline в карточке (store не менять):

1. `TeamLeadApprovalPanel` — сдача команды  
2. `BudgetWorkspacePanel` / `PlanApprovalPanel` — submit/return пакета  
3. `PlanningPage` — применить/удалить индексацию (осторожно: freeze)

### Этап UX-C — согласование как продукт (3–5 дней)

| # | Задача |
|---|--------|
| C1 | Inbox «Ждут решения (N)» над таблицей команд (юнит/директор/C&B) |
| C2 | Прогресс сдачи команд в одной строке (не размазан по секциям) |

### Этап UX-D/E — позже

- Вкладки в `PositionDrawer` (~1500 строк) — отдельный чат  
- `tabIndex` + Enter на строках таблицы  
- `SalaryBandHint` → модалка «Новая позиция» + drawer (шаги 3–4, компонент готов в 750cb59)  
- Консолидация CSS tokens (figma-shell vs index.css)

### Не делать без явного запроса

- UX-4 / полный visual redesign shell  
- PG/API, Kaiten F2  
- Рефактор `resolveCanEditWorkspace`, `applyIndexationToPlan`, `updateVersionPositions`, демо-сид индексации  
- Сливать вкладки год/квартал в один sticky-блок

---

## Быстрый smoke-чеклист

| # | Действие | Ожидание |
|---|----------|----------|
| 1 | `cd mvp/frontend` → `npm run dev` | http://localhost:5174/ |
| 2 | `/?reset=demo` | Сброс localStorage |
| 3 | **petya** → Планирование Mobile | Таблица без «В штате», без `(P…)`; id в drawer |
| 4 | **petya** → Мой бюджет | KPI-карточки; дек→дек: доли + ₽, не +883% |
| 5 | **petya** → Планирование (2+ баннера) | Один баннер + «Подробнее» |
| 6 | **sidr** | Пакет, 4 команды, ФОТ > 0; при return — комментарий отдельной строкой |
| 7 | **cb** → Планирование | Индексация только в шапке |
| 8 | `npm test && npm run build` | 189 tests |

---

## Дальнейший план (продукт)

| Приоритет | Задача |
|-----------|--------|
| P0 | UI/UX этапы 1 → UX-A → UX-B (этот чат) |
| P0 | W1–W3 согласование end-to-end (после UI или параллельно) |
| P1 | Коммит + push стабильного среза — по просьбе |
| P2 | Repository layer B1 |
| — | PG/API, Kaiten — только по запросу |

---

## Ключевые файлы (UX-сессия)

`PlanContextBar.tsx` · `PlanningPage.tsx` · `TeamLeadApprovalKpi.tsx` · `AnalyticsSummaryStrip.tsx` · `formatDisplay.ts` (`formatGrowthShareLine`) · `positionDisplay.ts` · `PositionIdentityCell.tsx` · `TeamLeadApprovalPanel.tsx` · `BudgetWorkspacePanel.tsx` · `LoginPage.tsx` · `SalaryBandHint.tsx` (не подключён)

Freeze: `planCorrectionWindow.ts`, `PlanIndexationSection` + `MassIndexationCompact`, `demoPlanSeed.ts`, `MvpAppContext.updateVersionPositions`
