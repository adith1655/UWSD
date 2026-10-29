---
title: UWSD Backend
emoji: 📷
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 5.9.1
app_file: app.py
pinned: false
---

# UWSD Backend API

FastAPI backend for the Unified Watch & Surveillance Device.
Visit `/docs` for the interactive API documentation.

## Environment Variables (set in Space Settings → Variables and secrets)

| Variable | Description |
|---|---|
| `UWSD_SMTP_FROM` | Gmail address for sending alerts |
| `UWSD_SMTP_PASSWORD` | Gmail App Password |
| `UWSD_SECRET_KEY` | JWT signing secret (use a strong random string) |
| `CORS_ORIGINS` | Comma-separated allowed frontend URLs e.g. `https://your-app.vercel.app` |
