# 26 — Decisions, assumptions and open questions

Baseline date: 2026-09-21. “Fixed” means required by the supplied task. “Selected design” means the proposed architectural baseline, still subject to stakeholder review. “TBD” requires a recorded owner decision before the listed gate; no policy approval is implied by document creation.

## Architecture decisions

| ID | Status | Decision and rationale | Consequence |
|---|---|---|---|
| ADR-01 | Fixed | React + TypeScript frontend; NestJS + TypeScript REST backend | No alternative frontend/backend stack introduced |
| ADR-02 | Fixed | MySQL primary database, Prisma ORM | Design/test MySQL-specific constraints; no PostgreSQL substitution |
| ADR-03 | Fixed | Modular monolith first | One business backend, explicit module ownership; extraction deferred |
| ADR-04 | Fixed | MinIO bytes; MySQL metadata; Redis supporting cache/queue; Keycloak identity | Separate storage/transaction failure handling and identity schema ownership |
| ADR-05 | Selected design | NestJS BFF browser session with code + PKCE | Server-side tokens, CSRF protection and Redis session recovery semantics |
| ADR-06 | Selected design | LTAS MySQL owns scoped authorization; Keycloak owns identity | Avoid conflicting duplicated business-role authorities |
| ADR-07 | Selected design | Independent stage/executive/review/publication/effectivity/custody dimensions | More explicit case view; no universal “approved = effective” shortcut |
| ADR-08 | Selected design | Version-pinned approved profile catalog, no general-purpose workflow scripting | Smaller implementation and auditable rule migration |
| ADR-09 | Selected design | Atomic business/audit/outbox and immutable official evidence | Retry-safe consumers and explicit superseding corrections |
| ADR-10 | Selected design | Reviewed public release snapshots with mediated downloads | Separate review effort; immediate server-side withdrawal possible |
| ADR-11 | Fixed | MySQL structured/full-text search initially; AI/OpenSearch deferred | Metadata fallback for scans; future adapters only |
| ADR-12 | Selected design | Single municipality per installation; stable municipality scope throughout | Future multi-tenancy requires new security/operations review |
| ADR-13 | Selected design | Secretary-entered roll-call record as initial voting mode | Self-cast/remote voting disabled until specifically approved |
| ADR-14 | Selected design | One Ubuntu/Compose host is candidate initial topology | Single failure domain; off-host backups mandatory; final hosting TBD |

## Assumptions to validate

| ID | Assumption | If false |
|---|---|---|
| A-01 | Initial deployment serves one municipality | Revisit tenancy, keys, administration, public hosts and recovery isolation |
| A-02 | Staff have online access during most operations | Add approved continuity process; do not improvise offline vote synchronization |
| A-03 | Historical people/terms must survive account turnover | Preserve person/membership model regardless of login provisioning |
| A-04 | Asia/Manila rules/display timezone, UTC instants, date-only facts retained | Validate alternate calendars/timezone interpretation before rules approval |
| A-05 | English-first internal UI; future translation possible | Revise labels/forms/help and document accessibility scope |
| A-06 | Small implementation team with part-time municipal reviewers | Re-estimate phases and reduce optional scope rather than skip integrity controls |
| A-07 | No local IRP, sample data or official templates supplied | Phase 0 validation cannot be treated as completed stakeholder sign-off |

## TBD decision register

| ID | Decision / needed evidence | Proposed owner | Must resolve by | Current status |
|---|---|---|---|---|
| D-01 | Municipality identity, scope, official branding and product sponsor | Municipal sponsor / Secretary | P0 approval | TBD |
| D-02 | Adopted IRP, measure subtypes, readings/urgency, legal sources, applicability and approved rule values | Legal reviewer / Sanggunian authority | Before affected workflow activation, P2–6 | TBD |
| D-03 | Actual role bundles, certification/signatory authority, independent reviewers, delegation and emergency access | Secretary / presiding officer / IT | P1 access baseline | TBD |
| D-04 | Numbering series by type/year/term, historical duplicates and correction policy | Secretary / records officer | P2 filing | TBD |
| D-05 | Hosting site/hardware, domains, staff remote access, network/power, email provider and support hours | IT / sponsor | P1 staging and P10 launch | TBD |
| D-06 | Chosen RPO/RTO, backup transfer frequency, recovery host and exercise frequency | Sponsor / IT / records officer | Before real-data pilot | TBD; options in 17 |
| D-07 | Official records schedule, audit/backup/log retention, holds, disposition authority and off-site custody | Records / privacy / legal officers | Before real-data retention policy, P7 import | TBD |
| D-08 | Data inventory, lawful handling, public fields, redaction policy, publication/release authority and correction channel | Privacy / legal / Secretary | P2 data intake and P9 release | TBD |
| D-09 | Audit reviewers, review cadence, export destination, integrity/signing keys and export-lag threshold | Auditor / IT / sponsor | P1 evidence operations | TBD |
| D-10 | Voting mode, membership/quorum/threshold formulas, presiding/tie/inhibition treatment and corrections | Presiding officer / legal / Secretary | P4–5 | TBD |
| D-11 | Volumes/concurrency, performance/availability targets, metric definitions, export templates and MVP acceptance scope | Product lead / IT / reports owner | P0 backlog then P8/P10 verification | TBD |
| D-12 | Supported component versions, Prisma/MySQL/Keycloak compatibility, MinIO distribution/support/license/object-lock, scanner, test tooling | Technical lead / procurement / IT | P1, scanner before P2 real uploads | TBD |
| D-13 | File limits/quotas, allowed formats, signature/certification policy, extraction need and scan backlog | Records / IT / legal | P2 documents | TBD; suggested cap in 10 |
| D-14 | Calendar holidays, deadline counting/trigger rules and source authority | Legal / Secretary | Before each deadline profile activation | TBD |
| D-15 | Historical source inventory, migration scope, duplicate strategy, validation sample and custodians | Records officer | P0 inventory, P7 import | TBD |
| D-16 | Session timeout/MFA enrollment, secure secret/key custodians and incident escalation | IT / privacy / sponsor | P1 identity; P10 launch | TBD |
| D-17 | Staffing, estimates, budget, procurement and phase delivery dates | Sponsor / product lead | Post-workshop roadmap approval | TBD |
| D-18 | AI/external integrations, hosting/processor policy and evaluation budget | Sponsor / privacy / technical lead | Future authorization only | Deferred / TBD |

Resolve decisions with date, accountable approver, supporting evidence, affected requirement/profile IDs and consequences. Do not delete the original decision history. If a decision contradicts the fixed task stack/scope, obtain explicit scope revision rather than silently changing the blueprint.

## Recommended planning workshop

Validate one ordinary ordinance, one ordinary resolution, one special/applicability-sensitive case, a veto/reconsideration branch and an incomplete historical import. Walk through roles, exact text versions, required evidence, dates, public fields and correction scenarios. Then approve the phase-blocking decisions and transform [traceability](27-TRACEABILITY-MATRIX.md) into a sized backlog with accountable acceptance owners.
