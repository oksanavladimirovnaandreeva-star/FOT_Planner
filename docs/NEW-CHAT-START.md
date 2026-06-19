# Старт нового чата — ФОТ-планировщик

Скопируй блок ниже в **первое сообщение** нового чата.

---

## Сообщение для агента (copy-paste)

```
Продолжаем ФОТ-планировщик (mvp/frontend). Прочитай docs/HANDOFF.md и docs/NEW-CHAT-START.md.

Контекст: вариант A «Мой бюджет», новая демо-оргструктура (Департамент ИТ/HR/Продажи, юниты, русские названия команд), 15 персон, годовой сид без квартала. DEMO_SEED_VERSION=11, авто-миграция localStorage (demoStorageMigration.ts).

Состояние кода: много незакоммиченных изменений (см. git status). Тесты 162, build green. Коммит/push — только по моей просьбе.

Проблема пользователя: в браузере «не работало» — нули в планировании, пустой «Мой бюджет», старые ProductDev/Engineering в данных. Лечение: ?reset=demo или F5 после миграции v11. Dev-сервер: cd mvp/frontend && npm run dev → http://localhost:5174/ (не 5173).

Сделано в UI:
- Login: optgroup Департамент→Юнит→Команда
- Мой бюджет (unit_lead/director): KPI + «Ваш контур» (плитки команд) + таблица команд
- Планирование: deep-link ?team=Качество; «Диапазоны» только у C&B на планировании
- Настройки C&B: доступы команд + доступы к диапазонам

Задача на сессию (по приоритету):
1. Убедиться что localhost:5174 открывается и демо работает после ?reset=demo — smoke: Татьяна Белова (Качество) видит позиции; Сидор Морозов — бюджет юнита А с ФОТ и плитками; Пётр Сидоров → сдача Mobile → Морозов в очереди.
2. Если что-то сломано — минимальный фикс, без лишнего рефакторинга.
3. После стабилизации — предложить один коммит (не делать без просьбы).

Ограничения: scope mvp/frontend; не трогать PG/API; не UX-4; AGENTS.md — ориентация.
```

---

## Быстрый smoke-чеклист

| # | Действие | Ожидание |
|---|----------|----------|
| 1 | `cd mvp/frontend` → `npm run dev` | `http://localhost:5174/` |
| 2 | Открыть `/?reset=demo` | Сброс localStorage |
| 3 | Login → **Татьяна Белова** | Планирование: команда «Качество», позиции > 0, ФОТ > 0 |
| 4 | Login → **Сидор Морозов** | Мой бюджет: плитки 4 команд, таблица с суммами |
| 5 | Login → **Пётр Сидоров** | Мой бюджет: KPI команды Mobile, можно сдать |
| 6 | `npm test && npm run build` | 162 tests, без ошибок |

---

## Дальнейший план (после стабилизации)

| Приоритет | Задача | Где |
|-----------|--------|-----|
| P0 | Закоммитить стабильный срез «демо-орг + мой бюджет + миграция» | git |
| P1 | F2 Kaiten UI (найм/ОТиЗ из позиции, без API) | IMPLEMENTATION-STEPS F2 |
| P2 | Полный smoke согласования: team → unit → director → C&B | PlanApprovalPanel |
| P3 | План–факт: `PLAN_SCENARIO_INCLUDES_FACT = true` | planScenario.ts |
| — | PG/API | только по явному запросу |

---

## Файлы, которые трогали последние сессии

**Новые (untracked):**  
`BudgetWorkspacePanel.tsx`, `BudgetContourPanel.tsx`, `BudgetTeamsTable.tsx`, `BudgetChangesByType.tsx`,  
`buildBudgetPackage.ts`, `buildBudgetContour.ts`, `teamRosterSummary.ts`, `demoRosterPins.ts`,  
`demoStorageMigration.ts`, `demoOrg.ts`, `packageSubmissionStore.ts`, `resolveBudgetWorkspacePositions.ts`,  
`catalogVisibility.ts`, тесты `*.test.ts` к ним.

**Изменённые (modified):**  
`demoPersonas.ts`, `demoVersionSeed.ts`, `demoPlanSeed.ts`, `MvpAppContext.tsx`, `LoginPage.tsx`,  
`PlanningPage.tsx`, `SettingsPage.tsx`, `TeamLeadApprovalPanel.tsx`, `PlanApprovalPanel.tsx`,  
`userAccess.ts`, `orgStructureStore.ts`, `index.css`, … — полный список: `git status`.

---

## Что не делать

- Не менять `.cursor/plans/*` без запроса.
- Не коммитить `.playwright-mcp/`, `tmp-*`, `annual-eval/`, посторонние скрипты.
- Не добавлять UI-библиотеки.
- Не «чинить» localhost сменой порта/конфига без проверки — сначала `mvp/frontend`, порт 5174.
