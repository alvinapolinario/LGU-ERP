# 15 — Public legislative transparency portal

Proposed public host: `legislative.municipality.gov.ph`; internal host: `ltas.municipality.gov.ph`. These are illustrative, not registered or deployed domains. The official Phase 9 portal has a separate React build, reviewed release snapshots, and a dedicated public API. Anonymous browsing does not require a Keycloak session.

A constrained demonstration catalog now exists on the staff web origin at `/home`, `/track`, `/council`, `/ordinances`, `/resolutions`, `/about`, and `/contact`, reading live LTAS rows through `GET /public/*`. Public measure routes list submitted titles only. Draft and withdrawn case files, subjects, stages, authors, and referral dispositions are not included. Chrome follows the Philippine Government Website Template (GWT 26) used on libungan.gov.ph. It is not this document's approved-release model, not a replacement of the official municipal website, not DICT GWHS hosting, and not D-08 sign-off. See ADR-22 and ADR-23.

## Public experience

Search ordinances/resolutions by number, title, year, keyword and approved facets; browse enacted legislation, released status timelines, sessions and minutes, committees, public council-member profiles, legislative calendar and public hearings. Download approved public document copies with format/size, certification/source description and release date. Identify the municipality's contact and correction-request channel; channel details are TBD.

Show last publication/update time and any known incompleteness. An absence from search means not available in this portal, not proof that legislation does not exist. Public status labels distinguish Sanggunian approval, recorded executive action and confirmed effectivity. Do not present an unreleased internal status or private deadline simply because a measure is public.

## Release model

1. Authorized preparer selects the source revision and allowlisted metadata, public timeline events and specific document derivatives.
2. Review classification, personal data, privilege/confidentiality, embedded metadata and accessibility. Review legal/disclosure authority; do not infer all information is public because it concerns government.
3. Independent authorized approver freezes the exact payload and derivative hashes.
4. Publish an immutable release snapshot and update the current-release pointer, with audit/outbox/cache invalidation.
5. Changes require a new reviewed release. Withdrawal removes future access through API/download mediation and invalidates search/cache; preserve internal release history and reason.

Already downloaded copies cannot be recalled. Public responses should use a controlled revalidation/cache policy; initially prefer no long-lived caching of downloads and immediate release-status checks. Cache duration is a disclosed withdrawal-latency decision, not an invisible optimization.

## Field policy

| Usually eligible after approval | Excluded unless separately authorized |
|---|---|
| Official number/title/type/year, approved category, public authorship, released milestone dates | Draft comments, internal legal advice, nonpublic text or attachments |
| Public officeholder name/office/term and official contact | Personal phone/address, private email, identity credentials |
| Public session/hearing schedule and approved notice | Private attendance contacts, sensitive submissions, resource-person private details |
| Certified public copies and reviewed redacted derivatives | Original unredacted hearing evidence, hidden document revisions/metadata |

Public handlers use a dedicated restricted MySQL reader over approved-release tables/views and read only approved object references through mediation. This remains a monolith adapter, not a second authoritative database. Public searches, facet counts, snippets, sitemaps and feeds all follow the same release filter. Error responses conceal internal IDs and object existence.

## Acceptance and rollout

Test guessed IDs, withdrawn versions, draft release URLs, cache revalidation, search counts and original-document links. A public user must never reach private files via an otherwise public measure. Validate phones/tablets, keyboard navigation, accessible search/results and print/download behavior. Pilot with a reviewed collection before opening full historical search.

Citizen registration, QR attendance, online position-paper submission and comments are future work requiring privacy, moderation, abuse and retention design. Related: [security](11-SECURITY-ARCHITECTURE.md), [documents](10-DOCUMENT-MANAGEMENT.md), [roadmap](19-DEVELOPMENT-ROADMAP.md).
