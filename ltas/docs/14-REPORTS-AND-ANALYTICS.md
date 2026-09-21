# 14 — Reports and analytics

Analytics describes operations, workload and recorded activity. It must not score political performance, rank officials, infer effectiveness from volume, or treat attendance as a complete account of public service. LTAS-FR-DASHBOARD-001 and LTAS-FR-REPORT-001 govern this module.

## Metric catalog

| Metric/report | Definition and caveats |
|---|---|
| Filed measures | Distinct measures with accepted filing date in period; draft and duplicate import rows excluded |
| Sanggunian-approved measures | Distinct measures with certified approval event in period; label explicitly separate from enacted/effective |
| Enacted legislation | Distinct measures with the locally approved enactment classification confirmed in period; final definition D-11, never assumed identical to a vote count |
| Rejected measures | Distinct measures with certified rejection event in period; separate subsequently reconsidered cases |
| Pending measures | As-of snapshot of filed cases without a terminal legislative disposition; show separate outstanding post-approval obligations |
| Processing time | Calendar duration from accepted filing to the chosen confirmed milestone; define milestone, sample and pause treatment; show median/p90 and sample size |
| Measures by category | Distinct case counts; for multi-category records label that category totals can exceed unique total |
| Committee workload | Open referrals per committee, age buckets, reports due/submitted; joint referrals count once per assigned committee and separately in unique case total |
| Attendance | Recorded present/absent/excused/inhibited context by proceeding and eligible membership; distinguish incomplete records; approved denominator definition required |
| Voting | Round outcomes and member dispositions within release/access policy; distinguish abstention, absence, inhibition and missing response |
| Legislative productivity | Neutral activity counts by period/type: filed, deliberated, reports completed, certified outcomes; no composite score or member ranking |
| Historical trends | Same metric definition across periods, with term boundaries and incomplete import coverage flagged |
| Deadline backlog | Current unsatisfied obligations grouped by due date/owner; unresolved calculations separate from overdue |
| Status distribution | As-of counts by legislative stage and separate executive/review/publication/effectivity dimensions |

## Counting rules

Store a metric definition version. Reports declare period, municipality, term, date basis, timezone, filters, scope, generated/as-of time, exclusions and completeness warnings. Count case IDs rather than joined attachment/referral rows. Corrected/superseded events contribute only through the applicable current interpretation at the requested as-of point; historical reproducibility requires preserving source revisions. Unknown dates are an explicit bucket, never silently coerced into filing dates.

Processing time for still-pending measures is age-to-date, not completed processing duration. Paused periods may be separately reported only if consistently recorded. Compare like cohorts and display sample size. No “compliance rate” until legal definitions and complete evidence are approved. Forecasting, causality and AI-generated conclusions are outside MVP.

## Queries and exports

Start with indexed MySQL read queries and documented module-owned joins. Introduce MySQL projection tables only when measured cost warrants them; show refresh time and reconcile to source. Cache by municipality, access-policy scope, filters and definition version. A role change invalidates sensitive cached views. Public aggregates derive only from public releases and disclosure-approved aggregation, not internal counts.

Plan CSV and PDF exports; exact export formats and templates are D-11. Large exports run as jobs with permission checks at request, execution and download. Sanitize spreadsheet-formula prefixes in CSV fields, quote delimiters correctly, and avoid leaking hidden columns. Exports include report label, definition/version, as-of time and scope. Sensitive exports expire and their downloads are audited.

Acceptance fixtures deliberately include co-authors, multi-category measures, joint referrals, repeated vote rounds, rejected-then-reconsidered cases, partial histories and missing dates. Dashboard totals must reconcile to the same filtered report definition. Related: [database](08-DATABASE-DESIGN.md), [testing](18-TESTING-STRATEGY.md).
