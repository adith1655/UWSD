# 🛡️ UWSD — Unified Watch & Surveillance Device

> **AI-powered campus security platform that transforms reactive security into proactive threat prevention.**

Developed by **Team UWSD 2026** at **Manipal University Jaipur**.

---

## 📖 Overview

UWSD is a centralized, AI-powered campus security platform that integrates multiple security modules into a single intelligent engine. By connecting identity access, visitor management, vehicle tracking, and logistics, UWSD makes autonomous, real-time security decisions to keep the campus safe.

### 🎯 Core Value Proposition
Transform campus security from **reactive** (incidents known after the fact) to **proactive** (threats neutralized before escalating).

### 📈 Key Metrics
| Metric | Before UWSD | After UWSD |
| :--- | :--- | :--- |
| Unauthorized entry incidents/month | ~15 | **< 1.5 (↓90%)** |
| Threat detection response time | > 10 minutes | **< 3 seconds** |
| Entry events with audit trail | ~30% | **100%** |
| Guard time on routine checks | ~70% of shift | **< 25% (↓60%)** |

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Client_Layer [Client Layer]
        A[Web Dashboard - Next.js]
        B[Mobile App - React Native]
    end

    subgraph API_Gateway [API Gateway]
        C[FastAPI + Node.js]
        D[JWT Auth / RBAC / Rate Limiting]
    end

    subgraph AI_Core [AI & Core Services]
        E[AI/CV: DeepFace + YOLOv8 + OpenCV]
        F[Core: Identity, Visitor, Vehicle, NightOut]
    end

    subgraph Data_Layer [Data Layer]
        G[(PostgreSQL)]
        H[(Redis Caching)]
        I[Object Storage / Event Logs]
    end

    Client_Layer -->|HTTPS / WebSocket| API_Gateway
    API_Gateway --> E
    API_Gateway --> F
    E --> Data_Layer
    F --> Data_Layer
