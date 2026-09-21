# 20 — Standards for future development

These standards apply to authorized implementation. Phase 1 foundation code lives under `apps/` and `packages/contracts/`. Later phases must not treat that code as permission to add measures, uploads or public routes.

## TypeScript, organization and contracts

Use strict TypeScript with no implicit `any`; avoid `any` escapes for domain data, model nullable/unknown states explicitly and narrow external inputs. Use PascalCase for types/classes/components, camelCase for values/functions, kebab-case for general filenames, and stable uppercase codes for documented state semantics. Use snake_case for conceptual database tables/columns through an explicit ORM mapping. Pick consistent singular/plural names; do not alternate “bill,” “measure,” “ordinance” indiscriminately.

Keep frontend feature folders and backend module boundaries aligned with [05](05-MODULE-ARCHITECTURE.md). Domain logic must not import controllers, transport DTOs, UI hooks or infrastructure adapters. Export narrow module interfaces. Shared packages contain public contracts and reusable primitives; Prisma entities never become browser DTOs by default. Avoid a generic CRUD layer that bypasses business guards.

DTOs are explicit per operation, with allowlisted fields, limits, date semantics and error codes. Validate at the boundary and enforce business invariants inside application/domain services. Shared frontend Zod checks improve feedback only. APIs follow [09](09-API-DESIGN.md), including pagination, authorization, optimistic locking and idempotency. Do not return internal exception objects.

## Data, time and side effects

Use short MySQL transactions for business change + audit + outbox; isolate storage/network work outside them. Parameterize SQL and review any raw query. Index verified access patterns; avoid unbounded lists and N+1 access. Use integer/rational counts for voting, not floating-point rounding assumptions. Preserve date-only facts separately from instants and never infer a historical timezone/time without evidence.

Workers are retry-safe and record initiator plus service identity. No critical queue data exists only in Redis. Add new document versions rather than overwriting; enforce classification at reads and writes. Migration changes and supporting architecture/entity/contract updates belong in the same review.

## Errors, logs and comments

Return safe actionable messages and stable error codes. Correlate logs across requests/jobs without tokens, passwords, private document text or unrestricted personal data. Record required audit in the transaction rather than relying on console logs. Comments explain policy provenance, non-obvious invariants or tradeoffs; they do not restate simple code. Link rule decisions and requirement IDs near business-critical tests and documentation.

## Git and review

Use short-lived branches such as `feat/<scope>`, `fix/<scope>` and `docs/<scope>`. Use clear commits such as `feat(measures): preserve version on filing`; repository branch protection and merge strategy are Phase 1 choices. Never commit credentials or real private fixtures.

Pull requests describe the problem and resulting behavior, relevant requirement IDs, policy/schema/API changes, validation evidence, migration/rollback considerations and residual risk. Small changes need concise descriptions; complex workflow/security changes need enough evidence for domain and technical review. Require independent review of authorization, official-record mutation, workflow formulas, certification, release policy and destructive migration plans. Resolve contradictory documentation before merge.

## Verification and environment

Business-critical changes include meaningful success, failure and boundary tests. Run affected type/lint/unit/integration checks, then relevant contract/end-to-end suites. Do not write tests solely mirroring implementation. Use synthetic fixtures and the approved MySQL version for database behavior. Pin dependencies/runtime/images and review security/license impact on upgrades.

Validate environment configuration at startup; fail safely when required secrets or policies are missing. Document each nonsecret setting, environment scope and default. Secrets use approved protected storage and rotation; no hard-coded fallback credentials. Local, staging and production identities/storage are distinct.

## Migrations

Prisma migrations are reviewed with the change that needs them. Review generated SQL, lock/backfill cost and compatibility against representative MySQL data. Prefer additive changes, explicit backfill validation and later cleanup; never silently reset a production database. Record backup/restore and forward-fix strategy before incompatible changes. Existing official numbers, hashes, certification references and audit history must survive upgrades. Keycloak schema upgrades remain its own managed lifecycle.

Related: [AI guidelines](21-AI-CODING-GUIDELINES.md), [tests](18-TESTING-STRATEGY.md), [architecture](04-SYSTEM-ARCHITECTURE.md).
