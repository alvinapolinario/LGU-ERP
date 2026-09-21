# 03 — Non-functional requirements

Targets below are proposed engineering acceptance candidates, not current measurements or stakeholder-approved service commitments. Workload, availability, retention and final RPO/RTO remain TBD. Each row defines `AC-NFR-<suffix>` and associated `T-NFR-<suffix>` where the suffix follows `LTAS-NFR-`.

| ID | Requirement | Acceptance evidence |
|---|---|---|
| LTAS-NFR-SECURITY-001 | Deny by default at every API, object, field, export and file boundary; fail closed for consequential writes. | Negative tests across role, assignment, term, classification and municipality scopes; zero unauthorized disclosures in the agreed suite. |
| LTAS-NFR-INTEGRITY-001 | Commit state change, timeline event, required audit and outbox in one MySQL transaction; enforce uniqueness and optimistic locking. | Fault injection and concurrent submission show no partial action, duplicate official number or lost certified record. |
| LTAS-NFR-PERFORMANCE-001 | Agree dataset and concurrent workload before service targets. Proposed interactive target: p95 ordinary reads under 2 seconds and ordinary writes under 3 seconds on the agreed environment, excluding file transfers and external identity. | Repeatable benchmark report with dataset, hardware, concurrency, error rate and plans for slow queries. Search, exports and uploads have separate TBD budgets. |
| LTAS-NFR-AVAILABILITY-001 | Provide maintenance windows, component health, documented degraded modes and a paper continuity procedure. | Exercise database, Redis, identity and object-store outages; state remains accurate and visible. Availability percentage and support hours TBD. |
| LTAS-NFR-RECOVERY-001 | Restore compatible database, objects, identity, configuration and audit evidence to a documented point. | Timed isolated restore and reconciliation against the stakeholder-selected RPO/RTO option. |
| LTAS-NFR-ACCESSIBILITY-001 | Target WCAG 2.2 AA for key internal and public journeys, subject to formal assessment. | Keyboard and screen-reader checks, focus and error handling, contrast review and automated checks; accessible alternatives for scanned documents. |
| LTAS-NFR-PRIVACY-001 | Minimize collection and disclosure, classify data and make retention/holds enforceable after policy approval. | Privacy review, release redaction tests, export access tests and documented retention decisions; no assertion of legal compliance from testing alone. |
| LTAS-NFR-MAINTAINABILITY-001 | Enforce module ownership, strict TypeScript, versioned contracts and reproducible dependency pins. | Boundary checks, contract review and documented migration/release procedure; no direct cross-module writes. |
| LTAS-NFR-OBSERVABILITY-001 | Correlate API requests, jobs, audit IDs and integrations without logging secrets or document bodies. | Trace a failed and retried action end to end; alerts identify failed jobs, backup failures and storage pressure without exposing sensitive content. |
| LTAS-NFR-PORTABILITY-001 | Run on the approved Ubuntu/Docker Compose platform with exportable records and no required proprietary search dependency. | Staging rebuild and restore using documented artifacts; exports include metadata and immutable version manifests. |
| LTAS-NFR-SEARCH-001 | Return only authorized records and declare indexing limits/freshness. | Filipino/English names, short ordinance numbers, punctuation, stopwords and unextracted scans tested; structured exact-number search remains available. |
| LTAS-NFR-AUDIT-001 | Retain attributable, tamper-evident audit evidence beyond ordinary administrative control. | Application write role cannot update/delete audit rows; exported manifest verification detects altered or missing evidence. |

## Capacity planning worksheet

Collect existing measures by year, files and average/largest sizes, annual growth, concurrent staff/public usage, peak session activity, export frequency, historical-import backlog and network speed. Estimate storage for original bytes, every retained version, redacted derivatives, backups, binlogs and audit growth separately. Do not size from measure row count alone. Agree load fixtures before performance acceptance.

## Reliability and degradation

MySQL is authoritative. Redis loss may interrupt sessions or notifications but must not lose legislative decisions; users may need to sign in again. MinIO outage blocks uploads/downloads/certification of unavailable evidence while metadata may remain readable. Keycloak outage denies new logins; existing local sessions can operate only within still-valid identity/session policy, with sensitive actions requiring current checks. Email failure leaves visible in-app tasks and delivery failures. Public cache is never the source of an internal decision.

Related: [security](11-SECURITY-ARCHITECTURE.md), [recovery](17-BACKUP-AND-DISASTER-RECOVERY.md), [tests](18-TESTING-STRATEGY.md).
