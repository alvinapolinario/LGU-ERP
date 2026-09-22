# 18 — Testing strategy

This document plans tests across all phases. Phase 1 currently has Vitest unit, contract and UI-boundary suites under `apps/` and `packages/`, a live MySQL 8.4 access-gate suite in `apps/api/src/mysql.access.test.ts` (`npm run test:mysql`), and a synthetic isolated restore rehearsal (`LTAS_RESTORE_CONFIRM=ltas-restore-rehearsal npm run recovery -- rehearse`, evidence in [backup REHEARSAL-2026-09-21](../infrastructure/backup/REHEARSAL-2026-09-21.md)). That rehearsal is not a substitute for an approved RPO/RTO (D-06), off-host copies, or UAT. Requirements and acceptance criteria are in [02](02-FUNCTIONAL-REQUIREMENTS.md) and [03](03-NON-FUNCTIONAL-REQUIREMENTS.md), mapped in [27](27-TRACEABILITY-MATRIX.md). Prioritize legal-record integrity, workflow and access boundaries over arbitrary line-coverage percentages.

## Test levels and responsibilities

| Level | Planned coverage | Evidence / owner |
|---|---|---|
| Unit | Pure state predicates, eligibility/threshold formulas, date calculations, classification and metric definitions | Deterministic fixtures and boundary cases / developers |
| Integration | Real supported MySQL transactions/constraints, Prisma queries, MinIO staged lifecycle, Redis retries | Disposable isolated integration environment / developers. Phase 1 access/revocation/scope/concurrent-grant evidence: `apps/api/src/mysql.access.test.ts`. Phase 2 numbering/version/scan evidence: `apps/api/src/mysql.measure.test.ts`. Phase 3 referral/CS-scope evidence: `apps/api/src/mysql.referral.test.ts`. Phase 3 meeting/document-owner evidence: `apps/api/src/mysql.meeting.test.ts`. Phase 4 session/attendance/tally evidence: `apps/api/src/mysql.session.test.ts`. Constrained library/report evidence: `apps/api/src/mysql.library.test.ts`. Combined: `npm run test:mysql` |
| API contracts | DTO validation, errors, pagination, filters, revisions, idempotency and OpenAPI compatibility | Success and failure contracts / API reviewers |
| Authorization | Every operation against role/scope/classification/term/state matrix, including combined roles and denied fields | Negative-access matrix / security reviewer |
| Workflow | Every approved transition, rejected edge, evidence requirement, exception and profile migration | Model-based transition scenarios / secretariat + developers |
| Database | Unique numbers, one seat per round, overlapping memberships, cross-municipality FK checks, concurrency and migration | Parallel race/failure tests / database reviewer |
| Documents | MIME spoofing, oversized/decompression attacks, malware unknown/fail, object orphaning, hash mismatch, private download | Security fixtures and reconciliation results / developers + records officer |
| Audit | Atomic write failure, restricted privileges, corrections, sequence gaps and independent manifest verification | Fault injection and tamper detection / auditor |
| UI | Forms, loading/empty/error states, conflict recovery, keyboard/focus and screen-reader labels | Automated component/journey checks + manual review / frontend team |
| End-to-end | Filing through committee/session/vote/post-approval and public release; correction and withdrawal branches | Synthetic complete case files / QA + staff |
| Security | Threat-model abuse cases, session/CSRF/CORS, upload isolation, privilege escalation and dependency review | Assessed findings and retest / security lead |
| Performance | Agreed volume/concurrency, bounded search, queue lag and large exports | Repeatable p95/error/resource measurements / operations |
| Backup/restore | Total host loss, compatible object/DB recovery, Keycloak login and outbox replay | Timed isolated rehearsal and data reconciliation / IT + records officer |
| UAT | Actual roles, local procedures, forms, sample measures and signatory authority | Signed acceptance record / product and legal/records stakeholders |

## Critical scenario catalog

1. File the same draft concurrently with two requests: exactly one official case number allocation, stable retry result, no duplicate history.
2. Attempt a transition using another committee's account, stale revision, missing report, obsolete profile or unready attachment: no state/audit-success partial commit.
3. Change a rule/calendar while a case is active: pinned profile and original deadline remain reproducible; authorized migration creates separate evidence.
4. Calculate receipt-based deadlines across weekends, holidays, leap day, month/year end, date-only inputs and inclusive/exclusive counting; missing trigger evidence remains unresolved.
5. Record arrival/departure, vacancy and inhibition, then open/close a vote: frozen denominator matches approved profile and cannot change retrospectively.
6. Submit two responses for one seat, submit at the close boundary, and retry certification after timeout: exactly one current seat record and one logical certification action.
7. Correct a certified vote or document: original remains retrievable, successor is linked, requester and approving authority are distinct as required.
8. Expire a mayoral/review deadline: advisory/task appears; no automatic approval, review conclusion or effectivity.
9. Fail MinIO after upload or MySQL after object copy: no READY manifest with missing bytes; orphan is reconciled without deleting official references.
10. Fail Redis/email and replay the outbox: official actions remain durable; logical notifications and downstream effects are deduplicated.
11. Revoke access while an export is queued: generation/download rechecks prevent disclosure. Public guessing/search/counts never reveal internal data.
12. Publish then withdraw a redacted release: private original stays inaccessible, public API/download/search/cache stop serving the withdrawn version within approved latency.
13. Restore a prior backup: latest required withdrawal/revocation evidence is reconciled before public reopening; file hashes and audit continuity verify.
14. Import historical records with missing dates, duplicate numbers and unverified copies: unknowns preserved, conflicts staged, no fabricated certification or proceedings.
15. Partially repeal a section: original text and unaffected provisions remain; graph relation does not automatically mark the entire measure repealed.

## Data and coverage policy

Use synthetic municipality/people/document fixtures and reviewed anonymized examples. Include ordinances, ordinary resolutions and a reviewed special subtype; simple and joint committees; complete and incomplete historical files; current and former officials; and public/restricted derivatives. Never use real private citizen data in CI. Reset isolated fixtures safely without production credentials.

Every business-critical change adds meaningful tests for its changed behavior and plausible failure modes. Cover every allowed and denied transition plus each permission boundary. Test MySQL-specific semantics on MySQL rather than treating an in-memory substitute as sufficient. Parser/scanner fixtures must be safe controlled samples. Exact tools and runner versions are D-12 implementation decisions.

## Release gates

Phase gates require linked acceptance evidence and unresolved defect review. Critical access/integrity failures block progression to real-data use. Before production: approved rules/roles/disclosure policy, completed end-to-end/UAT journeys, tested backup restore against selected objectives, validated scanner and MFA, security findings resolved or explicitly risk-accepted by accountable owners, operational runbooks and trained staff. Phase 10 consolidates evidence; it does not defer security testing until the end.

Documentation QA for this phase is limited to file completeness, links, IDs, consistency and conceptual review. Mermaid source is included; application behavior and rendered diagram correctness require later tooling/review where unavailable.
