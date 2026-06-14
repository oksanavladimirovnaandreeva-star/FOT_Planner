# ФОТ Планировщик

Веб-система годового планирования ФОТ и план-факт (MVP).

| | |
|---|---|
| **Папка проекта** | [`C:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner`](C:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner) |
| **Актуальный UI** | [`mvp/frontend/`](mvp/frontend/) |
| **Локально** | http://localhost:5174 (см. `Local:` в терминале) |
| **Handoff** | [`docs/HANDOFF.md`](docs/HANDOFF.md) |
| **Новый чат** | [`docs/NEW-CHAT-PROMPT.md`](docs/NEW-CHAT-PROMPT.md) |
| **Дизайн-референс** | [`docs/design/annual-budget-planning-app/source/`](docs/design/annual-budget-planning-app/source/) |

## Структура

```
fot-planner/
  mvp/frontend/     ← единственный актуальный UI (React + Vite)
  docs/             ← продукт, handoff, шаги, ИБ, дизайн
  scripts/          ← start-web.ps1, start.ps1
  apps/, packages/  ← legacy (API, domain) — не в фокусе MVP
```

## Запуск

Нужен **Node.js**. API и PostgreSQL **не требуются**.

```powershell
cd C:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner
npm run dev
```

Или: `.\scripts\start-web.ps1`

Первый раз:

```powershell
cd mvp\frontend
npm install
npm run dev
```

### Проверка

```powershell
npm test        # 48 тестов
npm run build
```

### Если не открывается

1. Смотрите URL в терминале (`VITE ready` → `Local:`).
2. Порт 5174 занят → Vite выберет 5175 и т.д.
3. Закрыть старый процесс: `Get-NetTCPConnection -LocalPort 5174`
4. Не открывать legacy **:5180** — это старый `apps/web`.

### Пустые данные

Сайдбар → план **2026 — baseline**. Admin → **Данные** → «Загрузить расширенное демо» → F5.

## Навигация MVP

- **Обзор** — `/`
- **Планирование** — `/planning` (корректировка: `?mode=correction`)
- **Аналитика** — `/analytics`
- **Версии** — `/versions` (консолидация: `?tab=consolidation`)

## Legacy

```powershell
npm run web:legacy    # apps/web → :5180
npm run api             # FastAPI → :8000
```

## Документация

| Файл | О чём |
|------|--------|
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | Состояние кода, запуск, файлы |
| [`docs/PRODUCT-MODEL.md`](docs/PRODUCT-MODEL.md) | Продуктовые правила |
| [`docs/IMPLEMENTATION-STEPS.md`](docs/IMPLEMENTATION-STEPS.md) | Чеклист шагов |
| [`docs/CONTEXT-MAP.md`](docs/CONTEXT-MAP.md) | Карта всех docs |
