# 02 — Functional requirements

Each row is a mandatory planned capability unless explicitly future. Acceptance IDs use `AC-` plus the suffix after `LTAS-FR-`; the criterion in that row is the minimum acceptance scenario. Detailed test mappings appear in [traceability](27-TRACEABILITY-MATRIX.md). P1–P10 denote roadmap phases, not priority ranks. All actions require server-side authorization and audit rules even when not repeated below.

| Requirement | Capability and minimum acceptance criterion | Phase |
|---|---|---|
| LTAS-FR-ACCESS-001 | Authenticate through Keycloak; a disabled local account cannot access records even with an otherwise valid identity session. | P1 |
| LTAS-FR-ACCESS-002 | Apply role permissions plus municipality, office term, assignment, classification and action constraints; a committee user cannot edit another committee's report. | P1 |
| LTAS-FR-ADMIN-001 | Manage municipality branding, settings, users, terms and approved rule profiles; changing a rule creates a version without rewriting an active case's profile. | P1–2 |
| LTAS-FR-MEASURE-001 | Register ordinances, resolutions and approved other types with title, subject, category, filing date, authors, co-authors and sponsors; concurrent filing never duplicates the official reference. | P2 |
| LTAS-FR-MEASURE-002 | Show a complete case file and chronological history including late-recorded events, attachments and related legislation; each entry links to its source and actor. | P2 |
| LTAS-FR-MEASURE-003 | Record first, second and third readings and amendments against exact versions and sessions according to the chosen profile; a reading cannot silently change its considered text. | P4 |
| LTAS-FR-WORKFLOW-001 | Execute approved, versioned transitions with preconditions, evidence and reasons; stale, unauthorized or disallowed transitions produce no partial write. | P2 |
| LTAS-FR-WORKFLOW-002 | Support return, withdrawal, deferment, reconsideration, rejection, exceptional paths and parallel post-approval obligations; reason and authority are retained. | P2–6 |
| LTAS-FR-DEADLINE-001 | Calculate auditable deadlines using trigger evidence, rule/calendar versions and timezone; changed receipt evidence creates a revised calculation and review task. | P2–6 |
| LTAS-FR-COMMITTEE-001 | Manage standing/special committees and time-bounded chair, vice-chair, member and staff assignments; historical membership remains queryable after turnover. | P1, P3 |
| LTAS-FR-COMMITTEE-002 | Assign single/joint referrals, lead committee, meetings, resource persons, findings, reports and recommendations; report submission retains referral and measure-version links. | P3 |
| LTAS-FR-HEARING-001 | Track notices, schedule, venue, measure, attendees, organizations, barangays, resource persons, submissions, papers, minutes, photos and findings; private attendee fields stay out of public release. | P3 |
| LTAS-FR-SESSION-001 | Manage regular/special sessions, numbers, dates, venues, agenda, ordered business, motions, deliberations, minutes, documents and adjournment; changes after agenda publication are revisioned. | P4 |
| LTAS-FR-SESSION-002 | Bind scheduled measures/readings to versions and agenda positions; a deferred item keeps its history when rescheduled to another session. | P4 |
| LTAS-FR-ATTENDANCE-001 | Record time-aware session and committee attendance, departures, returns, excuses and corrections; changing current attendance cannot rewrite a closed vote's snapshot. | P3–4 |
| LTAS-FR-QUORUM-001 | Calculate advisory quorum from an approved membership/eligibility snapshot and record the presiding officer's confirmation; absent confirmation blocks opening a vote. | P4 |
| LTAS-FR-VOTE-001 | Record motions and roll-call rounds with Yes, No, Abstain, Absent and Inhibited dispositions; only Yes/No/Abstain are ballots and eligibility governs counting. | P5 |
| LTAS-FR-VOTE-002 | Preserve each vote round, member record, considered version, tally, threshold basis and certification; corrections create a superseding record without deleting the certified round. | P5 |
| LTAS-FR-VERSION-001 | Keep original, committee, amendment, reading, approved, signed and certified versions with ancestry; a signed file is added as a new artifact, never an overwrite. | P2–5 |
| LTAS-FR-MAYOR-001 | Track dispatch, receipt, signed approval, veto, return, objections, deadlines and any reviewed reconsideration/override branch; timer expiry creates a confirmation task, not an automatic legal finding. | P6 |
| LTAS-FR-PROVINCE-001 | Track applicable transmittal, receiving office, acknowledgment, findings, action, deadline and completion; non-applicability requires an authorized recorded basis. | P6 |
| LTAS-FR-PUBLICATION-001 | Track requirement, posting locations, provider, dates, interval and proof per publication/posting obligation; one completed location does not complete every obligation. | P6 |
| LTAS-FR-EFFECTIVITY-001 | Separate calculated candidate and confirmed effectivity, preserving evidence, applicable clauses and confirming authority; conflicting dates remain flagged for review. | P6 |
| LTAS-FR-LIBRARY-001 | Search ordinances, resolutions, minutes, reports, hearing records, codes and historical legislation by number, title, year, keyword, author, committee, category, status, date and subject; permission filtering precedes counts and snippets. | P7 |
| LTAS-FR-CODIFY-001 | Record AMENDS, REPEALS, SUPERSEDES, IMPLEMENTS, REFERENCES and RELATED_TO with scope and evidence; partial repeal does not automatically mark the whole target repealed. | P7 |
| LTAS-FR-CODIFY-002 | Record active, amended, repealed, superseded, obsolete and under-review assessments with reviewer and effective interval; no relationship silently rewrites an official text. | P7 |
| LTAS-FR-DOCUMENT-001 | Upload validated PDF, DOCX and approved image formats to private quarantine; metadata, immutable version, SHA-256 and readiness are recorded before authorized use. | P2 |
| LTAS-FR-DOCUMENT-002 | Authorize every download and certify exact immutable versions; neither metadata edits nor a later release expose a private original or replace certified bytes. | P2 |
| LTAS-FR-DASHBOARD-001 | Present scoped KPIs, pending measures, status distribution, upcoming sessions/meetings, deadlines, recent activity, trends and permitted quick actions; totals reconcile with filtered reports. | P2, P8 |
| LTAS-FR-REPORT-001 | Produce descriptive counts, processing time, categories, workloads, attendance, voting, trends and deadlines using published metric definitions; exports retain filters, as-of time and access scope. | P8 |
| LTAS-FR-NOTIFY-001 | Deliver in-app/email reminders for sessions, meetings, hearings, reports, mayoral/review/publication deadlines and assignments; retries do not create duplicate logical notices. | P2–6 |
| LTAS-FR-TASK-001 | Assign, acknowledge, complete and escalate tasks with due dates and evidence; completing a reminder does not complete its underlying legal obligation. | P2–6 |
| LTAS-FR-AUDIT-001 | Atomically audit creations, edits, transitions, uploads, supersessions, certifications, votes and approvals; failure to record required audit evidence rolls back the business action. | P1 onward |
| LTAS-FR-AUDIT-002 | Audit account, permission and administrative actions; ordinary users and business administrators cannot edit audit history, and authorized reviewers can inspect attributable evidence. | P1 onward |
| LTAS-FR-PORTAL-001 | Separately publish approved measures, enacted legislation, sessions, committees, council members, calendar, hearings, status and downloadable public copies; a guessed internal ID reveals no private record. | P9 |
| LTAS-FR-PORTAL-002 | Review/redact, approve, release, supersede and withdraw public snapshots with cache invalidation; withdrawal removes future portal access while preserving internal evidence. | P9 |
| LTAS-FR-IMPORT-001 | Stage and reconcile historical records with source inventory, known/unknown dates and duplicate checks; import cannot invent missing proceedings or silently create certified status. | P7 |
| LTAS-FR-ARCHIVE-001 | Accession completed/historical case files with custody, completeness assessment, holds and retrieval links; archiving does not imply repeal or erase open obligations. | P7 |
| LTAS-FR-IMPLEMENTATION-001 | Record responsible office, follow-up reviews, observations and evidence for enacted measures; observations do not alter confirmed legal status. | P7 |

## Cross-cutting behavior

Every lifecycle command records actor, authoritative record ID, occurrence time, recording time, reason where required, and rule/version context. Returned, rejected and withdrawn records remain discoverable to authorized users. Corrections are distinguishable from original events. Concurrent edits produce an explicit conflict rather than silent last-write-wins behavior.

Accessibility, security, recovery and performance acceptance supplement these criteria in [NFRs](03-NON-FUNCTIONAL-REQUIREMENTS.md). Future comparison, QR attendance, citizen submissions, SMS, push, consolidated-code generation, semantic search and AI remain in [future roadmap](23-FUTURE-ROADMAP.md).
