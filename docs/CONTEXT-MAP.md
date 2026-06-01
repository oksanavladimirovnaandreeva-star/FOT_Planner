# Карта контекста — ничего не обнулялось

| Что | Где | Статус |
|-----|-----|--------|
| **Код MVP** | `mvp/frontend/src/` | На диске |
| **Handoff** | `docs/HANDOFF.md` | 2026-05-29 |
| **Промпт переезда** | `docs/NEW-CHAT-PROMPT.md` | **Копировать в новый чат** |
| **Сессия 2026-05-29** | `docs/SESSION-2026-05-29.md` | Версии, факт, drawer, prod |
| **Сессия 2026-05-28** | `docs/SESSION-2026-05-28.md` | Import, KPI, drawer baseline |
| **Prod roadmap** | `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md` | Не сокращать |
| **Правила drawer/движок** | `docs/ROOT-PROMPT.md` | |
| **PG / 1С / BI** | `docs/DATA-INTEGRATION-postgresql-excel-bi.md` | После UI |
| **Дизайн** | `docs/design/annual-budget-planning-app/source/` | |

## Что читать агенту

1. `docs/HANDOFF.md`
2. `docs/SESSION-2026-05-29.md`
3. `docs/NEW-CHAT-PROMPT.md` (задача на старт)
4. `docs/ROOT-PROMPT.md` — при правках drawer/событий

## Порядок этапов (актуально)

```
MVP UI (frontend JSON)
  → drawer + версии (дожать)
  → шаги 5–6 (applyEvents, прогноз)
  → API + PostgreSQL + ИБ (prod)
```

Path A: сначала браузер и согласованная модель, потом `apps/api` и PG.

---

*При новой сессии: дописать `SESSION-YYYY-MM-DD.md`, обновить `HANDOFF.md` и блок в `NEW-CHAT-PROMPT.md`.*
