# Legislative Tracking and Analysis System (LTAS)

**Status: PHASE 1–4 IMPLEMENTATION, plus a constrained library and report catalog, a demonstration public catalog, and a historical ordinance register.** Platform foundation through constrained sessions, calendar, secretary-entered roll-call, and the document list are in the tree. So are a permission-filtered e-Library, descriptive counts, the catalog at `/home`, `/track`, and `/council`, and a prior-term ordinance register with keyword search on saved scan text.  
Official numbering, IRP, malware scanning, MFA, readings, hearings, committee reports, certified votes, the official archive, official metrics, and the Phase 9 approved-release portal are not in this slice.

LTAS is a Municipal Legislative Management Platform for a Philippine municipality and its Sangguniang Bayan. Each legislative measure is a digital case file. Phase 1 ships identity, scoped access, municipal structure, committee roster, and attributable audit. Phase 2 adds draft case files, versions, in-app tasks, and quarantined uploads. Phase 3 adds lead/joint referrals, committee-scoped measure visibility, secretariat-recorded meetings, and committee/meeting quarantine uploads. Phase 4 adds secretariat-recorded sessions, a combined calendar, secretary-entered attendance and tallies, and a document list. The library, reports, demonstration catalog, and historical ordinance register are recorded in [34](docs/34-PHASE-7-LIBRARY-REPORTS.md), [15](docs/15-PUBLIC-PORTAL.md), and [35](docs/35-HISTORICAL-ORDINANCES.md).

Implementation was authorized on 2026-09-21. This is not production, municipal policy approval, or Phase 1 acceptance. Open decisions remain in [26](docs/26-DECISIONS-AND-ASSUMPTIONS.md). How to run, what is in scope, and remaining gates are in [28 Phase 1 foundation](docs/28-PHASE-1-FOUNDATION.md).

## Objectives

- Support registration through deliberation, enactment, post-approval tracking, archives, and codification (Phases 2–7).
- Preserve the provenance of official records and make every consequential action attributable.
- Help authorized officials apply their approved rules without software declaring legal validity.
- Provide a separately reviewed public legislative record and descriptive operational analytics (later phases).
- Establish boundaries for eventual municipal ecosystem integrations without implementing other systems.

## Architecture and technology

One NestJS modular monolith owns the transactional domain. The React app serves the authenticated workspace and the demonstration catalog. MySQL is the primary transactional database; Prisma is the ORM. MinIO stores quarantined case-file bytes; MySQL stores metadata and historical-ordinance scan bytes. Redis supports sessions and recoverable background work. Keycloak supplies identity. Anonymous reads are `GET /api/v1/public/*` for the demonstration catalog only. The separate Phase 9 `apps/public-portal/` package is not built.

| Layer | Planned technology |
|---|---|
| Web | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide Icons |
| Web data/forms | TanStack Query, TanStack Table, React Hook Form, Zod |
| Charts | Recharts |
| API | Node.js, NestJS, TypeScript, versioned REST |
| Data | MySQL, Prisma; MySQL structured and Full-Text Search |
| Supporting services | Redis, Keycloak, MinIO |
| Hosting | Ubuntu Server, Docker, Docker Compose, Nginx, Git |
| Future only | OpenSearch; Python/FastAPI, embeddings and LLM integrations |

Phase 1 uses React, Vite, TanStack Query, Lucide, Zod, NestJS, Prisma, MySQL, Redis, and Keycloak. Phase 2 adds MinIO for quarantined uploads. Tailwind, shadcn/ui, TanStack Table, React Hook Form, and Recharts remain for later UI work. Exact support arrangements and licensing review stay D-12. PostgreSQL and a microservices-first topology are outside this design.

## What is in the tree

Phase 1: municipality profile, council terms, people, committee roster, user linking, dual-control grants, hash-chained audit, outbox export, and the authenticated workspace.

Later authorized slices, each in its own handoff:

- Phase 2: draft case files, versions, in-app tasks, quarantined uploads
- Phase 3: lead and joint referrals, secretariat-recorded committee meetings
- Phase 4: sessions, calendar, secretary-entered attendance and tallies, document list
- Phase 7/8 constrained slice: permission-filtered library and descriptive counts
- Demonstration catalog at `/home`, `/track`, and `/council` (ADR-22). This is not an approved public release
- Historical ordinance register (ADR-24). This is not an official archive or a legislative measure

Still later: hearings, committee reports, certified voting, post-approval, codification, the official archive, official metrics, the Phase 9 approved-release portal, and production readiness.

## Repository structure

| Directory | Responsibility |
|---|---|
| `apps/web/` | Authenticated municipal workspace and the demonstration catalog at `/home`, `/track`, and `/council` |
| `apps/api/` | Modular-monolith backend and same-codebase worker |
| `packages/contracts/` | Shared Zod contracts and DTO types |
| `infrastructure/docker/` | Compose definitions for MySQL, Redis, Keycloak, and loopback MinIO |
| `infrastructure/nginx/` | Staging reverse-proxy example |
| `infrastructure/database/` | Database bootstrap and runtime grants |
| `infrastructure/backup/` | Recovery rehearsal procedure and redacted T-NFR-RECOVERY-001 evidence |
| `docs/` | Authoritative numbered planning baseline plus phase handoffs through the ordinance register |
| `scripts/` | Local env generation, Keycloak provisioning, audit verification, isolated restore |

A constrained demonstration public catalog is served from `apps/web` at `/home`, `/track`, and `/council`. The official Phase 9 `apps/public-portal/` package, reviewed releases, and public downloads remain unauthorized.

## Reading order and document index

Start with overview, requirements, architecture, workflow, database, permissions, traceability, and the [Phase 1 handoff](docs/28-PHASE-1-FOUNDATION.md). A **TBD** blocks only the phase or action identified in the decision register. It is not permission for an AI assistant to guess a policy.

| Document | Purpose |
|---|---|
| [00 Project overview](docs/00-PROJECT-OVERVIEW.md) | Scope, outcomes, ownership, assumptions |
| [01 System vision](docs/01-SYSTEM-VISION.md) | Case-file approach and future ecosystem |
| [02 Functional requirements](docs/02-FUNCTIONAL-REQUIREMENTS.md) | Identified, testable requirements |
| [03 Non-functional requirements](docs/03-NON-FUNCTIONAL-REQUIREMENTS.md) | Quality and operational requirements |
| [04 System architecture](docs/04-SYSTEM-ARCHITECTURE.md) | Boundaries, transactions and integrations |
| [05 Module architecture](docs/05-MODULE-ARCHITECTURE.md) | Ownership and dependencies |
| [06 Roles and permissions](docs/06-USER-ROLES-AND-PERMISSIONS.md) | Grants, scopes and separation of duties |
| [07 Legislative workflow](docs/07-LEGISLATIVE-WORKFLOW.md) | Rules, states, exceptions and diagrams |
| [08 Database design](docs/08-DATABASE-DESIGN.md) | Conceptual entities and constraints |
| [09 API design](docs/09-API-DESIGN.md) | REST groups and contract policies |
| [10 Document management](docs/10-DOCUMENT-MANAGEMENT.md) | File lifecycle, versions and access |
| [11 Security architecture](docs/11-SECURITY-ARCHITECTURE.md) | Identity, threats and protections |
| [12 Audit trail](docs/12-AUDIT-TRAIL-DESIGN.md) | Evidence and tamper detection |
| [13 UI/UX](docs/13-UI-UX-GUIDELINES.md) | Navigation, case file and accessibility |
| [14 Reports and analytics](docs/14-REPORTS-AND-ANALYTICS.md) | Definitions and safeguards |
| [15 Public portal](docs/15-PUBLIC-PORTAL.md) | Reviewed releases and public experience |
| [16 Deployment architecture](docs/16-DEPLOYMENT-ARCHITECTURE.md) | Proposed environments and operations |
| [17 Backup and recovery](docs/17-BACKUP-AND-DISASTER-RECOVERY.md) | Coordinated recovery and options |
| [18 Testing strategy](docs/18-TESTING-STRATEGY.md) | Risk-based verification and release gates |
| [19 Development roadmap](docs/19-DEVELOPMENT-ROADMAP.md) | Phase dependencies and acceptance |
| [20 Coding standards](docs/20-CODING-STANDARDS.md) | Engineering conventions |
| [21 AI coding guidelines](docs/21-AI-CODING-GUIDELINES.md) | Implementation context and constraints |
| [22 Risk register](docs/22-RISK-REGISTER.md) | Owners, mitigation and indicators |
| [23 Future roadmap](docs/23-FUTURE-ROADMAP.md) | Deferred features and extraction criteria |
| [24 Glossary](docs/24-GLOSSARY.md) | Consistent terminology |
| [25 Sources and rule validation](docs/25-SOURCES-AND-RULE-VALIDATION.md) | Reference evidence and local validation |
| [26 Decisions and assumptions](docs/26-DECISIONS-AND-ASSUMPTIONS.md) | Accepted design choices and open decisions |
| [27 Traceability matrix](docs/27-TRACEABILITY-MATRIX.md) | Requirement-to-delivery mapping |
| [28 Phase 1 foundation](docs/28-PHASE-1-FOUNDATION.md) | Implementation status, runbook and remaining gates |
| [29 D-03 role bundles](docs/29-D-03-ROLE-BUNDLES.md) | Working paper: Phase 1 interim roles and emergency access |
| [30 Phase 2 measures](docs/30-PHASE-2-MEASURES.md) | Draft case files, versions, quarantined uploads |
| [31 Phase 3 referrals](docs/31-PHASE-3-REFERRALS.md) | Lead/joint referrals and CS-scoped case files |
| [32 Phase 3 meetings](docs/32-PHASE-3-MEETINGS.md) | Committee meetings and committee/meeting documents |
| [33 Phase 4 sessions](docs/33-PHASE-4-SESSIONS.md) | Sessions, calendar, roll-call, and document list |
| [34 Phase 7/8 library and reports](docs/34-PHASE-7-LIBRARY-REPORTS.md) | Permission-filtered e-Library and descriptive counts |
| [35 Historical ordinances](docs/35-HISTORICAL-ORDINANCES.md) | Direct prior-term ordinance register and scan keyword search |
| [Documentation index](docs/README.md) | Baseline maintenance and precedence |

## Development phases

0 Architecture and requirements; 1 Platform foundation; 2 Measures and documents; **3 Committees (referrals/meetings current; hearings later)**; 4 Sessions; 5 Voting; 6 Post-approval workflow; 7 e-Library and codification; 8 Reports; 9 Public portal; 10 Production readiness. Security, testing, audit and restore exercises begin before their release gates, not only in Phase 10. AI intelligence is a separate future phase.

## Next action

Follow [28](docs/28-PHASE-1-FOUNDATION.md) to run the synthetic foundation locally. Phase 2–4 constrained slices, the library/report catalog, and the historical ordinance register are in [30](docs/30-PHASE-2-MEASURES.md), [31](docs/31-PHASE-3-REFERRALS.md), [32](docs/32-PHASE-3-MEETINGS.md), [33](docs/33-PHASE-4-SESSIONS.md), [34](docs/34-PHASE-7-LIBRARY-REPORTS.md), and [35](docs/35-HISTORICAL-ORDINANCES.md). The demonstration catalog is [15](docs/15-PUBLIC-PORTAL.md). D-03 is open as a working paper in [29](docs/29-D-03-ROLE-BUNDLES.md). Remaining gates: D-03 confirmation, D-04 numbering, D-05/D-09/D-10/D-11/D-12/D-13/D-16. MySQL-backed access checks are `npm run test:mysql`. Isolated restore rehearsal is `LTAS_RESTORE_CONFIRM=ltas-restore-rehearsal npm run recovery -- rehearse`.
