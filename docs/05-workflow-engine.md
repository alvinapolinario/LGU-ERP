# 05 — Workflow Engine Design

## 1. Intent

Approval paths differ by LGU, office, amount, document type, and political structure. The engine is therefore a **configurable state-and-assignment machine**, not a set of `if department == Budget` statements.

Every later module that needs approval (purchase request, leave, permit, journal voucher, GIS layer publish) should create a **workflow instance** bound to a domain record rather than implementing its own routing.

The engine does **not** need full BPMN or Camunda for MVP. It needs the behaviors clerks and department heads actually use: sequential and simple parallel review, return, reject, delegate, escalate, and a complete history.

---

## 2. Design principles

1. Definitions are data. Shipping a new routing chart is a configuration change.
2. Runtime instances are immutable in history. Corrections are new events.
3. Assignment targets **positions, offices, roles, or named users**, with position preferred.
4. Domain modules own the **business record** and the **final action** (approve PR, release document). The engine owns **how it got there**.
5. Conditions are declarative and sandboxed. No arbitrary script execution in MVP.

---

## 3. Conceptual model

```text
WorkflowDefinition
 ├── Trigger (manual | on_create | on_event | on_status)
 ├── Context type (document, purchase_request, layer_publish, …)
 ├── Steps[]
 │    ├── type: review | endorse | approve | encode | sign | release | custom
 │    ├── assignment rule
 │    ├── sla / deadline
 │    ├── form / checklist (optional)
 │    └── transitions[]
 │         ├── to step or terminal
 │         ├── action: submit | return | reject | approve | delegate
 │         └── conditions (optional)
 ├── Escalation policies
 └── Terminals: approved | rejected | withdrawn | cancelled
```

Runtime:

```text
WorkflowInstance
 ├── definition_version (pinned)
 ├── subject (entity_type + entity_id)
 ├── initiator
 ├── current step(s)
 ├── status
 ├── Tasks[]
 │    ├── assignee (user / position / office)
 │    ├── due_at
 │    ├── outcome
 │    └── comments
 └── History[] (append-only)
```

**Versioning:** editing a definition creates a new version. In-flight instances keep the version they started on unless an admin explicitly migrates them.

---

## 4. Assignment rules

An assignment rule evaluates to one or more principals.

| Rule type | Behavior |
|---|---|
| `position` | Current occupant of a named position (e.g. Municipal Accountant) |
| `office_role` | Any user with role X in office Y |
| `initiating_office_head` | Head of the office that started the instance |
| `named_user` | Specific user (avoid except for exceptional routing) |
| `previous_assignee` | Return path |
| `pool` | First-claim from a queue (Records receiving) |

If a position is vacant, the engine uses the configured fallback (acting officer, office pool, or escalation). Vacancy must not silently drop a document.

---

## 5. Conditions (MVP vocabulary)

Conditions are JSON predicates against a **context snapshot** supplied by the calling module.

Allowed fields (examples):

- `amount`
- `document_type`
- `confidentiality`
- `origin_office_id`
- `fund_source`
- `has_attachment`
- `barangay_id`

Operators: `eq`, `neq`, `in`, `gt`, `gte`, `lt`, `lte`, `exists`.

Boolean combinations: `all`, `any`.

**Not in MVP:** arbitrary Python, JS eval, calls to external APIs inside predicates. Those become an extension later if a real LGU rule requires it.

Example: “If amount ≥ 1,000,000, add BAC Chair as extra approver” is a condition on a transition or a dynamically included step.

---

## 6. Actions at a step

| Action | Effect |
|---|---|
| Claim | Pool task becomes personal |
| Submit / Endorse | Advance along happy path |
| Approve | Advance; may be terminal |
| Return | Send to a configured prior step with comment required |
| Reject | Terminal rejected; comment required |
| Delegate | Reassign; recorded; optional time limit |
| Escalate | Auto or manual to configured superior |
| Comment | Non-transition note |
| Withdraw | Initiator cancels if policy allows |

Every action writes history: actor, from, to, comment, timestamp, IP/session id.

---

## 7. Deadlines and escalation

Each step may define `due_in_hours` (business hours optional later).

On breach:

1. Mark task overdue
2. Notify assignee and optional watcher
3. After `escalate_after`, reassign per policy
4. Surface on executive dashboard (document turnaround)

SLA clocks pause on return-for-revision if configured.

---

## 8. Parallel vs sequential

MVP supports:

- **Sequential** steps (default)
- **Simple parallel** — all listed reviewers must complete (`join: all`) or any one (`join: any`)

Do not implement arbitrary free-graph BPMN in MVP. If an LGU needs a complex fork, represent it as an explicit parallel step group.

---

## 9. Binding to domain records

```text
Purchase Request (procurement.pr)
        │
        └── workflow.instance(subject=procurement.pr:uuid)
                    │
                    └── on terminal approved
                              └── procurement service finalizes PR
```

The engine emits events:

- `workflow.instance.started`
- `workflow.task.assigned`
- `workflow.task.completed`
- `workflow.instance.returned`
- `workflow.instance.rejected`
- `workflow.instance.completed`

The subject module listens and updates its own status. The engine does not `UPDATE procurement.purchase_request` directly.

For documents, the document module is both subject and the primary UX.

---

## 10. Example definitions (configuration, not code)

### Incoming document

```text
Records receive → Encode/scan complete → Office review → (optional) Approval → Release / file
```

### Purchase request (illustrative; LGU-specific)

```text
Requesting Office
        ↓
Department Head
        ↓
Budget (if amount or object of expenditure requires)
        ↓
Accounting
        ↓
Procurement
        ↓
Approving Authority (Mayor / Admin / authorized)
```

A different LGU may skip Accounting for small amounts or insert BAC. That is a different definition, same engine.

### GIS layer publish

```text
Uploader → GIS Officer validation → Steward approval → Publish hook
```

---

## 11. Security and integrity

- Starting a workflow requires `create` on the subject and `workflow.start` where policy demands it.
- Acting on a task requires being the assignee, a delegate, or an admin with `workflow.reassign`.
- Admins may reassign; they may not silently rewrite history.
- Sensitivity of the subject applies to task visibility (a confidential document’s tasks do not leak subject lines to unauthorized inboxes).
- All definition edits are audited.

---

## 12. What we will not do

- Hard-code the sample purchase-request chain
- Embed department names in source
- Allow workflow “scripts” that execute OS commands
- Use the engine as a general RPA / email bot
- Auto-approve anything because a deadline lapsed unless an LGU explicitly configures that policy (default is escalate, not approve)

---

## 13. Implementation sequence (when coding is approved)

1. Definition CRUD + versioning
2. Sequential instances + history
3. Return / reject / delegate
4. In-app task inbox
5. SLA + escalation job
6. Parallel join
7. Condition predicates
8. Bind documents (MVP)
9. Bind GIS publish (MVP)
10. Expose API for later modules

Until (1)–(8) exist, no ERP module should invent a private approval table.
