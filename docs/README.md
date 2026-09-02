# Architecture documentation

This folder is the architecture baseline for the **Integrated LGU Digital Government Platform** (ERP + paperless + GIS + CDRA/CLUP + executive support).

**Status:** planning only. No application code, migrations, or Compose files have been generated.

---

## Document index

| File | Contents |
|---|---|
| [00-product-vision.md](00-product-vision.md) | Executive concept, principles, evolution path |
| [01-business-scope.md](01-business-scope.md) | In/out of scope, policy awareness, product boundaries |
| [02-system-architecture.md](02-system-architecture.md) | Runtime architecture, quality attributes, **technology decision matrix** |
| [03-domain-architecture.md](03-domain-architecture.md) | Domain/module map, integration, enablement |
| [04-shared-core.md](04-shared-core.md) | Identity, RBAC, org, master data, numbering |
| [05-workflow-engine.md](05-workflow-engine.md) | Configurable routing and approvals |
| [06-document-management.md](06-document-management.md) | DMS, records, lifecycle, files |
| [07-gis-architecture.md](07-gis-architecture.md) | PostGIS, GeoServer, QGIS, OpenLayers |
| [08-database-architecture.md](08-database-architecture.md) | Schema strategy, identifiers, roles |
| [09-api-architecture.md](09-api-architecture.md) | `/api/v1` strategy and conventions |
| [10-security-architecture.md](10-security-architecture.md) | Controls, privacy, hardening |
| [11-data-governance.md](11-data-governance.md) | Classification, ownership, retention |
| [12-docker-architecture.md](12-docker-architecture.md) | Services, resources, volumes (no Compose yet) |
| [13-mvp-scope.md](13-mvp-scope.md) | What ships first; acceptance journeys |
| [14-development-roadmap.md](14-development-roadmap.md) | Phases 0–8 |
| [15-deployment-strategy.md](15-deployment-strategy.md) | LAN-first install, backup, cutover |
| [16-risk-register.md](16-risk-register.md) | Risks, assumptions, open questions |
| [17-recommended-next-prompt.md](17-recommended-next-prompt.md) | Next Cursor prompt (implementation of skeleton only) |

---

## Required analysis outputs

| # | Output | Where |
|---|---|---|
| 1 | Executive system concept | [00](00-product-vision.md) |
| 2 | Proposed architecture | [02](02-system-architecture.md) |
| 3 | Domain / module map | [03](03-domain-architecture.md) |
| 4 | Technology decision matrix | [02 §8](02-system-architecture.md) |
| 5 | Shared-core architecture | [04](04-shared-core.md) |
| 6 | Workflow-engine design | [05](05-workflow-engine.md) |
| 7 | Document-management architecture | [06](06-document-management.md) |
| 8 | GIS architecture | [07](07-gis-architecture.md) |
| 9 | PostgreSQL / PostGIS schema strategy | [08](08-database-architecture.md) |
| 10 | API strategy | [09](09-api-architecture.md) |
| 11 | Docker architecture | [12](12-docker-architecture.md) |
| 12 | Security architecture | [10](10-security-architecture.md) |
| 13 | Data governance model | [11](11-data-governance.md) |
| 14 | MVP scope | [13](13-mvp-scope.md) |
| 15 | Phase roadmap | [14](14-development-roadmap.md) |
| 16 | Repository structure | [below](#recommended-repository-structure) |
| 17 | Key technical risks | [16](16-risk-register.md) |
| 18 | Assumptions | [16](16-risk-register.md) |
| 19 | Recommended product boundaries | [01 §6](01-business-scope.md) |
| 20 | Recommended next Cursor prompt | [17](17-recommended-next-prompt.md) |

---

## Recommended repository structure

Improvements over the original sketch: a `packages/` shared kernel, `identity` as a domain, `finance` instead of many empty domains, and GIS styles kept with GIS ops.

```text
lgu-digital-platform/
├── apps/
│   ├── web/                      # React + TypeScript + Vite (admin + map)
│   └── api/                      # FastAPI composition root
├── packages/
│   ├── ui/                       # shared React components (later)
│   └── python-common/            # logging, errors, auth principal types
├── domains/
│   ├── core/
│   ├── identity/
│   ├── workflow/
│   ├── documents/
│   ├── gis/
│   ├── procurement/              # from Phase 2
│   ├── inventory/
│   ├── assets/
│   ├── finance/
│   ├── hr/
│   ├── projects/
│   ├── cdra/
│   └── clup/
├── services/
│   ├── worker/                   # Celery entry (may share apps/api image)
│   ├── scheduler/
│   ├── reporting/
│   └── notifications/
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   ├── postgres/
│   ├── geoserver/
│   ├── minio/
│   ├── redis/
│   └── monitoring/
├── database/
│   ├── migrations/               # Alembic
│   ├── seeds/
│   └── schemas/                  # reference SQL docs only
├── gis/
│   ├── qgis/
│   ├── styles/
│   └── sample-data/              # fictional / open license only
├── docs/
│   ├── architecture/             # this set may later be moved here
│   ├── requirements/
│   ├── workflows/
│   ├── database/
│   ├── security/
│   ├── gis/
│   └── deployment/
├── scripts/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── README.md
```

**Now:** only `docs/` and the master `prompt.md` exist. Folders above are created when implementation is approved.

**Rule:** do not add empty domain packages for Phase 2+ until that phase starts.

---

## Review checklist before coding

- [ ] MVP cut accepted (paperless + GIS + core + dashboard)
- [ ] Pilot LGU and process owners named
- [ ] Operational CRS and backup target decided
- [ ] No request to generate all ERP modules in the first implementation pass
