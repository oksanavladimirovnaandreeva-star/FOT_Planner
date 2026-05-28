# Карта контекста — ничего не обнулялось

Если кажется, что «весь контекст пропал» — это **сжатие истории в окне чата Cursor**, а не удаление проекта.

| Что | Где лежит | Статус |
|-----|-----------|--------|
| **Код MVP** | `mvp/frontend/src/` | На диске, все фичи сессии |
| **Краткий handoff** | `docs/HANDOFF.md` | Baseline 2026-05-28 |
| **Полная сессия (этот чат)** | `docs/SESSION-2026-05-28.md` | Решения, что сделали, что бесило, очередь |
| **Длинный roadmap + ТЗ** | `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md` (~460 строк) | Не трогали, весь prod-контекст |
| **Продуктовые правила** | `docs/ROOT-PROMPT.md` | Drawer, dec→dec, индексация |
| **Drawer UX** | `docs/DRAWER-UX.md` → HANDOFF | |
| **Промпт нового чата** | `docs/NEW-CHAT-PROMPT.md` | Фазы A и B |
| **Откат drawer** | `mvp/frontend/src/components/PositionDrawer.baseline.tsx` | = текущий drawer |
| **История переписки** | Cursor → Projects → agent transcript `05bd1680-eb23-432b-94fb-89620fb284be` | Полный лог чата |
| **Старый длинный baseline** | `git log -- mvp/docs/baseline-current-state.md` | До 2026-05-28 файл сжали до ссылки |

## Что читать агенту в новом чате (по порядку)

1. `docs/HANDOFF.md`
2. `docs/SESSION-2026-05-28.md`
3. `docs/ROOT-PROMPT.md` (если правки drawer/событий)
4. `docs/ПЛАН-ПРОДОЛЖЕНИЯ.md` — только если нужна модель `apps/*` или долгий roadmap

## Решение сессии, которое нельзя потерять

- Путь **A**: сначала JSON import/export во frontend, потом API/Postgres.
- Рабочая папка: **только** `mvp/frontend/`.
- Порядок работ: **фаза A (шаги 1–4) → фаза B (шаги 5–6)**. Без «если останется время».

---

*При обновлении baseline дописывай `SESSION-2026-05-28.md` или создай `SESSION-YYYY-MM-DD.md`, не удаляй `ПЛАН-ПРОДОЛЖЕНИЯ.md`.*
