# 17 — Backup and disaster recovery

The municipality must approve recovery objectives and budget. **No final RPO or RTO is assumed.** RPO is the maximum acceptable loss of recent committed data; RTO is the target time to restore usable service after disruption. Recovering MySQL without its referenced document bytes is not a complete LTAS recovery.

## Options for stakeholder approval

| Candidate | Illustrative RPO / RTO target | Needed capability and tradeoff |
|---|---|---|
| Basic | Up to 24 hours / 1–2 working days | Daily coordinated off-server copies and rebuild procedure; lower cost, more manual re-entry risk |
| Balanced | Up to 1 hour / 8 hours | Daily consistent DB backup plus frequent binlog/object transfer, prepared recovery host and practiced restore |
| Enhanced | Up to 15 minutes / 4 hours | Frequent protected DB/object replication or backup transfer, reserve capacity and more operational coverage |

These are options, not promises. Effective RPO is limited by the slowest verified component and off-site transfer, not just binlog frequency. Choose based on session criticality, document sizes, available bandwidth, staffing and funding, then prove it in a timed exercise.

## Coverage and schedule proposal

| Asset | Proposed plan | Restore evidence |
|---|---|---|
| MySQL LTAS | Daily transaction-consistent full backup; binlogs transferred at frequency matching chosen RPO | Backup ID, binlog coordinates/time, checksum, schema version and integrity checks |
| MinIO | Daily version-aware backup plus incremental transfer of new immutable objects at selected RPO cadence | Inventory of bucket/key/storage-version/hash/size matching committed manifests |
| Keycloak | Consistent dedicated database backup plus realm/client/provider configuration and required key material | Recovered identities, client mappings, signing-key/secret handling and successful test login |
| Configuration | Each approved change and daily inventory of deployment/version/config artifacts | Pinned image/source manifests and nonsecret configuration checksums |
| Secrets and encryption keys | Protected recoverable copies in separately controlled storage | Authorized restore/key-access rehearsal; no secrets in ordinary backup reports |
| Audit | Daily protected backup plus independent frequent event/manifest export | Sequence continuity and independent digest verification |
| Redis | No authoritative recovery dependency; reconstruct work and invalidate sessions | Durable outbox replay without duplicate effects; fresh login |

Realm exports alone are not a substitute for the complete Keycloak recovery plan. A same-host snapshot or RAID is not an off-server backup. Keep encrypted off-server copies and a separately protected/offline or immutable copy where supported; separate backup credentials from production write identities. Encryption keys must be recoverable if the entire server is lost.

## Coordinated recovery set

Because object storage and database commits are not atomic together, publish a recoverability manifest: database checkpoint/time and schema revision, all referenced immutable object versions up to that point, audit sequence/export evidence, Keycloak/config versions and encryption-key identifiers. A candidate backup is not “verified” until referenced-object coverage is checked. If objects are missing, repair the set or mark an earlier complete recovery point; never silently present broken official links as successful recovery.

An initial backup procedure may briefly quiesce consequential writes for a coherent checkpoint while transferring immutable data in advance. Online backup plus binlog replay can reduce interruption after validation. Do not replay MySQL beyond available object coverage without explicit reconciliation. Restored but later-withdrawn public releases require a preserved withdrawal/revocation ledger or complete replay before reopening the portal.

## Proposed retention for approval

Operational backup option: 14 daily, 8 weekly and 12 monthly recovery sets, with more frequent incremental/binlog coverage sufficient for the selected replay window. This is a sizing proposal, not a statutory records schedule. Official legislative retention and legal holds are separate and may exceed backup rotation. D-07 must approve retention, geographic custody, disposal, key rotation and privacy handling. Backups containing withdrawn personal data need controlled access and a restore-time remediation procedure.

## Disaster recovery runbook

1. Incident lead declares recovery, records time/impact and isolates compromised systems if relevant. Preserve evidence; do not overwrite the only copy.
2. Select a verified recovery set and trusted build/configuration. Confirm object, audit, identity and key coverage and any later withdrawals/revocations.
3. Prepare clean isolated infrastructure and recover secrets through authorized custodians. Keep public/notification traffic disabled.
4. Restore MySQL and replay binlogs only to the agreed recoverable point. Restore MinIO objects/version mapping, Keycloak DB/configuration and independent audit evidence. Validate ownership/permissions.
5. Reconcile every authoritative document manifest or the approved full-inventory verification method, number sequences, workflow bindings, vote certifications and audit continuity. Rebuild search/projections from source.
6. Invalidate pre-incident sessions, review grants/disabled accounts and rotate compromised credentials. Restore Redis as empty where appropriate; replay outbox with dedupe, suppress already delivered or obsolete reminders.
7. Perform staff login, case lookup, certified-document hash, permissions, public-withdrawal and representative command checks. Record actual loss and restore duration.
8. Obtain incident/product-owner release authorization, reopen gradually and communicate verified limitations. Reconcile paper work captured during downtime with occurrence/recording times and review.

## Testing and accountability

IT owns execution; records officer verifies documentary completeness; identity administrator verifies account state; audit reviewer verifies evidence; product/incident lead authorizes return to service. Proposed quarterly isolated restore exercises and a production-readiness exercise are approval candidates. Test total-host loss, object corruption, accidental deletion, ransomware-compromised credentials and loss of one key custodian. Alert on missed backups and verify actual restore, not just a successful upload job.

Related: [NFRs](03-NON-FUNCTIONAL-REQUIREMENTS.md), [documents](10-DOCUMENT-MANAGEMENT.md), [deployment](16-DEPLOYMENT-ARCHITECTURE.md), [decisions](26-DECISIONS-AND-ASSUMPTIONS.md).
