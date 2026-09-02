# 02 — System Architecture

## 1. Proposed architecture

The platform is a **modular monolith** deployed as a small set of Docker services on a single LGU server.

```text
                         Optional: Cloudflare / VPN
                                        |
                         +--------------v--------------+
                         |     Reverse proxy (Nginx)   |
                         |  TLS, routing, rate limits  |
                         +------+-------------+--------+
                                |             |
                     /          |             |   /geoserver (WMS/WFS)
            +-------v----+  +---v----+  +-----v----------+
            |  Web SPA   |  |  API   |  |  GeoServer     |
            | React+Vite |  | FastAPI|  |  published     |
            +------------+  +---+----+  |  layers only   |
                                |       +--------+-------+
                                |                |
                     +----------+----------------+
                     |          |                |
              +------v---+ +----v-----+ +--------v---+
              | PostgreSQL| |  Redis   | |   MinIO    |
              | + PostGIS | | cache,   | |  objects   |
              |           | | queue,   | |            |
              |           | | locks    | |            |
              +------+---+ +----+-----+ +------+-----+
                     |          |              |
                     |     +----v------+       |
                     |     | Worker +  |<------+
                     |     | Scheduler |
                     |     | (Celery)  |
                     |     +-----------+
                     |
     QGIS Desktop (LAN) -- SQL / GeoServer WFS-T (controlled)
```

Internal eventing for MVP is **in-process domain events + Redis** (cache, locks, Celery broker). A message broker (NATS/RabbitMQ/Kafka) is an explicit later option, not an MVP dependency.

---

## 2. Architectural style

| Decision | Choice | Why |
|---|---|---|
| Application shape | Modular monolith | One deployable API, hard domain boundaries, extract later |
| Composition | API is a composition root | Domains are packages; the API wires routers and DI |
| UI | Single admin SPA + later citizen SPA | Shared design system; citizen app is a later surface |
| Data | One PostgreSQL with schemas | Transactional integrity across documents, workflow, finance |
| Spatial | PostGIS + GeoServer + QGIS + OpenLayers | Do not build a GIS engine |
| Files | MinIO (S3 API) | Documents, rasters, reports stay off the DB |
| Jobs | Celery worker + beat scheduler | GIS ingest, reports, notifications, backup orchestration |
| Isolation | Docker Compose on one host | Fits i9 / 64 GB / no K8s MVP |
| Tenancy | Single LGU per deploy + `lgu_id` column | Repeatable product, future multi-tenant path |

---

## 3. Logical layers

```text
┌──────────────────────────────────────────────┐
│ Presentation                                 │
│  Admin web  ·  Map viewer  ·  later Citizen  │
├──────────────────────────────────────────────┤
│ API / Application                            │
│  AuthN  ·  RBAC  ·  validation  ·  use cases │
├──────────────────────────────────────────────┤
│ Domain modules                               │
│  workflow · documents · gis · (later ERP…)   │
├──────────────────────────────────────────────┤
│ Shared core                                  │
│  identity · org · master data · audit · bus  │
├──────────────────────────────────────────────┤
│ Platform services                            │
│  files · jobs · notify · search · reporting  │
├──────────────────────────────────────────────┤
│ Data & infra                                 │
│  PostgreSQL/PostGIS · Redis · MinIO · GS     │
└──────────────────────────────────────────────┘
```

**Rule:** a domain may depend on shared core and platform services. A domain may **not** import another domain’s tables or internals. Cross-domain collaboration uses:

1. Public application services / interfaces
2. Shared master-data identifiers
3. Domain events

---

## 4. Runtime components (MVP)

| Component | Role |
|---|---|
| `reverse-proxy` | TLS termination (when certs exist), path routing, static SPA, rate limit |
| `web` | React admin + OpenLayers map |
| `api` | FastAPI modular monolith |
| `worker` | Celery: ingest, conversions, reports, mail, layer publish hooks |
| `scheduler` | Celery beat: retention jobs, dashboard snapshots, backup triggers |
| `postgres-postgis` | System of record, including spatial |
| `redis` | Cache, session coordination, broker, locks |
| `minio` | Object storage |
| `geoserver` | WMS/WFS for approved layers |
| `monitoring` | Prometheus + Grafana (Loki optional later) |
| `backup` | Scheduled dump + object sync to local/off-box storage |

QGIS Desktop is **not** containerized as a required service. GIS staff run it on workstations against PostGIS or controlled GeoServer endpoints.

---

## 5. Network placement

```text
[LGU LAN]
  Staff browsers  →  https://erp.lgu.local (or IP)
  QGIS workstations → PostGIS (restricted role) and/or GeoServer
  Optional VPN users → same reverse proxy

[Optional Internet]
  Reverse proxy or Cloudflare Tunnel → same services
  Citizen portal (later) on a separate hostname and tighter API surface
```

**Must remain private:** PostgreSQL port, Redis, MinIO console, GeoServer admin, Grafana (or put Grafana behind SSO and LAN-only).

**May be published (carefully):** SPA, API `/api/v1`, GeoServer **WMS/WFS read** for approved public layers only.

---

## 6. Offline / intermittent Internet

| Function | Internet required? |
|---|---|
| Login, documents, workflow, audit | No |
| Local map layers (PostGIS/GeoServer) | No |
| Basemap tiles from OSM/Google | Yes — provide a local/offline basemap fallback |
| Email notifications | Yes (or local mail relay) |
| SMS | Yes |
| Cloudflare | Yes — LAN URL remains the fallback |
| Software updates / image pulls | Yes — schedule, do not require at runtime |

Design implication: ship a **local basemap** (vector tiles or raster) for the LGU extent. External tile servers are enhancement, not a dependency.

---

## 7. Event-driven extension (without Kafka)

MVP event bus:

```text
Domain action
   → persist in same DB transaction
   → publish DomainEvent to in-process bus
   → transactional outbox row (same transaction)
   → worker reads outbox / Redis
   → notification, search index update, GeoServer hook, dashboard refresh
```

Example events (stable names):

- `document.registered`
- `document.routed`
- `workflow.task.assigned`
- `workflow.completed`
- `user.permission.changed`
- `gis.layer.published`
- later: `purchase_request.approved`, `payment.received`, `permit.approved`

When volume or multiple writers justify it, replace the worker transport with a broker. Event **names and payloads** stay stable.

---

## 8. Technology decision matrix

| Concern | Decision | Alternatives considered | Defer / reject |
|---|---|---|---|
| Admin UI | React + TypeScript + Vite | Next.js | Next.js not required; SPA behind Nginx is enough |
| Maps | OpenLayers | MapLibre, Leaflet | MapLibre if vector tiles become primary; Leaflet only for trivial embeds |
| API | FastAPI + Pydantic | Django, NestJS | FastAPI fits GIS Python ecosystem |
| ORM | SQLAlchemy 2 + Alembic | Django ORM, Prisma | GeoAlchemy2 alignment |
| Spatial DB | PostgreSQL 16 + PostGIS 3 | SpatiaLite, separate GeoDB | Single DB preferred |
| Map server | GeoServer | QGIS Server, Martin, pg_tileserv | Evaluate QGIS Server when project-faithful print/style is required |
| GIS desktop | QGIS | ArcGIS | QGIS is the supported professional client |
| Cache / broker | Redis | None for MVP | — |
| Workers | Celery + Redis | ARQ, RQ | Celery is enough; keep beat separate container |
| Objects | MinIO | filesystem, S3 | MinIO keeps S3 API without cloud dependency |
| Search | PostgreSQL FTS (+ trigram) | OpenSearch | OpenSearch only if FTS proves insufficient |
| Auth tokens | Server session + optional JWT for APIs | Keycloak | Add OIDC later; do not require it for MVP |
| Reverse proxy | Nginx | Traefik | Nginx is simpler for a single host |
| Orchestration | Docker Compose | Swarm, K8s | K8s later |
| Monitoring | Prometheus + Grafana | — | Loki later |
| Reports | Dedicated reporting service interface | Jasper, Metabase | Start with server-generated PDF/XLSX; BI later |
| Workflow | Custom configurable engine | Camunda, Temporal | External BPMN is heavier than LGU ops need for MVP |

---

## 9. Scalability posture

The first bottleneck will be **GIS rasters, document binaries, and concurrent map tiles**, not business-transaction TPS.

Vertical path on the target box (64 GB):

- Postgres: 8–16 GB
- GeoServer + JVM: 4–8 GB
- API + workers: 4–8 GB
- Redis + MinIO + proxy + monitoring: remainder
- Leave headroom for QGIS clients hitting the same DB

Horizontal path later (without redesign):

- Split worker/scheduler first
- Read replicas for reporting / GeoServer
- Extract notification or GIS ingest as a service
- Kubernetes only when there are multiple hosts or HA requirements

---

## 10. Quality attributes

| Attribute | Architecture response |
|---|---|
| Modularity | Domain packages + schema isolation + events |
| Auditability | Append-only audit schema; workflow history |
| Security | Proxy boundary, RBAC, secrets outside git |
| Privacy | Sensitivity on records and layers; no PII on public maps |
| Recoverability | Daily logical backup + object storage sync |
| Portability | Compose + `.env`; no proprietary cloud runtime |
| Observability | Structured logs, metrics, audit queries |
| Maintainability | API-first, typed contracts, Alembic as only schema path |

Detailed views: [03-domain-architecture.md](03-domain-architecture.md), [12-docker-architecture.md](12-docker-architecture.md), [15-deployment-strategy.md](15-deployment-strategy.md).
