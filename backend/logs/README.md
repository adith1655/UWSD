# Logs Directory

Application logs from the UWSD backend services are stored here.

> **Status:** Backend services are planned for Phase 2. This directory is reserved for future use.

## Planned Log Files

- **uwsd.log** — Main application log (system events, detections, errors, performance)
- **access.log** — Entry/exit event log (append-only, immutable audit trail)
- **ai-service.log** — Face recognition and YOLO inference logs
- **alerts.log** — Alert generation and escalation events

## Log Levels

| Level | Usage |
|-------|-------|
| DEBUG | Detailed debugging (dev only) |
| INFO | General operational info (default) |
| WARNING | Degraded performance, non-critical issues |
| ERROR | Failures requiring attention |
| CRITICAL | System-level failures |

## Log Format

```
2026-03-28 21:30:15,123 - module_name - LEVEL - Message
```

## Rotation (Production)

```python
from logging.handlers import RotatingFileHandler

handler = RotatingFileHandler(
    'logs/uwsd.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
```

## Viewing Logs

```bash
# Real-time monitoring
tail -f logs/uwsd.log

# Filter by severity
grep ERROR logs/uwsd.log

# Recent entries
tail -n 100 logs/uwsd.log
```
