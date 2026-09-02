# 08 — Database Architecture

## 1. Strategy

One **PostgreSQL 16** cluster with **PostGIS 3** is the system of record for transactional and spatial data.

- **Schemas** enforce domain boundaries.
- **UUIDs** are primary keys for operational entities.
- **Business numbers** are unique, human-facing identifiers.
- **Alembic** is the only production schema path.
- **MinIO** holds blobs; the database stores keys and checksums.
- Do not create a schema for a domain that is not being implemented yet.

---

## 2. Schema strategy — recommended vs specified

The master prompt listed many schemas. Creating all of them on day one adds empty surface area and confused grants.

### MVP schemas (create now)

| Schema | Purpose |
|---|---|
| `core` | LGU, org, employees (lite), facilities, module flags, settings, numbering |
| `auth` | Users, credentials, sessions, MFA, password tokens |
| `reference` | Configurable codes: document types, hazard types, barangays (attributes), countries, etc. |
| `workflow` | Definitions, versions, instances, tasks, history |
| `documents` | Registry, files metadata, links, retention |
| `gis` | Layer catalog, datasets, publish runs, MVP spatial tables (barangay geom, facility geom, hazard) |
| `notifications` | In-app inbox |
| `audit` | Append-only audit events |

### Later schemas (create with the phase)

| Phase | Schemas |
|---|---|
| 2 | `procurement`, `inventory`, `assets`, `projects`, `engineering` |
| 3 | `finance` — *see note* |
| 4 | `hr`, `payroll` |
| 5 | `cdra`, `clup`, `zoning`, `drrmo` |
| 6 | `bplo`, `assessor` |
| 7 | `citizen`, `integration` |

### Finance note

`budget`, `accounting`, and `treasury` can be:

- **A:** one `finance` schema with prefixed tables (`budget_annual`, `acct_journal`, `treas_receipt`)
- **B:** three schemas when teams and grants need hard isolation

**Recommendation:** start with **one `finance` schema** in Phase 3. Split only if privilege management or size demands it. Three empty schemas in MVP are unnecessary.

### Records note

`records` as a separate schema is deferred. Retention tables live in `documents` until a dedicated records service exists.

### Analytics note

No `analytics` schema in MVP. Dashboards query permissioned views. Materialized read models can appear when reporting load requires them.

---

## 3. Identifier policy

| Kind | Rule |
|---|---|
| Primary key | `UUID` (`uuidv7` preferred when available, else v4) |
| External/public API | UUID + business number; never expose raw `bigserial` as the only id |
| Sequences | Allowed **internally** for numbering series and surrogate needs |
| Natural keys | Unique constraints (e.g. `lgu_id + document_no`) |
| Cross-module refs | UUID of the foreign aggregate + optional `entity_type` |

Do not use auto-increment integers as the only handle in URLs or QR codes.

---

## 4. Common columns (governance)

Operational tables should include, unless there is a reason not to:

```text
id              uuid pk
lgu_id          uuid not null
created_at      timestamptz
created_by      uuid
updated_at      timestamptz
updated_by      uuid
deleted_at      timestamptz null   -- soft delete where required
row_version     int                -- optimistic concurrency where needed
```

Master data additionally:

```text
status          active | inactive
effective_from  date
effective_to    date null
source          system | import | qgis | integration
owner_office_id uuid
```

Audit tables **do not** get `updated_by` mutation paths.

---

## 5. Spatial conventions

- Geometry columns use `geometry(Type, SRID)` with an explicit SRID from LGU settings.
- GiST indexes on every queried geometry.
- Validate `ST_IsValid` on ingest; quarantine invalid rows in staging.
- Prefer `geography` only when truly geodesic measure is required; most LGU ops use projected meters.
- Publish **views** to GeoServer, not base tables that contain PII.

Example MVP tables:

- `gis.admin_boundary` (LGU polygon)
- `gis.barangay_boundary`
- `gis.facility_location`
- `gis.hazard_zone` (`hazard_type_id` → `reference.hazard_type`)

---

## 6. Reference data

`reference` holds **configurable classifications**:

- document types (or FK from documents to reference)
- hazard types
- land-use classes (Phase 5)
- zoning classes (Phase 5)
- fund types (Phase 3)
- employment statuses
- sensitivity labels (if not a hard enum)

Use `code` (stable) + `label` (display) + `sort_order` + `is_system` (seed vs user-added) + `active`.

System codes may be deactivated but not deleted if referenced.

---

## 7. Roles inside PostgreSQL

| Role | Use |
|---|---|
| `app_owner` | Migrations only |
| `app_runtime` | DML on operational schemas; no `DROP` |
| `geoserver_reader` | `SELECT` on publish views |
| `qgis_staging` | DML on `gis_staging` only |
| `auditor_ro` | `SELECT` on `audit` + selected registers |
| `backup` | `pg_dump` |

The API uses `app_runtime`. GeoServer never uses `app_owner`.

Staging schema `gis_staging` is created with GIS MVP.

---

## 8. Integrity across domains

PostgreSQL FKs **may** cross schemas (same database). That is desired for `office_id`, `user_id`, `lgu_id`.

FKs should **not** reach into a later module that might be disabled. Use:

- FK to core/reference always
- Soft reference (`entity_type`, `entity_id`) from workflow/documents to optional modules
- Optional FK when the module is guaranteed present

Workflow subject pointers are polymorphic (`subject_type`, `subject_id`) and validated in application code.

---

## 9. Search

MVP:

- `pg_trgm` on names and document numbers
- `tsvector` on document subject/summary
- Indexes for inbox queries (`assignee_id`, `status`, `office_id`)

OpenSearch is out until relevance or volume justifies the operational cost on a single server.

---

## 10. Migration and seed

```text
database/
  migrations/     # Alembic, owned by apps/api
  seeds/
    reference/    # codes
    demo/         # fictional LGU for development
    lgu/          # per-deployment packs (not in public git if real)
  schemas/        # optional SQL reference docs, not a second source of truth
```

Rules:

- Never edit applied migrations; add new ones.
- Seeds for demo use fictional names.
- Production LGU packs stay off public remotes.

---

## 11. Retention and audit volume

`audit.event` will grow quickly. Plan:

- Partition by month
- Retain in-cluster per policy (e.g. 2–7 years)
- Export to compressed files in MinIO for longer hold
- No `UPDATE`/`DELETE` grants to `app_runtime` on audit partitions (except archival jobs using a dedicated role)

---

## 12. What not to do

- Separate Postgres for GIS vs ERP (loses transactional overlay and complicates backup)
- MongoDB for documents metadata
- Storing PDFs in `bytea`
- Auto-increment as public document id
- Creating 25 empty schemas “for completeness”
