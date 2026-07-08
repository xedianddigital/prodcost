# Runbook: Launching ProdCost Locally

Two services make up the app: a FastAPI backend (the costing engine and JSON stores) and a Vite/React frontend (the UI). Start the backend first, then the frontend, then open the browser.

The easiest way to run both at once is `./setup.sh` (first time only) followed by `./start.sh` from the repository root — see the README's Quick Start. This file covers the manual, per-service steps, useful for development or troubleshooting.

## Prerequisites

- Python 3.12+ (`python3 --version`)
- Node.js 18+ with npm (`node --version`)
- No database or external services are needed — all data lives in `data/*.json`.

## 1. Backend (FastAPI, port 8002)

First time only — create a virtual environment and install:

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
```

Every start:

```bash
cd backend
. .venv/bin/activate
uvicorn app.main:app --reload --port 8002
```

The API is now at `http://localhost:8002`. Quick health check:

```bash
curl http://localhost:8002/health
```

If the port is busy: pick another port (e.g. `--port 8003`) and change the proxy target in `frontend/vite.config.ts` to match.

## 2. Frontend (Vite dev server, port 8001)

First time only:

```bash
cd frontend
npm install
```

Every start (in a second terminal, backend still running):

```bash
cd frontend
npm run dev
```

Open the printed URL, normally `http://localhost:8001` (the port is set in `frontend/vite.config.ts`). The dev server proxies every `/api` request to the backend on port 8002, so both must be running.

## 3. Seeing the project

1. Open `http://localhost:8001`.
2. Use **Load Demo RFQ** on the Quote page for a filled-in walkthrough quote.
3. Suggested tour order for a first-time viewer: **Profile → Resources → Quote → Scenarios → Market Rates → Profitability → Case → Guide → Methods**. See [`guidebook.md`](guidebook.md) for a detailed walkthrough of every tab.

## Running the tests

Backend (from `backend/`, venv active — or use `PYTHONPATH=.` if pytest can't find `app`):

```bash
pytest -q
# or without an installed package:
PYTHONPATH=. python3 -m pytest -q
```

Frontend type check (from `frontend/`):

```bash
npx tsc --noEmit
```

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| UI loads but every number panel says "..." or shows an API error | Backend not running, or running on a different port than the Vite proxy expects. |
| `ModuleNotFoundError: No module named 'app'` when running pytest | Run from `backend/` with the venv active, or prefix `PYTHONPATH=.` |
| Port 8001 already in use | Vite picks the next free port automatically — read the URL it prints (a fixed port is set in `frontend/vite.config.ts`). |
| Assumption edits don't persist | The backend writes to `data/*.json`; make sure the process has write permission to the repo's `data/` directory. |
