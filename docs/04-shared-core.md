# 04 — Shared-Core Architecture

## 1. Purpose

The shared core is the only layer every module may depend on. If a later ERP or GIS feature needs “who is this person,” “which office owns this,” “is this allowed,” or “what is the LGU called,” it uses the core — it does not invent its own copy.

Core responsibilities:

- LGU tenancy and branding configuration
- Authentication and sessions
- RBAC and attribute-based constraints
- Organization structure
- Lightweight employee/actor directory (until HRIS owns the 201 file)
- Shared party master (persons, organizations)
- Module enablement
- Numbering series coordination
- Application settings
- Cross-cutting types (sensitivity, status patterns)

Workflow, documents, GIS, notifications, and audit are **platform domains**, not part of the smallest core kernel — but they are MVP-mandatory and sit beside the core. This document covers the kernel those platform domains consume.

---

## 2. Core aggregates

### 2.1 LGU profile

One row per deployment (plus `lgu_id` for future multi-tenant).

| Concern | Stored as data |
|---|---|
| Legal name, short name | text |
| LGU type | municipality / city / HUC / component / province (extensible) |
| Classification | income class, legislative district — optional |
| Seal / logo | MinIO object keys, not files in git |
| Address, contact | structured |
| Timezone, locale, currency | `Asia/Manila`, `en-PH`, PHP |
| Map default extent | bounding box |
| Public vs internal hostnames | settings |

Nothing in application code may contain the municipality name or seal.

### 2.2 Organization

```text
LGU
 └── Department
      └── Office
           └── Section (optional)
                └── Position
                     └── Assignment (employee + dates)
```

Rules:

- Trees are data. Offices can be added, renamed, deactivated, and reparented.
- Deactivation is soft. Historical documents keep the office id.
- A position may be vacant. Workflow assignment can target a **position** so routing survives staff turnover.
- Geographic scope (e.g. barangay captain vs municipal office) is an attribute, not a separate product.

### 2.3 Identity

| Concept | Notes |
|---|---|
| User | Login identity; usually 1:1 with an employee, but contractors/MIS admins allowed |
| Credential | Password hash (Argon2id); never reversible |
| Session | Server-side session; optional refresh tokens for SPA |
| MFA factor | Optional TOTP; designed now, enforceable by policy later |
| Password reset | Time-limited token; works on LAN via admin-assisted reset if no mail |

Citizen portal users (Phase 7) are a **separate user pool** with a different assurance level. They must not receive staff RBAC roles.

### 2.4 RBAC model

Permissions are a tuple, not a single role name.

```text
Permission = module + resource_type + action
Role       = named set of permissions + optional constraints
Grant      = principal (user or position) + role + scope
```

**Actions (minimum):** `view`, `create`, `update`, `delete`, `assign`, `approve`, `reject`, `release`, `export`, `admin`, `publish` (GIS).

**Constraints that a grant may carry:**

| Constraint | Example |
|---|---|
| Department / office | Budget staff see only Budget office documents |
| Module | GIS technician without procurement |
| Record type | Incoming documents vs executive orders |
| Action | Can encode but cannot approve |
| Geographic area | Barangay-scoped viewing |
| Sensitivity | Cannot open `confidential` |
| Own-only | See only records where user is originator or current assignee |

Roles are configurable. Seed a starter catalog (Records Clerk, Department Head, Administrator, GIS Officer, Mayor/Executive, Auditor-ReadOnly). LGUs may clone and rename.

**Auditor-ReadOnly** can read audit and selected registers and cannot mutate operational data.

### 2.5 Party master (shared people and organizations)

Avoid per-module “name/address” tables.

| Party type | Used by |
|---|---|
| Person | Employees (link), citizens, signatories, owners |
| Organization | Suppliers, businesses, contractors, NGAs, NGOs |

A party has identifiers (optional TIN, any government id — stored as restricted), contacts, and addresses. Modules add **roles** on the party (`supplier_profile`, `business_profile`) rather than new name records.

PII fields carry sensitivity and are export-controlled. See [11-data-governance.md](11-data-governance.md).

### 2.6 Lightweight employee (MVP)

Until HRIS exists, Core stores:

- party_id
- employee_number
- office_id, position_id
- employment_status
- contact for notifications
- active flag

HRIS later extends this with plantilla, 201 documents, and service history. Core retains the projection needed for routing.

### 2.7 Module enablement and settings

- `core.module` — catalog of known modules
- `core.module_enablement` — on/off per LGU
- `core.setting` — namespaced key/value (branding, password policy, session TTL, map defaults)

Settings are typed (string, number, bool, json) and audited on change.

### 2.8 Numbering series

A shared service issues business identifiers:

```text
series_code + period + sequence  →  display number
```

Examples: `IN-2026-000123`, `PR-2026-000045`. Modules request a number from Core; they do not maintain ad-hoc counters. Gaps, reset policy, and prefixes are configurable per series.

---

## 3. Authentication flows

1. **Login** — username/email + password; optional MFA; session cookie (`Secure`, `HttpOnly`, `SameSite=Lax` or `Strict` on LAN HTTPS).
2. **Logout** — revoke session.
3. **Password reset** — email when available; otherwise privileged admin reset with forced change on next login.
4. **Session idle timeout** — configurable; default aligned to office use (e.g. 30–60 minutes) with warning.
5. **Lockout** — after N failures; audit the event.

API requests resolve `CurrentUser` via session (cookie) or later OIDC. Services receive a principal DTO, never raw tokens.

---

## 4. Authorization enforcement points

| Layer | Check |
|---|---|
| Route | Module enabled + authenticated |
| Use case | Permission + constraints |
| Query | Mandatory row filters (office, sensitivity, geography) |
| File download | Same check as the owning record |
| Report / export | Permission `export` + field redaction |
| GeoServer | Either internal-only, or a filtered view / auth plugin later |

Never rely on hiding a button in the UI as the only control.

---

## 5. Shared kernel types

Keep these few and stable:

- `LguId`, `UserId`, `OfficeId`, `PartyId` (UUID newtypes)
- `Sensitivity` — `public | internal | restricted | confidential`
- `RecordStatus` pattern — active/inactive + effective dates
- `Money` — amount + currency
- `DateRange`
- `DomainError` taxonomy (not found, forbidden, conflict, validation)

---

## 6. What Core must not become

Core is not:

- The document table
- The workflow engine
- The GIS layer catalog
- A dumping ground for every lookup (those go to `reference`)

If a table is only meaningful to one module, it does not belong in Core.

---

## 7. Seed data (configuration, not code)

Each LGU deployment loads:

1. LGU profile
2. Departments and offices
3. Positions
4. Starter roles and permission matrix
5. First admin user
6. Barangay list (names; geometries may follow via GIS ingest)
7. Enabled modules
8. Numbering series for documents

A second LGU is a new seed + configuration pack, not a branch of the repository.
