# Новый чат — копипаст

**Чекпоинт:** `drawer-W-B` + **Фаза 0 deploy** · **94 tests** · `git log -1` → `chore(mvp/frontend): GitHub Pages base path и CI/deploy`

Скопируй блок ниже целиком:

```
ФОТ-планировщик — продолжение MVP фронта

Проект: C:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner
Код: только mvp/frontend/ (React 19, TS, Vite, localStorage, без API/PG).

Читай по порядку:
1. AGENTS.md
2. docs/PRODUCT-MODEL.md
3. docs/HANDOFF.md
4. docs/IMPLEMENTATION-STEPS.md

Запуск:
  cd C:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner
  npm run dev          → http://localhost:5174
  cd mvp\frontend && npm test    # 94 теста
  npm run build

Деплой (GitHub Pages, после push в main):
  • Settings → Pages → Source: GitHub Actions
  • base: /{имя-репозитория}/  (VITE_BASE_PATH в CI)
  • workflow: .github/workflows/deploy-pages.yml
  • Локальная проверка base:  cd mvp\frontend
    $env:VITE_BASE_PATH='/fot-planner/'; npm run build; npm run preview

Навигация:
  / — обзор · /planning — план · /analytics — аналитика · /versions — версии
  Корректировка: /planning?mode=correction
  Согласование/сравнение: /versions?tab=approval|compare
  Drawer: клик по позиции → единый экран (identity, статус, план, история, ФОТ)

Жёстко (не ломать):
  • факт НЕ правит план; экономия = Δ план − факт
  • план–факт vs утверждённая версия
  • в UI «позиция», не «слот»
  • PG/API/Kaiten API — не начинать без явного запроса

Сделано (НЕ откатывать):
  • F1 CSV + audit · F3 consolidation · F4 matrix locked · F5 variance drivers · UX-3
  • Position Drawer W-B: stack-layout, форма 6 полей + комментарий, история без inner scroll,
    ФОТ 2 полугодия, сводка «декабрь к декабрю» + полный итог, CR-подсветка
  • Фаза 0: vite base (VITE_BASE_PATH), BrowserRouter basename (appBase.ts),
    GitHub Actions CI + deploy-pages, public/.nojekyll
  • F2 Kaiten — частично (модалка, найм на вакансии); пользователь просил отложить

Отложено:
  • F2 Kaiten — довести до приёмки
  • UX-4 — модалка массовых действий, MetricHelp, UnitLead strip

Следующие задачи (на выбор):
  1. Фаза 1 рефакторинг: storageKeys.ts → один файл ключей localStorage
  2. Фаза 1: разбить MvpAppContext на usePlanVersions / useUserAccess / useImportExport
  3. Пилот/демо: пройти сценарии, зафиксировать расхождения с Excel
  4. DATA-1: боевой CSV-импорт факта

Ключевые файлы:
  components/PositionDrawer.tsx, index.css (drawer)
  context/MvpAppContext.tsx (монолит — кандидат на слайсы)
  vite.config.ts, src/appBase.ts, src/main.tsx
  .github/workflows/frontend-ci.yml, deploy-pages.yml

После правок в data/: npm test && npm run build. Коммиты — только по просьбе.
```

Подробности — `docs/HANDOFF.md`. `SESSION-*` и `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md` не читать при старте.
