# 12 — Docker Architecture

## 1. Goal

Run the full MVP on **one Linux host** with Docker Engine and Compose:

- Intel Core i9 class
- 64 GB RAM
- NVMe
- Gigabit LAN
- No Kubernetes

The layout must still allow a later split (more workers, external DB, Kubernetes) without rewriting domains.

**This document specifies services and topology only. Compose files are not created in the architecture phase.**

---

## 2. Service catalog (MVP)

| Service | Image / build | Purpose | Publish? |
|---|---|---|---|
| `proxy` | Nginx | TLS, SPA, `/api`, `/geoserver` WMS | 80/443 |
| `web` | Custom Node build → static Nginx or served by proxy | Admin SPA | internal |
| `api` | Custom FastAPI | Application | internal |
| `worker` | Same image as API, Celery worker | Jobs | none |
| `scheduler` | Same image, Celery beat | Crons | none |
| `postgres` | PostGIS | DB | LAN optional for QGIS; never Internet |
| `redis` | Redis | Cache, broker, locks | none |
| `minio` | MinIO | Objects | none (API uses it) |
| `geoserver` | Official GeoServer | OGC publish | via proxy, not admin |
| `prometheus` | Prometheus | Metrics | LAN |
| `grafana` | Grafana | Dashboards | LAN |
| `backup` | Small custom/cron container | `pg_dump`, MinIO mirror | none |

Optional later (do not add until needed): Loki, mail relay, OCR, document converter, OpenSearch, message broker, QGIS Server.

---

## 3. Compose files (planned)

```text
docker-compose.yml          # production-shaped baseline
docker-compose.dev.yml      # hot reload, published debug ports, sample seeds
docker-compose.monitor.yml  # prometheus/grafana profile
```

Profiles:

- `core` — proxy, web, api, worker, scheduler, postgres, redis, minio
- `gis` — geoserver
- `observe` — prometheus, grafana
- `ops` — backup

An LGU without public GIS can still run `gis` internally.

---

## 4. Networking

```text
bridge: lgu_internal
  all services

ports on host:
  80/443 → proxy
  (dev only) 5173 web, 8000 api — never in production compose
```

GeoServer admin bound to internal network. If MIS needs it, use SSH tunnel or LAN-only published port documented as an exception.

Postgres: production default is internal-only. For QGIS, publish `5432` to a **management VLAN** or use an SSH tunnel / `pgbouncer` later.

---

## 5. Volumes

| Volume | Contents |
|---|---|
| `pgdata` | PostgreSQL |
| `minio` | Objects |
| `geoserver_data` | GeoServer data dir |
| `redis` | AOF if persistence enabled |
| `grafana` | Dashboards |
| `backups` | Local dump copies (also sync off-box) |

Place Docker data-root or bind mounts on NVMe. Separate disk for backups if possible so a volume fill does not eat the backup.

---

## 6. Resource guidance (64 GB host)

| Service | Memory order of magnitude |
|---|---|
| PostgreSQL | 8–16 GB (`shared_buffers` ~2–4 GB to start) |
| GeoServer JVM | 4–8 GB |
| API (2–4 workers) | 1–2 GB |
| Celery workers | 2–4 GB (GDAL jobs can spike) |
| Redis | 512 MB–1 GB |
| MinIO | 1 GB |
| Nginx | 256 MB |
| Prometheus + Grafana | 1–2 GB |
| OS + QGIS clients hitting DB | remainder |

Tune after first raster and concurrent-map test. Do not give GeoServer unbounded `-Xmx`.

---

## 7. Images and build

- `apps/web` multi-stage: Node build → static assets
- `apps/api` image shared by `api`, `worker`, `scheduler` (different `CMD`)
- Pin base tags; prefer digests in production
- API image may include GDAL (large). If it becomes too heavy, split `worker-gis` later — designed as a Compose split, not a domain rewrite

---

## 8. Configuration

Environment variables only for runtime config:

- DB URL, Redis URL, MinIO endpoint/keys
- `LGU` branding is **database**, not env (except bootstrap)
- `PUBLIC_BASE_URL` for links in emails
- Feature flags only for infrastructure (e.g. `MAIL_ENABLED`)

`.env.example` documents keys. Production `.env` is root-owned `0600`.

---

## 9. Observability

- API/workers: structured JSON logs to stdout
- Prometheus scrapes `/metrics` on api and postgres/redis exporters if added
- Grafana: host health, request rate, job queue depth, disk
- Loki later if log search on the box is needed

Do not require an external SaaS APM for core operation.

---

## 10. Backup container behavior (design)

Scheduled:

1. `pg_dump` (custom format) → `backups/postgres/YYYYMMDD/`
2. `minio mirror` to backup disk or NAS
3. GeoServer data dir tarball
4. Retain N days locally
5. Emit a notification on failure (in-app + email if configured)

Restore is documented in [15-deployment-strategy.md](15-deployment-strategy.md) and must be rehearsed.

---

## 11. Migration toward Kubernetes

When a second host or HA is required:

| Compose service | K8s analogue |
|---|---|
| api / web / worker | Deployments |
| scheduler | Deployment replicas=1 or CronJob |
| postgres | Operator or managed PG — *hardest move* |
| redis / minio / geoserver | StatefulSets |
| proxy | Ingress |

Domains and Alembic stay the same. **Do not introduce K8s in MVP.**

---

## 12. Non-goals

- Docker Swarm
- Sidecar service mesh
- Building a private Kubernetes “to be future-proof” on one box
- Publishing every container port “for convenience”
