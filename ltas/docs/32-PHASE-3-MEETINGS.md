# 32 — Phase 3 meetings and documents (constrained slice)

**Engineering authorized 2026-09-22. Not municipal IRP. Not a hearing. Not certified minutes. Not a committee report. Not production. D-02/D-03 unsigned. D-13 unchanged.**

This handoff continues the constrained Phase 3 slice from [19](19-DEVELOPMENT-ROADMAP.md) and [31](31-PHASE-3-REFERRALS.md): secretariat-recorded committee meetings, agenda links to existing referrals, and committee/meeting uploads on the same MinIO quarantine path. Numbered documents 00–27 remain the design baseline. D-03 signatures and D-02 IRP remain deferred by product request.

## Requirement slice

| Requirement | Phase 3 behavior | Evidence |
|---|---|---|
| LTAS-FR-COMMITTEE-002 (partial) | Schedule/edit/close a committee meeting. Attach existing same-committee referrals as agenda. Auto reference `M-{Asia/Manila year}-{n}`. Close does not create certified minutes | `apps/api/src/meetings.service.ts`, `apps/api/src/mysql.meeting.test.ts` |
| LTAS-FR-ACCESS-002 | **SEC** municipality-wide meeting manage/close. **CS** manage/close only the assigned committee. **AUD/LS** view. **SYS** none. CH/CM stay inactive | `packages/contracts`, `apps/api/src/domain/policy.test.ts`, `apps/api/src/access.ts` |
| LTAS-FR-DOCUMENT-001 / 002 | `ownerType` COMMITTEE or MEETING uses the existing quarantine/UNKNOWN scan. Download remains READY-only (D-13). Closed meetings may still receive uploads | `apps/api/src/documents.service.ts`, `apps/api/src/mysql.meeting.test.ts` |
| LTAS-FR-TASK-001 / NOTIFY-001 | In-app task and notice for the committee's CS grant holders on create. Completing a task does not close the meeting | `apps/api/src/meetings.service.ts` |

## Implemented HTTP surface (added)

- `GET /committees/:id/meetings`
- `POST /committees/:id/meetings` — SEC municipality-wide or CS for that committee
- `GET /meetings/:id`
- `PATCH /meetings/:id` — scheduled meetings only
- `POST /meetings/:id/close` — not certified minutes
- `POST /meetings/:id/referrals` — same-committee referral, unique per meeting
- `GET /committees/:id/documents`
- `GET /meetings/:id/documents`

Document intents already accept `ownerType` MEASURE. This slice adds COMMITTEE and MEETING on the same `/documents/intents` path.

## Explicit non-goals

Sessions, calendar, roll-call, and the document list are the [next constrained slice](33-PHASE-4-SESSIONS.md). No hearings, resource persons, findings, committee reports, CH/CM roles, session-sourced referrals, readings, certified votes, mayoral action, public portal, official numbers, or IRP. Seed does not invent meetings. A software grant is not authority to convene a committee in law. Closing a meeting is not certified minutes and is not a committee recommendation.

Meeting reference `M-{year}-{n}` is an engineering sequence, not an official series (D-04).
