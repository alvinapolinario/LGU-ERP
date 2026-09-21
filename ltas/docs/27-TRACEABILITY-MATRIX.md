# 27 — Requirements traceability matrix

This matrix links every baseline FR and NFR to module, logical API, conceptual data, future test and acceptance criterion. Acceptance IDs are defined by the corresponding row in [functional requirements](02-FUNCTIONAL-REQUIREMENTS.md) or [NFRs](03-NON-FUNCTIONAL-REQUIREMENTS.md). `T-` IDs designate planned test suites, not executed tests. Each suite must include normal, denied, boundary and failure cases appropriate to the requirement. Full criteria remain authoritative in 02/03; short evidence labels here aid navigation.

Phase numbers refer to [19](19-DEVELOPMENT-ROADMAP.md). API paths refer to [09](09-API-DESIGN.md); unprefixed paths use `/api/v1`. Tables refer to [08](08-DATABASE-DESIGN.md). Some list/query resources intentionally have no dedicated persistence table.

## Functional requirements

| Requirement | Module | Logical API | Entity / data | Test → acceptance | Phase | Evidence scenario |
|---|---|---|---|---|---|---|
| LTAS-FR-ACCESS-001 | Access | `/auth` | users | T-FR-ACCESS-001 → AC-ACCESS-001 | 1 | Disabled account is denied despite identity session |
| LTAS-FR-ACCESS-002 | Access | `all internal groups` | user_roles, role_permissions, user_permission_grants | T-FR-ACCESS-002 → AC-ACCESS-002 | 1 | Cross-assignment and expired-term actions denied |
| LTAS-FR-ADMIN-001 | Administration / Workflow | `/admin, /workflows` | system_settings, workflow_profile_versions | T-FR-ADMIN-001 → AC-ADMIN-001 | 1–2 | New rule version preserves pinned active cases |
| LTAS-FR-MEASURE-001 | Measures | `/measures` | legislative_measures, measure_authors, number_sequences | T-FR-MEASURE-001 → AC-MEASURE-001 | 2 | Concurrent filing cannot duplicate official reference |
| LTAS-FR-MEASURE-002 | Measures | `/measures/{id}/timeline` | measure_status_history, document_links | T-FR-MEASURE-002 → AC-MEASURE-002 | 2 | Late event shows occurrence and recording times |
| LTAS-FR-MEASURE-003 | Sessions / Measures | `/measures/{id}/readings` | measure_readings, amendments, measure_versions | T-FR-MEASURE-003 → AC-MEASURE-003 | 4 | Reading remains bound to considered text |
| LTAS-FR-WORKFLOW-001 | Workflow | `/workflows/{id}/transitions` | workflow_instances, workflow_transitions, measure_status_history | T-FR-WORKFLOW-001 → AC-WORKFLOW-001 | 2 | Denied or stale transition leaves no partial write |
| LTAS-FR-WORKFLOW-002 | Workflow / Post-approval | `/workflows/{id}/transitions` | measure_status_history, mayoral_actions, provincial_reviews | T-FR-WORKFLOW-002 → AC-WORKFLOW-002 | 2–6 | Return/reconsideration preserves prior events |
| LTAS-FR-DEADLINE-001 | Workflow | `/deadlines` | deadline_rules, deadlines, calendars, calendar_days | T-FR-DEADLINE-001 → AC-DEADLINE-001 | 2–6 | Corrected receipt produces versioned recalculation |
| LTAS-FR-COMMITTEE-001 | Committees | `/committees` | committees, committee_members, council_memberships | T-FR-COMMITTEE-001 → AC-COMMITTEE-001 | 1, 3 | Term change retains historical assignments |
| LTAS-FR-COMMITTEE-002 | Committees | `/committees/{id}/referrals` | committee_referrals, committee_meetings, committee_reports | T-FR-COMMITTEE-002 → AC-COMMITTEE-002 | 3 | Joint referral retains each report and version |
| LTAS-FR-HEARING-001 | Hearings | `/hearings` | public_hearings, hearing_attendees, hearing_documents, hearing_notices | T-FR-HEARING-001 → AC-HEARING-001 | 3 | Complete consultation record excludes private contacts from release |
| LTAS-FR-SESSION-001 | Sessions | `/sessions` | sessions, session_agenda_revisions, motions, deliberation_entries | T-FR-SESSION-001 → AC-SESSION-001 | 4 | Published agenda changes use a new revision |
| LTAS-FR-SESSION-002 | Sessions | `/sessions/{id}/agenda` | session_agenda_items, measure_readings | T-FR-SESSION-002 → AC-SESSION-002 | 4 | Rescheduling keeps original considered/deferred event |
| LTAS-FR-ATTENDANCE-001 | Attendance | `/sessions, /committees` | session_attendance, committee_attendance, attendance_events | T-FR-ATTENDANCE-001 → AC-ATTENDANCE-001 | 3–4 | Departure/correction cannot change closed vote snapshot |
| LTAS-FR-QUORUM-001 | Attendance / Voting | `/sessions/{id}/quorum` | quorum_snapshots, council_memberships | T-FR-QUORUM-001 → AC-QUORUM-001 | 4 | Unconfirmed quorum blocks round opening |
| LTAS-FR-VOTE-001 | Voting | `/votes` | motions, votes, vote_records | T-FR-VOTE-001 → AC-VOTE-001 | 5 | Ballots distinguished from absent/inhibited dispositions |
| LTAS-FR-VOTE-002 | Voting | `/votes/{id}/certifications` | vote_certifications, correction_requests, vote_records | T-FR-VOTE-002 → AC-VOTE-002 | 5 | Certified correction supersedes rather than overwrites |
| LTAS-FR-VERSION-001 | Measures / Documents | `/measures/{id}/versions` | measure_versions, document_versions | T-FR-VERSION-001 → AC-VERSION-001 | 2–5 | Signed copy creates new immutable artifact |
| LTAS-FR-MAYOR-001 | Mayoral action | `/mayoral-actions` | mayoral_actions, deadlines | T-FR-MAYOR-001 → AC-MAYOR-001 | 6 | Expired deadline triggers task without legal auto-approval |
| LTAS-FR-PROVINCE-001 | Provincial review | `/provincial-reviews` | provincial_reviews, provincial_review_events | T-FR-PROVINCE-001 → AC-PROVINCE-001 | 6 | Non-applicability and completion have recorded authority |
| LTAS-FR-PUBLICATION-001 | Publication | `/publications` | publication_obligations, publications | T-FR-PUBLICATION-001 → AC-PUBLICATION-001 | 6 | One proof does not complete other location obligations |
| LTAS-FR-EFFECTIVITY-001 | Effectivity | `/effectivity` | effectivity_confirmations, document_links | T-FR-EFFECTIVITY-001 → AC-EFFECTIVITY-001 | 6 | Candidate and confirmed dates remain distinct |
| LTAS-FR-LIBRARY-001 | Library | `/library` | legislative_measures, archive_accessions, document_extractions | T-FR-LIBRARY-001 → AC-LIBRARY-001 | 7 | Filters and counts respect scope; scans remain metadata-searchable |
| LTAS-FR-CODIFY-001 | Codification | `/codification` | measure_relationships | T-FR-CODIFY-001 → AC-CODIFY-001 | 7 | Partial repeal retains unaffected target scope |
| LTAS-FR-CODIFY-002 | Codification | `/codification` | legal_status_assessments | T-FR-CODIFY-002 → AC-CODIFY-002 | 7 | Reviewed assessment never rewrites source text |
| LTAS-FR-DOCUMENT-001 | Documents | `/documents/uploads` | upload_sessions, documents, document_versions | T-FR-DOCUMENT-001 → AC-DOCUMENT-001 | 2 | Spoofed or unknown-scan file never becomes ready |
| LTAS-FR-DOCUMENT-002 | Documents | `/documents/{id}/downloads` | document_versions, document_certifications, document_links | T-FR-DOCUMENT-002 → AC-DOCUMENT-002 | 2 | Private originals remain inaccessible through public case |
| LTAS-FR-DASHBOARD-001 | Dashboard | `/dashboard` | scoped source queries, tasks, deadlines | T-FR-DASHBOARD-001 → AC-DASHBOARD-001 | 2, 8 | KPI reconciles with identical filtered report |
| LTAS-FR-REPORT-001 | Reports | `/reports` | report_jobs, votes, committee_referrals | T-FR-REPORT-001 → AC-REPORT-001 | 8 | Counts handle joins, cohorts and incomplete records |
| LTAS-FR-NOTIFY-001 | Notifications | `/notifications` | notifications, notification_deliveries, outbox_events | T-FR-NOTIFY-001 → AC-NOTIFY-001 | 2–6 | Retry delivers one logical notice without official mutation |
| LTAS-FR-TASK-001 | Tasks | `/tasks` | tasks, deadlines | T-FR-TASK-001 → AC-TASK-001 | 2–6 | Completing reminder leaves unsatisfied obligation open |
| LTAS-FR-AUDIT-001 | Audit / all commands | `all mutation groups` | audit_logs, outbox_events | T-FR-AUDIT-001 → AC-AUDIT-001 | 1 onward | Audit insertion failure rolls back business action |
| LTAS-FR-AUDIT-002 | Access / Audit | `/admin, /audit` | audit_logs, audit_exports, user_roles | T-FR-AUDIT-002 → AC-AUDIT-002 | 1 onward | Ordinary admin cannot edit permission-change history |
| LTAS-FR-PORTAL-001 | Public portal | `/api/public/v1` | public_releases, public_release_documents | T-FR-PORTAL-001 → AC-PORTAL-001 | 9 | Guessed internal IDs disclose no private data |
| LTAS-FR-PORTAL-002 | Public releases | `/public-releases` | public_releases, public_release_documents | T-FR-PORTAL-002 → AC-PORTAL-002 | 9 | Withdrawal blocks future search/download access |
| LTAS-FR-IMPORT-001 | Archive / Import | `/imports` | import_batches, import_items, archive_accessions | T-FR-IMPORT-001 → AC-IMPORT-001 | 7 | Duplicates staged and unknown history not fabricated |
| LTAS-FR-ARCHIVE-001 | Archive | `/archives` | archive_accessions, retention_holds | T-FR-ARCHIVE-001 → AC-ARCHIVE-001 | 7 | Accession preserves completeness and outstanding obligations |
| LTAS-FR-IMPLEMENTATION-001 | Implementation review | `/implementation-reviews` | implementation_reviews, tasks | T-FR-IMPLEMENTATION-001 → AC-IMPLEMENTATION-001 | 7 | Operational finding does not alter legal status |

## Non-functional requirements

| Requirement | Module | Interface | Entity / data | Test → acceptance | Phase | Evidence |
|---|---|---|---|---|---|---|
| LTAS-NFR-SECURITY-001 | Access / all adapters | All API/file/export boundaries | users, grants, public_releases | T-NFR-SECURITY-001 → AC-NFR-SECURITY-001 | 1–10 | Negative permission and disclosure suite |
| LTAS-NFR-INTEGRITY-001 | All commands | Mutation groups | business records, audit_logs, outbox_events | T-NFR-INTEGRITY-001 → AC-NFR-INTEGRITY-001 | 1 onward | Fault injection and concurrent uniqueness |
| LTAS-NFR-PERFORMANCE-001 | Queries / operations | Lists/search/reports | query indexes, report_jobs | T-NFR-PERFORMANCE-001 → AC-NFR-PERFORMANCE-001 | 7–10 | Agreed workload p95/error/resource report |
| LTAS-NFR-AVAILABILITY-001 | Operations | Health and degraded routes | authoritative MySQL state | T-NFR-AVAILABILITY-001 → AC-NFR-AVAILABILITY-001 | 1, 10 | Component outage and paper continuity exercise |
| LTAS-NFR-RECOVERY-001 | Operations / Records | No public restore endpoint | all MySQL, object manifests, identity backup | T-NFR-RECOVERY-001 → AC-NFR-RECOVERY-001 | 1, 10 | Timed coordinated restore and reconciliation |
| LTAS-NFR-ACCESSIBILITY-001 | Both frontends | User journeys | no dedicated table | T-NFR-ACCESSIBILITY-001 → AC-NFR-ACCESSIBILITY-001 | 2–10 | Keyboard/screen-reader/contrast assessment |
| LTAS-NFR-PRIVACY-001 | Documents / Releases | File, export and public groups | classification, public_releases, retention_holds | T-NFR-PRIVACY-001 → AC-NFR-PRIVACY-001 | 2, 9–10 | Redaction, minimization and retention review |
| LTAS-NFR-MAINTAINABILITY-001 | All modules | Contract boundaries | owned tables and migration history | T-NFR-MAINTAINABILITY-001 → AC-NFR-MAINTAINABILITY-001 | 1 onward | Boundary checks and reviewed reproducible build |
| LTAS-NFR-OBSERVABILITY-001 | Operations / Audit | All requests/jobs | audit_logs, outbox_events, delivery records | T-NFR-OBSERVABILITY-001 → AC-NFR-OBSERVABILITY-001 | 1 onward | Correlated failed/retried action and safe alerts |
| LTAS-NFR-PORTABILITY-001 | Operations | Build/restore procedures | exportable database/object manifests | T-NFR-PORTABILITY-001 → AC-NFR-PORTABILITY-001 | 1, 10 | Staging rebuild and data export verification |
| LTAS-NFR-SEARCH-001 | Library / Public | /library, /api/public/v1 | text indexes and approved releases | T-NFR-SEARCH-001 → AC-NFR-SEARCH-001 | 7, 9 | Language/token/scan and denied-scope fixtures |
| LTAS-NFR-AUDIT-001 | Audit | /audit | audit_logs, audit_exports | T-NFR-AUDIT-001 → AC-NFR-AUDIT-001 | 1 onward | Privilege denial, sequence and digest tamper checks |

## Maintenance and acceptance ownership

When implementation begins, add work-item/PR references and executed evidence locations without replacing these IDs. Requirements changing meaning receive reviewed revisions; new behavior receives new IDs. A missing entity/API/test mapping is a design gap to resolve before coding. Phase acceptance includes all applicable earlier controls, not just new features.

The Secretary/product lead owns business acceptance; the presiding officer and legal reviewer approve procedural scenarios; records/privacy owners accept preservation/disclosure behavior; IT accepts operational evidence; security/audit reviewers verify access and integrity controls. A passing test is evidence for acceptance, not a substitute for policy approval.

