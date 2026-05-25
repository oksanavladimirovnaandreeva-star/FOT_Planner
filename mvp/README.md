# FOT Planner MVP

Новый проект с нуля для этапов P0-P3:
- `frontend` - React + TypeScript + Vite
- `backend` - FastAPI + SQLAlchemy + Alembic

## Текущий baseline

- Зафиксированная реализованная логика и рабочее поведение: `docs/baseline-current-state.md`
- Этот документ используем как опорный "source of truth" перед следующими итерациями.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Открыть `http://localhost:5173/planning`.

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Проверка: `http://localhost:8000/health`.

## Тесты домена

```bash
cd backend
pytest
```

