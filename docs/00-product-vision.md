# 00 — Product Vision

## 1. Executive system concept

The **Integrated LGU Digital Government Platform** is a reusable, modular software product for Philippine municipal and city governments. It is not a one-off custom system for a single LGU.

It unifies seven capabilities that LGUs today usually buy, build, or operate as disconnected tools:

1. **LGU administration** — organization, users, roles, master data
2. **Paperless operations** — incoming/outgoing documents, routing, approvals, records
3. **ERP** — finance, procurement, inventory, assets, HR, payroll (phased)
4. **GIS** — authoritative spatial data, map viewer, professional editing via QGIS
5. **CDRA / CLUP / zoning** — climate-disaster risk, land-use planning, zoning overlays
6. **Citizen services** — later-phase portal for requests, permits, and status
7. **Executive decision support** — dashboards that combine operational and spatial indicators

The product promise is:

> One configurable platform that an LGU can adopt gradually — starting with paperless operations and GIS — without rewriting software when the next office, workflow, or municipality is onboarded.

The platform is a **modular monolith**: one deployable system, many domain modules, shared core services, and a path to extract services later. Modules are licensed, enabled, and configured per LGU. They are not a single tightly coupled application.

---

## 2. Who the product is for

| Audience | Primary need |
|---|---|
| Mayor / City or Municipal Administrator | Situation awareness, turnaround, collections, projects, risk |
| Records / Admin / Secretary to the Sanggunian | Document registry, routing, archival |
| Department heads | Approvals, office workload, assigned documents |
| Budget / Accounting / Treasury | Funds, obligations, collections (later phases) |
| BAC / Procurement / GSO | Purchase requests through award and inventory |
| HRMO | Plantilla, attendance, leave, service records |
| BPLO | Business permits and registry |
| Assessor | Parcels, ownership, tax-map linkage |
| Engineering / Project Monitoring | Infrastructure registry and progress |
| MPDO / CPDO | CLUP, zoning, development constraints |
| DRRMO / MDRRMO | Hazards, incidents, evacuation assets |
| GIS unit / Planning staff | Layer governance, QGIS editing, published maps |
| Citizens (later) | Applications, complaints, status checking |
| System implementers / integrators | Repeatable deployment across LGUs |

---

## 3. Product principles

1. **Configurable, not hard-coded.** LGU name, logo, barangays, departments, workflows, fund types, document types, hazard classes, zoning categories, and land-use classes are data — never constants in code.
2. **Modular adoption.** An LGU may go live with Core + Paperless + GIS only. Later modules attach to shared identity, workflow, documents, audit, and master data.
3. **Local-first.** Core operations run on the LGU LAN. Internet, Cloudflare, and VPN are optional. Intermittent connectivity must not stop document routing or map viewing of local layers.
4. **Shared master data.** Citizens, businesses, properties, employees, barangays, projects, and funds are registered once and referenced everywhere.
5. **Workflow is a gate, not a feature.** Every later ERP action (PR approval, permit issuance, journal posting) uses the same configurable engine.
6. **GIS is infrastructure, not a map widget.** PostGIS is the spatial system of record. GeoServer publishes. QGIS edits. The web app consumes. The platform does not invent a GIS engine.
7. **Decision support, not decision automation.** Overlays may warn of hazard or zoning conflict. The system never issues a legal planning, procurement, or permitting decision on its own.
8. **Government-grade governance.** Audit, retention, sensitivity classification, least privilege, and privacy-by-design are first-class.

---

## 4. What “reusable across LGUs” means

A new LGU deployment is a **configuration and data** exercise:

- Create the LGU tenant profile (name, seal, address, legislative classification)
- Load barangays, departments, offices, positions
- Load or draw administrative boundaries
- Configure document types and numbering series
- Configure workflows (which may differ from the previous LGU)
- Enable licensed modules
- Load or connect GIS layers
- Set retention schedules and sensitivity labels

The same codebase, container images, and schema serve a 4th-class municipality and a highly urbanized city. Differences live in reference data, workflow definitions, and module enablement.

**Initial tenancy model:** one production deployment equals one LGU. Schema and APIs still carry an explicit `lgu_id` so a future hosted multi-LGU offering does not require a rewrite.

---

## 5. Evolution path

```text
Paperless LGU
      ↓
Integrated ERP
      ↓
GIS-enabled Operations
      ↓
Digital Citizen Services
      ↓
Executive Decision Support
```

This is a product evolution, not a rewrite sequence. Each stage adds modules on the same core.

| Stage | What becomes true |
|---|---|
| Paperless LGU | Incoming/outgoing documents are registered, routed, approved, searchable, and auditable |
| Integrated ERP | Procurement, inventory, assets, finance, and HR share the same people, offices, and documents |
| GIS-enabled operations | Parcels, businesses, projects, hazards, and facilities are spatial objects, not just addresses |
| Digital citizen services | External users submit and track requests without entering the admin system |
| Executive decision support | Leaders see operational + spatial indicators with conflict warnings, not isolated reports |

---

## 6. Product boundaries (what this is / is not)

### This product is

- A modular LGU operations platform with paperless, ERP, GIS, planning, and later citizen services
- A configuration-driven system suitable for repeated municipal/city deployments
- A spatial operations platform that uses PostGIS, GeoServer, and QGIS
- An on-premises-first system that can later sit behind Cloudflare or migrate toward Kubernetes

### This product is not

- A clone of a national system (e.g., a PhilGEPS replacement, eNGAS replacement, or eSRE replacement)
- A full legal-compliance engine for GAM, RA 9184/12009, or tax assessment on day one
- A custom GIS rendering or analysis engine
- A custom cryptographic signing protocol
- A citizen social network or 311 product in MVP
- An AI that automatically approves budgets, permits, or land-use decisions

See [01-business-scope.md](01-business-scope.md) for in-scope / out-of-scope detail and [13-mvp-scope.md](13-mvp-scope.md) for the first shippable slice.

---

## 7. Success definition

The architecture is successful if, after MVP:

1. An LGU can register, route, approve, and archive documents without paper logs.
2. A second LGU can be onboarded by configuration, not a fork.
3. Barangays, facilities, and hazard layers are visible on a web map served from local PostGIS/GeoServer.
4. Every material action is in an immutable audit trail.
5. A later module (procurement, CDRA, BPLO) can attach to identity, workflow, documents, and GIS without redesigning the core.
6. The system remains usable on the LAN when the public Internet is down.
