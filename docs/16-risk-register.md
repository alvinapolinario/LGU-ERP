# 16 — Risk Register

Likelihood and impact are qualitative: **H** high, **M** medium, **L** low.

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R01 | Scope explosion (building “all of ERP” in phase 1) | H | H | Freeze MVP; phase gate; this doc set as contract |
| R02 | Hard-coded LGU / offices / workflows in first code drop | H | H | Architecture review checklist; seed data only |
| R03 | Workflow engine too naive for real routing, then rewritten | M | H | Position-based assignment, versioning, conditions vocabulary now |
| R04 | Workflow engine too much like Camunda, delayed MVP | M | H | Sequential + return/reject first; no BPMN |
| R05 | Duplicate master data per module | H | H | Party/office ownership rules; code review |
| R06 | GIS treated as a screenshot widget; QGIS files remain SoR | H | H | Layer registry + promote pipeline; QGIS on staging |
| R07 | CRS mistakes corrupt cadastre | M | H | Store source CRS; `crs_locked`; GIS officer approval |
| R08 | GeoServer admin or Postgres exposed to Internet | M | H | Compose bindings; firewall; publish checklist |
| R09 | PII on public WMS | M | H | Publish views; sensitivity; catalog from API |
| R10 | Single NVMe fills with orthophotos | H | H | MinIO quotas; raster policy; backup on other disk |
| R11 | Backup never tested | H | H | Quarterly restore on staging; backup failure alert |
| R12 | Ransomware / host loss | M | H | Off-box backups; LUKS; least-open ports |
| R13 | Secrets committed | M | H | `.env.example` only; pre-commit ignore; review |
| R14 | Celery + GDAL memory spikes starve Postgres | M | M | Separate worker limits; job size caps |
| R15 | OpenLayers vs GeoServer auth mismatch | M | M | Proxy + filtered catalog; no client-side secrets |
| R16 | Staff reject paperless (process, not software) | H | H | Pilot office; parallel logbook; training |
| R17 | Over-promising GAM / RA 9184 / tax assessment compliance | H | H | Explicit non-goals; configurable rules later |
| R18 | Internet outage blamed on “system down” because OSM tiles missing | M | M | Local basemap required for MVP map |
| R19 | Audit table growth degrades DB | M | M | Partition + export |
| R20 | Premature microservices / Kafka / K8s | M | H | Modular monolith rule; re-evaluate on HA need |
| R21 | Custom cryptography for “e-sign” | L | H | Provider adapter only |
| R22 | Legal decisions automated by overlay or AI | L | H | Warnings only; human action required |
| R23 | Multi-LGU SaaS assumed too early (noisy neighbor) | M | M | One LGU per deploy now; keep `lgu_id` |
| R24 | QGIS users given superuser DB | M | H | `qgis_staging` role only |
| R25 | Unvalidated consultant GDB overwrites live parcels | M | H | Staging + workflow publish |
| R26 | Accessibility / low-spec office PCs | M | M | Progressive UI; map optional for clerks |
| R27 | Time drift invalidates audit | L | M | chrony/NTP mandatory |
| R28 | Vendor lock-in to a cloud API | L | H | Local-first; no required SaaS |
| R29 | Team builds UI without API contracts | M | M | API-first; OpenAPI |
| R30 | Phase 5 CDRA becomes a science project | M | M | Configurable types; reuse GIS overlays; no custom model runtime in v1 |

---

## Key technical risks (narrative)

### Product risk

The largest risk is **political and process**, not React vs FastAPI. If Records still run a paper log and GIS still live in desktop folders, the platform becomes a second ledger. Mitigation is a narrow pilot and a hard MVP.

### Spatial risk

Wrong CRS, unpublished PII, and disk exhaustion will hurt more than missing CLUP forms. Treat GeoServer and PostGIS as production systems from day one.

### Engineering risk

A “complete schema for all 25 domains” or a microservice mesh will stall the paperless go-live. Empty abstraction is a delivery failure.

### Compliance risk

Encoding incomplete GAM or procurement law as if it were complete creates **wrong official numbers**. Better to store evidence and configurable checks than to claim certification.

---

## Assumptions

These assumptions underlie the architecture. If one is false, revisit the design.

1. The first production target is **one LGU, one server**, not a national multi-tenant SaaS.
2. MIS can operate Docker, backups, and a Linux firewall, or a vendor will.
3. QGIS Desktop is acceptable for professional editing; web editing is limited.
4. Staff will have LAN access; Internet is unreliable.
5. English UI is acceptable for MVP; labels can be bilingual later.
6. A fictional demo LGU is allowed in the repo; real parcels are not.
7. Email is optional at go-live.
8. Wet-ink + scanned PDF is a legally acceptable interim for most document types.
9. The LGU can name process owners for Records and GIS.
10. Kubernetes, Kafka, and OpenSearch are **not** required to prove value.
11. Philippine policy instruments inform design but the product is not pre-certified.
12. The same codebase will be reused for a second LGU within the product life, so configuration discipline matters immediately.
13. 64 GB RAM is shared with GeoServer and Postgres; rasters must be governed.
14. Users are municipal/city staff first; citizens later.
15. Domain events plus Redis/Celery are enough until integration volume says otherwise.

---

## Open questions for stakeholders

1. Which LGU is the first pilot, and which office owns document numbering today?
2. Is HTTPS on LAN required at go-live or can it follow?
3. Will QGIS connect over LAN to Postgres, or must all edits go through files?
4. What is the official operational CRS for cadastre vs planning?
5. Is there an existing document classification / retention schedule to load?
6. Who is allowed to lower a document’s confidentiality?
7. Will any map be public in year one?
8. Is there a NAS for backups, or only the system disk?
9. Which identity source exists (AD/LDAP) vs local users?
10. Are there binding constraints from an existing finance system that Phase 3 must interface with rather than replace?
