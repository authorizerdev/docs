# Authorization Change Evidence — Design

**Date:** 2026-09-28
**Status:** Design, awaiting review
**Scope:** FGA authorization changes (tuples, model, reset)
**Repo:** `authorizerdev/authorizer` (server)

## Problem

A verification pass against `main` (891f58fd) asked whether Authorizer can evidence
**one real authorization change** — the state before it, the change itself, the state
after, and the audit record. Findings, each confirmed in code:

| Requirement | Today |
|---|---|
| The change happened | **Yes** — audit row with action, resource type, IP, UA, protocol, timestamp |
| State **before** | **No** — never captured |
| The change itself | **Partial** — FGA tuple write/delete records `count=N` only (`admin_fga.go:116`, `:149`); model write records the new id only (`:82`); `FgaReset` records nothing (`:290-297`) |
| State **after** | **No** — never captured |
| Audit evidence | **Partial** — best-effort, no actor identity, `ResourceID` unset on tuple events |

Supporting detail:

- **No before/after anywhere.** No write path snapshots prior state. The engine SPI has
  no `ReadChanges` and no read-by-version; `ReadModel` returns only the active model
  (`internal/authorization/engine/engine.go:164`), even though `Reset`'s doc (`:180`)
  confirms OpenFGA retains prior versions.
- **`ResourceID` is unset** on tuple write/delete, so `_audit_logs(resource_id:)` cannot
  locate a specific change.
- **Best-effort evidence.** `LogEvent` is fire-and-forget via `asyncutil.Go`; a storage
  failure is logged at Debug and dropped (`internal/audit/provider.go:101-103`) while the
  mutation returns success.
- **No actor identity on admin ops.** Every FGA event is `ActorType: admin` with an empty
  `ActorID`. Super-admin is a single shared `AdminSecret` or a session cookie derived from
  it (`internal/token/admin_token.go:41-63`) — there is no per-admin identity to record.
- **Two storage parity bugs** make the record unfindable on some backends (see Phase 0).

## Locked decisions

Agreed with the maintainer before this spec was written:

1. **Scope: FGA only** — tuples, model, reset. User roles, org membership, and other
   authz-adjacent admin surfaces are explicitly out of scope for this spec.
2. **Explicit before/after snapshots**, not replay-derivable deltas. Literal evidence,
   accepting the extra engine reads and the payload-bounding work.
3. **Actor identity: record what exists.** No new auth model. Named admin accounts remain
   a separate future feature.
4. **Synchronous audit for authorization changes only.** Logins and token issuance stay
   asynchronous.
5. **On audit-write failure: return an error, do not compensate.** The change stays
   applied.

## Non-goals

- Named per-admin identities (would need its own auth-model spec and migration).
- Making non-FGA authz changes (roles, org membership) evidential — same mechanism will
  apply later, but not here.
- Exposing OpenFGA's `ReadChanges` as an admin API. It exists on the embedded server
  (`openfga@v1.18.1/pkg/server/read_changes.go:19`) and Authorizer inherits
  `ChangelogHorizonOffset = 0` so it would return changes immediately — noted as a future
  option for independent cross-checking, deliberately not built now.
- Audit log retention/rotation. `DeleteAuditLogsBefore` exists on the storage interface
  (`internal/storage/provider.go:306`) with zero callers; snapshots will grow the table
  faster, so retention becomes worth revisiting — tracked, not solved here.

---

## Phase 0 — Make the record findable (storage parity)

Setting `ResourceID` is pointless if callers cannot filter on it. Two backends accept
filters the GraphQL API advertises and silently ignore them:

| Backend | `action` | `actor_id` | `resource_type` | `resource_id` | `from`/`to_timestamp` |
|---|---|---|---|---|---|
| SQL, MongoDB, ArangoDB, DynamoDB | yes | yes | yes | yes | yes |
| Couchbase | yes | yes | yes | yes | **ignored** |
| Cassandra/ScyllaDB | yes | yes | **ignored** | **ignored** | **ignored** |

Cassandra: `internal/storage/db/cassandradb/audit_log.go:39-61`.

**Change**

- Add `resource_id` and `resource_type` secondary indexes beside the existing three
  (`cassandradb/provider.go:408-419`) and apply both filters as indexed equality, matching
  the existing comment's constraint that count queries must not need `ALLOW FILTERING`
  (Scylla builds secondary indexes as materialized views).
- Timestamp range on a non-key column cannot use a secondary index. Use `ALLOW FILTERING`
  for the range predicate only, with a `ponytail:` comment naming the materialized-view
  upgrade path. This is an admin-only, rare query; a full scan is acceptable until it is
  measurably not.
- Couchbase: apply `from_timestamp` / `to_timestamp` in the N1QL predicate.

**Verification.** Storage-layer change, so per `AGENTS.md` step 4 SQLite alone is
insufficient: `make test-scylladb` and `make test-couchbase` must both pass.

**Ships as its own PR** — it is an independent bug fix and is useful without the rest.

---

## Phase 1 — Audit plumbing

### 1.1 Synchronous audit writes

Add to `audit.Provider` (`internal/audit/provider.go`):

```go
// LogEventSync records an audit log entry synchronously and returns the storage
// error. Callers that treat the audit record as part of the operation's contract
// (authorization changes) use this; everything else uses LogEvent.
LogEventSync(ctx context.Context, event Event) error
```

`LogEvent` keeps its current fire-and-forget behaviour so logins and token issuance stay
off the audit DB's hot path. Both share one internal `buildAuditLog(event)` so the
protocol-folding in `metadataWithProtocol` (`provider.go:63-79`) is not duplicated.

Blast radius is small: the only test double is `inviteAudit`
(`internal/service/admin_access_invite_test.go:90`), which embeds `audit.Provider` and so
satisfies a widened interface without edits.

### 1.2 Failure semantics

Ordering is forced: before-snapshot → engine write → after-snapshot → audit write. When
the audit write fails **the authorization change has already persisted**.

Per locked decision 5, no compensation:

```go
if err := p.AuditProvider.LogEventSync(ctx, ev); err != nil {
    log.Error().Err(err).Str("action", ev.Action).Str("object", obj).
        Msg("authorization change applied but NOT audited")
    return nil, nil, err
}
```

Note the log level: `Error`, not the `Debug` used everywhere else in the audit path. The
documented meaning of this error is **"the change was applied but is unevidenced — verify
the live state with `_fga_read_tuples`"**, and the GraphQL/gRPC/REST docs must say so,
because the natural reading of an error is "nothing happened."

Known consequence, accepted: a naïve client retry of `_fga_write_tuples` may then fail on
duplicate tuples. Rejected alternatives and why:

- *Compensating rollback* — a failed compensation leaves **two** unaudited changes, and
  `FgaReset` has no compensation at all.
- *Succeed and flag* — reintroduces exactly the silent evidence gap this spec exists to
  close.

### 1.3 Actor identity

Record what the system already knows; invent no new identity model.

- Add `AuthMode string` to `authctx.Principal` (`internal/authctx/principal.go:42`),
  values `"admin_session"` or `"shared_secret"`. Set it at
  `internal/grpcsrv/interceptors/auth.go:138-139`, which today constructs
  `Principal{IsSuperAdmin: true}` and nothing else. Derive the same value through the gin
  shim on the GraphQL/REST path.
- Emit it as `auth_mode` in the event metadata.
- **Never record the admin session id.** `GetAdminAuthToken` returns a live bearer
  credential and the dashboard renders this table. If per-session correlation is ever
  needed, store a non-reversible hash — not in this spec.
- The shared actor-resolution helper populates `ActorID` / `ActorEmail` whenever a real
  user id is available via `callerTokenData` (`internal/service/caller.go:15`). Every FGA
  operation is super-admin-gated, so in this spec's scope that path never fires and FGA
  rows carry `auth_mode` only. The helper is written to handle it so the org-admin lanes
  get it for free when they are brought in scope later; no org-admin call sites are
  changed here.

This does not make a super-admin action attributable to a person. It records honestly
that it was not. Stated as a known limitation in the docs.

---

## Phase 2 — FGA snapshots

### 2.1 Grain: one audit row per distinct object touched

A write of `[(alice, viewer, doc:1), (bob, editor, doc:2)]` emits **two** audit rows, with
`ResourceID` = `document:1` and `document:2`.

Rationale:

- `_audit_logs(resource_id: "document:1")` answers the question an auditor actually asks —
  "what happened to this object?" — which a single batch row cannot.
- Each row's payload is bounded by the fan-in of one object, not the whole request.
- No invented batch-correlation id.

Rejected alternative: one row per request with a batch id. Smaller write amplification,
but pushes correlation onto the reader and leaves `ResourceID` unusable.

### 2.2 Record shape

Tuple write/delete:

```json
{
  "protocol": "graphql",
  "auth_mode": "shared_secret",
  "op": "write",
  "object": "document:1",
  "delta": [
    {"user": "user:alice", "relation": "viewer", "object": "document:1"}
  ],
  "before": {"tuples": [...], "count": 3, "truncated": false},
  "after":  {"tuples": [...], "count": 4, "truncated": false},
  "concurrent_modification": false
}
```

Model write:

```json
{
  "op": "model_write",
  "auth_mode": "admin_session",
  "before": {"model_id": "01ABC...", "dsl": "model\n  schema 1.1\n..."},
  "after":  {"model_id": "01XYZ...", "dsl": "model\n  schema 1.1\n..."}
}
```

`before` is `null` when no model existed (`engine.ErrNoModel`).

The **delta is always recorded** alongside the snapshots. This is not a hedge against
decision 2 — it is the only field guaranteed complete when a snapshot truncates, and
§2.4 depends on it.

### 2.3 Bounding

DynamoDB's 400KB item limit is the hard ceiling; Cassandra degrades near 100KB. Cells are
`text` / unbounded elsewhere.

- **32KB budget** for the serialized metadata of one row.
- **250 tuples per snapshot side.** A serialized tuple runs ~80-120 bytes, so 2 x 250
  leaves headroom inside the 32KB budget for the delta and envelope. On overflow emit
  `"truncated": true` with the true `count` so the reader knows what they are missing. The
  budget is enforced as the real limit — the tuple cap is the cheap pre-check, and a row
  still over 32KB after it truncates further.
- Snapshot reads **must page** — `ReadTuples` caps at `maxFgaReadPageSize = 100`
  (`admin_fga.go:25`) — looping until the cap or exhaustion.
- **Object fan-out cap.** `maxFgaTuplesPerWrite = 100` (`admin_fga.go:20`) bounds a request
  to 100 tuples and therefore up to 100 distinct objects. Worst case that is 200 engine
  reads plus 100 synchronous inserts for one mutation. Above **20 distinct objects**,
  degrade to a single summary row carrying the full delta and
  `"snapshot_skipped": "too_many_objects"`. Typical writes touch one or two objects.
- Model DSLs: if both DSLs exceed the budget, fall back to `before_model_id` alone. OpenFGA
  retains prior model versions, so the id stays a stable pointer even though nothing
  exposes it for reading yet.

### 2.4 The read-write-read race

OpenFGA offers no transaction spanning before-read → write → after-read. A concurrent
write from another replica pollutes the after-snapshot.

A process mutex does not fix this — multi-replica deployments share one SQL FGA store
(`internal/authorization/engine/openfga/datastore_sql.go`).

Instead, make the record self-checking: compute `expected_after = before ⊕ delta`, compare
against the observed after-snapshot, and set `"concurrent_modification": true` when they
disagree. The auditor sees a flagged row instead of a silent lie. Cost is a set comparison
over already-loaded data.

### 2.5 Per-operation behaviour

| Operation | before | after | Rows |
|---|---|---|---|
| `FgaWriteTuples` (`admin_fga.go:93`) | tuples on each object | tuples on each object | one per object |
| `FgaDeleteTuples` (`:126`) | tuples on each object | tuples on each object | one per object |
| `FgaWriteModel` (`:60`) | active model id + DSL, or `null` | new model id + DSL | one |
| `FgaReset` (`:267`) | active model id + DSL | empty | one, written **before** execution |

`FgaReset` writes its audit row before executing because it cannot be compensated and its
after-state is empty by construction. It already reads tuples for its safety gate
(`:278-283`, which refuses while any tuple exists) — reuse that read rather than adding
another.

### 2.6 Code layout

FGA-specific snapshot and metadata shaping goes in a new
`internal/service/admin_fga_audit.go`, keeping `admin_fga.go` readable and the audit
package generic.

**Constraint:** `admin_gate_test.go:108` statically asserts every admin function calls
`requireSuperAdmin` at top level. Any helper extracted from these functions must preserve
that shape.

---

## Phase 3 — Tests

Per `AGENTS.md`, integration tests use SQLite via `getTestConfig()`.

**Integration** (`internal/integration_tests/`) — assert row *content*, not just presence:

1. Tuple write on a fresh object: exactly one row, `ResourceID` = the object,
   `before.tuples` empty, `after.tuples` contains the new tuple, `delta` matches.
2. Tuple delete: `before` contains it, `after` does not.
3. Multi-object write: one row per distinct object, each scoped to its own object.
4. Object fan-out over the cap: single summary row with `snapshot_skipped`.
5. Snapshot over the tuple cap: `truncated: true` with an accurate `count`.
6. Model write over an existing model: both DSLs present; and over an empty store:
   `before: null`.
7. `FgaReset`: row present with the prior model DSL.
8. Audit-write failure (injected): mutation returns an error **and** the tuples are still
   present via `_fga_read_tuples` — the documented no-compensation contract.
9. `auth_mode` recorded correctly for both header-secret and admin-session auth.

**Storage** (`internal/storage/`): `resource_id`, `resource_type` and timestamp-range
filters return correct results on every backend — the Phase 0 regression test.

**Concurrency:** a unit-level test of the `expected_after` comparison with a synthetic
divergent after-set; a genuine race is not reliably reproducible in CI.

**Full gate before any PR** (`AGENTS.md`): `go build ./...`, `go vet ./...`, `make test`,
at least one non-SQL backend (`make test-scylladb`, `make test-couchbase` for Phase 0),
and `make lint`.

---

## Rollout

Four PRs, each on its own feature branch, never to `main`:

1. `fix/audit-log-filter-parity` — Phase 0.
2. `feat/audit-sync-and-actor-mode` — Phase 1.
3. `feat/fga-change-snapshots` — Phase 2 + Phase 3.
4. Docs: the `_audit_logs` metadata shape, the no-compensation error contract, and the
   stated limitation that super-admin actions are not attributable to a person.

`security-engineer` reviews PRs 2 and 3 — both touch admin auth context and audit
integrity.

Per the established rollout order, after the server ships: dashboard (render the
before/after diff on the audit log page), SDKs, then the docs site.

## Open risks

- **Audit table growth.** Snapshots are far larger than today's `count=N` rows. Retention
  (`DeleteAuditLogsBefore`, currently uncalled) becomes worth wiring. Out of scope; flagged.
- **Write amplification.** Up to 20 synchronous inserts for one multi-object mutation.
  Bounded by the fan-out cap, but it makes admin FGA writes measurably slower. Acceptable
  for an admin-only path.
- **Super-admin remains unattributable.** This spec records *that* it was a shared secret,
  not *who* held it. Genuinely closing this needs named admin accounts.
