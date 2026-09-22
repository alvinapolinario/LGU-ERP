# 33 — Phase 4 sessions, calendar, roll-call, and document list (constrained slice)

**Engineering authorized 2026-09-22. Not municipal IRP. Not a reading. Not certified minutes. Not a certified vote. Not a quorum declaration. Not production. D-02/D-03/D-10 unsigned.**

This handoff starts a constrained Phase 4 slice from [19](19-DEVELOPMENT-ROADMAP.md): secretariat-recorded sessions, a combined calendar of sessions and committee meetings, secretary-entered attendance and tallies, and a municipality document list on the existing quarantine path. Numbered documents 00–27 remain the design baseline.

## Requirement slice

| Requirement | Phase 4 behavior | Evidence |
|---|---|---|
| LTAS-FR-SESSION-001 (partial) | Schedule/edit/close a sitting. Auto reference `S-{Asia/Manila year}-{n}`. Attach existing measures as agenda. Close is not certified minutes | `apps/api/src/sessions.service.ts`, `apps/api/src/mysql.session.test.ts` |
| LTAS-FR-ATTENDANCE-001 (partial) | Record PRESENT/ABSENT/EXCUSED against a person in the directory. Not a council roster and not a quorum snapshot | `POST /sessions/:id/attendance` |
| LTAS-FR-VOTE-001 (partial) | Secretary-entered yes/no/abstain counts on an agenda measure. Result is always `RECORDED`. Counts do not pass or fail a measure (ADR-13) | `POST /sessions/:id/votes` |
| LTAS-FR-DOCUMENT-001 | `ownerType` SESSION uses the same quarantine/UNKNOWN scan. `GET /documents` lists files the caller can already see | `apps/api/src/documents.service.ts` |
| LTAS-FR-ACCESS-002 | **SEC** municipality-wide session manage/close, attendance, and tally. **LS** view + attendance. **AUD** view. **CS/SYS** no session writes. CH/CM/PO/COU stay inactive | `packages/contracts`, `apps/api/src/domain/policy.test.ts` |

## Implemented HTTP surface (added)

- `GET /sessions`, `POST /sessions`
- `GET /sessions/:id`, `PATCH /sessions/:id`, `POST /sessions/:id/close`
- `POST /sessions/:id/agenda`
- `POST /sessions/:id/attendance`
- `POST /sessions/:id/votes`
- `GET /sessions/:id/documents`
- `GET /calendar`
- `GET /documents`

## Explicit non-goals

No readings, motions, published agenda revisions, quorum formulas, certified minutes, vote.cast, vote.certify, PO/COU roles, hearings, official session numbers (D-04), or IRP. Seed does not invent sessions. A software grant is not authority to convene, preside, or vote in law. A recorded tally is not a certified result.

Session reference `S-{year}-{n}` is an engineering sequence, not an official series. Calendar is a combined list, not an official hearing calendar. Documents is a case-file index, not the e-Library.
