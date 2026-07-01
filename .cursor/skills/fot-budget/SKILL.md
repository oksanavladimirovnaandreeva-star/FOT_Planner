---
name: fot-budget
description: >-
  Guides FOT budget planning and approval workflow in mvp/frontend: «Мой бюджет»,
  team/unit/director/C&B chain, demo personas, key data modules, smoke checks,
  and frozen areas. Use when the user mentions бюджет, согласование, пакет юнита,
  сдача команды, Мой бюджет, W1, team submit, package approval, BudgetWorkspace,
  or continues budget/approval work in ФОТ-планировщик.
---

# ФОТ — бюджет и согласование

Компактная шпаргалка для задач по **бюджету и approval**. Не дублирует `AGENTS.md` — жёсткие правила и freeze см. там.

## Быстрый старт

1. Рабочая папка: `mvp/frontend/`. Dev: `npm run dev` → http://localhost:5174/
2. Перед smoke: `/?reset=demo` (или C&B → Настройки → сброс).
3. После правок в `data/` или бизнес-логике: `npm test && npm run build`.

**Документы (только при необходимости):**

| Задача | Читать |
|--------|--------|
| Спор о продукте / план–факт | `docs/PRODUCT-MODEL.md` |
| Состояние репо, маршруты | `docs/HANDOFF.md` |
| Чеклист задач | `docs/IMPLEMENTATION-STEPS.md` |
| Новый чат | `docs/NEW-CHAT-START.md` |

Не читать: `docs/SESSION-*.md`, `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md`.

## Scope

- **Только** `mvp/frontend/`. PG/API/Kaiten — не начинать без явного запроса.
- Сценарий пилота: **годовой план без факта** (`PLAN_SCENARIO_INCLUDES_FACT = false`).
- Коммит/push — **только по просьбе пользователя**.

## Годовой цикл согласования (W1)

Цепочка для демо ИТ / Юнит А / Mobile:

```
team_lead (petya)  →  unit_lead (sidr)  →  director (dir_it)  →  cb (cb)
     team_submit         unit_approve +          director_approve +      cb accept
                         package submit          package submit
```

| Роль | UI | Маршрут |
|------|-----|---------|
| `team_lead` | `TeamLeadApprovalPanel` | `/versions?tab=approval` |
| `unit_lead` | `BudgetWorkspacePanel` level=unit | `/versions?tab=approval` |
| `director` | `BudgetWorkspacePanel` level=department | `/versions?tab=approval` |
| `cb_admin` | `AnnualCbPackagePanel` (год без кварт. черновика) | `/versions?tab=approval` |

**Store:** `teamSubmissionStore.ts` (фазы команды), `packageSubmissionStore.ts` (пакет юнита/департамента).

**Тест цепочки:** `data/approvalWorkflowAnnual.test.ts` — прогонять после правок workflow.

Подробности: [reference.md](reference.md).

## Карта файлов (бюджет)

| Область | Файлы |
|---------|-------|
| Сборка пакета | `buildBudgetPackage.ts`, `resolveBudgetWorkspacePositions.ts` |
| Кнопки submit/approve | `budgetPackageWorkflow.ts`, `packageSubmissionStore.ts` |
| Сдача команды | `teamSubmissionStore.ts`, `submissionWorkflowPolicy.ts` |
| UI лидов | `TeamLeadApprovalPanel.tsx`, `BudgetWorkspacePanel.tsx`, `BudgetContourPanel.tsx` |
| C&B approval | `PlanApprovalPanel.tsx`, `AnnualCbPackagePanel.tsx` |
| Deep-link в план | `planningDeepLink.ts` |
| Персона ↔ ростер | `personaRoster.ts`, `demoRosterPins.ts`, `demoSessionStore.ts` |
| Контекст приложения | `context/MvpAppContext.tsx` |

## ⛔ Не трогать без явного запроса

См. раздел **«Заморожено»** в `AGENTS.md`. Кратко:

- `planCorrectionWindow.ts` / `resolveCanEditWorkspace`
- `PlanningPage.tsx`: `applyIndexationToPlan`, `deleteIndexationBatch`
- `MvpAppContext.tsx`: `updateVersionPositions` для индексации
- `demoPlanSeed.ts`, `demoRosterPins.ts`, `personaRoster.ts`
- `positionDisplay.ts`: `formatEmployeeIdForDisplay`

Перед касанием: `npm test -- planCorrectionWindow massIndexation positionDisplay demoPlanSeed personaRoster`.

## Правила агента (важно)

1. **Вопрос пользователя ≠ просьба удалить UI.** «Что за сообщение?» → объяснить текст, не вырезать подсказку.
2. **Минимальный diff.** Одна проблема → один файл (или явно согласованный список).
3. **Не «чистить шум» оптом** — убирать только то, что пользователь назвал (или показал на скрине).
4. **Не рефакторить «заодно»** workflow, индексацию, login, таблицу позиций в одной задаче.
5. **KPI «Мой бюджет» = срез `filterPositionsByRole`** (как на «Планировании»): тимлид — команда без себя; юнит-лид — юнит без себя; директор — департамент без себя. Не суммировать `versionDiff` целиком.
6. **Не грузить лишний контекст** — не читать весь `src/`, не открывать Playwright-логи без запроса.

### Известные UI-нюансы

- Дубль «вакансия»: роль в сиде `Engineer (вакансия)` + статус «Вакансия» в `PositionIdentityCell` — чинить **только** условием «не дублировать статус», не менять сид.
- «Согласующий вернул — исправьте и сдайте снова» — подсказка `TeamLeadApprovalPanel` при статусе `returned`; комментарий — в `submission.returnedNote`.

## Smoke (6 шагов)

| # | Действие | Ожидание |
|---|----------|----------|
| 1 | `/?reset=demo` | Чистый сид |
| 2 | `dir_it` (Орлов) | Контур → Сидор → планирование, 1 позиция директора |
| 3 | `sidr` | «Мой бюджет»: ФОТ > 0, плитки команд |
| 4 | `petya` (Mobile) | KPI, сдача команды |
| 5 | Пакет юнита | Submit **один раз**, без повторной кнопки |
| 6 | `npm test && npm run build` | Все тесты, build green |

Дополнительно: `tl_qa` (Качество) — позиции и ФОТ > 0.

## Команды

```powershell
cd mvp/frontend
npm run dev
npm test
npm test -- approvalWorkflowAnnual budgetPackageWorkflow teamSubmission
npm run build
```

## Дополнительно

- Персоны, фазы, маршруты, глоссарий UI: [reference.md](reference.md)
