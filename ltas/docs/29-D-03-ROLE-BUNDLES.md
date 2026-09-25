# 29 — D-03 role bundles and emergency access

**Status: working paper opened 2026-09-21. Q1–Q8 proposed 2026-09-21. Phase 2 engineering authorized 2026-09-21 (LS live in software per Q8). Phase 3 referrals authorized 2026-09-22 (CS measure list is referral-scoped). Phase 3 meetings authorized 2026-09-22 (SEC municipality-wide; CS committee-scoped). Not approved. Not municipal policy. §6 unsigned.**

Owners: Secretary to the Sanggunian, presiding officer, municipal IT.  
Requirement: [LTAS-FR-ACCESS-002](02-FUNCTIONAL-REQUIREMENTS.md). Register: [D-03](26-DECISIONS-AND-ASSUMPTIONS.md). Software subset: [ADR-15](26-DECISIONS-AND-ASSUMPTIONS.md). Proposed full catalog: [06](06-USER-ROLES-AND-PERMISSIONS.md).

This paper starts D-03. It does not invent officeholders, certification authority, or a broader role catalog. A software grant never confers public-office power to sign, preside, or vote.

## 1. Decision requested

Confirm a **Phase 1 interim** so access work can continue without waiting for the full Sanggunian/executive catalog. A later addendum can enable PO, COU, CH, CM, RO, LR, MAY, MA, and PUB when the module that needs them is authorized. **LS is already live** in software for Phase 2 drafts (Q8).

Until this paper is signed, PO, COU, CH, CM, RO, LR, MAY, MA, and PUB stay inactive. **LS is live** for Phase 2 draft preparation (Q8). Official file/certify still require D-04 and Q7 confirmation. D-16 session/MFA is unchanged.

## 2. What software already does

These are facts about the running foundation, not a claim that the municipality adopted them as policy.

| Role | Scope | Live permissions | Explicitly cannot |
|---|---|---|---|
| **SYS** | Municipality | Users, dual-control grants, municipality settings, terms (view), health | Committee business, measures, certify, vote, public release |
| **SEC** | Municipality | Municipality settings, terms, people, committees, referrals, meetings, sessions, secretary-entered attendance/tallies, audit view, draft measures, library/report view, `measure.file` (fails without D-04) | Identity administration, grant approval, certified votes, official archive |
| **AUD** | Municipality | View municipality, terms, committees, referrals, meetings, audit, measure/document metadata, library/report view | Writes, quarantine download |
| **CS** | **One committee** | View that committee, municipality, terms, and measures referred to it; manage/close that committee's meetings; upload committee/meeting files; scoped library/report view | Unreferred measures, memberships, administration, referral create/close, other committees' meetings, municipality-wide sessions |
| **LS** | Municipality | Draft create/edit/submit, versions, case uploads, in-app tasks/notices, library/report view | Official numbering, certify, user administration |

Grant rules already encoded:

- Requester, reviewer, and recipient must be three different people.
- Grants are dated; revocation and account disable take effect on the next protected request. A request marked acting or emergency is rejected when the window is longer than 24 hours (Q6). A term appointment is not capped. Owner signatures for Q6 are still open.
- Only CS may be committee-scoped; SYS cannot be committee-scoped.
- Overlapping unrevoked grants of the same role and scope are rejected, including concurrent dual-control review (`npm run test:mysql`).

Technical emergency access to the host or database is **not** an LTAS role. It is named IT access, externally logged, and cannot rewrite `audit_logs` through the application identities. See [11](11-SECURITY-ARCHITECTURE.md).

### Intended Phase 1 holders (Q2)

Offices only. Occupants are not named. Do not copy fictional development accounts into this table.

| Role | Intended office | Occupant |
|---|---|---|
| SYS (grant requester) | Municipal IT administrator (primary) | TBD |
| SYS (grant reviewer) | Municipal IT administrator (independent reviewer) | TBD — must be a different person from the requester and from the recipient |
| SEC | Secretary to the Sanggunian | TBD |
| AUD | Designated auditor / read-only reviewer | TBD |
| CS | Committee secretary or staff of a named standing committee | TBD (committee TBD) |
| LS | Legislative staff (draft preparation / filing support) | TBD |

## 3. Proposed Phase 1 interim (confirm or amend)

Proposed for Secretary / presiding officer / IT confirmation. Blank means not yet decided.

1. **Role catalog for Phase 1 plus Phase 2 LS:** keep **SYS, SEC, AUD, CS**, and enable **LS** (Q8). Do not enable PO, COU, CH, CM, RO, LR, MAY, MA, or PUB until a dated addendum names the module that needs them.
2. **Independent review:** privileged grants keep three distinct people. If the municipality cannot staff two SYS reviewers plus a distinct recipient, record an alternate procedure here — the application must not silently drop the check.
3. **Delegation / acting officers:** use a **dated grant** to another linked account (same role, validity **at most 24 hours**). Do not introduce a separate “acting” role or copy another person’s identity.
4. **Emergency access in LTAS:** no break-glass API and no wildcard administrator. Recover by: disable or revoke in-app; dual-control grant of SYS or SEC for **at most 24 hours**; IT host/database access outside the application with reason, expiry, and after-action review (Q5).
5. **Certification / signatory:** not in Phase 1. When certify, file, or release commands are later authorized, the **Secretary to the Sanggunian records** the act and the **presiding officer confirms** it. Recorder and confirmer must be different people. Named occupants of those offices remain TBD. A software grant is not a legal signature.
6. **Software ≠ authority:** holding SEC or CS in LTAS does not make the user the Secretary or a committee officer in law.

## 4. Catalog not activated

[06](06-USER-ROLES-AND-PERMISSIONS.md) still proposes PO, COU, CH, CM, RO, LR, MAY, MA, and PUB. They remain **inactive**. Do not treat that table as the live permission matrix. **LS is live** for Phase 2 drafts and is not in this wait list.

| Proposed role | Why it waits |
|---|---|
| PO, COU | Sessions, quorum, voting (Phases 4–5); D-10 formulas |
| CH, CM | Committee hearings and reports (later Phase 3). Secretariat-recorded referrals and meetings use SEC/CS only |
| RO | Documents, classification, archive (Phases 2, 7, 9) |
| LR | Legal assessment and rule approval (Phases 2–6) |
| MAY, MA | Executive action and operational oversight (Phase 6, reports) |
| PUB | Public portal accounts are not required; releases are Phase 9 |

## 5. Workshop questions

Answer with name/title, date, and a short rationale. Do not answer from generic parliamentary practice.

| # | Question | Owner | Answer |
|---|---|---|---|
| Q1 | Confirm the Phase 1 interim in §3, or list amendments | Secretary + PO + IT | 2026-09-21 workshop: confirm §3.1–3.4 and §3.6 as written. Amend §3.5 — Secretary records; presiding officer confirms; named persons TBD. Owner signatures still required. |
| Q2 | Named persons who may hold SYS, SEC, AUD, CS in the real municipality (not the fictional seed accounts) | Secretary + IT | 2026-09-21 workshop: record offices now; occupants TBD. SYS = Municipal IT administrator; SEC = Secretary to the Sanggunian; AUD = designated auditor / read-only reviewer; CS = committee secretary or staff of a named standing committee (committee TBD). Fictional seed logins are not officeholders. Named persons still required from Secretary + IT. |
| Q3 | Second SYS (or approved alternate) who can review grants when the requester is the other SYS | Secretary + IT | 2026-09-21 workshop: two distinct Municipal IT posts, both SYS. Primary requests; independent reviewer approves. Occupants TBD. No non-SYS alternate; `grant.approve` stays SYS-only. Reviewer ≠ requester ≠ recipient. Fictional seed pair is not this answer. |
| Q4 | How acting Secretary / acting staff is recorded (dated grant vs other instrument) | Secretary + PO | 2026-09-21 workshop: dated LTAS grant only — same role, bounded validity, different linked account. No separate “acting” role; do not copy another person’s identity. No additional paper instrument required in LTAS. Occupants TBD. Duration: Q6. |
| Q5 | Who reviews IT emergency host/database access after the fact | IT + sponsor | 2026-09-21 workshop: Secretary to the Sanggunian reviews after the fact, in addition to IT logging. Reviewer must differ from the person who used the access. Occupant TBD. No LTAS break-glass API. |
| Q6 | Maximum duration of an emergency or acting grant | Secretary + IT | 2026-09-21 workshop: **one cap, 24 hours**, for both acting grants and emergency SYS/SEC grants. Host/database emergency access stays outside LTAS (Q5) and is not this grant. A request marked acting or emergency cannot exceed 24 hours. Term appointments are not capped. Owner signatures still required. |
| Q7 | Who will be the designated certifier for measures when Phase 2 starts (office, not only a role code) | Secretary + PO | 2026-09-21 workshop: confirm Q1 §3.5. **Secretary to the Sanggunian** records; **presiding officer** confirms. Occupants TBD. Not the SEC role code alone. Certify/file/release commands remain out of Phase 1. |
| Q8 | Whether any proposed 06 role must be brought forward before Phase 2 | Product + Secretary | 2026-09-21 workshop: bring **LS (legislative staff)** forward when Phase 2 is authorized. **2026-09-21 engineering: LS live** for assigned draft preparation, filing support, and evidence entry. Other 06 roles stay inactive. |

## 6. Confirmation

Copy this block when the owners agree. Leave unsigned until then.

| | Name / office | Date | Decision |
|---|---|---|---|
| Secretary to the Sanggunian | | | Confirm / amend §3 |
| Presiding officer | | | Confirm / amend §3 |
| Municipal IT | | | Confirm / amend §3 |

Evidence to attach: this file, ADR-15, the live permission table in `packages/contracts`, and `npm run test:mysql` results. Do not delete prior D-03 text when an addendum is later approved; append it.
