# 31 — Phase 3 referrals (constrained slice)

**Engineering authorized 2026-09-22. Not municipal IRP. Not a session reading. Not a committee report. Not production. D-02/D-03 unsigned. D-16 unchanged.**

This handoff implements a constrained Phase 3 slice from [19](19-DEVELOPMENT-ROADMAP.md): secretariat-recorded single and joint referrals, one lead committee, version-bound obligations, close without a report, and committee-scoped measure visibility for CS. Numbered documents 00–27 remain the design baseline. D-03 signatures and D-02 IRP remain deferred by product request.

## Requirement slice

| Requirement | Phase 3 behavior | Evidence |
|---|---|---|
| LTAS-FR-COMMITTEE-002 (partial) | Assign one lead plus optional joints in one command. Each row keeps its own due date, disposition, and the exact measure version current at referral. Re-referral after every open row is closed increments `(measure, committee, sequence)` | `apps/api/src/referrals.service.ts`, `apps/api/src/mysql.referral.test.ts` |
| LTAS-FR-ACCESS-002 | **CS** may `measure.view` only with committee scope, and only for measures referred to that committee. SYS still has no measure rights. CH/CM stay inactive | `packages/contracts`, `apps/api/src/domain/policy.test.ts`, `apps/api/src/access.ts` |
| LTAS-FR-TASK-001 / NOTIFY-001 | In-app task and notice for each referred committee's CS grant holders. Completing a task does not close the referral. Closing a referral is not a committee finding | `apps/api/src/referrals.service.ts` |
| LTAS-FR-DASHBOARD-001 | Pending Committee = distinct measures with an OPEN referral visible to the caller. Other pipeline KPIs stay 0 / later phase | `GET /measures/stats`, `apps/web/src/App.tsx` |
| LTAS-FR-WORKFLOW-001 | Measure stage is unchanged by referral. `P2-DRAFT-INTERIM` is still the only profile. Secretariat recording is not a first-reading event. Withdraw is denied while any referral is OPEN | `apps/api/src/domain/workflow.ts`, `apps/api/src/measures.service.ts`, `apps/api/src/mysql.referral.test.ts` |

## Implemented HTTP surface (added)

- `POST /measures/:id/referrals` — SEC; lead + joints; binds current version
- `GET /measures/:id/referrals`
- `GET /committees/:id/referrals`
- `POST /referrals/:id/close` — SEC; reason required; not a report

## Explicit non-goals

Meetings and committee/meeting documents are the [next constrained slice](32-PHASE-3-MEETINGS.md). No hearings, resource persons, findings, committee reports, CH/CM roles, session-sourced referrals, readings, voting, mayoral action, public portal, official numbers, or IRP. Seed does not invent referrals. A software grant is not authority to refer in law. Closing a referral is not a committee recommendation.

Source kind is `SECRETARIAT_RECORDED`. That is an engineering provenance label, not an adopted Internal Rules of Procedure path (D-02).
