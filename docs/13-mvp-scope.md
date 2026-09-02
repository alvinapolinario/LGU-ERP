# 13 — MVP Scope

## 1. MVP definition

The MVP is the **smallest production-capable foundation** that:

1. An LGU can use daily for paperless document control
2. Shows the LGU on a map with barangays, facilities, and at least one hazard layer family
3. Gives executives a basic operational picture
4. Runs on the target Docker host, locally, with backup and audit
5. Lets every later module plug into identity, workflow, documents, GIS, and audit **without a redesign**

The MVP is **not** a complete ERP, not a complete CDRA/CLUP suite, and not a citizen portal.

---

## 2. In scope

### 2.1 Core

- LGU profile (name, seal, extent, settings) as data
- Departments, offices, sections, positions
- Users, login/logout, password reset (admin-assisted if no mail)
- Sessions, lockout
- RBAC: roles, permissions, office and sensitivity constraints
- Lightweight employees bound to positions
- Module enablement
- Numbering series
- Append-only audit for auth, CRUD, permission changes, workflow, GIS publish

### 2.2 Paperless

- Configurable document types
- Document registry (incoming / outgoing / internal)
- Upload, version, checksum
- Workflow definition (sequential + return/reject/delegate)
- Start workflow on a document
- Task inbox
- Comments, routing history
- Status tracking
- In-app notifications
- Search (documents + basic parties/offices)
- Archive metadata + retention schedule fields (no auto-destroy)

### 2.3 GIS

- PostGIS + GeoServer + layer registry
- Ingest/staging/approve/publish pipeline (may be operator-assisted in first cut)
- Web map: catalog, identify, measure, print, local basemap fallback
- Layers: LGU boundary, barangays, facilities, hazard zones (configurable types)
- QGIS documented access to staging
- PII-safe publish views

### 2.4 Executive

- Dashboard widgets: open tasks, overdue, documents by status/office, recent publishes, simple volume counts
- Permission-filtered

### 2.5 Infrastructure

- Compose topology as specified (files created in implementation phase)
- Nginx proxy
- Redis, MinIO
- Structured logs
- Prometheus + Grafana (LAN)
- Scheduled backup job design implemented
- `.env.example`, secrets not in git

---

## 3. Explicitly out of MVP

| Item | Phase |
|---|---|
| Procurement, inventory, assets | 2 |
| Projects, engineering registers | 2 |
| Budget, accounting, treasury / OR | 3 |
| Full HRIS, attendance, leave, payroll calc | 4 |
| CDRA analytics, CLUP editor, zoning engine | 5 (overlay warning beyond visual is Phase 5) |
| DRRMO incident command | 5 |
| BPLO, assessor tax rules | 6 |
| Citizen portal, e-sign provider, OCR, SMS | 7 |
| AI / forecasting | 8 |
| Kafka, Kubernetes, OpenSearch | when justified |
| MFA enforced for all users | designed; optional flag OK |
| Email | optional if relay exists; not required to operate |
| Parallel multi-approver graphs beyond simple join | soon after MVP if a pilot LGU needs it |
| Public Internet hardening at scale | if the LGU publishes; LAN-first |

---

## 4. MVP user journeys (acceptance)

### Journey A — Incoming document

1. Records clerk logs in
2. Registers an incoming letter (type, subject, sender, office)
3. Uploads a scan
4. System assigns a document number
5. Workflow routes to the target office head
6. Office head comments and endorses or returns
7. Final release/archive
8. Another user finds it by number and subject
9. Audit shows each action

### Journey B — Second LGU configuration (dev/staging)

1. Load a different LGU profile and offices
2. No source change
3. Document types and a different workflow definition work

### Journey C — Map

1. GIS officer publishes barangay and hazard layers
2. Department head opens the map, switches layers, identifies a barangay, measures a distance
3. Public workspace does not include owner-name attributes

### Journey D — Outage

1. Disconnect Internet
2. Login, route a document, view local layers still work

### Journey E — Recovery drill

1. Restore yesterday’s dump into a clean instance
2. Documents and layers present

---

## 5. MVP non-functional targets

| Quality | Target |
|---|---|
| Concurrent staff | 25–50 active users on LAN (pilot) |
| Document upload | 50 MB default cap (configurable) |
| Map | LGU-wide barangays + a few vector hazards at interactive pan/zoom |
| RPO | 24 hours (daily backup); improve if NAS exists |
| RTO | 1 working day for single-host restore (procedure exists) |
| Auth | All API routes default deny |

---

## 6. What “foundation” means for later modules

After MVP freeze, a new module must be able to:

- Authenticate with existing users
- Authorize with new permissions added to the catalog
- Attach documents via `documents.link`
- Start a workflow with `subject_type` = the new aggregate
- Register a spatial view in `gis.layer`
- Emit audit events
- Appear in search with a new `kind`
- Toggle via module enablement

If a Phase 2 feature requires changing these contracts, the MVP contract was wrong — fix the contract before expanding ERP.

---

## 7. Pilot recommendation

Pilot with **one** willing LGU office set:

- Records / Admin
- Office of the Mayor / Administrator
- MPDO or GIS focal
- MIS

Do not pilot with Treasury go-live in MVP. Trust is built on documents and maps first.
