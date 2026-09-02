# 11 — Data Governance Model

## 1. Intent

Government data is evidence. The platform must make it clear **who owns a record**, **how sensitive it is**, **how long it is kept**, and **what may be shown on a map or export**.

Governance is implemented as metadata + access rules + process, not as a written policy PDF alone.

---

## 2. Data classification

| Level | Examples | Default access |
|---|---|---|
| `public` | Published zoning map, office directory, released executive order if declared public | Public layers / FOI-ready exports |
| `internal` | Routine incoming letters, project status, stock counts | Authenticated staff with module access |
| `restricted` | Employee numbers with pay hints, supplier evaluations, unpublished hazards tied to vulnerable sites | Named roles |
| `confidential` | Citizen complaints with personal details, 201 file, tax owner PII, investigation notes | Need-to-know + extra permission |

Classification is a field on the record (and inherited by files and tasks). Users have a **clearance** at least as high as the record to view it.

Default for new documents: `internal`. Clerks can raise; lowering confidentiality is itself an audited permission.

---

## 3. Master data governance

Every master record (party, office, barangay, facility, item, fund) supports:

| Attribute | Purpose |
|---|---|
| Owner office | Who maintains it |
| Source | `system`, `manual`, `import`, `qgis`, `integration` |
| Status | active / inactive |
| Effective dates | History without silent overwrite |
| History | Changes via audit; important masters may have version rows later |

**Golden record rule:** one party, one barangay, one facility id. Modules add profiles, they do not clone names.

Inactive records remain resolvable for historical documents.

---

## 4. Ownership by domain

| Data | Steward (typical office) | System owner |
|---|---|---|
| Users and roles | MIS + HR / Admin | Identity |
| Offices / positions | HR / Admin | Core |
| Document registry | Records | Documents |
| Workflow definitions | MIS + process owner | Workflow |
| Layers and CRS | GIS / MPDO | GIS |
| Hazards | DRRMO / Planning | CDRA (MVP: GIS + reference) |
| Land use / zoning | MPDO | CLUP / Zoning |
| Parcels | Assessor | Assessor |
| Businesses | BPLO | BPLO + party master |
| Budget / books | Budget / Accounting | Finance |
| Collections | Treasury | Finance |
| Employees 201 | HRMO | HR |
| Audit log | MIS + Internal Audit | Audit (immutable) |

Stewards are data; they are not hardcoded office names.

---

## 5. Quality rules

Ingest (especially GIS and bulk party import) must run validation:

- Required fields
- Unique business numbers
- Geometry validity and CRS
- Bounding box vs LGU extent (warning, not always hard fail — coastal/adjacent lots)
- Reference code exists and is active

Staging → approve → promote. No silent overwrite of operational parcels from a USB geodatabase.

---

## 6. Retention and disposition

Aligned with RA 9470 practices at the **mechanism** level:

- Retention schedule on document type
- Clock start: created / released / archived (configurable)
- Legal hold blocks disposition
- Disposition is a dual-control job (propose + approve)
- GIS superseded layers are `retired`, not deleted, until schedule says so
- Audit partitions exported before drop

The product does not auto-shred confidential records because a date elapsed without a human confirmation.

---

## 7. Privacy and minimization

Collect only fields the process needs. Examples:

- Incoming document: sender name and office may suffice; do not require TIN
- Map pin for a business: location + trade name; not owner home address on the layer
- Dashboard: counts and amounts, not lists of complainants

Privacy-aware export:

- Role `export` 
- Column policy per report
- “Public release” report profile vs “internal working” profile

---

## 8. Temporal honesty

Planning and GIS data go stale. Records store `as_of_date` / `valid_from` / `valid_to` for layers, land-use, and hazard editions.

The UI should show **which edition** of a CLUP or flood map the user is seeing. Mixing 2015 flood lines with 2026 proposed land use is allowed for analysis but must be labeled.

---

## 9. Cross-LGU reuse

When the same product is deployed to another LGU:

- No production data is copied
- Reference *structures* (hazard type list, document type list) may be cloned as a template
- Workflow definitions may be cloned then edited
- Geometries, parties, and documents never ship in the product image

---

## 10. Open data vs operational GIS

A future open-data site may consume `lgu_public` WMS/WFS. That is a deliberate publish, not the default for all PostGIS tables.

Consultant “source files” remain in MinIO as datasets with license/attribution metadata and are not automatically public.

---

## 11. AI / analytics later

Phase 8 analytics and AI-assisted search may read **classified** data only inside the same RBAC envelope. Models must not be trained on confidential LGU data using external cloud APIs unless the LGU executes a privacy contract and a network allowlist. Default: on-box or not at all.

AI outputs are advisory. They are not official approvals.
