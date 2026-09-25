# 28 — Phase 1 foundation

**Implementation authorized 2026-09-21. Not production. Not municipal policy approval.**

This handoff describes the platform-foundation slice in [19](19-DEVELOPMENT-ROADMAP.md): identity, scoped access, municipality/terms/people, committee roster, audit/outbox, and a local deployment skeleton. Numbered documents 00–27 remain the design baseline. Where this file records an implemented subset, it does not silently replace D-03 role catalogs or later-phase modules.

## Requirement slice

| Requirement | Phase 1 behavior | Evidence |
|---|---|---|
| LTAS-FR-ACCESS-001 | Keycloak authorization code + PKCE through the NestJS BFF; disabled local accounts are rejected on the next protected request | `apps/api/src/auth.ts`, `apps/api/src/access.ts`, `apps/api/src/access.test.ts`, `apps/api/src/mysql.access.test.ts` |
| LTAS-FR-ACCESS-002 | Deny-by-default grants; SYS has no committee/audit business rights; CS is bound to one committee. Reports, classification and office-term seats are later phases | `apps/api/src/domain/policy.ts`, `apps/web/src/App.test.tsx`, `apps/api/src/mysql.access.test.ts` |
| LTAS-FR-ADMIN-001 | Municipality name/province, users, terms. Branding assets and versioned workflow profiles wait for D-01 and Phase 2 | `apps/api/src/administration.service.ts` |
| LTAS-FR-COMMITTEE-001 | Standing committee identity and dated chair/vice/member/staff assignments; history is retained. Referrals/meetings/reports are Phase 3 | committee commands and overlap checks |
| LTAS-FR-AUDIT-001 | Business write, audit row, cursor and outbox in one transaction; audit insert failure rolls back | `apps/api/src/commands.ts`, `apps/api/src/commands.test.ts` |
| LTAS-FR-AUDIT-002 | No update/delete audit API; runtime SQL cannot UPDATE/DELETE `audit_logs`; SEC/AUD may view | `infrastructure/database/runtime-grants.sql` |
| LTAS-NFR-AVAILABILITY-001 | Unauthenticated liveness and readiness; authenticated operations probe for outbox lag | `/api/v1/health/live`, `/ready`, `/operations` |
| LTAS-NFR-SECURITY-001 / AUDIT-001 | CSRF, origin check, idempotency keys, independent grant approval, overlapping-grant denial | policy and command tests |

Phase 1 roles in software were **SYS, SEC, AUD, CS**. Phase 2 adds **LS**. The broader catalog in [06](06-USER-ROLES-AND-PERMISSIONS.md) stays proposed until D-03 signatures. See [30](30-PHASE-2-MEASURES.md).

## Implemented HTTP surface (`/api/v1`)

- `GET /auth/login`, `GET /auth/callback`, `GET /auth/session`, `POST /auth/logout`
- `GET /health/live` — process up; no session
- `GET /health/ready` — MySQL + Redis; no session; no outbox counts
- `GET /health/operations` — SYS `system.monitor`; includes `pendingOutbox`
- `GET|PATCH /admin/municipality`
- `GET /admin/roles`, `GET|POST /admin/users`, `PATCH /admin/users/:id/state`
- `GET /admin/grant-committees` — committee name and term for a CS grant request. Requires `role.assign`. It does not grant committee management.
- `GET|POST /admin/grant-requests`, `POST /admin/grant-requests/:id/approve|reject`
- `GET /admin/grants`, `POST /admin/grants/:id/revoke`
- `GET|POST /admin/terms`, `PATCH /admin/terms/:id`, `GET|POST /admin/persons`, `PATCH /admin/persons/:id`, `PUT|GET /admin/persons/:id/photo`, `GET /admin/persons/:id/profile`. Each person is encoded on one council term. The profile groups directory rows that share a display name and counts only submitted authorship. A term label and its dates can be corrected. A person's display name and position can be corrected. Committees, draft measures, and sessions cannot use a term until that term has people, and those people must belong to the same term.
- `GET|POST /committees`, `GET /committees/:id`, `POST /committees/:id/members`
- `GET /audit`
- `GET /public/home`, `GET /public/measures`, `GET /public/measures/:id`, `GET /public/council?termId`, `GET /public/persons/:id`, `GET /public/persons/:id/photo` — anonymous demonstration catalog; not an official release. The council page lists one term at a time. A person profile counts submitted records only and does not publish draft titles. Public chrome follows GWT 26 at `/home`, `/track`, `/council`, `/ordinances`, `/resolutions`, `/about`, `/contact` (ADR-23). Not libungan.gov.ph.

Mutations require a session, CSRF token, `Idempotency-Key`, expected revision where the row is mutable, and an audit reason.

## Synthetic local run

Use fictional data only. Do not point this procedure at a real municipality.

1. From `ltas/`: `node scripts/create-local-env.mjs` (refuses to overwrite an existing `.env`).
2. `docker compose -f infrastructure/docker/compose.dev.yml up -d`
   Development Compose starts MinIO on loopback `127.0.0.1:9000`. `.env` must set `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, and `MINIO_SECRET_KEY` (the generator copies them from `MINIO_ROOT_*`). Uploads return 503 only when those keys or the MinIO process are missing.
3. `npm install`
4. `npm run db:generate && npm run db:migrate && npm run build`. `db:migrate` deploys the schema as `ltas_migrator`, then applies `infrastructure/database/runtime-grants.sql` as root inside the development MySQL container. A fresh volume gets the same runtime privileges the restore rehearsal reapplies. `npm run db:grants` repeats that grant step alone.
5. `npm run db:seed` (empty database only; `ALLOW_SYNTHETIC_SEED=yes`)
6. `node --env-file=.env scripts/provision-keycloak.mjs` — writes `.local/development-accounts.json` (mode 0600). Keep it off git. The development realm uses the `ltas` Keycloak login theme mounted from `infrastructure/keycloak/themes/ltas`. That theme is visual only; identity still goes through Authorization Code + PKCE with no guest bypass.
7. `npm run worker` in one terminal; `npm run dev:api` in another; `npm run dev:web` in a third. The worker writes independent audit files under `AUDIT_EXPORT_DIR`. A delivery failure logs the error name and message. Pending, stuck, and dead audit events are retried until the same evidence is exported. A dropped database connection is logged and retried; the process stays up. `LTAS_WORKER_ONCE=yes` drains currently due events and then exits.
8. Open `http://localhost:5173`, sign in with a generated account, and confirm each seeded role. Another machine on the same private LAN can use `http://<this-host-lan-ip>:5173`. Vite listens on all interfaces; Keycloak `8081` is published for that login hop. MySQL and Redis stay on loopback. Re-run provisioning after a network change so LAN redirect URIs stay current.
9. `npm run check` for generate, typecheck, unit tests, the MySQL gate suites, and build. The MySQL suites need the local 8.4 instance from Compose. They cover access, measures, referrals, meetings, sessions, the library, and the historical ordinance image path. `npm run test:mysql` runs those suites alone. `LTAS_RESTORE_CONFIRM=ltas-restore-rehearsal npm run recovery -- rehearse` is the isolated restore rehearsal (T-NFR-RECOVERY-001); procedure in [backup README](../infrastructure/backup/README.md).

The API stays on `127.0.0.1:3000` and is reached through the Vite `/api` proxy. Compose publishes MySQL `3307` and Redis `6380` on loopback only. Keycloak `8081` is reachable on the LAN in this development compose so a remote browser can complete sign-in. MinIO starts with the development Compose for Phase 2 quarantine uploads and stays on loopback.

## Remaining Phase 1 gates

These are still required before calling Phase 1 accepted:

| Gate | Owner | Status |
|---|---|---|
| Disabled-account, revocation and negative-scope tests on **MySQL 8.4**, including concurrent grant review | Technical lead | Recorded 2026-09-21 on MySQL 8.4.11 via `npm run test:mysql` |
| Initial isolated restore rehearsal | IT | Recorded 2026-09-21 on this workstation: [REHEARSAL-2026-09-21](../infrastructure/backup/REHEARSAL-2026-09-21.md). Isolated project `ltas-restore-rehearsal` on ports 3308/6381/8082; original `mysql-data` not overwritten. ~50 s restore elapsed. Not off-host. D-06 RPO/RTO unselected. Staff SSO against isolated ports not re-bound. |
| D-03 actual role bundles and emergency access | Secretary / presiding officer / IT | Working paper [29](29-D-03-ROLE-BUNDLES.md) opened; interim not yet signed. Software uses SYS/SEC/AUD/CS/**LS** |
| D-05 hosting, domains, remote access | IT / sponsor | TBD |
| D-09 audit export destination, reviewers, lag threshold | Auditor / IT | Local directory + 3600s lag used for development only |
| D-12 supported versions/licensing | Technical lead / procurement | Images pinned in Compose; this workstation ran checks on Node 26 while `engines` requires Node 24. Formal support review TBD |
| D-16 session timeout, MFA, secret custodians | IT / privacy | 30-minute idle cookie and 8-hour max session; MFA TBD |

Do not treat this Phase 1 handoff as a ban on later phases. Phase 2 engineering is recorded in [30](30-PHASE-2-MEASURES.md). Phase 3 referrals are recorded in [31](31-PHASE-3-REFERRALS.md). Phase 3 meetings and documents are recorded in [32](32-PHASE-3-MEETINGS.md). Phase 4 sessions are recorded in [33](33-PHASE-4-SESSIONS.md). The library and report catalog are recorded in [34](34-PHASE-7-LIBRARY-REPORTS.md). The historical ordinance register is recorded in [35](35-HISTORICAL-ORDINANCES.md). The demonstration catalog is ADR-22, served at `/home`, `/track`, and `/council`. D-03/D-16 signatures remain open; they are not a claim that official numbering, IRP, or MFA were approved.

## Explicit non-goals for this phase

This file's slice is identity, municipal structure, grants, and audit. Draft measures, workflow profiles, document bytes, sessions, the library, the demonstration catalog, and the historical ordinance register belong to the later handoffs listed above. They are outside the Phase 1 acceptance gate.

Still excluded here: OpenSearch, PostgreSQL, and AI. No administrator bypass of grant separation. No production secrets in git. Software access is not public-office authority.
