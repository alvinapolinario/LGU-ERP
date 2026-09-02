# 07 — GIS Architecture

## 1. Principle

Do **not** build a GIS engine. Compose a proven stack:

| Role | Component |
|---|---|
| System of record (vector + attributes) | PostgreSQL + PostGIS |
| Professional edit / analysis | QGIS Desktop |
| Publish maps and OGC services | GeoServer |
| Web visualization | OpenLayers in the admin SPA |
| Raster / large files | MinIO + GeoServer coverage stores or COG |
| Ingest / validation jobs | Celery workers (GDAL, Rasterio, GeoPandas as needed) |
| Layer governance | `gis` schema in this platform |

MapLibre may be adopted later if the LGU standardizes on vector tiles. Leaflet is limited to trivial embeds, not the primary viewer.

---

## 2. Why this split

- **QGIS** is how planning, assessor, and engineering staff already work.
- **PostGIS** is how those edits become operational data for ERP modules.
- **GeoServer** is how browsers and other systems consume stable WMS/WFS.
- **OpenLayers** is how non-GIS staff see the same truth without a desktop license.

The web app is a **consumer and governor**, not an editor that replaces QGIS for complex geometry work. Simple point drops (facility pin, incident) may be allowed in the web UI.

---

## 3. GIS data lifecycle

```text
Acquisition (survey, NAMRIA, consultant, drone, CAD)
        ↓
Upload (file to MinIO) + register dataset
        ↓
Validation job (CRS, geometry validity, required fields, bbox vs LGU)
        ↓
Staging tables / staging schema
        ↓
Review (GIS Officer)
        ↓
Approval (steward / department head)  ← workflow engine
        ↓
Promote to PostGIS operational tables
        ↓
Publish to GeoServer (workspace, store, layer, style)
        ↓
Web GIS + optional public WMS (PII-stripped views only)
```

Unapproved consultant geodatabases never become live layers.

---

## 4. Layer registry

`gis.layer` is the catalog the rest of the platform trusts.

| Attribute | Purpose |
|---|---|
| code, title, abstract | Metadata |
| category | admin, facility, hazard, landuse, infra, cadastre, environment, other |
| geometry type | point / line / polygon / raster / mixed |
| source | upload, qgis-edit, national, derived |
| srid | Default **3123 or 32651** configurable; store in a project CRS, transform on view if needed |
| owning_office_id | Steward |
| sensitivity | Blocks public publish if not `public` |
| status | draft / staging / approved / published / retired |
| geoserver_layer_name | Set only after publish |
| style_ref | SLD / QML reference in repo or MinIO |
| attribution / license | Required for third-party data |
| as_of_date | Temporal honesty |

Related: `gis.dataset` (files), `gis.publish_run` (job log), `gis.style`.

---

## 5. Spatial tables vs generic geometry dump

Avoid a single `gis.features` bag for all business objects.

**Preferred:**

- Administrative: `reference` / `gis` barangay, municipality boundary
- Facilities: `core.facility` + geometry or `gis.facility`
- Hazards: `cdra.hazard_zone` (Phase 5) — in MVP, `gis.hazard_zone` with configurable `hazard_type_id`
- Later parcels, roads, zoning live in their domain schemas with geometry columns

**Registry** points at the table/view to publish.

**Public views** strip owner names, contact numbers, tax values, and case identifiers.

---

## 6. Coordinate reference system

Philippine LGU practice often mixes:

- WGS84 (EPSG:4326) — GPS, web
- Web Mercator (EPSG:3857) — tiles
- PRS92 / Luzon 1911 variants, UTM 51N (EPSG:32651), local cadastral grids

**Policy:**

1. LGU sets `default_srid` in Core settings.
2. Ingest **always records source CRS** and transforms into the operational SRID.
3. The web viewer displays in Web Mercator / WGS84 as required by OpenLayers.
4. Cadastral data that must not be lightly transformed is flagged `crs_locked` and handled by GIS staff in QGIS.

Do not silently assume 4326 for assessor lots.

---

## 7. GeoServer posture

- Deployed on the Compose network; **admin UI LAN-only** (or SSO later).
- Workspaces: `lgu_internal`, `lgu_public` (strict).
- Stores: JNDI/JDBC to PostGIS with a **restricted DB role** (`geoserver_reader`) that can `SELECT` only publish views.
- WFS-T: **off** by default. If enabled, only for a dedicated staging workspace and GIS roles.
- Security: do not expose `/geoserver/web` to the Internet. Public maps use tightly scoped layer endpoints or tiles proxied by Nginx.
- Styles: keep SLD in `gis/styles` and apply during publish job for repeatability.

QGIS Server is a later evaluation when an LGU’s print layout / QGIS project must be published faithfully. It is not the MVP publisher.

---

## 8. QGIS operating model

Supported patterns:

1. **Direct PostGIS** with a `qgis_editor` role on staging tables only.
2. Operational tables editable only by GIS Officer role.
3. Project files (`.qgz`) stored in `gis/qgis` or MinIO; they are artifacts, not the system of record.

Authentication: database users mapped from platform policy, or a small pool of GIS technical accounts under MIS control. Do not share the Postgres superuser with planners.

---

## 9. Web map viewer (MVP)

OpenLayers application module inside the admin SPA:

- Layer switcher driven by **layer registry** (not hardcoded layer names)
- Default extent from LGU profile
- Identify (WMS GetFeatureInfo or WFS)
- Measure length/area
- Search barangay / facility
- Print to PDF (simple)
- Basemap: local first, OSM if online
- No editing of cadastral polygons in v1

RBAC: layer visibility is filtered by sensitivity and office. The API returns the layer catalog per user; the client does not receive unpublished or unauthorized layer names.

---

## 10. Rasters and large datasets

- Store GeoTIFF / COG in MinIO.
- Publish via GeoServer coverage store or as COG if/when adopted.
- Orthophotos stay out of PostgreSQL TOAST.
- Worker validates size, CRS, overviews.
- Disk budget is a first-class operational concern on a single NVMe box — see [16-risk-register.md](16-risk-register.md).

---

## 11. CDRA / CLUP / zoning relationship

GIS provides **overlay capability**; planning modules provide **meaning**.

```text
Proposed development (CLUP)
    + hazard (CDRA)
    + exposure
    + environmental constraints
    = conflict warning (not a legal decision)
```

MVP: publish hazard and admin layers and support visual overlay + simple spatial filter (“barangays intersecting this hazard”).

Phase 5: persisted overlay results, vulnerability tables, and structured warnings when a project or zoning change intersects a high-risk zone.

The platform **must not** auto-approve or auto-deny locational clearance.

---

## 12. Privacy on maps

Forbidden on any `lgu_public` layer:

- Resident names, signatures, photos of persons
- Contact numbers, exact household occupant lists
- Tax declaration personal details
- Health, case, or incident personal identities
- Employee home addresses

Allowed internally with RBAC: parcel owner queries in Assessor, incident PII in DRRMO.

---

## 13. Integration with ERP

| ERP object | Spatial link |
|---|---|
| Barangay | Polygon |
| Facility / evacuation center | Point/polygon |
| Business (BPLO) | Point (later) |
| Parcel | Polygon |
| Project / infrastructure | Point/line/polygon |
| Asset (vehicle yard, building) | Point optional |
| Farm | Polygon optional |

Store `geometry` or `location_id` on the business row; register a layer that reads a view.

---

## 14. Sample data policy

`gis/sample-data` may contain **non-real**, generalized, or openly licensed extracts for development. Production LGU data never belongs in git.

---

## 15. Non-goals

- Recreate QGIS editing, geoprocessing, or print composer
- Recreate PostGIS
- A custom WebGL engine
- Real-time GPS fleet tracking in MVP
- Hosting all of NAMRIA nationally
