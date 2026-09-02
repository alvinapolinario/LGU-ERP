# 17 — Recommended next Cursor prompt

Use this prompt **after** the architecture documents are reviewed. It authorizes a **narrow implementation**: repository skeleton, Core + Auth + Workflow + Documents contracts, and Docker baseline — not the full ERP.

Copy everything below the line.

---

## Cursor prompt — Phase 1 foundation (skeleton + core contracts only)

You are implementing the first slice of the Integrated LGU Digital Government Platform described in `/docs`.

### Mandatory reading (do not skip)

Read and follow:

- `docs/README.md`
- `docs/13-mvp-scope.md`
- `docs/04-shared-core.md`
- `docs/05-workflow-engine.md`
- `docs/06-document-management.md`
- `docs/08-database-architecture.md`
- `docs/09-api-architecture.md`
- `docs/10-security-architecture.md`
- `docs/12-docker-architecture.md`

### Goal of this pass

Create a **runnable modular-monolith skeleton** that proves the foundation, not the whole product.

Deliver:

1. Repository folders as in `docs/README.md` (only MVP domains: `core`, `identity`, `workflow`, `documents`, `gis`)
2. `apps/api` FastAPI app with health routes and empty versioned router mounts
3. `apps/web` Vite + React + TypeScript shell (login placeholder, app layout, no fake ERP pages)
4. Alembic wired; **MVP schemas only**: `core`, `auth`, `workflow`, `documents`, `gis`, `notifications`, `audit`, `reference`
5. SQLAlchemy models for: LGU profile, departments/offices/positions, users, roles/permissions, lightweight employee, numbering series, document type + document + file metadata, workflow definition/instance/task/history (minimal columns per docs)
6. Auth: register-not-public; seed admin; login/logout; password hash Argon2id; session
7. Docker Compose **dev** baseline: `proxy`, `web`, `api`, `worker`, `postgres-postgis`, `redis`, `minio` — no Kafka, no Kubernetes, no OpenSearch
8. `.env.example` with placeholders only
9. README with how to run locally
10. A fictional seed LGU (e.g. “San Ejemplo”) — never a real municipality’s employee list

### Hard rules

- Do **not** implement procurement, finance, HR, BPLO, CDRA, CLUP, payroll, citizen portal
- Do **not** hard-code LGU name, barangays, offices, or approval chains in application code
- Do **not** invent a GIS engine; GIS in this pass is schema + layer registry table + health; GeoServer service may be added as a Compose service with default config only
- Do **not** implement a custom signing protocol
- Do **not** commit secrets
- Prefer UUID primary keys and a document numbering service interface
- Keep domain packages decoupled; API is the composition root
- Tests: at least auth login and document create-in-db unit/integration smoke

### After this pass

Stop and report what was created. Do not continue into dashboard widgets, OpenLayers, or the full workflow runtime unless this skeleton is accepted.

If anything in `/docs` conflicts with this prompt, **stop and ask** — do not silently pick the more expansive interpretation.
