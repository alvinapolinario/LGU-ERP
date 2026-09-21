# 22 — Risk register

Ratings are qualitative planning judgments, not measured probabilities. H = high, M = medium, L = low. Owners are proposed roles pending actual assignment. Review at each phase gate and whenever a rule, scope or hosting decision changes.

| ID | Risk / likelihood / impact | Trigger or indicator | Mitigation and contingency | Owner / gate |
|---|---|---|---|---|
| R-01 | Incorrect legal-rule automation / H / H | Unreviewed universal path, timer changes official status | Approved profiles and human confirmation; stop affected transition and record reviewed correction | Legal reviewer + Secretary / P0, P6 |
| R-02 | Role confused with legal authority / H / H | SYS can certify; inactive member can vote | Scoped term/assignment checks, separation and explicit authority; revoke and investigate improper grants | Secretary + IT / P1, P5 |
| R-03 | Certified evidence overwritten / M / H | Mutable object keys or vote updates after closure | Immutable manifests, restricted writes and supersessions; recover originals from protected copy | Records officer / P2, P5 |
| R-04 | Private data published / M / H | Portal reads internal tables; hidden PDF metadata | Reviewed snapshots, independent release, derivative inspection; withdraw, preserve evidence and follow incident procedure | Privacy + release officer / P9 |
| R-05 | Deadline or quorum arithmetic wrong / H / H | Ambiguous receipt, membership, denominator or calendar | Pinned inputs/formulas, fixtures and confirmation; flag unresolved results rather than infer | Legal + presiding officer / P4–6 |
| R-06 | Single server/power/network failure / M / H | No off-host verified copy or recovery host | Approved RPO/RTO option, power/network planning, paper fallback and restore drill | IT + sponsor / P10 |
| R-07 | Database restored without files/identity / M / H | Broken document links after recovery | Coordinated recovery manifest, hash inventory and login test; fall back to latest complete set | IT + records officer / P2 onward |
| R-08 | Poor historical data / H / M | Missing dates, duplicate references, unreadable scans | Staged import, provenance/unknown flags and reconciliation; keep disputed rows pending | Records officer / P7 |
| R-09 | Scope overload for small team / H / H | Microservices, visual workflow platform or AI added early | Phase gates and explicit MVP; defer nonessential integrations and advanced features | Product lead / every gate |
| R-10 | Unsupported technology / M / H | Unpinned versions, edition/license assumptions | Compatibility/support/license review for MySQL/Prisma/Keycloak/MinIO and all images; retain stack but escalate incompatibility before procurement | Technical lead / P1 |
| R-11 | Insider audit tampering / M / H | Same administrator controls records and all evidence | Restricted DB grants, independent exports and verification; preserve incident copy externally | Auditor + IT / P1 onward |
| R-12 | Malware or unsafe extraction / M / H | Scanner outage treated as clean | Quarantine/fail closed, sandbox parsers; manual reviewed intake without online release | IT / P2 |
| R-13 | Lost encryption/identity keys / M / H | Backup exists but cannot decrypt/login | Separate custodians and rehearsed key recovery; controlled credential rotation | IT + sponsor / P10 |
| R-14 | Slow search/reporting / M / M | Broad unindexed joins, scanned content assumed searchable | Capacity fixtures, metadata fallback, indexed filters and bounded jobs; defer search-engine extraction until justified | Technical lead / P7–8 |
| R-15 | Staff rejection or bypass / M / H | Paper records and system diverge | Co-design forms, training, clear authority and downtime reconciliation; phased pilot with records checks | Secretary / P3–10 |
| R-16 | Misleading analytics / M / M | Ranked members, duplicated joins, incomplete denominator | Metric definitions, neutral counts, cohort/completeness labels; withdraw flawed report version | Product + reports owner / P8 |
| R-17 | Queue duplicates or stale reminders / M / M | Email retries generate multiple actions | Outbox, idempotent consumers and current-revision checks; reconcile delivery logs | Technical lead / P2 onward |
| R-18 | Withdrawal lost during restore/cache / M / H | Old public release reappears | Release-version checks, revocation replay and portal reopening gate | IT + release officer / P9–10 |
| R-19 | Retention conflicts with privacy/records duties / M / H | Generic delete or indefinite retention without authority | Approved schedules and holds; disposition review separate from ordinary CRUD | Records + privacy/legal / P7 |
| R-20 | AI alters authoritative record or leaks data / M / H | AI tool has write credentials or unscoped retrieval | Read-only isolated interface, evaluation and human commands; disable AI independently | Future AI owner / future phase |

Residual risks must be accepted by accountable municipal owners with rationale, expiry/review date and compensating controls. A developer cannot accept a legal/disclosure risk merely to meet a delivery date. Related: [decisions](26-DECISIONS-AND-ASSUMPTIONS.md), [roadmap](19-DEVELOPMENT-ROADMAP.md).
