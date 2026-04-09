# UWSD — Unified Watch & Surveillance Device

> AI-powered campus security platform that transforms reactive security into proactive threat prevention.

**Team UWSD 2026 — Manipal University Jaipur**

---

## Overview

UWSD is a centralized, AI-powered campus security platform that connects all security modules — identity/access control, visitor management, vehicle tracking, night-out compliance, parcel logistics, and guard dashboards — into a single intelligent engine that makes real-time security decisions.

### Core Value Proposition

Transform campus security from *reactive* (incidents known after the fact) to *proactive* (threats neutralized before escalating).

### Key Metrics

| Metric | Before UWSD | After UWSD |
|--------|-------------|------------|
| Unauthorized entry incidents/month | ~15 | < 1.5 (↓90%) |
| Threat detection response time | > 10 minutes | < 3 seconds |
| Entry events with audit trail | ~30% | 100% |
| Guard time on routine checks | ~70% of shift | < 25% (↓60%) |

---

## System Architecture

```
┌──────────────────────────────────────────────────────┐
│                  CLIENT LAYER                         │
│  Web Dashboard (Next.js)  │  Mobile App (React Native)│
└──────────────┬───────────────────────────────────────┘
               │ HTTPS / WebSocket
┌──────────────▼───────────────────────────────────────┐
│                  API GATEWAY                          │
│            FastAPI (Python) + Node.js                 │
│       JWT Auth │ Rate Limiting │ RBAC                 │
└──────┬─────────────────────────┬─────────────────────┘
       │                         │
┌──────▼──────────┐   ┌─────────▼────────────────────┐
│  AI/CV SERVICE  │   │      CORE SERVICES            │
│ DeepFace + YOLO │   │ Identity │ Visitor │ Vehicle   │
│ OpenCV          │   │ Parcel   │ NightOut│ Guard     │
└──────┬──────────┘   └─────────┬────────────────────┘
       │                        │
┌──────▼────────────────────────▼──────────────────────┐
│                  DATA LAYER                           │
│  PostgreSQL │ Redis │ Object Storage │ Event Log      │
└──────────────────────────────────────────────────────┘
```

---

## Project Structure

```
UWSD/
├── README.md                  # This file
├── backend/                   # Backend services (planned)
│   ├── logs/                  # Application logs
│   └── test_video.txt         # Test video placeholder
│
└── frontend/                  # Next.js 14 Web Dashboard
    ├── package.json
    ├── next.config.mjs
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── app/
    │   ├── layout.tsx         # Root layout (Inter font, dark mode)
    │   ├── page.tsx           # Redirect → /login
    │   ├── globals.css        # Tailwind + custom styles
    │   ├── login/
    │   │   └── page.tsx       # Authentication screen
    │   └── dashboard/
    │       ├── layout.tsx     # Dashboard shell (sidebar + main)
    │       ├── page.tsx       # Overview dashboard
    │       ├── live/          # Live camera feed grid
    │       ├── alerts/        # Alert center
    │       ├── visitors/      # Visitor management
    │       ├── night-out/     # Night-out compliance
    │       ├── parcels/       # Parcel logistics
    │       ├── vehicles/      # Vehicle gate intel
    │       ├── reports/       # Reports & analytics
    │       ├── settings/      # Campus configuration
    │       └── users/         # User management
    ├── components/
    │   ├── sidebar.tsx        # Persistent nav sidebar
    │   ├── header.tsx         # Top bar (clock, search, status)
    │   ├── stat-card.tsx      # KPI metric card
    │   ├── alert-badge.tsx    # RED/YELLOW/GREEN badge
    │   ├── alert-feed.tsx     # Real-time alert list
    │   ├── camera-grid.tsx    # Multi-column camera layout
    │   └── data-table.tsx     # Reusable data table
    └── lib/
        ├── utils.ts           # cn(), formatters, color helpers
        └── mock-data.ts       # Demo data for all modules
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) | Web dashboard & admin portal |
| **Styling** | Tailwind CSS | Utility-first styling |
| **Charts** | Recharts | Analytics visualizations |
| **Icons** | Lucide React | Consistent icon system |
| **Language** | TypeScript | Type safety |
| **AI/Vision** | DeepFace, YOLOv8, OpenCV | Face recognition, object detection |
| **Backend** | FastAPI (Python), Node.js | API services (planned) |
| **Database** | PostgreSQL, Redis | Primary store, caching |
| **Mobile** | React Native (Expo) | Student & warden app (planned) |
| **Notifications** | Firebase FCM, Twilio | Push & SMS alerts (planned) |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm** 9+

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd UWSD

# Install frontend dependencies
cd frontend
npm install

# Start the development server
npm run dev
```

The dashboard will be available at **http://localhost:3000**.

### Demo Access

The login screen accepts any credentials. Use these demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Guard | `vikram@muj.edu` | any |
| Warden | `meera@muj.edu` | any |
| Admin | `amit@muj.edu` | any |

### Build for Production

```bash
cd frontend
npm run build
npm start
```

---

## Dashboard Pages

### Login (`/login`)
Polished authentication screen with animated background, demo credential hints, and password visibility toggle.

### Overview (`/dashboard`)
Central command hub with 8 KPI stat cards, hourly entry/exit traffic chart, real-time alert feed, camera preview grid, and recent access logs.

### Live Feed (`/dashboard/live`)
Multi-camera grid view with adjustable layouts (2x2, 3x3, 4x4), live status indicators, and a camera health summary table.

### Alert Center (`/dashboard/alerts`)
Filterable alert feed by threat level (RED/YELLOW/GREEN), acknowledge and escalate actions, real-time stat counters.

### Visitor Management (`/dashboard/visitors`)
Register visitors, issue digital passes, check-in/out workflows, zone-based access control, search and filter.

### Night-Out Management (`/dashboard/night-out`)
Student request cards, warden approve/reject actions, overdue warnings with pulse animations, status-based filtering.

### Parcel Management (`/dashboard/parcels`)
Log incoming parcels, notify recipients, mark as collected, escalate unclaimed packages, full audit trail.

### Vehicle Gate Intel (`/dashboard/vehicles`)
License plate tracking, vehicle registration, parking duration monitoring, 2-hour overstay alerts for unregistered vehicles.

### Reports & Analytics (`/dashboard/reports`)
Interactive Recharts visualizations (bar, line, pie), access log tables, incident report creation, immutable audit trail.

### Campus Settings (`/dashboard/settings`)
Configurable thresholds (face recognition, curfew time, overstay limits), notification toggles, camera configuration, danger zone actions.

### User Management (`/dashboard/users`)
Full CRUD for users, role-based filtering (Student/Guard/Warden/Admin), status toggles, slide-over edit forms.

---

## Security Modules

| Module | Description | Threat Levels |
|--------|-------------|---------------|
| **Identity & Access** | Face recognition at entry gates; access grant/deny | RED: Unauthorized, GREEN: Verified |
| **Visitor Management** | Pre-registration, digital passes, zone restrictions | YELLOW: Unregistered, RED: Blacklisted |
| **Vehicle Gate Intel** | License plate recognition, parking time tracking | YELLOW: Overstay, RED: Unknown vehicle |
| **Night-Out Compliance** | AI-verified night-out pass system | RED: Violation/Overdue |
| **Parcel & Logistics** | Delivery logging, student notifications | YELLOW: Unclaimed 48h+ |
| **Guard Dashboard** | Real-time alerts, patrol logs, incident reports | All levels |

---

## User Roles (RBAC)

| Role | Access Level |
|------|-------------|
| **Super Admin** | Full system access; campus configuration; user management |
| **Campus Admin** | Campus-level settings; all modules; reports |
| **Warden** | Night-out approvals; visitor approvals; alerts; student profiles |
| **Guard** | Live feeds; alert acknowledgement; parcel logging; patrol logs |
| **Student** | Own profile; night-out requests; parcel notifications; visitor pre-reg |

---

## Roadmap

- [x] **Phase 1** — Web Dashboard (Next.js)
  - [x] Login & authentication UI
  - [x] Dashboard overview with KPIs
  - [x] Live camera feed grid
  - [x] Alert center with threat classification
  - [x] Visitor management module
  - [x] Night-out compliance module
  - [x] Parcel logistics module
  - [x] Vehicle gate intelligence module
  - [x] Reports & analytics with charts
  - [x] Campus settings configuration
  - [x] User management (CRUD)
- [ ] **Phase 2** — Backend Services
  - [ ] FastAPI AI/CV microservice
  - [ ] PostgreSQL database + Redis cache
  - [ ] JWT authentication + RBAC enforcement
  - [ ] WebSocket real-time event server
  - [ ] Face recognition pipeline (DeepFace + ArcFace)
  - [ ] RTSP camera stream ingestion
- [ ] **Phase 3** — Mobile App
  - [ ] React Native (Expo) student app
  - [ ] Warden approval workflows
  - [ ] Push notifications (Firebase FCM)
  - [ ] SMS alerts (Twilio)
- [ ] **Phase 4** — Edge AI & Scale
  - [ ] Raspberry Pi / Jetson Nano deployment
  - [ ] Multi-campus SaaS rollout
  - [ ] Predictive risk scoring ML model
  - [ ] 10,000+ student capacity

---

## License

This project is developed by Team UWSD 2026 at Manipal University Jaipur.

---

*"We are not building a security system — we are building a system that thinks, predicts, and protects."*
#   U W S D  
 