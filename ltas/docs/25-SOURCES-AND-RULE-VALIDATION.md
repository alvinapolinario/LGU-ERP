# 25 — Sources and legal-rule validation

Reference review date: **2026-09-21**. This is a planning reference register, not an exhaustive legal opinion or confirmation of every amendment, special law or local rule. The supplied brief fixes scope/stack. External sources inform context; architecture choices elsewhere are design proposals. No municipal IRP or approved rule catalog was supplied.

## Primary source register

| ID | Source | Verified relevance and limitation |
|---|---|---|
| SRC-01 | [RA 7160, Supreme Court E-Library](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/53542) | Sections 54–56 concern executive action and provincial review; section 59 addresses posting/publication/effectivity. Applicability and exceptions require legal review. Source search excerpts were accessible; full-page fetch timed out during this review, so verify complete provisions before configuring rules. |
| SRC-02 | [LGA publication excerpt, printed page 69](https://cdn.lga.gov.ph/publication/attachments/1756874653.pdf) | Describes LTAS as tracking legislative documents/proposals through committee and executive/posting stages and supporting later review. Guidance context, not a universal executable procedure. Full publication title/edition to be catalogued by the local reviewer. |
| SRC-03 | [LGA publication excerpt, printed page 59](https://cdn.lga.gov.ph/publication/attachments/1756874522.pdf) | Discusses inventory, full history, indexing, digital access and codification among legislative tracking indicators. Used as planning context, not a political scoring specification. |
| SRC-04 | [RA 10173, National Privacy Commission](https://privacy.gov.ph/data-privacy-act/) | Statutory data-protection context. Local lawful basis, data inventory, rights and responsibilities still require assessment. |
| SRC-05 | [NPC announcement on Circular 2023-06](https://privacy.gov.ph/npc-issues-circulars-to-strengthen-personal-data-protection-in-ph/) and [NPC FAQ](https://privacy.gov.ph/wp-content/uploads/2024/12/v12-19-2024_FAQ-NPC-Circular-2023-06_NNJ_JDN.pdf) | NPC states 2023-06 repeals 16-01 and took effect March 30, 2024. Obtain/review the complete current circular and later applicable issuances before security-policy approval. |
| SRC-06 | [RA 9470 implementing rules, National Archives](https://www.nationalarchives.gov.ph/wp-content/uploads/2024/09/IRR-of-R.A.-9470.pdf) | Rules 27–31 address records schedules and authorized disposition. Obtain the municipality's applicable approved schedule; backup rotation is not disposal authority. |
| SRC-07 | [Keycloak OIDC documentation](https://www.keycloak.org/securing-apps/oidc-layers) | Identity endpoints and authorization-code integration basis. Version-specific configuration and supported database compatibility remain to be verified. |
| SRC-08 | [MySQL Full-Text Search documentation](https://dev.mysql.com/doc/refman/8.4/en/fulltext-search.html) | Text-column indexing/search basis. This reference version is not a final product-version selection or an OCR capability. |

No verbatim legal provisions are reproduced here. Local reviewers should retain approved source copies, revision dates, relevant sections and authority records in the rule catalog.

## Rule validation worklist

| Topic | Source/review input | Proposed handling | Required approving roles |
|---|---|---|---|
| Readings, referral, notice and urgency procedures | Municipal IRP; legal review of applicable law/guidance | Configurable paths with mandatory evidence and explicit exceptions | Secretary, presiding officer, legal reviewer |
| Membership, quorum, voting and tie/override treatment | Complete applicable provisions and IRP, current roster/appointments | Versioned formulas + immutable inputs + human declaration/certification | Presiding officer, Secretary, legal reviewer |
| Executive action and veto/item scope | SRC-01 sections 54–55 plus applicable special provisions | Applicability profile, receipt evidence, advisory timers and confirmed outcomes | Legal reviewer, Secretary, Mayor's Office |
| Provincial review | SRC-01 section 56 plus applicable measure subtype | Scoped review obligation; separate dispatch/receipt/deadline records | Legal reviewer and Secretary |
| Posting/publication/effectivity | SRC-01 section 59, measure clause and applicable special laws | Multiple obligations/proofs and reviewed effectivity confirmation | Legal reviewer and records/secretariat authority |
| Codification / legal condition | Source legislation, amendments, external decisions and reviewed analysis | Section-scoped relationships and attributable assessments | Legal reviewer and records officer |
| Data disclosure and privacy | SRC-04/05, local policy and data inventory | Classification, minimization, redaction and independent release | Privacy/legal and release authority |
| Archives, retention and disposition | SRC-06 and approved municipality schedule | Holds and controlled disposition outside ordinary CRUD | Records officer and competent authorities |

The table intentionally supplies no universal numeric legal deadline or majority rule. Parameter values, triggers, inclusivity, denominator and exceptions must be approved together. Software cannot validate a legal rule merely because its numeric field is populated.

## Workshop evidence to obtain

Obtain current adopted IRP and amendments; council/committee membership and acting-authority records; sample ordinary and special-type ordinances/resolutions; session agenda/minutes and vote certification forms; mayoral receipt/veto documents; provincial acknowledgments/findings; posting/publication proofs; certified copies and archival inventories; approved retention/disclosure/privacy policies; and continuity/IT constraints.

For each rule, record rule ID, exact source/version/section, plain-language meaning, applicability, inputs, formula/transition, required evidence, exceptions, effective dates, designated confirmer, approvers and at least one normal and exceptional worked example. Reconcile conflicting sources with authorized legal review. Approved versions remain immutable and linked to their cases. Related: [workflow](07-LEGISLATIVE-WORKFLOW.md), [decisions](26-DECISIONS-AND-ASSUMPTIONS.md).
