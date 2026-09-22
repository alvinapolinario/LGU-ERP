# 30 — Phase 2 measures (constrained slice)

**Engineering authorized 2026-09-21. Not municipal IRP. Not official numbering. Not production. D-03 §6 unsigned. D-16 unchanged.**

This handoff implements a constrained Phase 2 slice from [19](19-DEVELOPMENT-ROADMAP.md): draft case files, authors, versioned synopsis text, allowlisted draft transitions, in-app tasks/notices, and quarantined uploads. Numbered documents 00–27 remain the design baseline. D-03 signatures and D-05–D-16 workshops remain deferred by product request.

## Requirement slice

| Requirement | Phase 2 behavior | Evidence |
|---|---|---|
| LTAS-FR-MEASURE-001 | Register ORDINANCE/RESOLUTION drafts with title, subject, term, authors. Official `file` is **422 `SERIES_NOT_CONFIGURED`** until D-04. Concurrent allocation is tested only against a fictional test series | `apps/api/src/measures.service.ts`, `apps/api/src/measures.test.ts`, `apps/api/src/mysql.measure.test.ts` |
| LTAS-FR-MEASURE-002 | Case file + chronological status history; late-recorded fields are occurrence vs recording on audit | `GET /measures/:id`, `GET /measures/:id/timeline` |
| LTAS-FR-WORKFLOW-001 | Version-pinned engineering profile `P2-DRAFT-INTERIM` only: DRAFT↔SUBMITTED, either→WITHDRAWN. Not IRP. Stale revision writes nothing | `apps/api/src/domain/workflow.ts` |
| LTAS-FR-VERSION-001 | New synopsis version on each version command; frozen rows are not updated | `POST /measures/:id/versions` |
| LTAS-FR-DOCUMENT-001/002 | Upload to MinIO quarantine; SHA-256; proposed 25 MiB cap; scanner adapter returns UNKNOWN so state stays QUARANTINED; download only READY (unreachable until D-13) | `apps/api/src/documents.service.ts`, `apps/api/src/domain/scanner.ts` |
| LTAS-FR-TASK-001 / NOTIFY-001 | In-app task on submit; completing it does not file. No email (D-05) | `apps/api/src/measures.service.ts` |
| LTAS-FR-DASHBOARD-001 | Proposed Measures = live DRAFT+SUBMITTED count. Other pipeline KPIs stay 0 / later phase | `apps/web/src/App.tsx` |
| LTAS-FR-ACCESS-002 | **LS** live (Q8). SYS has no measure rights. CS measure list is referral-scoped in [31](31-PHASE-3-REFERRALS.md). `measure.file` / `document.certify` stay closed without PO confirmation (Q7) | `packages/contracts`, `apps/api/src/domain/policy.test.ts` |

## Implemented HTTP surface (added)

- `GET|POST /measures`, `GET|PATCH /measures/:id`
- `POST /measures/:id/submit`, `/return`, `/withdraw`, `/file`, `/versions`
- `GET /measures/:id/timeline`, `GET /measures/stats`
- `POST /documents/intents`, `PUT /documents/intents/:id/content`, `POST /documents/intents/:id/finalize`
- `GET /documents/:id`, `GET /documents/:id/download` (READY only)
- `GET /tasks`, `POST /tasks/:id/complete`
- `GET /notifications`

## Explicit non-goals

No readings, sessions, voting, mayoral action, public portal, official number series, extra measure subtypes, malware scanner, email, or MFA. Referrals are the [Phase 3 slice](31-PHASE-3-REFERRALS.md). No fictional ordinances in seed. Completing a task is not a legal filing. A software grant is not authority to sign.

## Local run additions

Optional MinIO: `docker compose -f infrastructure/docker/compose.dev.yml --profile object-storage up -d`. Bind loopback only. Set `MINIO_ENDPOINT=http://127.0.0.1:9000` with keys matching `MINIO_ROOT_*`. Uploads without MinIO return 503. Restore dumps without an object inventory are incomplete if any upload intent exists.

Profile `P2-DRAFT-INTERIM` is an engineering allowlist, not adopted Internal Rules of Procedure (D-02).
