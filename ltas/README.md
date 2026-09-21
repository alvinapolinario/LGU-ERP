# Legislative Tracking and Analysis System (LTAS)

**Status: PHASE 1–2 IMPLEMENTATION** — platform foundation and constrained draft measures.  
Official numbering, IRP, malware scanning, MFA, readings, referrals, voting, and the public portal are not in this slice.

LTAS is a Municipal Legislative Management Platform for a Philippine municipality and its Sangguniang Bayan. Each legislative measure is a digital case file. Phase 1 ships identity, scoped access, municipal structure, committee roster, and attributable audit. Phase 2 adds draft case files, versions, in-app tasks, and quarantined uploads.

Implementation was authorized on 2026-09-21. This is not production, municipal policy approval, or Phase 1 acceptance. Open decisions remain in [26](docs/26-DECISIONS-AND-ASSUMPTIONS.md). How to run, what is in scope, and remaining gates are in [28 Phase 1 foundation](docs/28-PHASE-1-FOUNDATION.md).

## Objectives

- Support registration through deliberation, enactment, post-approval tracking, archives, and codification (Phases 2–7).
- Preserve the provenance of official records and make every consequential action attributable.
- Help authorized officials apply their approved rules without software declaring legal validity.
- Provide a separately reviewed public legislative record and descriptive operational analytics (later phases).
- Establish boundaries for eventual municipal ecosystem integrations without implementing other systems.

## Architecture and technology

One NestJS modular monolith owns the transactional domain. React applications provide authenticated operations and a later separate public experience. MySQL is the primary transactional database; Prisma is the ORM. MinIO stores quarantined file bytes in Phase 2; MySQL stores metadata. Redis supports sessions and recoverable background work. Keycloak supplies identity. Public endpoints are not served in Phase 1.

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

## Phase 1 modules

Municipality profile; council terms; historical people; committee roster; user linking; dual-control grants; hash-chained audit; outbox export; authenticated workspace.

Not in Phase 1: measures, workflow, documents, hearings, sessions, voting, post-approval, e-Library, reports, public portal.

## Repository structure

| Directory | Responsibility |
|---|---|
| `apps/web/` | Authenticated municipal workspace |
| `apps/api/` | Modular-monolith backend and same-codebase worker |
| `packages/contracts/` | Shared Zod contracts and DTO types |
| `infrastructure/docker/` | Compose definitions for MySQL, Redis, Keycloak; optional MinIO |
| `infrastructure/nginx/` | Staging reverse-proxy example |
| `infrastructure/database/` | Database bootstrap and runtime grants |
| `infrastructure/backup/` | Recovery rehearsal procedure and redacted T-NFR-RECOVERY-001 evidence |
| `docs/` | Authoritative numbered planning baseline plus Phase 1 handoff |
| `scripts/` | Local env generation, Keycloak provisioning, audit verification, isolated restore |

`apps/public-portal/` and additional shared packages are created when those phases are authorized.

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
| [Documentation index](docs/README.md) | Baseline maintenance and precedence |

## Development phases

0 Architecture and requirements; 1 Platform foundation; **2 Measures and documents (current engineering)**; 3 Committees and hearings; 4 Sessions; 5 Voting; 6 Post-approval workflow; 7 e-Library and codification; 8 Reports; 9 Public portal; 10 Production readiness. Security, testing, audit and restore exercises begin before their release gates, not only in Phase 10. AI intelligence is a separate future phase.

## Next action

Follow [28](docs/28-PHASE-1-FOUNDATION.md) to run the synthetic foundation locally. Phase 2 draft measures are in [30](docs/30-PHASE-2-MEASURES.md). D-03 is open as a working paper in [29](docs/29-D-03-ROLE-BUNDLES.md) (not yet signed). Remaining gates: D-03 confirmation, D-04 numbering, D-05/D-09/D-12/D-13/D-16. MySQL-backed access checks are `npm run test:mysql`. Isolated restore rehearsal is `LTAS_RESTORE_CONFIRM=ltas-restore-rehearsal npm run recovery -- rehearse`.
