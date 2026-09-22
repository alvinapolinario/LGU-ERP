# 34 — Phase 7/8 e-Library and reports (constrained slice)

**Engineering authorized 2026-09-22. Not municipal IRP. Not an official archive. Not a public portal. Not official metrics. Not production. D-02/D-03/D-10/D-11 unsigned.**

This handoff starts a constrained slice of [19](19-DEVELOPMENT-ROADMAP.md) Phases 7–8: a permission-filtered index of records the caller can already see, and a published engineering catalog of descriptive counts. Numbered documents 00–27 remain the design baseline.

## Requirement slice

| Requirement | Constrained behavior | Evidence |
|---|---|---|
| LTAS-FR-LIBRARY-001 (partial) | Search measures, documents, sessions, meetings, and committees the caller can already see. Permission filtering precedes hits. Empty query lists visible records | `GET /library`, `apps/api/src/mysql.library.test.ts` |
| LTAS-FR-REPORT-001 (partial) | Descriptive counts using `P-REPORT-INTERIM-1`. `measures.proposed` and `referrals.pendingMeasures` use the same definitions as the dashboard KPIs | `GET /reports` |
| LTAS-FR-DASHBOARD-001 (partial) | Dashboard Proposed Measures and Pending Committee reconcile to the same filtered report keys | `T-FR-REPORT-001` |
| LTAS-FR-ACCESS-002 | **SEC/AUD/LS** municipality-wide library and report view. **CS** committee-scoped. **SYS** denied. CH/CM/RO/MA/PUB stay inactive | `packages/contracts`, `apps/api/src/domain/policy.test.ts` |

## Implemented HTTP surface (added)

- `GET /library`
- `GET /reports`

CSV download is generated in the browser from the same snapshot. It is not a sensitive export job.

## Explicit non-goals

No accession, historical import, codification, legal-status assessments, official archive, public portal, processing-time analytics, political scoring, certified productivity, or D-11 official metric definitions. Seed does not invent enacted legislation. A software grant is not authority to publish or certify a report.

e-Library is an internal index, not the official e-Library or a release catalog. Reports are operational counts, not official municipal analytics.
