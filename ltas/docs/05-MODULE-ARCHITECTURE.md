# 05 — Module architecture

Each module exposes application commands and queries; its repositories remain private. Controllers adapt REST to these operations. The table defines logical ownership, not separate deployable services. Requirements are in [02](02-FUNCTIONAL-REQUIREMENTS.md), tables in [08](08-DATABASE-DESIGN.md) and routes in [09](09-API-DESIGN.md).

| Module | Owns | Commands / outputs | Dependencies and boundary |
|---|---|---|---|
| Access and administration | Local users, scoped grants, municipality, terms, settings | Link identity; grant/revoke; version settings | Keycloak authenticates; domain modules request policy decisions |
| Measures | Measure identity, types/categories, contributors, versions, status history | Create, file, submit, add version; MeasureFiled | Workflow approves transitions; never edits vote evidence |
| Workflow and deadlines | Versioned rule profiles, transitions, instances, deadlines | Evaluate, transition, recalculate; TransitionRecorded | Calls owned services in one transaction; no arbitrary scripts |
| Committees | Committees, membership, referrals, meetings, resource persons, position papers and reports | Refer, schedule, submit report; ReportSubmitted | Measures supply case references; sessions retain separate proceedings |
| Hearings | Hearing notices, attendance, submissions and findings | Schedule, record, close | Committee/measure references; documents are linked immutable versions |
| Sessions | Session, agenda revisions, readings, motions, minutes links | Publish agenda, open/suspend/adjourn, close | Attendance/quorum and voting own their evidence |
| Attendance and voting | Presence events, quorum snapshots, rounds, member records and certification | Confirm quorum, open/record/close/certify round | Eligibility from historical memberships; no vote implied by presence |
| Mayoral action | Dispatch/receipt/action/objection records | Record action and reviewed deemed-action confirmation | Workflow owns next-step decision; no timer auto-approval |
| Provincial review | Review case, transmittals, findings and resolution | Open, record correspondence, confirm completion | Applicability profile; does not equate review completion with effectivity |
| Publication and effectivity | Obligations, posting/publication proofs and effectivity confirmations | Record evidence, confirm candidate | Separate from portal release; legal reviewer handles uncertainty |
| Documents | Metadata, versions, classification, access, certification | Stage, validate, link, certify, download | MinIO adapter; domain ownership determines file visibility |
| Library, codification and archive | Relationships, assessments, accession, import, follow-up review | Index, relate, assess, accession | Uses certified sources; no automatic rewrite or legal determination |
| Dashboard and reports | Query definitions, export jobs, read projections | Scoped KPIs, aggregates and exports | Read-only across owned query interfaces; never political scoring |
| Notifications and tasks | Tasks, logical notices, delivery attempts, preferences | Assign, remind, acknowledge, deliver | Durable outbox; notices do not perform legislative actions |
| Audit | Append-only audit events and export manifests | Append within transaction, review/export | No update/delete interface for ordinary operation |
| Public releases | Approved snapshots, approved file derivatives, release history | Prepare, approve, publish, supersede, withdraw | Only source for public portal; no live internal serialization |

## Orchestration examples

Filing invokes Measures and Workflow, allocates a number, emits a timeline entry and appends Audit/Outbox within one transaction. It then asynchronously schedules notifications. A notification outage cannot roll back an already committed filing.

Vote certification is owned by Voting. It checks frozen membership, declared quorum, finalized member dispositions, the voted measure version, authority and certification evidence. Any resulting measure transition is an explicit coordinated command under the profile, committed atomically with the certification and audit. A computed majority alone is not certification.

Public release preparation reads approved internal data into a draft allowlist snapshot. Approval freezes it. Publication writes a release event and starts cache/index invalidation work. The current release pointer determines public visibility; cache keys include release revision. Withdrawal must invalidate current access without erasing released history internally.

## Dependency discipline

Foundational access, audit and storage ports cannot depend on measures or sessions. Domain modules may depend on identity IDs and policy interfaces, not Keycloak internals. Workflow configuration refers to a fixed catalog of domain commands, not reflection-based method execution. Report joins cannot mutate source tables. Shared DTO changes require consumers to be reviewed. Future extraction uses existing contracts and outbox events rather than duplicating authoritative state.

Suggested future backend organization: each module has domain, application, infrastructure and presentation folders. Small modules may start with fewer folders where separation remains explicit. Avoid a generic repository framework, universal entity service or workflow scripting platform until a measured need appears.
