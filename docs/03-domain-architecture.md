# 03 — Domain Architecture

## 1. Domain / module map

```text
                        ┌─────────────────────┐
                        │     SHARED CORE     │
                        │ identity · org ·    │
                        │ master data · audit │
                        │ config · numbering  │
                        └──────────┬──────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
     ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
     │    WORKFLOW     │  │   DOCUMENTS &   │  │  PLATFORM SVCS  │
     │  definitions    │  │    RECORDS      │  │ notify · search │
     │  instances      │  │  DMS · archive  │  │ report · files  │
     │  tasks          │  └────────┬────────┘  │ events          │
     └────────┬────────┘           │           └─────────────────┘
              │                    │
              └──────────┬─────────┘
                         │ used by every later module
         ┌───────────────┼───────────────────────────┐
         │               │                           │
┌────────▼──────┐ ┌──────▼──────┐            ┌───────▼───────┐
│ ADMINISTRATIVE│ │  SPATIAL &  │            │   EXTERNAL    │
│ ERP           │ │  PLANNING   │            │   SURFACES    │
│ procurement   │ │ gis         │            │ citizen       │
│ inventory     │ │ cdra        │            │ dashboard     │
│ assets        │ │ clup        │            │ integrations  │
│ finance*      │ │ zoning      │            └───────────────┘
│ hr / payroll  │ │ drrmo       │
│ bplo          │ │ engineering │
│ assessor      │ │ projects    │
└───────────────┘ │ agriculture │
                  │ environment │
                  └─────────────┘

* finance = budget + accounting + treasury (one bounded context, three subdomains)
```

---

## 2. Bounded contexts

| Context | Responsibility | Owns data | Depends on |
|---|---|---|---|
| **Core / Identity** | LGU config, users, RBAC, org, employees as actors | `core`, `auth` | — |
| **Reference / Master data** | Barangays, parties, funds, shared codes | `reference`, shared masters in `core` | Core |
| **Workflow** | Definitions, instances, tasks, escalation | `workflow` | Core |
| **Documents / Records** | Registry, files, versions, retention | `documents` | Core, Workflow, Files |
| **GIS** | Layers, datasets, publish, spatial tables | `gis` + spatial tables | Core, Files, Jobs |
| **Notifications** | In-app (and later channels) | `notifications` | Core, Events |
| **Audit** | Immutable event log | `audit` | Everything writes; nothing “owns” audit except the audit writer |
| **Procurement** | PR to PO / award | `procurement` | Core, Workflow, Documents, Budget (later) |
| **Inventory** | Stock movements | `inventory` | Core, Procurement |
| **Assets** | Fixed assets | `assets` | Core, Procurement, GIS optional |
| **Finance** | Budget, books, collections | `finance` (or split schemas) | Core, Workflow, Documents |
| **HR / Payroll** | Workforce and pay | `hr`, `payroll` | Core, Workflow |
| **BPLO** | Business permits | `bplo` | Core, Workflow, Treasury, GIS |
| **Assessor** | Parcels and ownership | `assessor` | Core, GIS |
| **Engineering / Projects** | Works and monitoring | `engineering`, `projects` | Core, Documents, GIS, Budget |
| **CDRA / CLUP / Zoning** | Risk and land use | `cdra`, `clup`, `zoning` | GIS, Core |
| **DRRMO** | Incidents and preparedness | `drrmo` | GIS, CDRA |
| **Agriculture / Environment** | Sector spatial ops | `agriculture`, `environment` | GIS, CDRA |
| **Citizen** | External cases | `citizen` | Documents, Workflow, Notifications |
| **Reporting / Analytics** | Read models, exports | views / `analytics` later | All (read-only) |
| **Integration** | Outbound/inbound adapters | `integration` | Events |

---

## 3. Cross-module integration map

Modules share **identifiers**, not copies.

```text
HRIS              → Payroll          (employee_id)
Procurement       → Inventory        (item receipts from PO)
Procurement       → Assets           (capitalized receipts)
Budget            → Procurement      (allotment / availability check)
Accounting        → Treasury         (collections and disbursements)
BPLO              → Treasury         (fees, OR status)
Assessor          → GIS              (parcel geometry)
Engineering       → GIS              (infrastructure geometry)
Projects          → GIS              (project geometry)
CDRA              → CLUP             (overlay conflict warnings)
Documents         → Every module     (supporting file set)
Workflow          → Every module     (approval of a domain record)
Audit             → Every module     (write-only)
Organization      → Every module     (office / actor)
```

### Integration rules

1. A module stores a **foreign UUID** to another module’s aggregate, or a **reference-data code**.
2. A module does not update another module’s tables.
3. Side effects (notify, reindex, publish layer) happen through events.
4. If two modules need a shared concept (Person, Organization, Location), it belongs in **master data**, not in either module.

---

## 4. Master data ownership

| Entity | Owner | Consumers |
|---|---|---|
| LGU profile, seal, settings | Core | All |
| Department / office / section / position | Core | All |
| User / role / permission | Identity | All |
| Employee (as workforce record) | HR (MVP: Core lightweight employee) | Workflow, Payroll, Assets |
| Citizen / resident party | Master data | Documents, Citizen, BPLO |
| Business / establishment | Master data; BPLO extends | Treasury, GIS |
| Supplier | Master data; Procurement extends | Inventory, Accounting |
| Barangay / admin boundary | Reference + GIS | All |
| Property / parcel | Assessor | GIS, Treasury |
| Facility | Master data + GIS | DRRMO, Engineering |
| Project | Projects | Engineering, Budget, GIS |
| Fund / account | Finance | Budget, Accounting, Procurement |
| Item | Inventory | Procurement, Assets |
| Asset | Assets | GIS, Accounting |
| Document type / numbering series | Documents | All |
| Hazard type / zoning class / land-use class | Reference (configurable) | CDRA, CLUP, Zoning |

**MVP note:** a lightweight `core.employee` exists so routing works before the HRIS module is built. HRIS later becomes the system of record and Core keeps a projection (id, name, office, status).

---

## 5. Domain package rules (modular monolith)

Each domain package exposes:

```text
domains/<name>/
  api/            # routers (optional; may live under apps/api)
  application/    # use cases
  domain/         # entities, value objects, events
  infrastructure/ # SQLAlchemy models, repositories
  README.md       # boundary, events published/consumed
```

Allowed imports:

```text
apps/api        → any domain application service
domain A        → core, shared kernel
domain A        → platform kits (files, notify publisher)
domain A        ↛ domain B internals
```

A thin **shared kernel** may contain: UUID newtypes, money, date ranges, sensitivity enum, pagination, error types. It must stay small.

---

## 6. Schema-to-domain mapping

See [08-database-architecture.md](08-database-architecture.md) for the pragmatic schema set. Summary:

| Phase | Schemas created |
|---|---|
| MVP | `core`, `auth`, `workflow`, `documents`, `gis`, `notifications`, `audit`, `reference` |
| Phase 2 | `procurement`, `inventory`, `assets`, `projects`, `engineering` |
| Phase 3 | `finance` (budget/accounting/treasury as prefixes or sub-schemas if justified) |
| Phase 4 | `hr`, `payroll` |
| Phase 5 | `cdra`, `clup`, `zoning`, `drrmo` |
| Phase 6 | `bplo`, `assessor` |
| Phase 7 | `citizen`, `integration` |

Do not create empty schemas for unimplemented domains.

---

## 7. Enablement model

Each module has a row in `core.module_enablement`:

- `code` (e.g. `documents`, `gis`, `procurement`)
- `enabled`
- `licensed_until` (optional)
- `config` JSON (module-level flags only; not workflow definitions)

The API hides routes for disabled modules. The web app hides navigation. Data already stored is retained.

---

## 8. Spatial domains

GIS is a **platform domain**. Sector modules own **business meaning**; GIS owns **geometry storage, layer metadata, and publish state**.

Example:

- Assessor owns tax-map identity and ownership.
- GIS owns `assessor.parcel` geometry table (or `gis.features` with `source_ref`) and the published layer.

Preferred pattern for first spatial modules: **feature table in the owning schema** with a PostGIS geometry column, **registered** in `gis.layer`. GeoServer is pointed at a view that strips PII.

---

## 9. What “modular” does not mean

- Not a microservice per office
- Not a separate database per module
- Not a separate login per module
- Not copy-pasted document upload per module

It means **deployable gradually**, **owned data**, and **stable contracts**.
