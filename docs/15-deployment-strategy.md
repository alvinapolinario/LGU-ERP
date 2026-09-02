# 15 — Deployment Strategy

## 1. Target environment

| Item | Assumption |
|---|---|
| Host | Dedicated Linux server (Ubuntu LTS or RHEL-compatible) |
| CPU / RAM | ~i9 / 64 GB |
| Disk | NVMe for live data; separate disk or NAS for backups |
| Runtime | Docker Engine + Compose plugin |
| Network | Gigabit LAN; optional public IP / Cloudflare / VPN |
| Clients | Modern browsers; QGIS LTR on GIS workstations |

The system must be useful **without Internet**. Internet is for updates, email, optional public access, and optional online basemaps.

---

## 2. Deployment topologies

### A. LAN only (default MVP)

```text
Staff → http(s)://erp.lgu.local → proxy → services
QGIS → PostGIS (restricted) and GeoServer
```

Use an internal CA or mkcert-style cert for HTTPS if possible.

### B. LAN + VPN

Same as A. Remote executives use VPN, not exposed 443.

### C. LAN + reverse proxy / Cloudflare

```text
Internet → Cloudflare Tunnel or port 443 → same proxy
```

Publish only web + API + approved WMS. Tighten rate limits, MFA for admins, and WAF if using Cloudflare. GeoServer admin and DB stay dark.

Citizen hostname (later) is separate from staff hostname.

---

## 3. Environments

| Name | Purpose |
|---|---|
| `dev` | Developers, fictional data |
| `staging` | LGU-like config, restore tests, training |
| `production` | Real LGU |

Staging should be a smaller clone of production Compose, not a developer laptop unique snowflake. Production data does not refresh into dev.

---

## 4. Release process (when implementation exists)

1. Tag a version
2. Build/pull pinned images
3. Run migrations (`alembic upgrade`) as a one-shot
4. Recycle api/worker
5. Smoke: health, login, open inbox, open map catalog
6. Record version in `core.setting` or a `deployments` table

Do not auto-upgrade GeoServer and Postgres in the same unattended window as the app without a backup.

---

## 5. Configuration packs

A production install is:

1. Images + Compose
2. `.env` secrets
3. LGU seed: profile, offices, users, roles, document types, workflows, numbering
4. GIS pack: boundaries, styles, GeoServer workspace
5. TLS certs
6. Backup destination

The software image contains **no** real LGU seal, employee list, or parcels.

---

## 6. Backup and recovery

### Backup (daily minimum)

- PostgreSQL logical dump (and weekly `pg_basebackup` if adopted later)
- MinIO contents
- GeoServer data directory
- Compose file and `.env` (secrets backup stored separately/encrypted)

Off-box copy: NAS, removable disk rotated offsite, or a second building. A backup that lives only on the same NVMe is not a backup.

### Recovery

1. Install Docker + Compose on replacement or wiped host
2. Restore volumes / dump
3. Restore MinIO and GeoServer data
4. Verify checksum and login
5. Re-point DNS/local hosts

**RPO/RTO (MVP):** 24 h / 1 working day unless the LGU funds tighter.

**Rehearse** restore on staging every quarter.

---

## 7. Operations on intermittent Internet

| Action | Policy |
|---|---|
| Image pulls | Pre-pull or local registry; do not require pull to start |
| APT updates | Scheduled when online |
| Email | Queue in worker; retry; in-app still works |
| OSM tiles | Fallback to packaged local basemap |
| License/activation | None that phones home for core modules |

---

## 8. GIS operational practice

- GIS Officer uses QGIS against staging or controlled views
- Publish only through the platform job (or a documented emergency GeoServer procedure)
- Large orthophotos: copy to NVMe first, then register; do not upload 20 GB via the SPA
- Style files versioned in `gis/styles`

---

## 9. Monitoring and on-call

LAN Grafana:

- Disk > 80%
- Postgres connections
- Celery queue depth
- Proxy 5xx
- Backup job last success

Alerting can be email when online, or a wall-mounted dashboard in MIS.

---

## 10. Cutover for paperless

Do not “switch off logbooks” on day one.

1. Parallel run: register incoming in system + existing log
2. One office as pilot
3. After two weeks of matching numbers, expand
4. Keep physical receiving stamp as needed for legal comfort

GIS cutover: consultant data is inventoried, validated, then published as edition 1. Old file geodatabases become MinIO archives.

---

## 11. Kubernetes later

Move when any of these is true:

- Two-node HA required
- Separate GIS rendering farm
- Multiple LGU tenants on one control plane with isolation needs Compose cannot meet

Until then, Compose on a well-backed-up host is the supported path.

---

## 12. Implementation hold

Compose files, Dockerfiles, and deploy scripts are **not** created in this architecture drop. They are the first implementation deliverable after review. See [17-recommended-next-prompt.md](17-recommended-next-prompt.md).
