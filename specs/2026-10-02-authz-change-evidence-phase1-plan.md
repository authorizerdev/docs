# Authorization Change Evidence — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the audit plumbing that Phase 2 and 2b need — a synchronous audit write that returns its error, a recorded super-admin authentication mode, and an `AuditProvider` reachable from the SCIM package.

**Architecture:** Three additive changes, no behaviour change to any existing caller. `audit.Provider` gains `LogEventSync`; the existing fire-and-forget `LogEvent` is untouched and both share one record builder so they cannot diverge. `token.Provider` gains `AdminAuthMode`, and `IsSuperAdmin` is re-expressed in terms of it so the two can never disagree. `scim.Dependencies` gains a nil-safe `AuditProvider` field.

**Tech Stack:** Go 1.26.6, zerolog, gin, testify, gqlgen, gocql/gocb/gorm storage providers.

**Spec:** `specs/2026-09-28-authz-change-evidence-design.md` (this repo), §Phase 1.

## Global Constraints

- Go 1.26.6 per `go.mod`. Do not raise the floor.
- Never commit to `main`. Branch `feat/audit-sync-and-actor-mode`.
- Run `make fmt` before committing; CI runs `make lint`.
- golangci-lint is pinned to `v2.11.4`. The Makefile installs it **only when no `golangci-lint` is on PATH**, so a newer local binary silently takes precedence and reports findings CI does not. Verify lint against CI, not a local binary of a different version.
- Verification gate before PR (`AGENTS.md`): `go build ./...`, `go vet ./...`, `make test`, `make lint`. No storage provider is modified in this phase, so no non-SQL backend run is required.
- Admin credentials are never written to an audit record. Record the *mode* of authentication, never the session handle or the secret.
- `LogEvent` keeps its exact current signature and fire-and-forget semantics. Logins and token issuance must not acquire a synchronous dependency on the audit table.

## Review Focus

Inputs the spec implies but no task's happy path exercises. Each has its test assigned to the task that owns the code.

1. **`LogEventSync` must fold `Protocol` into metadata exactly as `LogEvent` does.** If the two build their record separately, synchronous events silently lose the `protocol` key and audit queries filtering on it miss them. → Task 1, Step 9.
2. **`AdminAuthMode` must return empty when `AdminSecret` is unset**, even if a matching header is sent. An unconfigured secret must never authenticate, and must never be recorded as though it had. → Task 2, Step 7.
3. **`AdminAuthMode` must respect `DisableAdminHeaderAuth`.** With header auth disabled, a correct secret is not super-admin and must not report `shared_secret`. → Task 2, Step 7.
4. **`inviteAudit` embeds a nil `audit.Provider`.** Widening the interface compiles, but the first caller of `LogEventSync` under that test nil-panics. Phase 1 adds no caller; Phase 2 will. → Task 1, Step 7 adds the stub now.
5. **A nil `AuditProvider` in SCIM must be a no-op, not a panic.** `EventsProvider` already documents this convention; a deployment that does not wire audit must still serve SCIM. → Task 3, Step 1.

---

### Task 1: `LogEventSync` on `audit.Provider`

**Files:**
- Modify: `internal/audit/provider.go`
- Modify: `internal/service/admin_access_invite_test.go:90-92`
- Test: `internal/audit/provider_sync_test.go` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `audit.Provider.LogEventSync(ctx context.Context, event Event) error` — returns the storage error unchanged, `nil` on success. Phase 2 call sites depend on this exact signature.

- [ ] **Step 1: Write the failing test**

Create `internal/audit/provider_sync_test.go`:

```go
package audit

import (
	"context"
	"errors"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/authorizerdev/authorizer/internal/storage"
	"github.com/authorizerdev/authorizer/internal/storage/schemas"
)

// fakeAuditStore records what AddAuditLog received and can be told to fail.
// It embeds storage.Provider (nil) so it satisfies the interface without
// implementing the other ~200 methods; only AddAuditLog is ever called here.
type fakeAuditStore struct {
	storage.Provider
	got *schemas.AuditLog
	err error
}

func (f *fakeAuditStore) AddAuditLog(_ context.Context, l *schemas.AuditLog) error {
	if f.err != nil {
		return f.err
	}
	f.got = l
	return nil
}

func newTestProvider(st storage.Provider) Provider {
	log := zerolog.Nop()
	return New(&Dependencies{Log: &log, StorageProvider: st})
}

func TestLogEventSync_PersistsEventAndReturnsNil(t *testing.T) {
	st := &fakeAuditStore{}
	p := newTestProvider(st)

	err := p.LogEventSync(context.Background(), Event{
		Action:    "admin.fga_tuples_written",
		ActorType: "admin",
		ActorID:   "actor-1",
	})

	require.NoError(t, err)
	require.NotNil(t, st.got)
	assert.Equal(t, "admin.fga_tuples_written", st.got.Action)
	assert.Equal(t, "actor-1", st.got.ActorID)
}

func TestLogEventSync_ReturnsStorageError(t *testing.T) {
	boom := errors.New("audit table unavailable")
	p := newTestProvider(&fakeAuditStore{err: boom})

	err := p.LogEventSync(context.Background(), Event{Action: "admin.fga_reset"})

	require.Error(t, err)
	assert.ErrorIs(t, err, boom, "the storage error must reach the caller unchanged")
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
go test ./internal/audit/ -run TestLogEventSync -v
```

Expected: compile failure — `p.LogEventSync undefined (type Provider has no field or method LogEventSync)`.

- [ ] **Step 3: Extract the shared record builder**

In `internal/audit/provider.go`, add below `metadataWithProtocol`:

```go
// buildAuditLog converts an Event into its storage row. Shared by LogEvent and
// LogEventSync so the two can never disagree about how a record is shaped —
// in particular, both fold Protocol into Metadata via metadataWithProtocol.
func buildAuditLog(event Event) *schemas.AuditLog {
	return &schemas.AuditLog{
		ActorID:      event.ActorID,
		ActorType:    event.ActorType,
		ActorEmail:   event.ActorEmail,
		Action:       event.Action,
		ResourceType: event.ResourceType,
		ResourceID:   event.ResourceID,
		IPAddress:    event.IPAddress,
		UserAgent:    event.UserAgent,
		Metadata:     metadataWithProtocol(event.Metadata, event.Protocol),
	}
}
```

- [ ] **Step 4: Rewrite `LogEvent` to use the builder**

Replace the body of `LogEvent` so it reads:

```go
// LogEvent asynchronously records an audit log entry.
func (p *provider) LogEvent(event Event) {
	asyncutil.Go(p.deps.Log, func() {
		log := p.deps.Log.With().Str("func", "LogEvent").Logger()
		if err := p.deps.StorageProvider.AddAuditLog(context.Background(), buildAuditLog(event)); err != nil {
			log.Debug().Err(err).Str("action", event.Action).Msg("Failed to add audit log")
		}
	})
}
```

- [ ] **Step 5: Add `LogEventSync` to the interface**

In the `Provider` interface, below `LogEvent`:

```go
	// LogEventSync records an audit log entry synchronously and returns the
	// storage error.
	//
	// For operations where the audit record is part of the contract, not a
	// side effect: an authorization change that is not evidenced is a change
	// nobody can account for. Everything else — logins, token issuance —
	// keeps LogEvent, so the audit table stays off those hot paths.
	//
	// The caller decides what a failure means. For authorization changes the
	// convention is to return the error and NOT compensate: by the time this
	// is called the change has already been applied, so the error means
	// "applied but unevidenced", not "nothing happened".
	LogEventSync(ctx context.Context, event Event) error
```

- [ ] **Step 6: Implement `LogEventSync`**

Below `LogEvent` in `internal/audit/provider.go`:

```go
// LogEventSync records an audit log entry synchronously.
func (p *provider) LogEventSync(ctx context.Context, event Event) error {
	return p.deps.StorageProvider.AddAuditLog(ctx, buildAuditLog(event))
}
```

Note it takes the caller's `ctx`, unlike `LogEvent` which uses `context.Background()` because it outlives the request.

- [ ] **Step 7: Add the stub to the existing test double**

`internal/service/admin_access_invite_test.go` has `type inviteAudit struct{ audit.Provider }` with a nil embedded interface. Widening `Provider` still compiles, but the first caller of the new method under that test would nil-panic. Add the stub now, before Phase 2 introduces that caller. After line 92:

```go
func (inviteAudit) LogEventSync(_ context.Context, _ audit.Event) error { return nil }
```

Add `"context"` to that file's imports if absent.

- [ ] **Step 8: Run the tests to verify they pass**

```bash
go build ./... && go test ./internal/audit/ -run TestLogEventSync -v
```

Expected: both tests PASS.

- [ ] **Step 9: Add the protocol-folding regression test** (Review Focus 1)

Append to `internal/audit/provider_sync_test.go`:

```go
func TestLogEventSync_FoldsProtocolIntoMetadataLikeLogEvent(t *testing.T) {
	st := &fakeAuditStore{}
	p := newTestProvider(st)

	require.NoError(t, p.LogEventSync(context.Background(), Event{
		Action:   "admin.fga_tuples_written",
		Protocol: "grpc",
		Metadata: `{"count":2}`,
	}))

	require.NotNil(t, st.got)
	// Both keys must survive: the protocol the caller set, and the metadata it
	// already had. A separate builder for the sync path would drop one.
	assert.JSONEq(t, `{"protocol":"grpc","count":2}`, st.got.Metadata)
}
```

- [ ] **Step 10: Run it**

```bash
go test ./internal/audit/ -v
```

Expected: all PASS, including the pre-existing `metadata_test.go` tests.

- [ ] **Step 11: Verify no existing caller changed behaviour**

```bash
go build ./... && go vet ./... && make test
```

Expected: build and vet clean, 0 test failures. `LogEvent`'s observable behaviour is unchanged — this is the regression check for Step 4.

- [ ] **Step 12: Commit**

```bash
make fmt
git add internal/audit/provider.go internal/audit/provider_sync_test.go internal/service/admin_access_invite_test.go
git commit -m "feat(audit): add LogEventSync for evidence-critical events

Authorization changes need the audit record to be part of the
operation's contract, not a side effect. LogEvent stays fire-and-forget
so logins and token issuance keep the audit table off their hot path.

Both paths share buildAuditLog so they cannot diverge on record
shape — in particular on folding Protocol into Metadata."
```

---

### Task 2: Record how a super-admin authenticated

**Files:**
- Modify: `internal/constants/audit_event.go`
- Modify: `internal/token/provider.go:76-77`
- Modify: `internal/token/admin_token.go:41-63`
- Modify: `internal/authctx/principal.go:10-30`
- Modify: `internal/grpcsrv/interceptors/auth.go:181-184`
- Test: `internal/token/admin_auth_mode_test.go` (create)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `constants.AuditAuthModeAdminSession = "admin_session"`, `constants.AuditAuthModeSharedSecret = "shared_secret"`
  - `token.Provider.AdminAuthMode(gc *gin.Context) string` — one of the two constants, or `""` when the caller is not a super admin.
  - `authctx.Principal.AuthMode string`

Phase 2 reads `Principal.AuthMode` to populate the `auth_mode` key in audit metadata.

- [ ] **Step 1: Add the constants**

At the end of the actor-type block in `internal/constants/audit_event.go`:

```go
// Audit auth-mode constants record HOW a super-admin authenticated.
//
// Super-admin is a single shared AdminSecret, or a session cookie derived from
// it — there is no per-admin identity, so an audit record cannot name a person.
// Recording the mode is the honest alternative: it says which credential was
// used, and makes a shared-secret action distinguishable from a dashboard
// session without inventing an identity the system does not have.
//
// The session HANDLE is never recorded. It is a live bearer credential and the
// dashboard renders the audit table.
const (
	// AuditAuthModeAdminSession means the caller presented a valid admin
	// session cookie (dashboard login).
	AuditAuthModeAdminSession = "admin_session"
	// AuditAuthModeSharedSecret means the caller presented the
	// x-authorizer-admin-secret header.
	AuditAuthModeSharedSecret = "shared_secret"
)
```

- [ ] **Step 2: Write the failing test**

Create `internal/token/admin_auth_mode_test.go`. The existing `internal/token/admin_token_test.go` already provides `newGinCtx(header, value)` and `newProvider(adminSecret, disableHeaderAuth)` in this same package — reuse them, do not add parallel helpers.

```go
package token

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/authorizerdev/authorizer/internal/constants"
)

const adminSecretHeader = "x-authorizer-admin-secret"

func TestAdminAuthMode_SharedSecretWhenHeaderMatches(t *testing.T) {
	p := newProvider("correct-secret", false)
	assert.Equal(t, constants.AuditAuthModeSharedSecret,
		p.AdminAuthMode(newGinCtx(adminSecretHeader, "correct-secret")))
}

func TestAdminAuthMode_EmptyWhenNotSuperAdmin(t *testing.T) {
	p := newProvider("correct-secret", false)
	assert.Equal(t, "", p.AdminAuthMode(newGinCtx(adminSecretHeader, "wrong-secret")))
	assert.Equal(t, "", p.AdminAuthMode(newGinCtx(adminSecretHeader, "")))
	assert.Equal(t, "", p.AdminAuthMode(newGinCtx("", "")))
}

// IsSuperAdmin is re-expressed in terms of AdminAuthMode, so they must agree
// on every input. A divergence would mean a caller is admitted as super-admin
// while the audit record says they are not an admin at all.
func TestIsSuperAdmin_AgreesWithAdminAuthMode(t *testing.T) {
	p := newProvider("correct-secret", false)
	for _, secret := range []string{"correct-secret", "wrong-secret", ""} {
		gc := newGinCtx(adminSecretHeader, secret)
		assert.Equal(t, p.AdminAuthMode(gc) != "", p.IsSuperAdmin(gc),
			"disagreement for secret %q", secret)
	}
}
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
go test ./internal/token/ -run TestAdminAuthMode -v
```

Expected: compile failure — `p.AdminAuthMode undefined`.

- [ ] **Step 4: Add the interface method**

In `internal/token/provider.go`, directly below the `IsSuperAdmin` declaration at line 77:

```go
	// AdminAuthMode reports HOW the caller authenticated as super admin:
	// constants.AuditAuthModeAdminSession, constants.AuditAuthModeSharedSecret,
	// or "" when the caller is not a super admin at all.
	//
	// IsSuperAdmin is defined as AdminAuthMode(gc) != "", so the two cannot
	// disagree about who is an admin.
	AdminAuthMode(gc *gin.Context) string
```

- [ ] **Step 5: Implement it and re-express `IsSuperAdmin`**

Replace `IsSuperAdmin` in `internal/token/admin_token.go` with:

```go
// AdminAuthMode reports how the caller authenticated as super admin, or "" if
// they did not. This is the single place that decision is made; IsSuperAdmin
// is a thin predicate over it.
func (p *provider) AdminAuthMode(gc *gin.Context) string {
	token, err := p.GetAdminAuthToken(gc)
	if err == nil && token != "" {
		return constants.AuditAuthModeAdminSession
	}
	if p.config.DisableAdminHeaderAuth {
		return ""
	}
	// Reject header auth if no AdminSecret is configured — an unconfigured
	// secret must never grant super-admin access.
	if p.config.AdminSecret == "" {
		return ""
	}
	secret := gc.Request.Header.Get("x-authorizer-admin-secret")
	if secret == "" {
		return ""
	}
	// Throttled: this header is an unauthenticated guess at the single
	// highest-privilege credential in the system, and the only limiter in
	// front of it used to be the shared 30rps budget ordinary traffic gets.
	if valid, _ := p.VerifyAdminSecret(utils.GetIP(gc.Request), secret); valid {
		return constants.AuditAuthModeSharedSecret
	}
	return ""
}

// IsSuperAdmin checks if user is super admin
func (p *provider) IsSuperAdmin(gc *gin.Context) bool {
	return p.AdminAuthMode(gc) != ""
}
```

Add `"github.com/authorizerdev/authorizer/internal/constants"` to the imports if absent.

**Behaviour note:** the original returned `token != ""` when `GetAdminAuthToken` succeeded. `GetAdminAuthToken` already returns an error for an empty session id, so `err == nil && token != ""` is the same condition written explicitly.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
go build ./... && go test ./internal/token/ -v
```

Expected: the new tests PASS **and** every pre-existing test in `admin_token_test.go` still passes — including `TestIsSuperAdmin_EmptyAdminSecretRejectsAllHeaderAuth` and `TestIsSuperAdmin_WrongSecretRejected`, which are the regression gate for this rewrite.

- [ ] **Step 7: Add the config-edge tests** (Review Focus 2 and 3)

Append to `internal/token/admin_auth_mode_test.go`:

```go
// An unconfigured secret must never authenticate, and must never be recorded
// as though it had.
func TestAdminAuthMode_EmptyAdminSecretNeverReportsSharedSecret(t *testing.T) {
	p := newProvider("", false)
	assert.Equal(t, "", p.AdminAuthMode(newGinCtx(adminSecretHeader, "")))
	assert.Equal(t, "", p.AdminAuthMode(newGinCtx(adminSecretHeader, "anything")))
}

// With header auth disabled, even the correct secret is not super admin.
func TestAdminAuthMode_RespectsDisableAdminHeaderAuth(t *testing.T) {
	p := newProvider("correct-secret", true)
	assert.Equal(t, "", p.AdminAuthMode(newGinCtx(adminSecretHeader, "correct-secret")))
}
```

- [ ] **Step 8: Run them**

```bash
go test ./internal/token/ -run TestAdminAuthMode -v
```

Expected: all PASS.

- [ ] **Step 9: Add `AuthMode` to `Principal`**

In `internal/authctx/principal.go`, after the `ActorID` field:

```go
	// AuthMode records HOW a super-admin caller authenticated — one of
	// constants.AuditAuthModeAdminSession or
	// constants.AuditAuthModeSharedSecret. Empty for non-admin callers.
	//
	// Super-admin has no per-admin identity (one shared AdminSecret), so an
	// audit record cannot name a person. This records which credential was
	// used instead of leaving the question blank. Never the session handle
	// itself.
	AuthMode string
```

Do not import `constants` here — the field is a plain string and `authctx` is imported widely; keep it dependency-free.

- [ ] **Step 10: Set it in the gRPC interceptor**

In `internal/grpcsrv/interceptors/auth.go`, replace lines 181-184:

```go
			if mode := tp.AdminAuthMode(gc); mode != "" {
				ctx = authctx.WithPrincipal(ctx, &authctx.Principal{IsSuperAdmin: true, AuthMode: mode})
				return handler(ctx, req)
			}
```

This is the same decision as before — `AdminAuthMode(gc) != ""` is exactly `IsSuperAdmin(gc)` — but it carries the mode through instead of discarding it.

- [ ] **Step 11: Verify the whole tree**

```bash
go build ./... && go vet ./... && make test
```

Expected: build and vet clean, 0 test failures. The interceptor's admit/deny behaviour is unchanged; only the principal gained a field.

- [ ] **Step 12: Commit**

```bash
make fmt
git add internal/constants/audit_event.go internal/token/provider.go internal/token/admin_token.go internal/token/admin_auth_mode_test.go internal/authctx/principal.go internal/grpcsrv/interceptors/auth.go
git commit -m "feat(audit): record how a super-admin authenticated

Super-admin is one shared AdminSecret with no per-admin identity, so an
audit record cannot name a person. Recording the credential MODE is the
honest alternative, and makes a shared-secret action distinguishable
from a dashboard session.

IsSuperAdmin is now a predicate over AdminAuthMode so the admit decision
and the recorded mode cannot disagree. The session handle is never
recorded — it is a live bearer credential and the dashboard renders this
table."
```

---

### Task 3: Make `AuditProvider` reachable from SCIM

**Files:**
- Modify: `internal/service/scim/scim.go:86-100`
- Modify: `cmd/root.go:815-821`
- Test: `internal/service/scim/audit_wiring_test.go` (create)

**Interfaces:**
- Consumes: `audit.Provider` (unchanged by Task 1 for this purpose — only the field type matters).
- Produces: `scim.Dependencies.AuditProvider audit.Provider`, and `(*provider).logAuditSync(ctx, audit.Event) error` — a nil-safe wrapper Phase 2 calls from the SCIM group paths.

**Why this is in Phase 1 rather than Phase 2:** the SCIM package has no `AuditProvider` *at all*, so it cannot audit anything. That absence is structural and blocks four of the eight call sites in Phase 2. Wiring it here keeps Phase 2 to one concern. It does mean Phase 1 ships a dependency with no caller yet — accepted deliberately, and Step 1's test pins the nil-safety contract so the field is not merely decorative.

- [ ] **Step 1: Write the failing test**

Create `internal/service/scim/audit_wiring_test.go`:

```go
package scim

import (
	"context"
	"errors"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/authorizerdev/authorizer/internal/audit"
)

type recordingAudit struct {
	audit.Provider
	got audit.Event
	err error
}

func (r *recordingAudit) LogEventSync(_ context.Context, e audit.Event) error {
	if r.err != nil {
		return r.err
	}
	r.got = e
	return nil
}

// scim's concrete type embeds Dependencies BY VALUE (`type provider struct {
// Dependencies }`), so fields are reached as p.AuditProvider, not p.deps.X.
func newAuditTestProvider(ap audit.Provider) *provider {
	log := zerolog.Nop()
	return &provider{Dependencies: Dependencies{Log: &log, AuditProvider: ap}}
}

// A deployment that does not wire audit must still serve SCIM, matching the
// documented EventsProvider convention.
func TestLogAuditSync_NilProviderIsNoOp(t *testing.T) {
	p := newAuditTestProvider(nil)
	assert.NotPanics(t, func() {
		require.NoError(t, p.logAuditSync(context.Background(), audit.Event{Action: "x"}))
	})
}

func TestLogAuditSync_ForwardsEvent(t *testing.T) {
	ra := &recordingAudit{}
	p := newAuditTestProvider(ra)

	require.NoError(t, p.logAuditSync(context.Background(), audit.Event{Action: "scim.group_members_added"}))

	assert.Equal(t, "scim.group_members_added", ra.got.Action)
}

func TestLogAuditSync_PropagatesError(t *testing.T) {
	boom := errors.New("audit unavailable")
	p := newAuditTestProvider(&recordingAudit{err: boom})

	assert.ErrorIs(t, p.logAuditSync(context.Background(), audit.Event{Action: "x"}), boom)
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
go test ./internal/service/scim/ -run TestLogAuditSync -v
```

Expected: compile failure — `unknown field AuditProvider` and `p.logAuditSync undefined`.

- [ ] **Step 3: Add the dependency field**

In `internal/service/scim/scim.go`, after `EventsProvider` in `Dependencies`:

```go
	// AuditProvider records authorization-relevant SCIM operations. SCIM is
	// driven by an external IdP, so its writes are the least supervised
	// authorization changes in the system — and until this field existed the
	// package could not audit at all.
	//
	// Nil when audit is not wired — logging is then a no-op, matching the
	// EventsProvider convention above.
	AuditProvider audit.Provider
```

Add `"github.com/authorizerdev/authorizer/internal/audit"` to the imports.

- [ ] **Step 4: Add the nil-safe wrapper**

In `internal/service/scim/scim.go`, below the `Dependencies` struct:

```go
// logAuditSync records an audit event synchronously, returning the storage
// error. A nil AuditProvider is a no-op returning nil.
//
// Callers decide what a failure means: the SCIM group paths that treat a tuple
// write as non-fatal must treat a failed audit the same way, or an accepted
// partial failure becomes a failed deprovision.
func (p *provider) logAuditSync(ctx context.Context, event audit.Event) error {
	if p.AuditProvider == nil {
		return nil
	}
	return p.AuditProvider.LogEventSync(ctx, event)
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
go build ./... && go test ./internal/service/scim/ -run TestLogAuditSync -v
```

Expected: all three PASS.

- [ ] **Step 6: Wire it in `cmd/root.go`**

At `cmd/root.go:815`, add to the `scim.Dependencies` literal:

```go
		AuditProvider:       auditProvider,
```

`auditProvider` is already in scope — constructed at `cmd/root.go:704`.

- [ ] **Step 7: Verify the whole tree**

```bash
go build ./... && go vet ./... && make test
```

Expected: build and vet clean, 0 test failures.

- [ ] **Step 8: Confirm the wiring actually reaches a running server**

```bash
make smoke
```

Expected: PASS. `make smoke` builds the real binary and boots it, so it is the only check that proves `cmd/root.go` still wires a working server — a `Dependencies` literal mistake would not show up in unit tests. Per `AGENTS.md`, smoke is the right gate whenever `cmd/root.go` is touched.

- [ ] **Step 9: Commit**

```bash
make fmt
git add internal/service/scim/scim.go internal/service/scim/audit_wiring_test.go cmd/root.go
git commit -m "feat(scim): give the SCIM service an audit provider

scim.Dependencies had no AuditProvider at all, so the package could not
audit anything — an external IdP could provision users, create org
memberships, revoke access and rewrite FGA group tuples leaving no audit
row. That absence is structural, and blocks half the call sites in the
next phase.

Nil-safe, matching the EventsProvider convention. No events are emitted
yet; the call sites land with the phase that needs them."
```

---

## Deviations from the spec

Two, both deliberate; a reviewer comparing plan to spec should see them called out rather than assume an omission.

1. **Spec §1.4 says the shared actor-resolution helper that populates `ActorID`/`ActorEmail` is "written now".** This plan does not write it. Every FGA operation is super-admin gated, so in Phase 1's scope that helper would have zero callers — speculative code with no test that can fail meaningfully. Phase 2b brings the org-admin lanes that actually use it, and it should land there with its first consumer. Only `auth_mode` is implemented here, which is what Phase 2 consumes.

2. **Spec §1.2's failure semantics are documented, not coded.** The "return the error, do not compensate" contract belongs to the *callers* of `LogEventSync`, and all of them arrive in Phase 2. It is captured in the interface doc comment on `LogEventSync` so the contract travels with the method rather than living only in the spec.

**Honest framing for the PR:** this phase adds no new audit records and changes no observable behaviour. Its tests are unit-level by necessity — the consumers arrive in Phase 2. It is split out because Phase 2 is already 8 call sites plus snapshots plus a static guard test, and bundling the plumbing would make it unreviewable.

## Final verification before opening the PR

- [ ] `go build ./...` — clean
- [ ] `go vet ./...` — clean
- [ ] `make test` — 0 failures
- [ ] `make smoke` — PASS (required: `cmd/root.go` changed)
- [ ] `make lint` — clean. If a local `golangci-lint` of a version other than the pinned `v2.11.4` is on PATH, it will report findings CI does not; trust CI.
- [ ] No storage provider changed, so no non-SQL backend run is required. Confirm with `git diff --stat main -- internal/storage/` returning empty.
- [ ] Branch is `feat/audit-sync-and-actor-mode`, not `main`.
- [ ] PR body states plainly that this phase adds no new audit records — it is the plumbing Phase 2 consumes — so a reviewer does not go looking for behaviour changes that are not there.
- [ ] Request `security-engineer` review: this touches admin auth context and the audit path.
