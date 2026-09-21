# 09 — Logical REST API design

This is a contract plan, not implemented endpoints. Base internal route is `/api/v1`; public routes are `/api/public/v1`. Keycloak owns authentication protocol endpoints; `/api/v1/auth` is the LTAS session adapter. No endpoint accepts arbitrary table names, direct status assignment, unreviewed SQL, or authority from a client-provided role field.

## Groups and representative operations

| Group | Responsibility and representative resource/action | Authorization and evidence |
|---|---|---|
| `/auth` | Login, callback, current session, CSRF bootstrap, logout | Valid OIDC state/nonce/PKCE and local account; no password storage |
| `/measures` | List/create/detail/update drafts; `/{id}/submit`, `/file`, `/versions`, `/readings`, `/amendments`, `/timeline`, `/relationships` | measure permissions, field scope, expected revision; commands bind exact version |
| `/workflows` | Inspect allowed transitions; `/{instanceId}/transitions`; draft/review/approve profile versions | Approved catalog, rule authority and evidence; no force-state endpoint |
| `/deadlines` | List, inspect calculation, propose corrected trigger, confirm revision | Assigned record access; preserve previous calculation |
| `/committees` | Membership, referrals, meetings, reports and report submission | Assigned committee + permission, historical term checks |
| `/hearings` | Schedule/notices, attendees, submissions, findings and closure | Hearing scope; attendee private fields separately authorized |
| `/sessions` | Session schedule, agenda revisions, attendance, quorum snapshots, motions, deliberations and minutes | session/attendance/quorum permissions and presiding authority |
| `/votes` | Open/record/close rounds, own cast when enabled, certify, request corrections | Eligibility, quorum, mode, expected round revision; one seat record per round |
| `/documents` | Initiate upload, finalize/validate, metadata, versions, certification, authorized download | Parent permission + classification; uploads never directly ready |
| `/mayoral-actions` | Dispatch, receipt, action, objections and override evidence | mayor.action or delegated record permission; actual signatory identified |
| `/provincial-reviews` | Applicability, transmission, acknowledgment, correspondence and completion | provincial_review.manage and underlying measure scope |
| `/publications` | Posting/publication obligations and fulfillment proofs | publication permissions; obligation-specific evidence |
| `/effectivity` | Candidate assessment and authorized confirmations | effectivity.confirm, required authority and evidence |
| `/library` | Search/filter authorized archives, retrieve accession and versions | Scope applied before matching/counts/snippets |
| `/codification` | Relationships and reviewed legal-status assessments | codification/relationship authority; no generated legal text mutation |
| `/archives` | Accession, custody, completeness and hold management | archive.manage plus records authority |
| `/imports` | Stage, preview, validate, approve and reconcile historical batches | import.manage; idempotent source keys and provenance |
| `/implementation-reviews` | Responsible office, follow-up findings and evidence | Assigned review permission; no status side effects |
| `/dashboard` | Scoped aggregate summaries and quick-action eligibility | Query visibility matches source modules |
| `/reports` | Definitions, filtered reports, export jobs, expiring results | report.generate/export grant rechecked at execution and download |
| `/notifications`, `/tasks` | Own notices/read state; scoped assignment, escalation and task completion | Own/assigned scope, no notice-driven legal transitions |
| `/audit` | Filtered evidence view/export and integrity verification result | audit.view/export; no update/delete routes |
| `/admin` | Users, grants, municipality, terms, categories/settings | Privileged grants with independent approval and audit |
| `/public-releases` | Prepare, approve, publish, supersede, withdraw | Separate release permissions; approved snapshot only |
| `/api/public/v1` | Released measures, documents, sessions, committees, members, calendar and hearings | Anonymous, rate limited, allowlisted public repository |

GET reads, POST creates records or named commands, PATCH changes permitted mutable fields, and DELETE is limited to explicitly disposable drafts. Never use DELETE for filed measures, vote rounds, certified documents or audit events. Resource-specific action bodies must not accept uncontrolled object assignment.

## Contract conventions

- OpenAPI specifications will be generated/reviewed during implementation; major incompatible changes use a new path version with migration/deprecation notice. IDs are opaque strings; clients must not depend on numeric sequencing.
- Lists use `items`, `pageInfo` and optional authorized `total`. Proposed default limit 25, maximum 100. Cursor pagination is preferred for timelines and large changing lists, with a stable `(occurredAt,id)` or `(createdAt,id)` order. Small admin tables may use documented page/limit pagination. A cursor is bound to filters and access scope.
- Filtering uses documented keys such as type, stage, term, committee, author, category and date interval. Unknown filters/sort fields are rejected. Sort uses allowlisted fields plus stable ID tie-breaker. Date inclusivity and timezone are explicit.
- Search is a bounded `q` parameter plus structured exact-number filters. No raw search engine syntax unless intentionally exposed and validated. Do not leak total counts from inaccessible records.
- Instants use ISO 8601 with UTC offset; legal date-only fields use YYYY-MM-DD. Null means unknown/not recorded, not zero or an inferred date. Responses label advisory versus confirmed values.
- Single resources use `data` and a revision/ETag. Mutating commands require `If-Match` or an explicit expected revision; stale revisions return 409 or 412 according to documented operation semantics.
- Validate DTO shape/limits on the server, then domain invariants and reference scope. Shared Zod schemas improve UI feedback but do not replace backend validation. Reject unauthorized writable fields.

## Errors and retries

Use a consistent problem response containing `type`, `title`, HTTP `status`, safe `detail`, stable application `code`, `instance`, `correlationId`, and optional field-level `errors`. Do not expose SQL, tokens, filesystem paths or private evidence. 400 = malformed input; 401 = no valid session; 403 = denied visible action; 404 = missing or concealed inaccessible resource; 409 = state/concurrency conflict; 412 = stale If-Match; 413 = oversized file; 415 = unsupported media; 422 = domain validation; 429 = rate limit; 503 = required dependency unavailable. Client messages guide recovery without concealing failure.

Filing, workflow transitions, upload finalization, vote close/certify and public release commands accept idempotency keys. Scope a key to actor + action, store request hash and result reference atomically, replay the same successful result for an identical request, and reject reuse with different content. Proposed replay window: 24 hours, subject to workload review; domain uniqueness and version checks continue after expiry. An in-progress retry returns a defined pending/conflict response. Never blindly retry a new key after an ambiguous official action: query by the original operation ID first.

Export/import/large extraction requests return 202 with a job resource and explicit state/error. Polling is bounded and supports backoff. Audit records correlate user intent, job identity and eventual outcome; a worker records both initiating actor and service actor. Downloads recheck current permissions even for pre-generated artifacts.

## Required contract examples before implementation

For each critical command, approve a success example, denied scope, stale revision, missing evidence, duplicate retry, dependency failure and correction scenario. Define vote membership snapshot and effectivity confirmation schemas first. These examples become contract tests described in [18](18-TESTING-STRATEGY.md).
