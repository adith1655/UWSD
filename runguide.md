# UWSD run guide

How to run the backend and frontend locally.

## Prerequisites

- **Backend:** Python 3 with dependencies from `backend/requirements.txt`
- **Frontend:** Node.js and npm; install deps with `npm install` in `frontend`

## Ports

| Service  | Port | URL                    |
|----------|------|------------------------|
| Backend  | 8000 | http://localhost:8000  |
| Frontend | 3000 | http://localhost:3000  |

## Backend (FastAPI)

From the repository root:

```powershell
cd backend
python app.py
```

This starts Uvicorn with reload on `0.0.0.0:8000`.

Alternative (equivalent):

```powershell
cd backend
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## Frontend (Next.js)

In a **second** terminal:

```powershell
cd frontend
npm install
npx next dev -p 3000
```

Or use the default dev script if port 3000 is free:

```powershell
npm run dev
```

If something else is using port 3000, stop that process or pick another port, e.g. `npx next dev -p 3001`.

## Environment

The frontend may read `frontend/.env.local` for API URLs and similar settings. Set any required backend env vars (e.g. SMTP) in your shell or a `.env` file as documented in the backend code.

## Quick check

- Open http://localhost:3000 for the dashboard UI.
- Open http://localhost:8000/docs for the interactive API docs (FastAPI).
