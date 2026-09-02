# CURSOR MASTER PROMPT

## Integrated LGU ERP, Paperless Operations, GIS, CDRA and CLUP Platform

You are acting as a **Senior Enterprise Architect, Philippine LGU Information Systems Consultant, GIS Solutions Architect, Software Architect, Database Architect, DevOps Engineer, and Digital Government Transformation Consultant**.

We are designing a modular, production-ready platform for Philippine Local Government Units.

The target solution is:

# Integrated LGU Digital Government Platform

### ERP + Paperless Operations + GIS + CDRA + CLUP + Executive Decision Support

The platform must support the digital transformation of municipal and city government operations through:

* Paperless document workflows
* Records management
* Finance and administrative ERP
* HRIS
* Procurement
* Inventory and asset management
* Treasury and collection
* Business permitting
* Engineering and project monitoring
* Property and assessor functions
* GIS
* CDRA
* CLUP
* Zoning
* Disaster risk management
* Executive analytics
* Citizen services

The system must be designed as a **modular LGU ERP platform**, not as a single monolithic application.

Modules must be deployable gradually.

---

# 1. CORE PRODUCT VISION

The system should become a reusable digital government platform that can be deployed across multiple Philippine LGUs.

The software must NOT hard-code:

* LGU name
* logo
* municipal boundaries
* barangays
* departments
* offices
* approval workflows
* fund types
* document types
* hazard classifications
* zoning categories
* land-use classes
* employee structure

All these must be configurable.

The platform should support:

```text
LGU Administration
        +
Paperless Operations
        +
ERP
        +
GIS
        +
CDRA / CLUP
        +
Citizen Services
        +
Executive Decision Support
```

---

# 2. TARGET DEPLOYMENT ENVIRONMENT

Initial deployment target:

* Dedicated physical server
* Intel Core i9
* 64 GB RAM
* Linux
* Docker Engine
* Docker Compose
* SSD/NVMe storage
* Gigabit LAN
* Optional public Internet access
* Optional VPN
* Optional reverse proxy / Cloudflare

The system must work even if Internet connectivity is intermittent.

Core LGU functionality should operate on the local network.

Do not require Kubernetes for MVP.

Design the system so it may migrate to Kubernetes later if needed.

---

# 3. PRIMARY TECHNOLOGY STACK

Preferred stack:

## Frontend

React + TypeScript + Vite

Use:

* responsive administrative UI
* reusable components
* feature-based architecture
* strong typing
* modern routing
* centralized API access
* accessibility

GIS map rendering:

OpenLayers preferred.

MapLibre GL JS may be considered for vector tiles.

Leaflet may be used only for simpler map use cases.

---

## Backend

Preferred:

FastAPI + Python

Use:

* SQLAlchemy
* Alembic
* Pydantic
* GeoAlchemy2
* structured logging
* modular service layers
* dependency injection

GIS libraries may include:

* GDAL
* GeoPandas
* Rasterio
* Shapely
* PyProj

---

## Database

PostgreSQL + PostGIS

PostgreSQL will be the primary transactional database.

PostGIS will provide the spatial intelligence layer.

---

## GIS Stack

QGIS Desktop for professional GIS editing and analysis.

GeoServer preferred initially for publishing GIS layers.

QGIS Server may be evaluated when exact QGIS project publishing becomes operationally useful.

Do NOT create a GIS engine from scratch.

---

## Cache / Queue

Redis

Use for:

* caching
* session coordination
* background job coordination
* distributed locks

---

## Background Jobs

Celery or equivalent Python task worker.

Use for:

* GIS processing
* report generation
* bulk imports
* email notifications
* document conversions
* scheduled jobs
* backups
* data synchronization

---

## Object Storage

MinIO

Use for:

* uploaded documents
* scanned files
* GIS raster datasets
* orthophotos
* attachments
* generated reports
* map exports
* archival files

---

## Reverse Proxy

Nginx or Traefik

---

## Monitoring

Prometheus + Grafana

Optional:

Loki for logs.

---

# 4. SYSTEM ARCHITECTURE PRINCIPLE

The application must be modular.

Do NOT build one tightly coupled giant codebase.

Use a modular monolith initially, with clear domain boundaries and the option to extract services later.

Suggested major domains:

```text
Core Platform
Identity
Workflow
Documents
Records
Finance
Budget
Accounting
Treasury
Procurement
Inventory
Assets
HR
Payroll
BPLO
Assessor
Engineering
Projects
GIS
CDRA
CLUP
Zoning
DRRMO
Agriculture
Environment
Citizen Services
Reporting
Analytics
Audit
Notifications
Integrations
```

---

# 5. SHARED CORE PLATFORM

The shared ERP core must include:

## Authentication

* login
* logout
* password reset
* optional MFA
* user session management

## RBAC

Support access by:

* role
* department
* office
* module
* record type
* action
* geographic area
* sensitivity level

## Organization Structure

Support:

* LGU
* departments
* offices
* sections
* positions
* employees

## Master Data

Centralized reusable entities:

* departments
* employees
* suppliers
* citizens
* businesses
* barangays
* properties
* facilities
* projects
* programs
* funds
* accounts
* items
* assets

---

# 6. PAPERLESS OPERATIONS

Paperless operation is a CORE feature, not a side module.

Implement a configurable Workflow and Document Management Engine.

The system must support:

* electronic routing
* approvals
* digital forms
* comments
* endorsements
* return/revision
* rejection
* document attachments
* routing history
* audit trail
* notifications
* document status
* reference numbers

Example:

```text
Incoming Document
        ↓
Records Office
        ↓
Scan / Upload
        ↓
Document Registration
        ↓
Routing
        ↓
Office Review
        ↓
Approval
        ↓
Signature
        ↓
Release
        ↓
Archive
```

---

# 7. WORKFLOW ENGINE

Do NOT hard-code approval paths.

The workflow engine must allow configuration of:

* workflow name
* trigger
* steps
* reviewers
* approvers
* conditions
* escalation
* deadlines
* return paths
* rejection paths
* delegation
* final action

Example workflow:

```text
Purchase Request

Requesting Office
        ↓
Department Head
        ↓
Budget
        ↓
Accounting
        ↓
Procurement
        ↓
Approving Authority
```

Another LGU may use a different workflow.

The system must support configuration without code changes.

---

# 8. DOCUMENT MANAGEMENT SYSTEM

Support:

* incoming documents
* outgoing documents
* internal memoranda
* office orders
* executive orders
* resolutions
* requests
* correspondence
* contracts
* reports
* scanned documents
* attachments

Each document must support:

* document number
* subject
* type
* sender
* recipient
* office
* confidentiality
* status
* timestamps
* version
* attachments
* routing history
* retention metadata

---

# 9. RECORDS MANAGEMENT

Support:

* document classification
* retention schedules
* archival status
* disposition
* document registry
* search
* indexing
* metadata
* physical archive reference if applicable

Future integration may include:

* OCR
* barcode
* QR code
* digital signatures

---

# 10. FINANCE ERP

Design modules for:

## Budget Management

Support:

* annual budgets
* departments
* funds
* appropriations
* obligations
* allotments
* utilization
* balances
* programs
* projects
* activities

## Accounting

Support:

* chart of accounts
* journal entries
* vouchers
* ledgers
* financial transactions
* reports

## Treasury

Support:

* collections
* official receipts
* payment records
* cashier transactions
* deposits
* collection reports

Do not assume all Philippine government accounting rules at first.

Design the architecture to support applicable government accounting configuration.

---

# 11. PROCUREMENT MODULE

Support:

* purchase requests
* purchase orders
* procurement plans
* suppliers
* quotations
* canvass
* BAC-related documentation
* procurement status
* award records
* contract tracking

Future integrations:

* PhilGEPS references
* annual procurement plan
* bid monitoring

---

# 12. INVENTORY AND WAREHOUSING

Support:

* item master
* stock receiving
* stock issuance
* warehouse locations
* transfers
* reorder levels
* returns
* disposal
* serial numbers
* batch numbers
* expiration
* barcode
* inventory reports

---

# 13. ASSET MANAGEMENT

Support:

* equipment
* vehicles
* furniture
* buildings
* IT assets
* ownership
* assignment
* acquisition
* depreciation metadata
* maintenance
* repair
* disposal
* asset history

Optionally connect physical assets to GIS locations.

---

# 14. HRIS

Support:

* employee records
* position
* plantilla reference
* department
* employment status
* attendance
* leave
* training
* service history
* evaluations
* documents
* benefits metadata

---

# 15. PAYROLL

Payroll should be a separate sub-domain.

Support future implementation of:

* salary
* allowances
* deductions
* loans
* contributions
* withholding
* payroll periods
* payroll approval
* payslips

Do not implement full payroll calculation during architecture phase.

---

# 16. BPLO

Business Permits and Licensing Office module.

Support:

* business registration
* permit applications
* renewals
* requirements
* inspections
* assessment
* payment status
* permit issuance
* business registry

GIS integration:

Business locations must be mappable.

Future zoning validation may be supported.

---

# 17. ASSESSOR / PROPERTY

Support:

* property records
* parcels
* lot identifiers
* property classification
* land area
* improvement information
* ownership records
* tax-map references

Integrate parcels with PostGIS.

Do not attempt to replicate all tax-assessment rules initially.

---

# 18. ENGINEERING

Support:

* infrastructure registry
* building projects
* roads
* bridges
* drainage
* public works
* inspections
* project documents
* project locations
* progress tracking

GIS integration is required.

---

# 19. PROJECT MONITORING

Support:

* projects
* contractors
* budget
* timelines
* milestones
* progress percentage
* photographs
* inspection reports
* delays
* status

Projects should optionally contain geographic geometry.

---

# 20. GIS PLATFORM

Use:

PostgreSQL + PostGIS
GeoServer
QGIS Desktop
OpenLayers

GIS modules should support:

* layer management
* metadata
* vector data
* raster data
* spatial search
* map viewer
* feature identification
* measurement
* printing
* thematic maps

---

# 21. CDRA

Climate and Disaster Risk Assessment module.

Support:

* hazards
* exposure
* vulnerability
* risk analysis
* affected population
* affected infrastructure
* affected agriculture
* critical facilities
* barangay risk profiles

Hazard types must be configurable.

---

# 22. CLUP

Comprehensive Land Use Plan module.

Support:

* existing land use
* proposed land use
* zoning
* settlement areas
* production areas
* protection areas
* infrastructure
* growth areas
* development constraints

---

# 23. CDRA + CLUP INTEGRATION

Support spatial overlays such as:

```text
Proposed Development
        +
Hazard Layers
        +
Exposure
        +
Environmental Constraints
        =
Planning Decision Support
```

The system should warn users of conflicts.

Do NOT automatically make legal planning decisions.

---

# 24. ZONING

Support:

* zoning classifications
* zoning maps
* zoning boundaries
* permitted-use metadata
* overlays
* zoning history

Future use:

* locational clearance
* development permit validation

---

# 25. DRRMO MODULE

Support:

* hazards
* incidents
* evacuation centers
* emergency assets
* critical infrastructure
* preparedness
* disaster datasets

Future capabilities:

* incident command support
* evacuation allocation
* route planning
* disaster dashboard

---

# 26. AGRICULTURE

Support:

* farm locations
* crops
* agricultural zones
* irrigation
* livestock
* agricultural facilities
* disaster exposure

Integrate with GIS.

---

# 27. ENVIRONMENT

Support:

* watersheds
* protected areas
* forest areas
* coastal zones
* waterways
* environmental monitoring

Integrate with GIS.

---

# 28. CITIZEN SERVICES

Create a future citizen portal.

Support:

* requests
* applications
* complaints
* issue tracking
* status checking
* notifications
* document release

Do not require the citizen portal for MVP.

---

# 29. EXECUTIVE DASHBOARD

Create a decision-support dashboard for:

* Mayor
* Administrator
* Department Heads
* Planning
* Finance

Possible indicators:

* budget utilization
* collections
* procurement
* projects
* workforce
* document turnaround
* business permits
* assets
* inventory
* infrastructure
* hazards
* CDRA
* land use
* citizen requests

---

# 30. CROSS-MODULE INTEGRATION

Modules must share data where appropriate.

Examples:

```text
HRIS → Payroll
Procurement → Inventory
Procurement → Assets
Budget → Procurement
Accounting → Treasury
BPLO → Treasury
Assessor → GIS
Engineering → GIS
Projects → GIS
CDRA → CLUP
Documents → Every Module
Workflow → Every Module
Audit → Every Module
```

Avoid duplicate master data.

---

# 31. EVENT-DRIVEN EXTENSION

Design extension points for internal events.

Examples:

```text
purchase_request.approved
document.received
permit.approved
payment.received
asset.created
project.updated
hazard_layer.published
```

Do not introduce Kafka immediately.

For MVP, internal event handling may use application-level events and Redis.

Design so a message broker can be added later.

---

# 32. NOTIFICATION SERVICE

Support:

* in-app notifications
* email
* SMS integration later
* messaging gateways later

Example notifications:

* document assigned
* approval required
* permit approved
* purchase request returned
* report ready
* project delayed

---

# 33. DIGITAL SIGNATURE ARCHITECTURE

Design extension points for digital signatures.

Support future:

* document signing
* certificate-based signing
* signing logs
* verification

Do not create a custom cryptographic signing protocol.

---

# 34. REPORTING PLATFORM

Provide centralized reporting.

Output formats:

* PDF
* XLSX
* CSV

Reports must respect user permissions.

Consider a reusable reporting service.

---

# 35. SEARCH

Implement centralized search.

Potential searchable entities:

* documents
* employees
* suppliers
* citizens
* businesses
* properties
* projects
* assets
* facilities
* GIS locations

Start with PostgreSQL search.

Evaluate OpenSearch only when justified.

---

# 36. AUDIT TRAIL

Audit events should include:

* login
* logout
* creation
* update
* deletion
* approval
* rejection
* document routing
* payment
* inventory movement
* permission changes
* workflow changes
* GIS publishing

Audit logs should not be editable by normal users.

---

# 37. DATABASE DESIGN

Use PostgreSQL schemas to enforce domain separation.

Suggested structure:

```text
core
auth
workflow
documents
records
finance
budget
accounting
treasury
procurement
inventory
assets
hr
payroll
bplo
assessor
engineering
projects
gis
cdra
clup
zoning
drrmo
agriculture
environment
citizen
notifications
audit
reference
integration
```

Review whether all schemas are necessary.

Avoid unnecessary complexity.

---

# 38. SHARED ENTITY IDENTIFIERS

Design stable identifiers.

Prefer UUIDs for primary keys where appropriate.

Do not expose auto-increment IDs as the only external identifier.

Support business identifiers such as:

* document numbers
* employee numbers
* PR numbers
* PO numbers
* permit numbers
* asset codes
* project codes

---

# 39. API STRUCTURE

Initial conceptual API structure:

```text
/api/v1/auth
/api/v1/users
/api/v1/roles
/api/v1/departments

/api/v1/workflows
/api/v1/documents
/api/v1/records

/api/v1/budget
/api/v1/accounting
/api/v1/treasury
/api/v1/procurement
/api/v1/inventory
/api/v1/assets

/api/v1/hr
/api/v1/payroll

/api/v1/bplo
/api/v1/properties
/api/v1/engineering
/api/v1/projects

/api/v1/gis
/api/v1/cdra
/api/v1/clup
/api/v1/zoning

/api/v1/reports
/api/v1/dashboard
/api/v1/notifications
```

Do not implement all endpoints immediately.

---

# 40. DOCKER ARCHITECTURE

Target services:

```text
reverse-proxy
web
api
worker
scheduler
postgres-postgis
redis
minio
geoserver
monitoring
backup
```

Optional later:

```text
opensearch
mail-service
ocr-service
document-converter
message-broker
```

Do not add optional services until needed.

---

# 41. SECURITY ARCHITECTURE

Implement:

* HTTPS
* RBAC
* least privilege
* department access
* secure password hashing
* MFA extension
* rate limiting
* CORS restrictions
* input validation
* secure file uploads
* SQL injection protection
* CSRF protection where applicable
* audit logging
* secret management
* backup
* recovery

Production credentials must not be committed to Git.

---

# 42. PHILIPPINE PRIVACY REQUIREMENTS

Design the architecture with data privacy in mind.

Classify data by sensitivity.

Examples:

* public
* internal
* restricted
* confidential

Support:

* access control
* logging
* retention
* privacy-aware exports
* minimization

Do not expose citizen personal data through GIS public maps.

---

# 43. DOCUMENT LIFECYCLE

Suggested lifecycle:

```text
Draft
↓
Submitted
↓
Received
↓
Assigned
↓
Under Review
↓
For Approval
↓
Approved
↓
Released
↓
Archived
```

Allow configurable workflow states.

---

# 44. GIS DATA LIFECYCLE

```text
Acquisition
↓
Upload
↓
Validation
↓
Staging
↓
Review
↓
Approval
↓
PostGIS
↓
GeoServer
↓
Web GIS
```

---

# 45. MASTER DATA GOVERNANCE

Master records must support:

* owner
* source
* status
* active/inactive
* effective dates
* history

Avoid uncontrolled duplication.

---

# 46. MVP DEFINITION

MVP should NOT attempt to implement every ERP module.

Recommended MVP:

## Core

* Authentication
* RBAC
* departments
* offices
* employees
* audit

## Paperless

* document registry
* document upload
* routing
* workflow engine
* approvals
* notifications
* search
* document tracking

## GIS

* PostGIS
* GeoServer
* map viewer
* barangays
* facilities
* hazard layers
* layer registry

## Executive

* basic dashboard

## Infrastructure

* Docker deployment
* backup
* logging
* monitoring

This MVP should become the foundation for every later module.

---

# 47. PHASE 2

Implement:

* procurement
* inventory
* assets
* projects
* engineering

---

# 48. PHASE 3

Implement:

* budget
* accounting
* treasury

---

# 49. PHASE 4

Implement:

* HRIS
* attendance
* leave
* payroll

---

# 50. PHASE 5

Implement:

* CDRA
* CLUP
* zoning
* DRRMO

---

# 51. PHASE 6

Implement:

* BPLO
* assessor
* property
* collection integration

---

# 52. PHASE 7

Implement:

* citizen portal
* external integrations
* digital signatures
* advanced analytics

---

# 53. PHASE 8

Implement:

* executive intelligence
* forecasting
* predictive analytics
* AI-assisted search
* decision-support recommendations

AI must NOT make final government decisions automatically.

---

# 54. REPOSITORY STRUCTURE

Design the initial monorepo approximately like:

```text
lgu-digital-platform/
│
├── apps/
│   ├── web/
│   └── api/
│
├── domains/
│   ├── core/
│   ├── workflow/
│   ├── documents/
│   ├── procurement/
│   ├── inventory/
│   ├── assets/
│   ├── finance/
│   ├── hr/
│   ├── projects/
│   ├── gis/
│   ├── cdra/
│   └── clup/
│
├── services/
│   ├── worker/
│   ├── scheduler/
│   ├── reporting/
│   └── notifications/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   ├── postgres/
│   ├── geoserver/
│   ├── minio/
│   ├── redis/
│   └── monitoring/
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schemas/
│
├── gis/
│   ├── qgis/
│   ├── styles/
│   └── sample-data/
│
├── docs/
│   ├── architecture/
│   ├── requirements/
│   ├── workflows/
│   ├── database/
│   ├── security/
│   ├── gis/
│   └── deployment/
│
├── scripts/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── README.md
```

Improve this structure if necessary.

---

# 55. DESIGN PRINCIPLES

The system must follow:

* modular architecture
* API-first
* configurable workflows
* shared master data
* strong audit trail
* least privilege
* domain separation
* offline/local-first deployment capability
* government-grade data governance
* reusable LGU configuration
* scalable GIS architecture
* maintainability

---

# 56. NON-GOALS

Do NOT:

* build every module at once
* recreate QGIS
* recreate PostGIS
* build a custom GIS rendering engine
* implement custom cryptography
* hard-code approval chains
* hard-code LGU names
* duplicate master data
* introduce microservices prematurely
* introduce Kafka prematurely
* introduce Kubernetes prematurely
* expose PostgreSQL publicly
* expose GeoServer administration publicly
* rely on proprietary cloud services for core operation

---

# 57. IMPORTANT CURSOR RULE

Do NOT start implementation immediately.

The first response must focus ONLY on architecture, planning, scope, and documentation.

Do not generate application code.

Do not generate frontend components.

Do not generate migrations.

Do not generate Docker Compose yet.

---

# 58. FIRST REQUIRED OUTPUT

Analyze this specification and produce:

1. Executive system concept
2. Proposed architecture
3. Domain/module map
4. Technology decision matrix
5. Shared-core architecture
6. Workflow-engine design
7. Document-management architecture
8. GIS architecture
9. PostgreSQL/PostGIS schema strategy
10. API strategy
11. Docker architecture
12. Security architecture
13. Data governance model
14. MVP scope
15. Phase roadmap
16. Repository structure
17. Key technical risks
18. Assumptions
19. Recommended product boundaries
20. Recommended next Cursor prompt

---

# 59. DOCUMENTS TO CREATE

Create or propose these files:

```text
docs/
├── 00-product-vision.md
├── 01-business-scope.md
├── 02-system-architecture.md
├── 03-domain-architecture.md
├── 04-shared-core.md
├── 05-workflow-engine.md
├── 06-document-management.md
├── 07-gis-architecture.md
├── 08-database-architecture.md
├── 09-api-architecture.md
├── 10-security-architecture.md
├── 11-data-governance.md
├── 12-docker-architecture.md
├── 13-mvp-scope.md
├── 14-development-roadmap.md
├── 15-deployment-strategy.md
└── 16-risk-register.md
```

---

# 60. FINAL INSTRUCTION

Treat this project as a long-term Philippine LGU digital-government platform.

The architecture must support the evolution:

```text
Paperless LGU
      ↓
Integrated ERP
      ↓
GIS-enabled Operations
      ↓
Digital Citizen Services
      ↓
Executive Decision Support
```

The immediate goal is NOT to build everything.

The immediate goal is to create a clean, scalable, secure architecture that allows the LGU to adopt modules gradually.

Start with the architecture and planning artifacts only.

STOP after completing the requested architecture documents and recommendations.

Do not implement application code until the architecture is reviewed.
