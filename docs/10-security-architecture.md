# 10 — Security Architecture

## 1. Objectives

Protect LGU operational records, citizen and employee personal data, and GIS assets on a single physical server that may later face the Internet.

Priorities:

1. Least privilege
2. Strong authentication
3. Defense in depth (proxy, app, DB, files)
4. Auditability
5. Secrets out of git
6. Recoverability

---

## 2. Threat context

| Threat | Example |
|---|---|
| Insider misuse | Staff exporting the document registry |
| Credential stuffing | Shared passwords on public HTTPS |
| Path traversal / upload malware | Fake PDF in incoming scan |
| Privilege escalation | Clerk reaching Accounting |
| GIS over-exposure | Owner names on a public WMS |
| Ransomware / disk loss | Single NVMe, no backup |
| Misconfigured “temporary” Internet publish | Postgres 5432 on 0.0.0.0 |
| Supply chain | Unsigned images, random GHCR tags |

This is a government installation: assume curious insiders and occasional hostile scanning once any port is public.

---

## 3. Network controls

```text
Internet (optional)
    → 443 only to reverse proxy (or Cloudflare Tunnel)
        → web, api, selected GeoServer WMS
LAN
    → same proxy
    → QGIS to PostGIS (firewall: GIS workstation VLAN only)
    → no direct Redis/MinIO/Postgres from user desktops except GIS editors
```

**Never publish:** 5432, 6379, 9000/9001 (MinIO), 8080 GeoServer admin, 5555 Flower, Grafana without SSO, Docker API.

Host firewall (`nftables`/`ufw`) plus Docker binding to an internal bridge. Compose ports should not all map to `0.0.0.0`.

---

## 4. Identity and access

- Argon2id password hashing
- Session server-side; rotate on login and privilege change
- Lockout + CAPTCHA/delay on repeated failure
- MFA TOTP as a policy flag (recommended for admins, treasury later)
- RBAC + constraints (office, geography, sensitivity, action) — see [04-shared-core.md](04-shared-core.md)
- Separate citizen identity later
- Break-glass local admin stored offline (sealed password) for disaster recovery

Service accounts: `app_runtime`, `geoserver_reader`, `qgis_staging`, `backup` — distinct passwords/secrets.

---

## 5. Application controls

| Control | Implementation intent |
|---|---|
| Input validation | Pydantic models; reject unknown MIME |
| SQL injection | SQLAlchemy parameters only; no string-built SQL |
| XSS | React default escaping; CSP on Nginx |
| CSRF | SameSite cookie + header token for mutating routes |
| CORS | Explicit origin list; empty/disabled if same origin via proxy |
| SSRF | Do not fetch user-supplied URLs in workers without allowlist |
| Upload | Size caps, extension + magic-byte check, store outside web root, antivirus hook |
| Path safety | Generated object keys only |
| Rate limit | Proxy + app on auth and export |
| Dependency | Pinned images and lockfiles |

---

## 6. Data protection

- TLS in transit when certificates exist; on pure air-gapped LAN, still prefer internal TLS or accept risk explicitly in the deployment record
- Encryption at rest: LUKS on the data volume recommended for the physical server
- MinIO server-side encryption optional; still restrict bucket policy
- Secrets: `.env` on host with `0600`, or Docker secrets; **`.env` never committed**
- `.env.example` contains placeholders only
- Backup encryption for off-box copies

---

## 7. Sensitivity and exports

Records and layers carry `public | internal | restricted | confidential`.

Enforcement:

- Query filters
- Column redaction on export (TIN, full address, personal mobile)
- Watermark classification on PDF
- `export` permission distinct from `view`
- Audit every export and bulk download

---

## 8. GIS-specific security

- GeoServer admin not on the Internet
- `geoserver_reader` cannot write operational tables
- WFS-T off in production unless a written exception
- Public workspace contains only approved, PII-stripped layers
- Layer catalog from API, not a client-side list of all workspace layers
- QGIS credentials are not the app superuser

---

## 9. Audit

Write-only `audit.event` for:

- login / logout / lockout / password change / MFA change
- create / update / delete of operational records
- permission and role changes
- workflow definition changes and task actions
- document route, release, archive
- payment and inventory (later)
- GIS publish / unpublish
- export / report download
- settings changes

Normal roles cannot update or delete audit rows. Time sync (NTP/chrony) is mandatory so timestamps hold up.

---

## 10. Privacy (RA 10173 alignment)

Architecture supports:

- Lawful purpose specification in module notices (later UX)
- Minimization (do not collect extra ids “just in case”)
- Access control and logging
- Retention and disposition
- Privacy-aware exports
- Separate public map surfaces

The platform is not itself a DPO office. Implementers must register processing systems and contracts as required by the LGU’s privacy program.

---

## 11. Digital signatures

Extension interface only. Use a recognized certificate-based provider later. Do not ship a homemade PKI or “draw a signature image = legal sign” without a provider and policy.

---

## 12. Hardening checklist (deployment)

- Automatic security updates for the host OS (or staged)
- Unattended `docker compose pull` is **not** automatic in production; pin digests
- Disable unused Compose profiles (monitoring may be LAN-only)
- Regular `pg_dump` + MinIO sync + restore test
- Log shipping optional (Loki); logs must not contain passwords or tokens
- Incident contact list in the LGU runbook

---

## 13. Security non-goals for MVP

- Full Zero Trust mesh
- Hardware HSM (welcome later for treasury/e-sign)
- 24/7 SOC
- Public bug bounty on an unpublished LGU IP
