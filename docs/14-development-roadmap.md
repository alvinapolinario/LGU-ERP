# 14 — Development Roadmap

## 1. Phasing principle

Build the **shared kernel** once. Add modules that consume it. Do not start Phase 2 until MVP journeys A–E in [13-mvp-scope.md](13-mvp-scope.md) pass on a staging LGU.

Dates are intentionally omitted. Capacity depends on team size; order does not.

---

## 2. Phase 0 — Architecture (this phase)

**Status: in progress via these documents.**

- Product vision and boundaries
- Domain map
- Workflow, DMS, GIS, DB, API, security, Docker, risks
- Repository layout decision
- Next implementation prompt

**Exit:** stakeholders accept boundaries and MVP cut.

---

## 3. Phase 1 — MVP foundation

| Workstream | Deliverables |
|---|---|
| Repo skeleton | apps, domains, infra folders, lint, CI smoke |
| Compose | core + gis + observe + backup (implementation now allowed) |
| Core | LGU, org, auth, RBAC, employee lite, numbering, settings |
| Workflow | definitions, sequential run, inbox, history |
| Documents | registry, files, search, archive metadata |
| Notifications | in-app |
| GIS | registry, PostGIS tables, GeoServer publish job, OpenLayers viewer |
| Dashboard | summary widgets |
| Audit | writer + admin viewer |
| Ops | backup script, restore doc, Grafana starter |

**Exit:** pilot LGU can run paperless + map on LAN.

---

## 4. Phase 2 — Administrative operations

- Procurement: PR, quotations/canvass, PO, supplier profile, status, BAC document links
- Inventory: item master, receive, issue, location, simple reorder
- Assets: registry, assignment, maintenance log, optional map point
- Projects: record, contractor, timeline, % progress, photos, optional geometry
- Engineering: infrastructure registry linked to GIS and projects

**Depends on:** workflow + documents + master parties.

**Exit:** a purchase request can be raised, approved via configured workflow, and become a PO; stock and assets can be recorded.

---

## 5. Phase 3 — Finance

- Budget: annual structure, offices, funds, appropriations, allotments, obligations, balances
- Accounting: configurable chart of accounts, journals, vouchers, ledgers
- Treasury: collections, OR, cashier sessions, deposits, collection reports
- Integration: PR checks budget availability; later BPLO fees post to treasury

**Does not** claim full GAM certification. Rules remain configurable.

**Exit:** budget vs actual for enabled offices; collection posting path designed and usable for simple receipts.

---

## 6. Phase 4 — Human resource

- HRIS: 201 core, plantilla reference, status, documents
- Attendance and leave (policy-configurable)
- Training, service history, evaluation metadata
- Payroll **structure** and approval workflow; calculation engine last inside this phase or immediately after

**Exit:** HR owns employee master; Core uses projection. Payroll run may still be parallel/offline if calculation is incomplete.

---

## 7. Phase 5 — Risk and planning

- CDRA: hazard types (already reference), exposure, vulnerability, barangay risk profiles
- CLUP: existing/proposed land use
- Zoning: classes, maps, permitted-use metadata, history
- Overlay conflict **warnings**
- DRRMO: incidents, evacuation centers, emergency assets, preparedness datasets

**Exit:** planner can overlay proposed use vs hazard and receive a documented warning; DRRMO can locate centers and incidents.

---

## 8. Phase 6 — Regulatory and property

- BPLO: application, requirements, inspection, assessment, payment status (treasury), issuance, registry, map point
- Assessor: parcels, classification, area, improvements, ownership, tax-map refs
- Collection integration for fees and RPT *as configured*, not a full RPT engine on day one

**Exit:** a business can be found on the map and in the registry; a parcel exists as a PostGIS feature with ownership held internally.

---

## 9. Phase 7 — External surface and integrations

- Citizen portal: requests, complaints, status, notifications
- Email/SMS gateways
- Digital signature provider adapter
- OCR / document conversion workers
- PhilGEPS reference fields, other NGA adapters as needed
- OpenSearch only if search quality/volume requires

**Exit:** a citizen can file and track a request without a staff account; staff still decide.

---

## 10. Phase 8 — Executive intelligence

- Cross-module KPI warehouse / materialized views
- Forecasting and predictive **advisory** models
- AI-assisted search
- Decision-support recommendations with mandatory human confirmation

**Constraint:** no autonomous legal, fiscal, or permitting decisions.

---

## 11. Cross-phase technical track

Always allowed when needed:

- Performance (indexes, tile cache, worker split)
- Accessibility and UX hardening
- MFA enforcement
- QGIS Server evaluation
- Kubernetes evaluation (only with a second host/HA need)
- Threat review before any Internet publish

---

## 12. Dependency graph

```text
Phase 0 Architecture
        ↓
Phase 1 Core + Paperless + GIS + Dashboard
        ↓
        ├───────────────┬───────────────┐
        ↓               ↓               ↓
   Phase 2 Ops     Phase 5 Planning   (GIS deepens)
        ↓               ↓
   Phase 3 Finance     Phase 6 BPLO/Assessor
        ↓               ↓
   Phase 4 HR          Phase 7 Citizen
        ↓
   Phase 8 Intelligence
```

Phase 5 can proceed in parallel with Phase 2 if two teams exist **and** they only consume MVP contracts.

Phase 6 needs Phase 3 treasury if payment status is required; otherwise BPLO can record payment references manually first.

---

## 13. Team shape (suggested)

| Role | Phase 1 focus |
|---|---|
| Tech lead / architect | Boundaries, reviews |
| Backend (2) | Core, workflow, documents |
| Frontend (1–2) | Admin shell, inbox, map |
| GIS engineer | PostGIS, GeoServer, QGIS SOP |
| DevOps | Compose, backup, proxy, monitoring |
| LGU process counterpart | Document types, routing, barangay list |

---

## 14. Definition of done per phase

- Migrations apply cleanly from empty
- Seed demo LGU works
- RBAC tests for the new module
- Audit events documented
- No new hard-coded LGU or office names
- Backup still restores
- Docs updated (`docs/` + module README)
