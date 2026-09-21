# 12 — Audit trail design

Audit evidence answers who performed an action, on what, when, under which authority, with what outcome and provenance. It is separate from operational logs and from the user-facing legislative timeline, although both can reference the same immutable domain event. Requirements: LTAS-FR-AUDIT-001/002, LTAS-NFR-AUDIT-001 and LTAS-NFR-INTEGRITY-001.

## Event content

Required fields: event ID/sequence; municipality; actor user/service ID and stable display snapshot; initiating actor for worker actions; action; entity type/ID; outcome; occurrence and recording timestamps; request/job correlation ID; safe previous/new field diff or version references; reason/comment where required; rule/profile and entity revisions; evidence document-version IDs. Capture IP/device context only when justified under the privacy policy. Never store passwords, tokens, full private attachments or secrets in the diff.

Audit creation/edit/soft deletion/restoration, filing/number allocation, workflow transition, upload/validation/supersession, download of sensitive evidence, certification, vote entry/closure/correction, approvals, publication/withdrawal, export, account disablement, role/grant/configuration changes, backup/restore operations and privileged administration. Read-event volume/retention is configurable by sensitivity; consequential writes always require audit.

## Atomicity and failure

Business mutations and required audit rows share the same MySQL transaction. Required audit insertion failure rolls back the business action. Store outbox intent in that transaction for external evidence export; do not make a remote log server synchronous dependency for every command. Alert on export lag and stop privileged mutations if the approved evidence-lag limit is exceeded (limit TBD). A failed/denied attempt may be captured in separate security logs without exposing payload details.

Client-supplied actor or timestamp cannot replace server attribution. Authorized historical entry may specify occurrence date and source, while server recording time stays immutable. Administrative imports and workers record their own identity plus responsible initiating actor; they do not pretend the past official logged in today.

## Tamper resistance and limits

The application database identity has insert/select privileges on audit history and no update/delete privilege. Migration/maintenance identities are separate, restricted and monitored. Hash-chain or batch-Merkle manifests can make alteration detectable; sequence allocation and previous-hash linking must be serialized or use independently verifiable batches to avoid concurrency breaks. A database-only hash chain does not defeat an administrator who can rewrite the entire chain.

Export signed/digested manifests and audit batches to a separately administered off-host destination. Record sequence ranges, counts, digest algorithm, export time and verified destination receipt. Use protected storage/retention when supported and approved; keep verification keys and copies outside the application host. Reconcile gaps, duplicate sequences and clock drift. Alert on verification failure. Describe this as tamper-evident and restricted, not tamper-proof.

## Correction, retention and review

Audit events cannot be edited through APIs. Corrections reference the original event and new record, authorizing actor, reason and review. Sensitive information accidentally logged requires a restricted, legally reviewed remediation process preserving incident/disposition evidence; never casually erase a batch. Records retention and legal holds cover logs, manifests and restored backups, with schedules TBD.

Auditor views apply entity/field scope, filter by actor/action/time/entity and support restricted exports with a manifest and as-of timestamp. Export requests and downloads are themselves audited. A routine review checks privileged grants, rule changes, unusual downloads, certification corrections, public withdrawals, backup failures and independent evidence lag. Assigned reviewer and frequency are D-09.

Verification: tamper with a copy of one event and confirm digest failure; remove a sequence and detect the gap; revoke a grant and verify both action and denial evidence; fail audit insertion and prove no filing/vote certification committed. See [testing](18-TESTING-STRATEGY.md).
