# Planning baseline

**PLANNING / ARCHITECTURE PHASE** — **No production application implementation has started.**

Use the [master navigation](../README.md) for every planning document, stack, directory, and phase. Baseline date: 2026-09-21. Status: proposed architecture for stakeholder review, not an approved legal or operational policy.

The supplied task fixes the stack and documentation-only scope. Within this baseline, [requirements](02-FUNCTIONAL-REQUIREMENTS.md) define outcomes, [workflow](07-LEGISLATIVE-WORKFLOW.md) defines lifecycle behavior, [permissions](06-USER-ROLES-AND-PERMISSIONS.md) defines access, and [database](08-DATABASE-DESIGN.md) defines conceptual persistence. Resolve conflicts through [decisions](26-DECISIONS-AND-ASSUMPTIONS.md); do not silently choose a convenient interpretation. Approved local rules and applicable law require recorded review before this baseline changes.

Requirement IDs are permanent, never recycled. FR means functional requirement; NFR means quality requirement. Functional acceptance identifiers use `AC-<suffix after LTAS-FR->` and tests use `T-FR-<suffix>`. Quality acceptance identifiers use `AC-NFR-<suffix after LTAS-NFR->` and tests use `T-NFR-<suffix>`. [Traceability](27-TRACEABILITY-MATRIX.md) connects these. Future refinements add child IDs instead of renumbering existing requirements.

Documents describe proposed behavior using “shall” and “must.” These are design requirements, not claims that controls already exist. Numeric engineering defaults explicitly marked proposed are tunable; legal thresholds and final service objectives require approval. Diagrams are conceptual, not executable configurations.
