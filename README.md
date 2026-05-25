# ФОТ Планировщик

Веб-система годового планирования ФОТ и план-факт (MVP).

## Структура

- `apps/api` — FastAPI + SQLAlchemy
- `apps/web` — React + Vite
- `packages/domain` — расчётный движок
- `docs/` — mapping Excel, шаблоны CSV

## Запуск

Нужны **два процесса**: API (8000) и фронт (5180). Порт **5173 не используется** — там может быть ваш лидерборд.

**Быстрый старт (PowerShell):**

```powershell
cd c:\Users\andreeva.o\.cursor\projects\empty-window\fot-planner

# Терминал 1 — API (создаёт .venv, ставит зависимости)
.\scripts\start-api.ps1

# Терминал 2 — интерфейс
.\scripts\start-web.ps1
```

Или одной командой (API в отдельном окне): `.\scripts\start.ps1`

Если порт `8000` занят или API отвечает старым кодом:

```powershell
.\scripts\restart-api.ps1
```

Также можно запускать API с автоматическим освобождением порта:

```powershell
.\scripts\start-api.ps1 -ForceKillPort
```

Нужны **Python 3.11+** (в PATH) и **Node.js** (npm).

Откройте **http://localhost:5180** — только после `npm run dev` (должно быть `VITE ready`).

### Страницы пустые

1. **API должен работать** на http://127.0.0.1:8000/docs  
2. В сайдбаре выберите план **2026 — baseline** (подставляется автоматически).  
3. Если KPI = 0: **Пересчитать план** или (админ) **Импорт → Пересоздать демо-данные** → F5.

### `Not Found` на `/budget` или странный статус в планировании

Обычно это старый процесс на `:8000`. Выполните `.\scripts\restart-api.ps1`, затем обновите браузер через `Ctrl+F5`.

### Ошибка `Cannot GET /` на :5180

На порту отвечает **не** Vite (чужой процесс или фронт не запущен). Закройте лишнее на 5180, выполните `npm run dev` в `apps/web` и обновите страницу.

### Пользователи (заголовок X-User-Id)

- `admin` — полный доступ
- `user_it` — срез DEPT-IT

## Тесты движка

```bash
cd packages/domain
pip install pytest
pytest tests -q
```
