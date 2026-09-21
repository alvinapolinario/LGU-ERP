# 24 — Glossary

| Term | Meaning in this blueprint |
|---|---|
| LTAS | Legislative Tracking and Analysis System, the current municipal project |
| LGU | Local Government Unit |
| Sangguniang Bayan | Municipal legislative body; local authority and procedure require approved sources |
| Sangguniang Panlalawigan | Provincial legislative body involved in applicable review |
| IRP | Internal Rules of Procedure of the relevant Sanggunian |
| Measure | Stable digital case-file identity for proposed ordinance, resolution or another approved type |
| Ordinance / resolution | Distinct measure types; applicable procedural/legal treatment is profile-specific |
| Digital legislative case file | Linked identity, versions, proceedings, evidence, obligations and history for a measure |
| Legislative stage | Current recorded position in proceedings, separate from executive/review/effectivity state |
| Approved | Recorded Sanggunian outcome unless explicitly qualified; not shorthand for every later obligation |
| Enacted | Reporting/legal classification requiring approved local definition and evidence |
| Effective / effectivity | Authorized recorded assessment of operative date/status, separate from a calculated candidate |
| Reading | Recorded consideration of an exact measure version in a session under the applicable profile |
| Referral | Assignment of an identified measure/version to committee(s), with provenance and obligations |
| Hearing | Consultation event with notice, evidence, participants and findings |
| Session | Regular or special legislative proceeding with agenda, attendance, motions and minutes |
| Order of Business | Ordered categories/items for a session; maintained in agenda revisions |
| Quorum snapshot | Frozen membership/presence inputs, applied rule, calculation and authorized declaration |
| Motion | Recorded proposal for action within proceedings |
| Voting round | One bounded collection of member dispositions for a motion/text under a pinned rule |
| Abstain | Recorded ballot choice distinct from a No vote and from absence |
| Absent / inhibited | Attendance or eligibility dispositions, not cast ballots |
| Certification | Attributable attestation to an exact record/version by a designated authority |
| Signed copy | Artifact containing signatures; does not automatically establish cryptographic validation |
| Document version | Immutable bytes and metadata manifest identified by version ID and SHA-256 |
| Measure version | Identified legislative text at a stage, linked to exact document versions |
| Supersession | New record explicitly replaces the current interpretation while retaining its predecessor |
| Codification | Organized relationships and reviewed consolidation context for legislation; no autonomous rewriting |
| Archive | Custody/preservation/accession state; not a synonym for repeal or deletion |
| Public release | Approved immutable allowlisted snapshot and approved public file derivatives |
| Posting/publication | Tracked evidence of applicable legislative obligations; different from uploading to the portal |
| Rule profile | Approved versioned workflow, applicability, evidence and calculation configuration |
| System invariant | Technical integrity requirement that configuration cannot disable |
| Advisory | Computed suggestion/warning without autonomous authoritative effect |
| Provenance | Source, actor, time, authority and transformation history of a record |
| RBAC | Role-Based Access Control; role bundles supply candidate permissions |
| Permission-based control | Named action grants combined with record, assignment, term and classification scope |
| SSO / OIDC | Single Sign-On / OpenID Connect identity protocols through Keycloak |
| BFF | Backend-for-frontend session adapter inside NestJS, holding browser tokens server-side |
| PKCE | Proof Key for Code Exchange protecting authorization-code exchange |
| CSRF / XSS | Cross-Site Request Forgery / Cross-Site Scripting |
| Modular monolith | One business backend deployment/codebase with explicit internal module ownership |
| Outbox | Database-persisted asynchronous intent committed with the business transaction |
| Idempotency | Repeated same logical request yields no duplicate business effect |
| Optimistic locking | Rejecting changes based on a stale record revision |
| RPO / RTO | Recovery Point Objective / Recovery Time Objective; final values require approval |
| Soft deletion | Hiding/deactivating eligible mutable records while retaining identity and history |
| Legal hold | Authorized block on disposal while a preservation obligation exists |
| FR / NFR / AC | Functional requirement / Non-functional requirement / Acceptance criterion |
| TBD | A decision requiring named stakeholder resolution, not an invitation to invent a rule |

For governing definitions and sources, use [25](25-SOURCES-AND-RULE-VALIDATION.md); this glossary is system terminology, not a legal opinion.
