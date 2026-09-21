# T-NFR-RECOVERY-001 — synthetic isolated restore 2026-09-21

**Not production. Not an approved RPO/RTO. Not off-host backup evidence.** Fictional municipality data only.

| Field | Value |
|---|---|
| Requirement | [LTAS-NFR-RECOVERY-001](../../docs/03-NON-FUNCTIONAL-REQUIREMENTS.md) |
| Command | `LTAS_RESTORE_CONFIRM=ltas-restore-rehearsal npm run recovery -- rehearse` |
| Checkpoint | 2026-09-21T13:31:58Z |
| Restore finished | 2026-09-21T13:32:48Z |
| Isolated restore elapsed | 49914 ms (~50 s) after dump was already on disk |
| Source project / ports | `ltas-development` / MySQL 3307 (left running) |
| Isolated project / ports | `ltas-restore-rehearsal` / MySQL 3308, Redis 6381, Keycloak 8082, API 3001 |
| Isolated volume | `ltas-restore-rehearsal_restore-mysql-data` (distinct from `ltas-development_mysql-data`) |
| Git HEAD at run | `da20f01afd3964f46fcbd4f48523000cf522357a` (working tree also had uncommitted Phase 1 files) |
| `package-lock.json` SHA-256 | `8329bfe3c119a5138ea898915b3e2ac70eae9eac789ba7c0d371fc6e986c2e5e` |
| Dump SHA-256 | `661fc1b5cf22b8c6056d51a06a3c89fcba98f8aeab0053d19195c7a2bbba4e75` |
| Images | `mysql:8.4.11` `sha256:85b9bf2e29cf836ecb8c2a15a935d4ba0c606631dff1dd79531a11983c638f2a`; `redis:7.4.11-alpine` `sha256:520775a41a63e77e06c73e35d2fd9cc15921a609516818796b4ecbb813078bc7`; `quay.io/keycloak/keycloak:26.7.4` `sha256:82a77884f3af238beab1e7afd63b5f530e1b5c0590bd7aa60b40a40463e29b2c` |

The dump and audit-export copies stay under gitignored `.local/recovery/`. They are not committed.

## Reconciled counts

Source and isolated MySQL matched.

| Asset | Count |
|---|---|
| Users | 5 |
| Unrevoked grants | 5 |
| Council terms | 1 |
| People | 1 |
| Committee memberships | 1 |
| Audit logs | 2 |
| Outbox events | 2 (0 pending) |
| Audit cursor sequence / hash | `2` / `7fd5ef4f61be911f57b5787d3167c73d8b9ec12f25fa6b9dbcd6fd7e5ef62b30` |
| Keycloak schema tables | 100 |
| Keycloak `USER_ENTITY` rows | 6 |
| Independent audit JSON files | 2 (chain verified; last sequence/hash matches the cursor) |

Phase 1 has no authoritative MinIO objects.

## Checks that passed

- Application identity cannot `UPDATE` or `DELETE` `audit_logs` on the restored database.
- Application identity cannot read `keycloak.USER_ENTITY`.
- Retry of an already exported outbox event did not change the independent file; event returned to `DELIVERED`.
- A mismatched existing export file failed closed (event not marked `DELIVERED`; file not overwritten).
- Isolated Keycloak served `GET /realms/ltas-development/.well-known/openid-configuration`.
- Isolated API on `127.0.0.1:3001` returned live and ready, then was stopped.

## Explicitly not demonstrated

- Encrypted off-host copy of the dump (artifacts remain on this workstation).
- Stakeholder-selected RPO/RTO (D-06 still TBD).
- Browser sign-in as each synthetic role against the isolated ports (live development remains 5173 / 8081; isolated Keycloak was not given new redirect URIs).
- Re-run of `npm run test:mysql` against 3308 (that suite writes fixtures; it stays the original 8.4.11 access gate on 3307).

## Operator follow-up

Isolated containers were left running. There is no repository command that deletes volumes. To stop without removing data: from `ltas/`, `docker compose --env-file .env -f infrastructure/docker/compose.restore.yml --profile identity stop`.
