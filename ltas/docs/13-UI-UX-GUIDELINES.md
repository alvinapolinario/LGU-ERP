# 13 — UI/UX guidelines

Use a clean blue/white municipal identity with dark blue navigation and a large content workspace. Municipality seal, name, province, contact information and approved colors are configurable. Branding must preserve accessibility contrast; seals are provided by the municipality, not invented. Desktop-first and tablet-compatible, with a responsive public portal usable on small phones.

## Navigation and pages

Primary sidebar: Dashboard; Legislative Measures; Sessions; Committees; Calendar; Voting & Attendance; Documents; e-Library; Reports & Analytics; Administration. Contextual links expose hearings, executive/review/posting work and codification within the relevant case or module. Hide unavailable actions for usability, while the backend independently denies them.

| Screen | Essential content / interaction |
|---|---|
| Dashboard | Scoped KPI cards, pending work, upcoming sessions/meetings/hearings, deadline list, recent activity, trends and permitted quick actions |
| Measure list | Number/title/type/year, stage and separate obligation indicators; filters, sortable table, saved view proposal and explicit empty/loading/error states |
| Case-file workspace | Header with stable reference and current text version; Overview, Timeline, Versions, Referrals, Hearings, Sessions/Readings, Amendments/Votes, Post-Approval, Documents and Relationships tabs |
| Session workspace | Session identity, current agenda revision, ordered business, attendance and quorum panel, motions, voting rounds and minutes |
| Committee workspace | Members with term dates, workload, referrals, meeting/hearing calendar, report status and evidence |
| Vote recording | Frozen roster and version, visible mode, distinct ballots/dispositions, pending count, proposed tally and authorized close/certification actions |
| Post-approval workspace | Parallel mayoral/review/publication/effectivity panels; dispatch vs receipt; calculated vs confirmed dates and missing evidence |
| Document viewer | Classification, version/hash, source, certification, download authorization, derivative/original distinction and scan/extraction status |
| Administration | Role/grant scope, changes awaiting independent review, municipality settings, draft/approved rule versions and impact previews |

## Interaction safeguards

Consequential actions show a concise review screen: exact measure/version, action, actor authority, affected records, required evidence, applicable rule and reason. Filing, closing/certifying a vote, confirming effectivity and publishing a release require explicit action; ordinary drafting should not be slowed by repeated confirmations. A submit button remains disabled while a request is pending and reuses its idempotency key on safe retry.

If a concurrent edit causes conflict, show server/current and user's attempted values and offer reload/reapply where permitted. Do not silently discard work or retry official actions under a new identity. Session expiration warns users and preserves only safe unsent draft context according to local device policy; never persist tokens or private documents in browser storage.

Status badges use text and icons as well as color. Show “Awaiting confirmation,” “Evidence incomplete,” “Not applicable — basis recorded,” and “Unknown historical date” distinctly. Do not label a timer result “legally approved.” Timeline items show occurrence and recorded dates when different, actor, evidence links, supersessions and rule references where relevant.

## Accessibility and responsive behavior

Target WCAG 2.2 AA as specified in LTAS-NFR-ACCESSIBILITY-001, pending assessment. All dialogs, menus, tabs and tables support keyboard navigation, visible focus, semantic labels and announced validation errors. Maintain logical heading order and skip navigation. Tables offer responsive columns/detail views instead of requiring horizontal scrolling for critical actions. Charts have textual/tabular alternatives and do not rely only on color. Tooltips cannot be the only explanation of an action.

Use readable dates with explicit timezone on session schedules; never ambiguous day/month notation. Form errors identify the field and recovery action. Respect reduced motion. Scanned PDFs show extraction availability and a request-for-accessible-copy path; OCR quality warnings remain visible. Public pages provide meaningful titles, print styles and accessible download labels including format/size.

## Component use and validation

React/TypeScript/Vite structure the applications. Tailwind and shadcn/ui provide styling/primitives; Lucide icons include accessible text alternatives. TanStack Query manages server state and invalidation after commands, TanStack Table manages data tables, React Hook Form + Zod handle local input feedback, and Recharts renders operational charts. Exact versions and accessibility behavior must be checked during implementation. No frontend calculation is authoritative for votes, deadlines or permissions.

Before UI implementation, review low-fidelity sketches of filing, committee report submission, session operation, vote correction and public release with actual staff. Test realistic long ordinance titles, many attachments, tablet interaction and network failure. Related: [requirements](02-FUNCTIONAL-REQUIREMENTS.md), [public portal](15-PUBLIC-PORTAL.md).
