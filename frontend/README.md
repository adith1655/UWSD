# UWSD Frontend — Web Dashboard

Next.js 14 web dashboard for the UWSD campus security platform.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React
- **Utilities:** clsx, tailwind-merge, date-fns

## Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:3000** — login with any credentials.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Create optimized production build |
| `npm start` | Serve production build |
| `npm run lint` | Run ESLint |

## Routes

| Route | Page | Roles |
|-------|------|-------|
| `/login` | Authentication | All |
| `/dashboard` | Overview | Guard, Warden, Admin |
| `/dashboard/live` | Live Camera Feed | Guard |
| `/dashboard/alerts` | Alert Center | Guard, Warden |
| `/dashboard/visitors` | Visitor Management | Guard, Warden |
| `/dashboard/night-out` | Night-Out Compliance | Warden |
| `/dashboard/parcels` | Parcel Logistics | Guard |
| `/dashboard/vehicles` | Vehicle Gate Intel | Guard |
| `/dashboard/reports` | Reports & Analytics | Admin, Warden |
| `/dashboard/settings` | Campus Settings | Admin |
| `/dashboard/users` | User Management | Admin |

## Project Structure

```
frontend/
├── app/
│   ├── globals.css            # Tailwind base + custom styles
│   ├── layout.tsx             # Root layout (Inter font, dark mode)
│   ├── page.tsx               # Root redirect → /login
│   ├── login/page.tsx         # Login screen
│   └── dashboard/
│       ├── layout.tsx         # Dashboard shell (sidebar wrapper)
│       ├── page.tsx           # Overview (stats, charts, feeds)
│       ├── live/page.tsx      # Camera grid (2x2 / 3x3 / 4x4)
│       ├── alerts/page.tsx    # Alert feed with filters
│       ├── visitors/page.tsx  # Visitor CRUD + pass issuance
│       ├── night-out/page.tsx # Request approve/reject
│       ├── parcels/page.tsx   # Parcel log + workflows
│       ├── vehicles/page.tsx  # LPR tracking + registration
│       ├── reports/page.tsx   # Recharts analytics + audit
│       ├── settings/page.tsx  # Threshold & notification config
│       └── users/page.tsx     # User CRUD with role badges
├── components/
│   ├── sidebar.tsx            # Navigation with active states
│   ├── header.tsx             # Live clock, search, system status
│   ├── stat-card.tsx          # KPI metric display
│   ├── alert-badge.tsx        # Threat level badge (RED/YELLOW/GREEN)
│   ├── alert-feed.tsx         # Alert list with type icons
│   ├── camera-grid.tsx        # Responsive camera tile layout
│   └── data-table.tsx         # Generic sortable table
└── lib/
    ├── utils.ts               # cn(), formatters, color helpers
    └── mock-data.ts           # Demo data (users, cameras, alerts, etc.)
```

## Components

### `Sidebar`
Persistent left navigation with route-based active highlighting, alert count badge, and user profile footer.

### `Header`
Sticky top bar with page title, live clock (updates every second), expandable search, system online indicator, and notification bell.

### `StatCard`
Animated metric card with icon, value, trend indicator, and hover glow effect.

### `AlertBadge`
Inline threat level pill — supports `RED`, `YELLOW`, `GREEN` with optional pulse animation for active threats.

### `AlertFeed`
Scrollable alert list with type-specific icons (unauthorized entry, visitor, vehicle, camera offline, etc.) and relative timestamps.

### `CameraGrid`
Responsive camera tile grid with live/offline/maintenance states, scanline overlay effect, and hover-reveal controls.

### `DataTable`
Generic table with column definitions, custom cell renderers, row click handlers, and empty state.

## Design System

**Theme:** Dark security console

| Token | Value |
|-------|-------|
| Background | `slate-950` (#020617) |
| Card | `slate-900/50` |
| Border | `slate-800` |
| Text primary | `white` |
| Text secondary | `slate-400` |
| Text muted | `slate-500` / `slate-600` |
| Primary | `blue-600` (#2563eb) |
| Danger | `red-500` (#ef4444) |
| Warning | `amber-500` (#f59e0b) |
| Success | `emerald-500` (#10b981) |

## Mock Data

All pages use realistic demo data in `lib/mock-data.ts` simulating Manipal University Jaipur:

- **12 users** across student/guard/warden/admin roles
- **9 cameras** with online/offline/maintenance states
- **10 alerts** spanning all threat types
- **5 visitors** in various states (checked-in, pending, blacklisted)
- **6 night-out requests** (pending, approved, overdue, rejected)
- **6 parcels** (arrived, notified, collected, escalated)
- **6 vehicles** (registered/unregistered, parked/exited)
- **8 access logs** with confidence scores
- **Hourly traffic** and **weekly alert** chart data
