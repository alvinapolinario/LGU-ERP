# 23 — Future roadmap and extension points

These capabilities are deferred and must not become hidden MVP dependencies. Evaluate each against a concrete municipal need, data quality, sustainable operation, approved policy and budget.

| Capability | Extension point | Preconditions / acceptance boundary |
|---|---|---|
| Document comparison | Immutable source version pairs and extraction derivatives | Show source hashes, text/OCR limitations and human-reviewed differences; no silent official merge |
| Consolidated codes | Confirmed section-scoped amendment/repeal graph | Legal editor review, provenance for every provision and separate working consolidation from authoritative enactments |
| Advanced OCR | Sandboxed document extraction adapter | Language/layout accuracy assessment and accessible correction process; original remains authoritative |
| OpenSearch | Outbox-fed permission-aware index adapter | Measured MySQL limitations, funded operations and rebuild plan; public and internal indexes isolated |
| Semantic search | Approved embeddings/retrieval store with document-version IDs | Classification enforcement, deletion/withdrawal propagation, citation and recall evaluation |
| AI summaries/classification | Python/FastAPI read-only service contracts | Privacy/processor approval, prompt-injection defense, quality thresholds, source citations and non-authoritative labels |
| Related-legislation suggestions | Read-only candidate relationship output | Authorized reviewer creates any official relationship through deterministic commands |
| QR hearing attendance | Scoped temporary attendance token and separate registration interface | Privacy notice, anti-replay, assisted alternative and reviewed attendance confirmation |
| Citizen accounts/submissions | Public intake staging area | Identity/minimization, moderation, malware screening, notices and retention; no direct official-record insertion |
| SMS/push | Notification channel adapter | Delivery cost/consent policy, safe content and dedupe; delivery is not proof of legal notice |
| Digital signatures | Certification adapter with trust/validation evidence | Approved legal policy, certificate lifecycle, revocation/time validation and long-term verification |
| Remote/self-cast official voting | Vote-mode adapter | Specific legal/procedural approval, identity/availability/accessibility review and independent election-integrity assessment as appropriate |
| Cross-application SSO | Separate Keycloak clients/audiences | Common identity governance with application-specific grants; no role spillover |
| Multi-municipality hosting | Municipality scope and deployment boundary | Explicit tenant threat model, isolation tests, independent key/backup policy and procurement approval |
| Service extraction / high availability | Existing module contracts and outbox | Demonstrated capacity/availability or ownership need; measured operational benefit exceeds complexity |

## Municipal ecosystem integration

Citizen Services can consume released notices; ERP, Budget/Finance, Procurement, Project Monitoring, Business Permits and HR can link authorizing legislation through stable public/internal references according to scope. GIS may attach reviewed spatial applicability references. Executive Dashboards consume approved aggregates. Document/Records Management exchanges custody manifests and certified copies with provenance. Notification Services may deliver messages without owning deadlines. None receives direct MySQL write access.

Integration contracts must specify schema/version, purpose, data owner, allowed fields, identity/audience, legal basis/disclosure review, rate limits, idempotency, error handling, replay/withdrawal behavior and audit correlation. Prefer pull APIs first when enough; do not build a municipal event bus before a real consumer exists.

## AI governance

AI may summarize, classify, compare, search and suggest related materials. It cannot approve, certify, alter votes, declare validity, modify official documents or change statuses. Generated output is stored as a separate advisory artifact with source version IDs, model/configuration provenance, time, reviewer state and limitations. Official changes require independently authorized commands; the AI service holds no such credentials.

Before pilot: approve evaluation datasets and failure thresholds; test hallucinated citations, outdated/repealed sources, missing scans, prompt injection, data leakage and biased/inappropriate ranking. Approve processor location/retention/cost and implement opt-out or restricted-data exclusion as required. Withdrawal or access changes propagate to derived indexes/embeddings. A future service outage must not interrupt core legislative operations.

Related: [vision](01-SYSTEM-VISION.md), [architecture](04-SYSTEM-ARCHITECTURE.md), [AI coding guidelines](21-AI-CODING-GUIDELINES.md).
