# 09 — API Architecture

## 1. Strategy

The API is the **composition root** of the modular monolith: one FastAPI application, many domain routers, one OpenAPI document, one authn/authz pipeline.

- Versioned under `/api/v1`
- Resource-oriented, JSON
- Typed request/response with Pydantic
- The web SPA is the first client, not the only client
- Do not implement unused module routes in MVP

---

## 2. URL map (conceptual)

Implemented when the module exists.

```text
/api/v1/auth
/api/v1/users
/api/v1/roles
/api/v1/departments
/api/v1/offices
/api/v1/employees

/api/v1/workflows
/api/v1/tasks                 # current user inbox
/api/v1/documents
/api/v1/records

/api/v1/search
/api/v1/notifications
/api/v1/reports
/api/v1/dashboard

/api/v1/gis/layers
/api/v1/gis/datasets
/api/v1/gis/map-catalog

# later
/api/v1/budget
/api/v1/accounting
/api/v1/treasury
/api/v1/procurement
/api/v1/inventory
/api/v1/assets
/api/v1/hr
/api/v1/payroll
/api/v1/bplo
/api/v1/properties
/api/v1/engineering
/api/v1/projects
/api/v1/cdra
/api/v1/clup
/api/v1/zoning
```

Health (unversioned, internal):

```text
/health/live
/health/ready
```

---

## 3. Cross-cutting API conventions

| Topic | Convention |
|---|---|
| Resource id | UUID path param; business number as query/filter |
| List | Cursor or limit/offset + total when cheap; default page size 25, max 100 |
| Filter | Query params; no undocumented POST-for-GET except search |
| Sort | `sort=updated_at:desc` |
| Errors | `{ "error": { "code", "message", "details?" } }` with stable codes |
| Validation | 422 with field paths |
| Auth | 401 unauthenticated, 403 forbidden (do not reveal confidential existence where relevant) |
| Idempotency | `Idempotency-Key` on create for documents and payments (later) |
| Concurrency | `ETag` / `row_version` on updates of contested records |
| Time | ISO-8601 UTC; UI converts to Asia/Manila |
| Language | Messages in English for MVP; labels from reference data can be localized later |

---

## 4. Auth on the wire

MVP:

- Session cookie for the SPA (CSRF: same-site + double-submit or header token)
- Optional `Authorization: Bearer` for first-party workers and future integrations

Every business handler depends on `CurrentUser` (id, roles, office, permissions, sensitivity clearance).

Module enablement is checked in middleware/router dependency: disabled module → 404 (not 403) to avoid advertising unused surface, except for administrators viewing module catalog.

---

## 5. Router ownership

```text
apps/api/app/main.py          # app factory
apps/api/app/routers/         # thin HTTP
domains/*/application         # use cases
```

Routers:

- parse/validate
- call one use case
- map domain errors to HTTP

Routers do not contain SQL or workflow graphs.

---

## 6. File and map endpoints

**Uploads:** `POST /api/v1/documents/{id}/files` via multipart or presigned PUT initiated by the API. The client does not hold long-lived MinIO credentials.

**Downloads:** API authorizes then returns a short-lived presigned URL or streams through the API for small files.

**GIS catalog:** `GET /api/v1/gis/map-catalog` returns layers the user may see, with GeoServer WMS URLs that Nginx proxies. The SPA does not talk to GeoServer admin.

**GeoServer OGC:** `/geoserver/...` is proxied, not re-implemented. The API still owns **which layers exist in the catalog**.

---

## 7. Search API

```text
GET /api/v1/search?q=&kinds=document,employee,facility&limit=
```

Response groups hits by kind. Each hit includes id, title, subtitle, and a deep-link key. The query planner applies per-kind RBAC. Confidential documents omitted entirely.

---

## 8. Dashboard API

```text
GET /api/v1/dashboard/summary
GET /api/v1/dashboard/widgets/{code}
```

Widgets are registered server-side. The client does not send raw SQL. Each widget re-checks permissions (budget figures vs document turnaround vs GIS publish counts).

MVP widgets: open tasks, documents by status, overdue routings, layer publish health, recent audit (admin).

---

## 9. Reports API

```text
POST /api/v1/reports/{code}/runs     # enqueue
GET  /api/v1/reports/runs/{id}       # status
GET  /api/v1/reports/runs/{id}/file  # download
```

Generation happens in the worker. Formats: PDF, XLSX, CSV. The run stores the requester, filters, and checksum. Permission `report:{code}:export` required.

---

## 10. Events (not a public API)

Domain events are internal. If a future integration needs webhooks, they live under `/api/v1/integration/webhooks` in Phase 7 with signed payloads. Do not expose the Redis bus.

---

## 11. OpenAPI and clients

- FastAPI generates OpenAPI 3.
- The web app uses a typed client (generated or hand-maintained wrappers).
- Breaking changes require `/api/v2` or additive fields only.

Additive rule: new optional fields and new endpoints are OK. Renames and meaning changes are not.

---

## 12. Rate limiting and abuse

At the proxy and API:

- Login: strict per IP + username
- Search and export: per user
- Upload: size and rate
- GeoServer WMS: per IP to protect the i9 box

---

## 13. What not to implement yet

- GraphQL (no multi-client complexity yet)
- Public unauthenticated document tracking
- Per-module microservice gateways
- Endpoints for Phase 2–8 aggregates
