# Phase 1 recovery rehearsal

Use only fictional data until the deployment and policy gates in [Phase 1 handoff](../../docs/28-PHASE-1-FOUNDATION.md) are accepted. The local export folder is not independently administered off-host storage. This repository contains no command that deletes recovery or original volumes.

Requirements: [LTAS-NFR-RECOVERY-001](../../docs/03-NON-FUNCTIONAL-REQUIREMENTS.md). Test: T-NFR-RECOVERY-001.

## Operator commands

From `ltas/`, with the development Compose project already running and the host API/worker **stopped** (leave MySQL running):

1. `npm run build -w @ltas/api` so `dist/worker.js` and `dist/main.js` exist.
2. `npm run recovery -- checkpoint` — dumps `ltas` and `keycloak` inside the MySQL container via `MYSQL_PWD`, copies audit exports, and writes a manifest under `.local/recovery/` (gitignored).
3. `LTAS_RESTORE_CONFIRM=ltas-restore-rehearsal npm run recovery -- restore` — starts [compose.restore.yml](../docker/compose.restore.yml) on loopback ports **3308 / 6381 / 8082**, restores into volume `restore-mysql-data`, reapplies [runtime grants](../database/runtime-grants.sql), and reconciles counts. Combined: `LTAS_RESTORE_CONFIRM=ltas-restore-rehearsal npm run recovery -- rehearse`.

The restore script refuses to run unless `LTAS_RESTORE_CONFIRM=ltas-restore-rehearsal`. It will not import onto port 3307 or volume `mysql-data`.

Redacted evidence from the 2026-09-21 synthetic run: [REHEARSAL-2026-09-21.md](REHEARSAL-2026-09-21.md).

## Backup set

1. Stop the host API and worker to quiesce municipal writes; prevent staff login during the checkpoint. Record UTC time, source revision, lockfile checksum and image IDs. Do not stop MySQL before dumping it.
2. With a dedicated backup identity on an approved installation, take a transaction-consistent dump of both `ltas` and `keycloak`. For this synthetic setup, an operator may use the generated local root secret with `MYSQL_PWD` inside the MySQL container; never put a password in the command line or commit the dump. Use `mysqldump --single-transaction --routines --events --triggers --databases ltas keycloak`.
3. Preserve `.env` separately under encrypted, access-controlled custody. It contains identity client, session and service secrets. Preserve Keycloak configuration and recorded image versions. No real passwords belong in a recovery report.
4. Copy audit exports without modifying originals. Record each municipality's `audit_cursors.sequence` and `hash` in the checkpoint manifest and independently retain that manifest. Run `node scripts/verify-audit.mjs <copy-directory>` and compare its last sequence/hash to the checkpoint. An export backlog means the evidence set is incomplete.
5. Phase 1 has no document intake; Phase 2 quarantine objects exist only if the `object-storage` profile was used. Inventory/copy MinIO separately. A MySQL dump without that object inventory is not a complete recovery set once any upload intent exists.
6. Compute SHA-256 for every backup artifact, transfer an encrypted copy off the application host, verify checksums there, and retain key-recovery instructions separately. Record duration and actual checkpoint, then restart the original API and worker.

## Isolated restore

1. Use a separate computer or isolated Docker project with new volume names and different loopback ports. Never import over the original development volumes. Confirm target host, project, ports, empty databases and volume names before proceeding.
2. Recover the same MySQL/Keycloak versions and secrets. Restore the dump using the migration/restore identity, recreate service accounts through the init procedure, and reapply [runtime grants](../database/runtime-grants.sql). The application identity must not run schema restoration.
3. Restore independently retained audit files and compare every chain to the trusted checkpoint. Check counts of users, grants, terms, people and committee memberships; verify revision numbers and the hash cursor.
4. Start Redis empty: prior sessions must not survive. Reconcile disabled accounts and revocations recorded after the checkpoint before allowing access. Reset local secrets if compromised; reconfigure Keycloak host and exact redirect URLs only for the isolated installation.
5. Start the restored worker. Retry an already exported outbox event and verify no second logical export/receipt. A mismatched existing file must fail closed. Start the API and web; sign in as each synthetic role.
6. Prove scoped committee access, account disablement on the next protected request, separation of reviewers, fresh login, and audit-denied update/delete using the application database identity. Confirm no identity-database access from that identity.
7. Record elapsed restore time, checkpoint/data loss, commands, redacted outputs and defects in the acceptance checklist. A successful dump is not evidence of a successful restore. RPO/RTO remain municipal decisions.

Do not automate cleanup of recovery or original volumes until the operator identifies the exact disposable target.
