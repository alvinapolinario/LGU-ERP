# 01 — Business Scope

## 1. Purpose

This document defines what the platform will and will not do, which offices it serves, and how scope is bounded by phase. It is the product-boundary companion to [00-product-vision.md](00-product-vision.md).

---

## 2. Problem statement

Philippine LGUs typically operate with:

- Paper routing slips and logbooks for incoming/outgoing communications
- Spreadsheets for tracking, inventory, and project status
- Separate (or absent) GIS desktop files that are not connected to operations
- Finance systems that do not share master data with permits, HR, or procurement
- Planning products (CDRA, CLUP, zoning) that live in consultant deliverables and become stale
- Weak auditability when staff, approvals, or documents change

The result is delayed action, duplicate records, lost documents, and executives who cannot see a single operational picture.

---

## 3. In-scope business capabilities

Capabilities are **designed** now and **implemented** by phase. Design-in-scope does not mean MVP-in-scope.

### 3.1 Always-on platform capabilities

| Capability | Business outcome |
|---|---|
| Multi-LGU configurability | Same product, different LGU data |
| Identity and RBAC | Least-privilege access by role, office, module, action, geography, sensitivity |
| Organization structure | LGU → department → office → section → position → employee |
| Master data | Shared people, places, organizations, funds, items |
| Workflow engine | Configurable routing and approvals |
| Document and records management | Registry, versions, retention, archive |
| Notifications | In-app now; email when a mail path exists; SMS later |
| Audit | Immutable record of material actions |
| Search | Cross-entity find (starting with PostgreSQL) |
| Reporting | PDF / XLSX / CSV with permission checks |
| Local-first operations | LAN operation without Internet |

### 3.2 Paperless operations (MVP)

- Incoming, outgoing, and internal documents
- Scan/upload, registration, numbering
- Routing, review, endorsement, return, rejection, approval
- Attachments, comments, routing history
- Document status and tracking
- Basic records classification and retention metadata

### 3.3 GIS (MVP)

- Layer registry and metadata
- Barangay boundaries, facilities, selected hazard layers
- Web map viewer (identify, measure, print)
- PostGIS storage + GeoServer publish + QGIS professional editing

### 3.4 Executive (MVP)

- Basic dashboard: document volumes/turnaround, user/office activity, GIS layer status
- Role-filtered indicators

### 3.5 Later ERP and sector modules

| Domain | Business scope (design now, build later) |
|---|---|
| Procurement | PR, canvass, quotations, PO, BAC docs, award, contract tracking |
| Inventory | Item master, receive, issue, transfer, reorder, disposal |
| Assets | Registry, assignment, maintenance, GIS location optional |
| Projects | Timeline, contractor, progress, photos, geometry |
| Engineering | Roads, bridges, drainage, inspections |
| Budget | Annual budget, funds, appropriations, allotments, obligations, balances |
| Accounting | Chart of accounts, journals, vouchers, ledgers |
| Treasury | Collections, ORs, cashiering, deposits |
| HRIS | Plantilla, 201 file, attendance, leave, training, evaluations |
| Payroll | Salary structure and run (calculation deferred) |
| BPLO | Application, inspection, assessment, issuance, registry |
| Assessor | Parcels, classification, ownership, tax-map refs |
| CDRA | Hazard, exposure, vulnerability, risk profiles |
| CLUP | Existing/proposed land use, constraints, growth areas |
| Zoning | Classifications, maps, permitted-use metadata |
| DRRMO | Incidents, evacuation centers, emergency assets |
| Agriculture | Farms, crops, irrigation, disaster exposure |
| Environment | Watersheds, protected areas, coastal, waterways |
| Citizen services | Requests, complaints, status (portal not in MVP) |

---

## 4. Out of scope (platform non-goals)

These are explicit non-goals for the product, not merely deferred features.

| Non-goal | Rationale |
|---|---|
| Rebuild QGIS, PostGIS, or a map engine | Use industry GIS stack |
| Custom cryptography / homemade digital signatures | Integrate certified signing later |
| Hard-coded LGU identity or approval chains | Breaks reuse |
| Full GAM / COA / eNGAS replacement in architecture phase | Design for configuration; do not encode all rules yet |
| Full real-property tax assessment engine | Assessor stores parcels and links to GIS first |
| Full payroll computation in early phases | Separate subdomain; calculate later |
| PhilGEPS, PSA, BIR, GSIS as required runtime dependencies | Optional integrations later |
| Citizen portal in MVP | Admin users first |
| AI auto-decisions | Assist and warn only |
| Kubernetes or Kafka for MVP | Premature operations complexity |
| Public exposure of PostgreSQL or GeoServer admin | Security boundary |
| Proprietary cloud as a core runtime | Must run on LGU hardware |

---

## 5. Philippine policy alignment (design awareness, not certified compliance)

The architecture is **aware** of these instruments. It does not claim to be a certified implementation of them.

| Instrument | Design implication |
|---|---|
| RA 7160 Local Government Code | Offices, powers, and LGU types are configurable |
| RA 10173 Data Privacy Act | Sensitivity labels, minimization, access logs, privacy-aware export |
| RA 9470 National Archives Act | Retention, disposition, registry |
| RA 11032 Ease of Doing Business | Measurable turnaround; later citizen tracking |
| RA 9184 / successor procurement law | Workflow + documentary trail; not a legal engine on day one |
| GAM for LGUs / COA rules | Configurable funds, accounts, document types |
| DHSUD CLUP / ZO guidelines | Land-use and zoning as data, with overlay warnings |
| DILG / OCD CDRA guidance | Configurable hazards and risk profiles |
| DICT digital government guidance | API-first, audit, local hosting option |

Legal, accounting, and planning **rules engines** are phase-specific. The core stores evidence, workflow, and configuration.

---

## 6. Recommended product boundaries

These boundaries keep the platform coherent and sellable.

### 6.1 Must remain in the core product

- Identity, RBAC, organization, audit
- Workflow engine
- Document / records management
- Master data and numbering
- Notification and search
- GIS platform services (layer registry, publish pipeline, viewer shell)
- Deployment, backup, monitoring

### 6.2 First-class modules (same product, separately enabled)

- Procurement, inventory, assets
- Budget, accounting, treasury
- HR, payroll
- BPLO, assessor
- Engineering, projects
- CDRA, CLUP, zoning, DRRMO
- Agriculture, environment
- Citizen portal
- Executive analytics beyond the basic dashboard

### 6.3 Remain outside the product

- Desktop GIS authoring (QGIS is the tool; we integrate)
- National systems of record (integrate by reference)
- Certified e-signature provider internals
- SMS gateway internals
- General office productivity (email, word processor)

### 6.4 Integration boundary

The platform **owns** LGU operational records. It **references** national systems (PhilGEPS number, OR series issued by treasury policy, tax declaration numbers) rather than attempting to become those systems.

---

## 7. Actors and offices (logical, not hard-coded)

Typical offices that will be seeded as **reference data**, not code:

- Office of the Mayor / Administrator
- Records / Admin / General Services
- Human Resource Management
- Accounting, Budget, Treasury
- BAC / Procurement
- BPLO
- Assessor
- Engineering / CEO
- MPDO / CPDO
- DRRMO
- Agriculture, Environment / MENRO
- Sanggunian Secretariat
- MIS / ICT

Workflow participants are bound to **positions and offices**, so an LGU that merges or splits offices does not require a code change.

---

## 8. Scope rules for implementation

1. Do not implement a later-phase module before the shared core it depends on is stable.
2. Do not encode a single LGU’s routing chart in application code.
3. Do not duplicate employees, barangays, or suppliers per module.
4. Do not expose citizen PII on public map layers.
5. Do not treat “the consultant’s geodatabase” as the system of record; ingest it into PostGIS under governance.

Related: [13-mvp-scope.md](13-mvp-scope.md), [14-development-roadmap.md](14-development-roadmap.md).
