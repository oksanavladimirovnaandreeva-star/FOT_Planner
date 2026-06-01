# Промпт для нового чата (переезд)

**Обновлено:** 2026-06-01  
Скопируй блок ниже целиком в новый чат Cursor.

---

```
ФОТ-планировщик MVP

Репозиторий: c:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner
Scope: ТОЛЬКО fot-planner/mvp/frontend/ (React, in-memory).
НЕ трогать: apps/, mvp/backend, PostgreSQL, Excel, apps/api до явной просьбе.

Запуск:
cd c:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner\mvp\frontend
npm run dev -- --host 127.0.0.1 --port 5174
npm run build
→ http://127.0.0.1:5174/

---

ЧИТАТЬ ПЕРЕД КОДОМ (по порядку):
1. docs/HANDOFF.md
2. docs/SESSION-2026-06-01.md
3. docs/SESSION-2026-05-29.md
4. docs/SESSION-2026-05-28.md (UI baseline)
5. docs/ROOT-PROMPT.md
6. docs/ПЛАН-ПРОДОЛЖЕНИЯ.md §5, §16 — applyEvents / сценарии
7. docs/DATA-INTEGRATION-postgresql-excel-bi.md — PG позже
Дизайн: docs/design/annual-budget-planning-app/source/

---

СДЕЛАНО — НЕ ОТКАТЫВАТЬ

Фаза A: import, KPI, индексация compact, carryover в «Данные».

Фаза C: версии v1/v+1, черновик, compare, repair; сайдбар + dev reset v1.

Drawer (UI готов):
- Одна колонка; indigo блок слот/орг/парам; green блок события
- ФИО в шапке; удаление событий в черновике
- baseline: mvp/frontend/src/components/PositionDrawer.baseline.tsx

Фаза B (начато):
- planOperations.ts: applyPlanTransfer, applyTerminationToVacancy, removePlanEvent (transferPairId)
- collectIndexationBatchesFromPositions — история индексаций в черновике
- isVacantForTransferAtMonth + подсказка intraTransferVacancyHint
- PlanningPage: withAppliedEvents в таблице

Факт/прогноз: factStore employee_id; /forecast без событий плана.

---

ПРОДУКТ

- Версии: v(N+1), diff база↔черновик
- Перевод intra: тот же dept+unit, вакансия в месяц M, «Сохранить в план»
- Увольнение: TERMINATION_TO_VACANCY, ФОТ не обнулять
- Прогноз (цель): факт + события до EOY
- dec→dec: prev>0; 0→X=100%; limit_flag с поля позиции

---

ПЕРВАЯ ЗАДАЧА НОВОГО ЧАТА

1. Приёмка фазы B (чеклист §16 ПЛАН-ПРОДОЛЖЕНИЯ):
   - перевод intra/inter, увольнение→вакансия, каскадное удаление transferPairId
2. При необходимости: seed sync, черновик вакансии в planPositions до сохранения
3. Шаг 6: полный прогноз + факт на обзоре/план-факт
4. Согласования rule-based — после 6

---

ПРАВИЛА

- Коммиты только по просьбе
- recharts нет
- npm run build после изменений
- Неясности → спросить, потом код
```

---

*Актуальный handoff — [`HANDOFF.md`](HANDOFF.md).*
