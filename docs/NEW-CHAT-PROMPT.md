# Новый чат — копипаст

**Чекпоинт:** `UX-3-workspace-drawer` · 69 tests · git: `a33d116`

Скопируй блок ниже целиком:

```
ФОТ-планировщик — продолжение MVP фронта (checkpoint UX-3-workspace-drawer)

Проект: C:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner
Код: только mvp/frontend/ (React 19, TS, Vite, localStorage, без API/PG).

Читай по порядку:
1. AGENTS.md
2. docs/PRODUCT-MODEL.md
3. docs/HANDOFF.md
4. docs/IMPLEMENTATION-STEPS.md

Запуск:
  cd C:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner
  npm run dev   → http://localhost:5174 (strictPort; Ctrl+Shift+R после pull)
  cd mvp\frontend && npm test    # 69 тестов
  npm run build

Навигация:
  / — обзор · /planning — план · /analytics — аналитика · /versions — версии
  Корректировка: /planning?mode=correction
  Согласование/сравнение: /versions?tab=approval|compare
  Консолидация: /versions?tab=consolidation
  Планирование: ?tab=positions|matrix|journal

Жёстко (не ломать):
  • факт НЕ правит план; экономия = Δ план − факт (плюс), перерасход = минус
  • план–факт vs утверждённая версия (resolvePlanFactBaseline)
  • в UI «позиция», не «слот»
  • массовая индексация: admin + unit_lead (inline на Planning, не модалка)
  • PG/API/Kaiten API — не начинать без явного запроса

Сделано в checkpoint UX-3-workspace-drawer (НЕ откатывать):
  • PlanContextBar, SliceToolbar, DemoRoleSelect, Versions tabs approval/compare
  • F1 CSV + audit · F3 consolidation · F4 matrix locked months · F5 variance drivers
  • PositionDrawer drawer--workspace: вкладки «Слот и занятость» / «События и ФОТ»
    + история событий + таблица ФОТ по месяцам (оклад, премия, итого, CR)
  • «Добавить позицию» на утверждённом v1 → квартальный черновик (роль admin)

НЕ в этом checkpoint (не восстанавливать без запроса):
  • F2 Kaiten UI · UX-4 (модалка массовых действий, MetricHelp, UnitLead strip, compact drawer)

НЕ делать без запроса:
  • topbar / sidebar 256px / BudgetFlow visual redesign
  • docs/archive/PositionDrawer.baseline.tsx — НЕ подменять основной drawer

Следующая задача: F2 Kaiten UI (заявки из позиции/журнала, mock, без API).

Ключевые файлы:
  pages/PlanningPage.tsx, components/PositionDrawer.tsx
  components/planning/PlanContextBar.tsx, components/SliceToolbar.tsx
  data/planFactVarianceDrivers.ts, data/userAccess.ts, data/exportScopedCsv.ts

После правок в data/: npm test && npm run build. Коммиты — только по просьбе.
```

Подробности — в `docs/HANDOFF.md`. `SESSION-*` и legacy `apps/web` не читать.
