# 01 — System vision

LTAS should let authorized staff answer: What is this measure? Which text was considered? Who acted, under what authority, when, with what evidence? What remains pending? What has been confirmed for public release? Each answer should link to the underlying record.

## Case-file model

A stable measure ID connects registration details, authors/co-authors/sponsors, referrals, meetings, hearings, readings, amendments, sessions, motions, vote rounds, signed/certified artifacts, executive correspondence, review findings, posting evidence, effectivity confirmations and relationships to other legislation. Chronological display uses both occurrence time and recording time so late entry does not conceal provenance.

Lifecycle stage, executive action, provincial review, posting/publication, effectivity, archival custody and codification condition are separate dimensions. A single “approved” badge must not imply all legal or administrative obligations are complete. Missing evidence is visible as unknown or awaiting confirmation.

## Design values

Deterministic recordkeeping, human accountability, accessibility, privacy-aware transparency, operational simplicity and portability govern tradeoffs. The system is useful with structured metadata and uploaded source documents even before advanced text extraction. Descriptive workload metrics support administration; they do not rank elected officials or infer political merit.

## Ecosystem boundaries

| Future system | Potential exchange | LTAS boundary |
|---|---|---|
| Citizen Services | Public hearing notices and approved public references | No citizen identity platform now |
| Municipal ERP / Budget and Finance | Enacted appropriation references and implementation feedback | No ledger or financial approvals |
| GIS | Spatial applicability references | No parcel or map authority |
| Executive Dashboards | Approved aggregate operational metrics | No direct table access |
| Document Management / Records Management | Certified copies and accession metadata | Preserve LTAS provenance and custody |
| Procurement / Project Monitoring | References to authorizing measures | No procurement or project workflow |
| Business Permits / HR | Applicable ordinance links / officeholder references | No permit decisions or payroll |
| Notification Services | Delivery requests and receipts | LTAS owns task/deadline state |
| AI/ML Services | Approved read-only analysis requests | Outputs remain non-authoritative |

Use versioned REST contracts and a durable integration outbox. No external system may directly write legislative tables or certify a record. Initial deployment has no external integration requirement beyond identity, storage and an approved email channel.

## Representative journeys

Staff files a draft; the secretary accepts it and assigns an official reference; the session records a reading and referral; committees assemble evidence; a later session considers an identified text and certifies a vote; authorized officers record executive and review evidence; a release officer approves a redacted public snapshot. A citizen sees that snapshot and its last publication time, without internal notes or hearing attendees' private contact details.

For a historical ordinance with missing session records, staff records known source provenance and uncertainty. Import does not fabricate readings, votes or effectivity. For a veto or returned measure, the system retains every prior text and action while a reviewed branch governs reconsideration.

Related: [architecture](04-SYSTEM-ARCHITECTURE.md), [workflow](07-LEGISLATIVE-WORKFLOW.md), [future roadmap](23-FUTURE-ROADMAP.md).
