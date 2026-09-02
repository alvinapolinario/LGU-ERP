# 06 — Document Management Architecture

## 1. Role in the product

Paperless operation is a **core product feature**, not a side module. For many LGUs it will be the first visible system. If document registration, routing, and tracking are weak, the rest of the ERP will not be trusted.

Documents are also the **attachment and evidence layer** for every later module (PR, contracts, permits, inspection reports).

---

## 2. Scope split: DMS vs records vs workflow

| Concern | Owner |
|---|---|
| File bytes, versions, checksums | Document files (MinIO) |
| Registry metadata, numbers, parties | Document module |
| Routing, approval, deadlines | Workflow engine |
| Classification, retention, disposition | Records function (same module in MVP) |
| Immutable “who did what” | Audit + routing history |

MVP keeps **DMS + records** in one domain (`documents`) to avoid premature split. A future National Archives–oriented records service can be extracted if needed.

---

## 3. Document types (configurable)

The following are **seed types**, not an exhaustive hardcoded enum:

- Incoming correspondence
- Outgoing correspondence
- Internal memorandum
- Office order
- Executive order
- Resolution / ordinance (registry; Sanggunian process may extend later)
- Request
- Contract
- Report
- Scanned legacy record
- Attachment-only supporting file (linked to a parent)

Each type has:

- code, label, active flag
- default sensitivity
- numbering series
- default workflow definition
- allowed file types / max size
- retention schedule reference
- whether it can be created without an incoming physical paper

LGUs add types without code changes.

---

## 4. Document aggregate

Logical fields:

| Field | Notes |
|---|---|
| `id` | UUID |
| `document_no` | Business identifier from numbering service |
| `type_id` | Configurable |
| `subject` | Required |
| `summary` | Optional |
| `direction` | incoming / outgoing / internal |
| `sender_party_id` / free-text sender | Parties preferred |
| `recipient_party_id` / office | — |
| `origin_office_id` | — |
| `current_office_id` | Denormalized for inbox queries |
| `sensitivity` | public / internal / restricted / confidential |
| `status` | See lifecycle |
| `received_at` / `document_date` | Distinguish receipt vs letter date |
| `due_at` | Optional action due |
| `barcode` / `qr` payload | Reserved; generate later |
| `physical_location` | Shelf/box ref for hybrid archives |
| `retention_schedule_id` | — |
| `hold` | Legal / audit hold blocks disposition |
| `version` | Current version number |
| `search_vector` | Generated |

Attachments are child objects, not the document itself. A document may have zero files (registry-only) during encoding, then files added after scan.

---

## 5. Lifecycle

Default states (overridable by the bound workflow):

```text
Draft
  → Submitted
  → Received
  → Assigned
  → Under Review
  → For Approval
  → Approved
  → Released
  → Archived
```

Also: `Returned`, `Rejected`, `Withdrawn`.

The document status is **projected** from workflow events plus explicit records actions (archive, disposition). Clerks should see one status in the UI.

---

## 6. Suggested operational flow

```text
Incoming paper / email / walk-in
        ↓
Records Office receiving
        ↓
Scan / upload
        ↓
Registration (number, subject, parties, type)
        ↓
Start workflow (type default or override)
        ↓
Office review / comments / attachments
        ↓
Approval / signature (wet-ink now; e-sign later)
        ↓
Release / reply / action
        ↓
Archive + retention clock
```

Outgoing and internal memos start at Draft in the originating office, then enter Records if the LGU’s policy requires central numbering.

---

## 7. File storage

- Bytes in **MinIO**, never on the API container filesystem except temp working files.
- Object key pattern: `lgu/{lgu_id}/documents/{document_id}/v{n}/{file_id}`
- Store: original filename, content-type, size, SHA-256, virus-scan status (hook), uploaded_by, uploaded_at.
- Versions: a new version is additive. “Replace” creates v+1; v-1 remains for audit.
- Download is authorized through the API (presigned GET with short TTL) so Geo/MinIO are not public.
- Block dangerous executables. Allow PDF, Office, images, and configured types.

Scan pipeline (worker, later): MIME sniff, thumbnail, PDF/A conversion optional, OCR optional (Phase 7+).

---

## 8. Routing history vs audit

**Routing history** (document UX): human-readable trail — received by, routed to, returned, comments.

**Audit log** (security): technical event — user, action, entity, before/after summary, IP.

Both are written. Routing history is not editable. Corrections are new entries.

---

## 9. Records management

MVP metadata:

- classification scheme (configurable tree)
- retention schedule (code, years, trigger: `from_archive` / `from_created` / `from_released`)
- archival status
- disposition action (`retain`, `transfer`, `destroy`) — **never auto-destroy** without a dual-control job and hold check
- physical archive reference

Search and index: metadata + PostgreSQL FTS on subject/summary; file full-text only after OCR exists.

---

## 10. Search

Central search starts here because documents are the densest corpus.

Queries:

- document number, subject, sender, office, type, date range, status, barangay tag
- permission-aware: unreadable hits do not appear (no existence leak for confidential)

Later entities (employees, assets, parcels) join the same search API with a `kind` discriminator. See [09-api-architecture.md](09-api-architecture.md).

---

## 11. Digital signature extension points

Do not invent a signing protocol.

Design now:

- `signature_request` on a document version
- provider adapter interface (`prep`, `sign`, `verify`, `revoke`)
- signature log (who, when, certificate subject, result)
- visual stamp as a **representation**, not the legal proof

MVP: wet-ink / scanned signed copy as a new version is valid. Provider integration is Phase 7.

---

## 12. Privacy and confidentiality

- Sensitivity inherited by files and tasks.
- Confidential documents: extra permission; masked lists; no public GIS link.
- Exports and print include classification marking.
- Citizen PII in attachments is still the LGU’s processing; access is staff-RBAC only in MVP.

---

## 13. Relationship to other modules

Any module may:

- `attach` a document or file set to its aggregate (`documents.link`)
- `start` a workflow whose subject is the module record, with supporting documents

The document module remains the file authority. Modules should not open their own MinIO prefixes for “the same class of office PDF” without cause.

---

## 14. MVP vs later

| MVP | Later |
|---|---|
| Registry, upload, version, route, search, archive metadata | OCR, barcode/QR, PDF/A, certified e-sign |
| Manual scan | Capture station / TWAIN integration |
| Single LGU series | Cross-office sub-series complexity as needed |
| In-app + optional email notify | SMS, public tracking stubs |
