# Authorization Change Evidence — Design

**Date:** 2026-09-28
**Status:** Design approved; Phase 0 shipped (authorizerdev/authorizer#802). Phases 1-3 pending review of this spec.
**Scope:** Two defensible claims — every FGA tuple change, and every change to a user's
roles or org membership (see Locked decisions 1)
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

1. **Scope is defined by the claim it makes true, not by a file.**

   An earlier revision scoped this to "FGA only", meaning `internal/service/admin_fga.go`.
   That is not a coherent boundary: **half the FGA tuple mutations in the codebase happen
   elsewhere** (see Phase 2.0). A spec limited to that file would ship, pass its tests, and
   still let an auditor read the log across a window in which SCIM rewrote group
   membership and conclude no authorization change occurred — replacing a known gap with
   false confidence, which is worse.

   Two claims are in scope. Each is stated so a reader can falsify it:

   - **Claim 1 — every FGA tuple change is evidenced.** All 8 engine-mutation call sites,
     plus a static guard test so a ninth cannot be added silently.
   - **Claim 2 — every change to a user's roles or org membership is evidenced.**
     `UpdateUser` roles, `RevokeAccess`/`EnableAccess`, `Add`/`RemoveOrgMember`, SCIM
     org-membership creation, SCIM deactivate/reactivate.

   Deliberately outside both: clients, trusted issuers, org OIDC/SAML connections, SCIM
   endpoints, org domains, SAML IdP keys and service providers (~22 sites). The line is
   *"who can do what" is evidenced; "how the system is configured" is not yet* — and those
   surfaces hold nearly all the credential material that makes redaction risky.
2. **Explicit before/after snapshots**, not replay-derivable deltas. Literal evidence,
   accepting the extra engine reads and the payload-bounding work.
3. **Actor identity: record what exists.** No new auth model. Named admin accounts remain
   a separate future feature.
4. **Synchronous audit for authorization changes only.** Logins and token issuance stay
   asynchronous.
5. **On audit-write failure: return an error, do not compensate.** The change stays
   applied.

## Non-goals

- Infrastructure-configuration surfaces: clients, trusted issuers, org OIDC/SAML
  connections, SCIM endpoints, org domains, SAML IdP keys/SPs. Same mechanism applies
  later. They are deferred because they change rarely and because their rows carry an RSA
  private key (`schemas/saml_idp_key.go:3`), a SCIM `TokenHash` (`scim_endpoint.go:33`)
  and a bcrypt client secret (`client.go:20`) — the redaction allow-list guarding those is
  the one part of this design that can cause a *new* incident, and it should be sized
  against three simple resource types before it has to cover private keys.
- A named-admin identity model (see decision 3).
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
| Couchbase | yes | yes | **ignored** | **ignored** | **ignored** |
| Cassandra/ScyllaDB | yes | yes | **ignored** | **ignored** | **ignored** |

Both broken backends drop the same four filters. (An earlier revision of this table
credited Couchbase with `resource_type`/`resource_id` — that was a misreading of its
SELECT column list; its `WHERE` builder only ever handled `action` and `actor_id`.
Confirmed by running the Phase 0 tests against Couchbase before the fix: all three new
subtests failed. The four "yes" rows are likewise verified by running the tests against
MongoDB, ArangoDB and DynamoDB, not by reading the code.)

A **second bug** surfaced while fixing this: on Scylla, two indexed equalities with no
`ALLOW FILTERING` are rejected outright, which is the query the pre-fix builder emitted.
So `_audit_logs(action:, actor_id:)` — the one combination Cassandra was believed to
support — already errored. No test combined two filters, and the audit integration tests
(`admin_audit_rest_test.go`, `admin_audit_grpc_test.go`) only ever pass `action`. That
absence is the root cause of both bugs, and is why Phase 3 asserts filter behaviour at the
storage layer across every backend rather than once over SQLite.

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
- Couchbase: apply all four missing filters in the N1QL predicate as named parameters.

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

### 1.3 SCIM audit wiring (prerequisite)

`scim.Dependencies` (`internal/service/scim/scim.go:88-100`) holds `Log`,
`StorageProvider`, `MemoryStoreProvider`, `AuthzEngine` and `EventsProvider` — and **no
`AuditProvider`**. The SCIM package therefore cannot audit anything today; the absence is
structural, not an oversight at individual call sites. Add the field and wire it in
`cmd/root.go` alongside the other SCIM dependencies.

Nil-safe: leave SCIM's audit calls no-ops when the provider is nil, matching the existing
convention for `EventsProvider` ("Nil when webhooks are not wired — event firing is then a
no-op").

### 1.4 Actor identity

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

## Phase 2 — Claim 1: every FGA tuple change is evidenced

### 2.0 The eight call sites

`AuthzEngine` mutation calls, enumerated from the tree (excluding `_test.go`):

| Site | Operation | Audited today |
|---|---|---|
| `internal/service/admin_fga.go:72` | `WriteModel` | yes (id only) |
| `internal/service/admin_fga.go:106` | `WriteTuples` | yes (`count=N`) |
| `internal/service/admin_fga.go:139` | `DeleteTuples` | yes (`count=N`) |
| `internal/service/admin_fga.go:286` | `Reset` | yes (nothing) |
| `internal/service/scim/groups.go:303` | `DeleteTuples` (group delete) | **no** |
| `internal/service/scim/groups.go:376` | `WriteTuples` (group members added) | **no** |
| `internal/service/scim/groups.go:382` | `DeleteTuples` (group members removed) | **no** |
| `internal/service/fga.go:446` | `DeleteTuples` (`purgeFgaTuplesForUser`) | **no** |

SCIM Group membership *is* FGA tuples — not a DB column (`scim.go:92-95`) — so an external
IdP rewriting a group is an authorization change that currently leaves no audit row at
all. `purgeFgaTuplesForUser` is called from `DeleteUser` (`admin_users.go:417`): the
deletion is audited, the grants it destroys are not enumerated, so "which access did this
removal actually revoke?" is unanswerable.

The four unaudited sites differ from the admin ones in a way that shapes their treatment:

- **SCIM sites are not super-admin actions.** Actor is the SCIM endpoint —
  `ActorType: service_account`, `ActorID` = the endpoint id, no `auth_mode`.
- **`groups.go:303` is deliberately non-fatal** — a tuple-delete failure there is logged
  and the group row is still removed. Its audit write must preserve that: log at `Error`
  and continue, **not** the return-an-error contract of §1.2. Applying the synchronous
  contract here would turn an accepted partial failure into a failed deprovision.
- **`purgeFgaTuplesForUser` has no natural per-object grain** — it deletes every tuple
  naming one user, so it emits **one** row keyed on `ResourceID` = `user:<id>`, with the
  deleted tuples as the delta. The §2.1 per-object grain does not apply.

### 2.0.1 Static guard test

The gap above exists because nothing enforced it. Mirroring `admin_gate_test.go:108`
(which statically asserts every admin function calls `requireSuperAdmin` at top level),
add a test that parses the tree for `AuthzEngine.WriteTuples` / `DeleteTuples` /
`WriteModel` / `Reset` call sites and fails when one appears without an audit emission in
the enclosing function, against an explicit allow-list of known sites.

This is the cheapest item in the spec and the only one that stops the gap reopening.

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

## Phase 2b — Claim 2: roles and org membership

Row-shaped lanes. `before` is the loaded row, `after` is what the storage call returned —
**no extra reads, no paging, no fan-out cap, and no `expected_after` comparison**; none of
§2.1-2.4 applies.

| Site | Note |
|---|---|
| `UpdateUser` (`admin_users.go:110`) | old roles already in memory at `:315`, discarded today |
| `RevokeAccess` / `EnableAccess` (`admin_access.go`) | |
| `AddOrgMember` (`admin_organizations.go:255`) | |
| `RemoveOrgMember` (`:317`) | a `before` of `{org_id, user_id, roles}` fixes today's dangling `membership.ID` |
| SCIM `AddOrgMembership` (`scim/scim.go:356`) | unaudited today |
| SCIM `deactivate` (`scim/scim.go:458-473`) | sets `RevokedTimestamp`, kills every session; unaudited today |
| SCIM reactivate (`scim/scim.go:412`) | clears `RevokedTimestamp`; unaudited today |

Two hard rules:

1. **Serialize before mutating.** Capture `beforeJSON` *before* any field assignment — not
   by cloning the struct. These handlers mutate the loaded row in place, several fields
   are `*string`, and a shallow copy shares slice backing arrays, so a clone helper would
   silently produce `before == after` and pass a naive test. It is also already the stored
   format.
2. **Snapshot the `schemas.*` row, never the `model.*` response.** Response objects carry
   plaintext secrets exactly once (`CreateClient`, `RotateClientSecret`,
   `RotateScimToken`); the DB row only ever holds the hash. This rule matters most for the
   deferred lanes, but the helper is written now and must enforce it from the start.

**Redaction allow-list**, opt-in per resource type — a deny-list would admit any newly
added secret field by default. In this phase it covers exactly three types: `user`
(excludes the password hash), `organization`, `org_membership`. A guard test enumerates
each schema's fields and fails when an unlisted one appears.

**Lost-update race:** two admins updating one row concurrently means the loser's `before`
is stale. This is the same last-writer-wins semantics the API already has; the snapshot
records what this call saw and wrote. No machinery.

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
10. **SCIM group member add/remove** emits rows with `ActorType: service_account` and the
    endpoint id as `ActorID`.
11. **SCIM group delete** with a failing audit write still deletes the group — the
    non-fatal contract of §2.0, not §1.2.
12. **`DeleteUser`** emits a `purgeFgaTuplesForUser` row keyed `user:<id>` listing the
    destroyed tuples.
13. **Claim 2 lanes:** role change records old and new roles; `RemoveOrgMember` records
    `{org_id, user_id, roles}`; SCIM deactivate records the `RevokedTimestamp` transition.
14. **Redaction:** a user snapshot contains no password hash; the allow-list guard test
    fails when a new schema field is added without a decision.
15. **Serialize-before-mutate:** a role change produces `before != after` — the regression
    test for the in-place-mutation trap.

**Storage** (`internal/storage/`): `resource_id`, `resource_type` and timestamp-range
filters return correct results on every backend — the Phase 0 regression test.

**Static:** the §2.0.1 guard test over `AuthzEngine` mutation call sites.

**Concurrency:** a unit-level test of the `expected_after` comparison with a synthetic
divergent after-set; a genuine race is not reliably reproducible in CI.

**Full gate before any PR** (`AGENTS.md`): `go build ./...`, `go vet ./...`, `make test`,
at least one non-SQL backend (`make test-scylladb`, `make test-couchbase` for Phase 0),
and `make lint`.

---

## Rollout

Six PRs, each on its own feature branch, never to `main`:

1. `fix/audit-log-filter-parity` — Phase 0. **Independent of everything else** — it is a
   standalone bug (the API advertises filters two backends ignore) and ships first rather
   than waiting on this design.
2. `feat/audit-sync-and-actor-mode` — Phase 1, including the SCIM `AuditProvider` wiring.
3. `feat/fga-change-evidence` — Phase 2, all 8 sites + the static guard test.
4. `feat/roles-membership-evidence` — Phase 2b.
5. Tests land with their phase; Phase 3 enumerates them in one place, it is not a
   separate PR.
6. Docs: the `_audit_logs` metadata shape, the no-compensation error contract, and the
   stated limitation that super-admin actions are not attributable to a person.

`security-engineer` reviews PRs 2, 3 and 4 — admin auth context, audit integrity, and the
redaction allow-list.

Per the established rollout order, after the server ships: dashboard (render the
before/after diff on the audit log page), SDKs, then the docs site.

## Open risks

- **Audit table growth.** Snapshots are far larger than today's `count=N` rows. Retention
  (`DeleteAuditLogsBefore`, currently uncalled) becomes worth wiring. Out of scope; flagged.
- **Write amplification.** Up to 20 synchronous inserts for one multi-object mutation.
  Bounded by the fan-out cap, but it makes admin FGA writes measurably slower. Acceptable
  for an admin-only path.
- **The audit table becomes a hard dependency of admin authorization changes.**
  Synchronous writes mean an audit-table outage fails those mutations. In every default
  deployment it is the same database the mutation already wrote to, so the added exposure
  is small — but it is real, and it is the direct cost of decision 4.
- **Deferred surfaces stay unevidenced.** Clients, trusted issuers, org connections, SCIM
  endpoints, domains and SAML IdP keys (~22 sites) keep today's partial records. The
  two-claim framing must be stated plainly in the docs so nobody reads "authorization
  changes are audited" more broadly than it is true.
- **Super-admin remains unattributable.** This spec records *that* it was a shared secret,
  not *who* held it. Genuinely closing this needs named admin accounts.
