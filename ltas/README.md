# Legislative Tracking and Analysis System (LTAS)

**Status: PLANNING / ARCHITECTURE PHASE**  
**No production application implementation has started.**

LTAS is a proposed Municipal Legislative Management Platform for a Philippine municipality and its Sangguniang Bayan. Each legislative measure is a digital case file containing its text, versions, deliberations, decisions, evidence, deadlines, and chronological history. This repository currently contains Markdown planning documents and empty directories only. It does not contain an executable application, infrastructure configuration, migrations, or installed dependencies.

## Objectives

- Support registration through deliberation, enactment, post-approval tracking, archives, and codification.
- Preserve the provenance of official records and make every consequential action attributable.
- Help authorized officials apply their approved rules without software declaring legal validity.
- Provide a separately reviewed public legislative record and descriptive operational analytics.
- Establish boundaries for eventual municipal ecosystem integrations without implementing other systems.

## Architecture and technology

One NestJS modular monolith owns the transactional domain. React applications provide authenticated operations and a separate public experience. MySQL is the primary transactional database; Prisma is the ORM. MinIO stores immutable file versions; MySQL stores their metadata. Redis supports recoverable background work and disposable caches. Keycloak supplies identity and future multi-application SSO. Public endpoints read approved publication snapshots only.

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

Exact versions, support arrangements, licensing review, and compatibility tests are Phase 1 decisions. PostgreSQL and a microservices-first topology are outside this design.

## Modules

Dashboard; legislative measures and versions; workflow and deadlines; sessions and agenda; committees; hearings; attendance and voting; mayoral action; provincial review; posting, publication and effectivity; documents; e-Library and codification; reports; notifications and tasks; audit; access administration; public releases and portal.

## Repository structure

| Directory | Intended responsibility |
|---|---|
| `apps/web/` | Authenticated municipal workspace |
| `apps/api/` | Single modular-monolith backend and same-codebase worker entry point |
| `apps/public-portal/` | Public-only frontend with its own build and host |
| `packages/ui/` | Shared accessible visual primitives, no business authorization |
| `packages/types/` | Public contract types, never Prisma-generated models |
| `packages/validation/` | Shareable input constraints; server remains authoritative |
| `packages/api-client/` | Versioned client contracts and error handling |
| `packages/config/` | Shared lint/compiler conventions; no secrets |
| `infrastructure/docker/` | Future Compose definitions and pinned images |
| `infrastructure/nginx/` | Future proxy, TLS, host and route isolation |
| `infrastructure/database/` | Future operational database procedures; migrations live with API |
| `infrastructure/backup/` | Future backup and recovery procedures |
| `docs/` | Authoritative numbered planning baseline |
| `docs/architecture`, `requirements`, `modules`, `database`, `api`, `security`, `deployment`, `workflows` | Reserved for later detailed specifications; numbered documents remain canonical |

Empty directories exist locally but Git does not preserve them. Future development creates files there when authorized; no placeholder application code is necessary.

## Reading order and document index

Start with overview, requirements, architecture, workflow, database, permissions, and traceability. A **TBD** blocks only the phase or action identified in the decision register. It is not permission for an AI assistant to guess a policy.

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
| [20 Coding standards](docs/20-CODING-STANDARDS.md) | Future engineering conventions |
| [21 AI coding guidelines](docs/21-AI-CODING-GUIDELINES.md) | Implementation context and constraints |
| [22 Risk register](docs/22-RISK-REGISTER.md) | Owners, mitigation and indicators |
| [23 Future roadmap](docs/23-FUTURE-ROADMAP.md) | Deferred features and extraction criteria |
| [24 Glossary](docs/24-GLOSSARY.md) | Consistent terminology |
| [25 Sources and rule validation](docs/25-SOURCES-AND-RULE-VALIDATION.md) | Reference evidence and local validation |
| [26 Decisions and assumptions](docs/26-DECISIONS-AND-ASSUMPTIONS.md) | Accepted design choices and open decisions |
| [27 Traceability matrix](docs/27-TRACEABILITY-MATRIX.md) | Requirement-to-delivery mapping |
| [Documentation index](docs/README.md) | Baseline maintenance and precedence |

## Development phases

0 Architecture and requirements; 1 Platform foundation; 2 Measures and documents; 3 Committees and hearings; 4 Sessions; 5 Voting; 6 Post-approval workflow; 7 e-Library and codification; 8 Reports; 9 Public portal; 10 Production readiness. Security, testing, audit and restore exercises begin before their release gates, not only in Phase 10. AI intelligence is a separate future phase. Phase 6 is the proposed internal lifecycle MVP; a public service release includes Phases 7–10. Dates and staffing remain TBD.

## Next planning action

Run a requirements and rules-validation workshop with the Secretary to the Sanggunian, presiding officer, legal reviewer, records officer, IT administrator, and privacy officer. Approve sample ordinance/resolution journeys, authority assignments, rule profiles, disclosure policy, and recovery objectives before implementation authorization.
