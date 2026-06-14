# AuthorizerAdminService Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the 32 active `_`-prefixed admin GraphQL operations as a gRPC `AuthorizerAdminService` + REST surface, with logic migrated into `internal/service`, served by the same gRPC server and gateway as the public API.

**Architecture:** Mirror the public `AuthorizerService` pattern (PR #620). Logic lives in transport-agnostic `internal/service` (new `AdminProvider` interface, implemented by the existing `*provider`). GraphQL resolvers, the new gRPC `AdminHandler`, and grpc-gateway REST all delegate to it. New proto file `proto/authorizer/v1/admin.proto` in package `authorizer.v1`. Admin auth via shared `requireSuperAdmin(meta)`.

**Tech Stack:** Go 1.24, buf/protovalidate, grpc-gateway v2, gqlgen, gin shim, zerolog. Reference design: `specs/2026-06-15-authorizer-admin-service-design.md`.

---

## Conventions used throughout this plan

- **Branch:** all work on `feat/authorizer-admin-api` in the server repo. Never commit to main.
- **Proto regen:** after editing any `.proto`, run `make proto-gen` (runs `buf generate`). Generated code lands under `gen/go/...` — never hand-edit it.
- **Build check:** `go build ./...` after every Go change.
- **Single-op integration test run:**
  `go clean --testcache && TEST_DBS="sqlite" go test -p 1 -v -run TestAdmin<Name> ./internal/integration_tests/`
- **Smoke test run:** `go test -v -run TestReleaseSmoke ./internal/e2e/`
- **Proto lint/breaking:** `make proto-lint && make proto-breaking`.
- **Commit cadence:** one commit per task (per op or per scaffolding unit). Commit messages: `feat(admin-api): <op>` / `chore(admin-api): <scaffolding>`.

## File structure

**Create:**
- `proto/authorizer/v1/admin.proto` — `AuthorizerAdminService` + admin messages.
- `internal/grpcsrv/handlers/admin.go` — `AdminHandler`, delegates to `service.AdminProvider`.
- `internal/grpcsrv/handlers/admin_project.go` — proto↔model projections for admin types (Webhook, EmailTemplate, AuditLog, AdminMeta, lists).
- `internal/service/admin_provider.go` — `AdminProvider` interface + `requireSuperAdmin` helper.
- `internal/service/admin_auth.go` — AdminLogin/Logout/Session/Meta.
- `internal/service/admin_users.go` — Users/User/UpdateUser/DeleteUser/VerificationRequests.
- `internal/service/admin_access.go` — RevokeAccess/EnableAccess/InviteMembers.
- `internal/service/admin_webhooks.go` — webhook ops + TestEndpoint + WebhookLogs.
- `internal/service/admin_email_templates.go` — email-template ops.
- `internal/service/admin_audit.go` — AuditLogs.
- `internal/service/admin_fga.go` — FGA admin ops (or extend existing `fga.go`).
- `internal/integration_tests/admin_grpc_test.go` — admin gRPC/REST integration tests.

**Modify:**
- `internal/grpcsrv/server.go` — register `AuthorizerAdminService` on the same `*grpc.Server`.
- `internal/gateway/mount.go` — register admin gateway handler in `registerAll`; add `WithIncomingHeaderMatcher`.
- `internal/grpcsrv/transport/grpc_metadata.go` — carry `x-authorizer-admin-secret` onto `synthRequest`.
- `internal/service/provider.go` — assert `*provider` implements `AdminProvider`.
- The 32 admin resolvers under `internal/graphql/*.go` — refactor to thin adapters.
- `internal/e2e/smoke_test.go` — admin REST + gRPC + fail-closed coverage.

---

## Phase 0 — Scaffolding

### Task 0.1: Branch + empty admin.proto compiles

**Files:**
- Create: `proto/authorizer/v1/admin.proto`

- [ ] **Step 1: Create branch**

```bash
cd /Users/lakhansamani/personal/authorizer/authorizer
git checkout main && git pull --ff-only
git checkout -b feat/authorizer-admin-api
```

- [ ] **Step 2: Create the proto skeleton**

```proto
// proto/authorizer/v1/admin.proto
//
// AuthorizerAdminService exposes Authorizer's super-admin-only operations
// (the `_`-prefixed GraphQL queries/mutations). It is registered on the SAME
// grpc.Server and gateway mux as AuthorizerService. Every RPC requires
// super-admin auth (admin session cookie or x-authorizer-admin-secret header)
// except AdminLogin, which establishes it. Admin operations are intentionally
// NOT exposed over MCP.
syntax = "proto3";

package authorizer.v1;

import "buf/validate/validate.proto";
import "google/api/annotations.proto";
import "authorizer/v1/types.proto";
import "authorizer/v1/authorizer.proto";

service AuthorizerAdminService {
}
```

- [ ] **Step 3: Generate + build**

Run: `make proto-gen && go build ./...`
Expected: PASS (no service methods yet; empty service is valid).

- [ ] **Step 4: Lint**

Run: `make proto-lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add proto/authorizer/v1/admin.proto gen/
git commit -m "chore(admin-api): scaffold AuthorizerAdminService proto"
```

### Task 0.2: AdminProvider interface + requireSuperAdmin helper

**Files:**
- Create: `internal/service/admin_provider.go`
- Modify: `internal/service/provider.go`

- [ ] **Step 1: Write the failing test**

```go
// internal/service/admin_provider_test.go
package service

import "testing"

// Compile-time guarantee that *provider satisfies AdminProvider.
func TestProviderImplementsAdminProvider(t *testing.T) {
	var _ AdminProvider = (*provider)(nil)
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `go test ./internal/service/ -run TestProviderImplementsAdminProvider`
Expected: FAIL — `AdminProvider` undefined.

- [ ] **Step 3: Define the interface + helper**

```go
// internal/service/admin_provider.go
package service

import (
	"context"

	"github.com/gin-gonic/gin"

	"github.com/authorizerdev/authorizer/internal/graph/model"
)

// AdminProvider is the transport-agnostic API for Authorizer's super-admin
// operations. The same concrete *provider that implements Provider also
// implements AdminProvider; the interface is split to keep the public
// Provider focused. Each method requires super-admin auth (enforced via
// requireSuperAdmin) except AdminLogin.
type AdminProvider interface {
	// Auth + meta.
	AdminLogin(ctx context.Context, meta RequestMetadata, params *model.AdminLoginRequest) (*model.Response, *ResponseSideEffects, error)
	AdminLogout(ctx context.Context, meta RequestMetadata) (*model.Response, *ResponseSideEffects, error)
	AdminSession(ctx context.Context, meta RequestMetadata) (*model.Response, *ResponseSideEffects, error)
	AdminMeta(ctx context.Context, meta RequestMetadata) (*model.AdminMeta, *ResponseSideEffects, error)
	// Users.
	Users(ctx context.Context, meta RequestMetadata, params *model.PaginatedRequest) (*model.Users, *ResponseSideEffects, error)
	User(ctx context.Context, meta RequestMetadata, params *model.GetUserRequest) (*model.User, *ResponseSideEffects, error)
	UpdateUser(ctx context.Context, meta RequestMetadata, params *model.UpdateUserRequest) (*model.User, *ResponseSideEffects, error)
	DeleteUser(ctx context.Context, meta RequestMetadata, params *model.DeleteUserRequest) (*model.Response, *ResponseSideEffects, error)
	VerificationRequests(ctx context.Context, meta RequestMetadata, params *model.PaginatedRequest) (*model.VerificationRequests, *ResponseSideEffects, error)
	// Access.
	RevokeAccess(ctx context.Context, meta RequestMetadata, params *model.UpdateAccessRequest) (*model.Response, *ResponseSideEffects, error)
	EnableAccess(ctx context.Context, meta RequestMetadata, params *model.UpdateAccessRequest) (*model.Response, *ResponseSideEffects, error)
	InviteMembers(ctx context.Context, meta RequestMetadata, params *model.InviteMemberRequest) (*model.InviteMembersResponse, *ResponseSideEffects, error)
	// Webhooks.
	AddWebhook(ctx context.Context, meta RequestMetadata, params *model.AddWebhookRequest) (*model.Response, *ResponseSideEffects, error)
	UpdateWebhook(ctx context.Context, meta RequestMetadata, params *model.UpdateWebhookRequest) (*model.Response, *ResponseSideEffects, error)
	DeleteWebhook(ctx context.Context, meta RequestMetadata, params *model.WebhookRequest) (*model.Response, *ResponseSideEffects, error)
	Webhook(ctx context.Context, meta RequestMetadata, params *model.WebhookRequest) (*model.Webhook, *ResponseSideEffects, error)
	Webhooks(ctx context.Context, meta RequestMetadata, params *model.PaginatedRequest) (*model.Webhooks, *ResponseSideEffects, error)
	WebhookLogs(ctx context.Context, meta RequestMetadata, params *model.ListWebhookLogRequest) (*model.WebhookLogs, *ResponseSideEffects, error)
	TestEndpoint(ctx context.Context, meta RequestMetadata, params *model.TestEndpointRequest) (*model.TestEndpointResponse, *ResponseSideEffects, error)
	// Email templates.
	AddEmailTemplate(ctx context.Context, meta RequestMetadata, params *model.AddEmailTemplateRequest) (*model.Response, *ResponseSideEffects, error)
	UpdateEmailTemplate(ctx context.Context, meta RequestMetadata, params *model.UpdateEmailTemplateRequest) (*model.Response, *ResponseSideEffects, error)
	DeleteEmailTemplate(ctx context.Context, meta RequestMetadata, params *model.DeleteEmailTemplateRequest) (*model.Response, *ResponseSideEffects, error)
	EmailTemplates(ctx context.Context, meta RequestMetadata, params *model.PaginatedRequest) (*model.EmailTemplates, *ResponseSideEffects, error)
	// Audit.
	AuditLogs(ctx context.Context, meta RequestMetadata, params *model.ListAuditLogRequest) (*model.AuditLogs, *ResponseSideEffects, error)
	// FGA admin.
	FgaWriteModel(ctx context.Context, meta RequestMetadata, params *model.FgaWriteModelInput) (*model.FgaModel, *ResponseSideEffects, error)
	FgaWriteTuples(ctx context.Context, meta RequestMetadata, params *model.FgaWriteTuplesInput) (*model.Response, *ResponseSideEffects, error)
	FgaDeleteTuples(ctx context.Context, meta RequestMetadata, params *model.FgaWriteTuplesInput) (*model.Response, *ResponseSideEffects, error)
	FgaReset(ctx context.Context, meta RequestMetadata) (*model.Response, *ResponseSideEffects, error)
	FgaGetModel(ctx context.Context, meta RequestMetadata) (*model.FgaModel, *ResponseSideEffects, error)
	FgaReadTuples(ctx context.Context, meta RequestMetadata, params *model.FgaReadTuplesInput) (*model.FgaTuples, *ResponseSideEffects, error)
	FgaListUsers(ctx context.Context, meta RequestMetadata, params *model.FgaListUsersInput) (*model.FgaListUsersResponse, *ResponseSideEffects, error)
	FgaExpand(ctx context.Context, meta RequestMetadata, params *model.FgaExpandInput) (*model.FgaExpandResponse, *ResponseSideEffects, error)
}

// requireSuperAdmin enforces super-admin auth in the transport-agnostic layer.
// It reuses the existing gin-shim pattern (meta.Request carries headers +
// cookies synthesized by transport.MetaFromGRPC / service.MetaFromGin) so the
// same TokenProvider.IsSuperAdmin check runs identically over GraphQL, gRPC,
// and REST. Returns ErrUnauthorized (mapped to codes.Unauthenticated) if the
// caller is not a super admin.
func (p *provider) requireSuperAdmin(meta RequestMetadata) error {
	gc := &gin.Context{Request: meta.Request}
	if !p.TokenProvider.IsSuperAdmin(gc) {
		return ErrUnauthorized
	}
	return nil
}
```

- [ ] **Step 4: Add ErrUnauthorized if missing**

Check `internal/service/errors.go` for an unauthorized sentinel. If none maps to `codes.Unauthenticated`, add:

```go
// ErrUnauthorized indicates the caller failed authentication (no/invalid
// admin credentials). Mapped to codes.Unauthenticated by the gRPC ErrorMap
// interceptor and to HTTP 401 by the REST gateway.
var ErrUnauthorized = NewError(ErrCodeUnauthorized, "unauthorized")
```

Verify the error code → gRPC status mapping in `internal/grpcsrv/interceptors/errormap.go` covers it (Unauthenticated → 401). Add the mapping if absent.

- [ ] **Step 5: Build**

Run: `go build ./...`
Expected: FAIL — interface methods not yet implemented on `*provider`. This is expected; the compile-time assertion test will pass only after the methods land. Temporarily comment out the assertion test body until Phase 1+ methods exist, OR keep the test and let it gate the final phase.

> NOTE: To keep the tree compiling during the staged migration, do NOT add the
> `var _ AdminProvider = (*provider)(nil)` assertion to `provider.go` until ALL
> methods are implemented (end of Phase 8). Keep the assertion test file but
> guard it with a build tag `//go:build adminprovider_complete` until then.

- [ ] **Step 6: Commit**

```bash
git add internal/service/admin_provider.go internal/service/admin_provider_test.go internal/service/errors.go
git commit -m "chore(admin-api): define AdminProvider interface + requireSuperAdmin"
```

### Task 0.3: AdminHandler skeleton (registered, all Unimplemented)

**Files:**
- Create: `internal/grpcsrv/handlers/admin.go`
- Modify: `internal/grpcsrv/server.go`

- [ ] **Step 1: Create the handler skeleton**

```go
// internal/grpcsrv/handlers/admin.go
//
// AdminHandler implements authorizer.v1.AuthorizerAdminService. It embeds the
// generated UnimplementedAuthorizerAdminServiceServer so any not-yet-migrated
// RPC returns codes.Unimplemented. Methods are filled in one domain group at a
// time, each delegating to service.AdminProvider following the public
// AuthorizerHandler pattern.
package handlers

import (
	authorizerv1 "github.com/authorizerdev/authorizer/gen/go/authorizer/v1"
	"github.com/authorizerdev/authorizer/internal/service"
)

// AdminHandler serves the admin gRPC/REST surface.
type AdminHandler struct {
	authorizerv1.UnimplementedAuthorizerAdminServiceServer
	Service service.AdminProvider
}
```

- [ ] **Step 2: Register on the same gRPC server**

In `internal/grpcsrv/server.go`, after the existing `RegisterAuthorizerServiceServer` line, add:

```go
	// Admin surface on the SAME server. AdminHandler embeds
	// UnimplementedAuthorizerAdminServiceServer; migrated RPCs override the
	// stubs. deps.ServiceProvider satisfies both Provider and AdminProvider.
	authorizerv1.RegisterAuthorizerAdminServiceServer(srv, &handlers.AdminHandler{Service: deps.ServiceProvider})
```

Note: `deps.ServiceProvider` is typed `service.Provider`. Change `Dependencies.ServiceProvider` to a type that satisfies both, or pass the concrete provider. Simplest: keep the field as `service.Provider` and add `AdminProvider` to the same value via a second field, OR widen the field. Recommended: change `server.Dependencies.ServiceProvider` to an interface embedding both:

```go
// in server.go Dependencies
ServiceProvider interface {
	service.Provider
	service.AdminProvider
}
```

Confirm the value wired in `cmd/root.go` (the concrete `*service.provider` via `service.New(...)`) satisfies both. (It will once Phase 8 completes; until then the build needs all methods — so register the admin server but keep the field as `service.Provider` and type-assert inside, OR defer this registration line until Phase 1 lands at least the stubs. Recommended: do registration here but only after Task 0.2's methods compile. Since methods aren't implemented yet, gate by implementing a no-op `*provider` set first — see Step 3.)

- [ ] **Step 3: Make it compile now (stub methods)**

To keep main compiling before per-op work, the `UnimplementedAuthorizerAdminServiceServer` embed already provides all RPC stubs for the HANDLER. The blocker is `*service.provider` not yet implementing `AdminProvider`. Resolve by widening the handler field to the concrete need only when methods exist. For Phase 0, set `AdminHandler.Service` to `service.AdminProvider` but wire it in `server.go` using the same `deps.ServiceProvider` value and keep `Dependencies.ServiceProvider service.Provider`; cast with a runtime assertion:

```go
	adminSvc, _ := deps.ServiceProvider.(service.AdminProvider)
	authorizerv1.RegisterAuthorizerAdminServiceServer(srv, &handlers.AdminHandler{Service: adminSvc})
```

This compiles immediately (interface assertion), and `adminSvc` becomes non-nil once `*provider` implements all methods. RPCs invoked before then hit the Unimplemented stub.

- [ ] **Step 4: Build + commit**

Run: `make proto-gen && go build ./...`
Expected: PASS.

```bash
git add internal/grpcsrv/handlers/admin.go internal/grpcsrv/server.go
git commit -m "chore(admin-api): register AdminHandler on shared gRPC server"
```

### Task 0.4: Gateway wiring + admin-secret header forwarding

**Files:**
- Modify: `internal/gateway/mount.go`, `internal/grpcsrv/transport/grpc_metadata.go`

- [ ] **Step 1: Register admin gateway handler**

In `registerAll` (`internal/gateway/mount.go`), add after the existing registrar:

```go
	if err := authorizerv1.RegisterAuthorizerAdminServiceHandler(ctx, mux, conn); err != nil {
		return err
	}
	return nil
```

(Convert the existing single `return` into the two-registrar form.)

- [ ] **Step 2: Forward the custom admin-secret header**

In the `runtime.NewServeMux(...)` options in `mount.go`, add:

```go
		// Forward the custom admin-secret header to the gRPC layer. The
		// default matcher only forwards permanent headers (Authorization,
		// Cookie); admin header-auth needs x-authorizer-admin-secret too.
		runtime.WithIncomingHeaderMatcher(func(key string) (string, bool) {
			if strings.EqualFold(key, "x-authorizer-admin-secret") {
				return key, true
			}
			return runtime.DefaultHeaderMatcher(key)
		}),
```

Add `"strings"` to imports.

- [ ] **Step 3: Carry admin-secret onto the synth request**

In `internal/grpcsrv/transport/grpc_metadata.go`, in `MetaFromGRPC`, after building `meta` and before `synthRequest`, capture the header; and in `synthRequest`, set it on the request. Add a field to `RequestMetadata` if a generic header map isn't present:

```go
	// in MetaFromGRPC, extend meta:
	meta.AdminSecret = firstHeader(md, "x-authorizer-admin-secret", "grpcgateway-x-authorizer-admin-secret")
```

```go
	// in synthRequest:
	if meta.AdminSecret != "" {
		req.Header.Set("x-authorizer-admin-secret", meta.AdminSecret)
	}
```

Add `AdminSecret string` to the `service.RequestMetadata` struct (in `internal/service/sideeffects.go`) and populate it in `MetaFromGin` too:

```go
	// in MetaFromGin:
	AdminSecret: gc.GetHeader("x-authorizer-admin-secret"),
```

- [ ] **Step 4: Build + commit**

Run: `go build ./...`
Expected: PASS.

```bash
git add internal/gateway/mount.go internal/grpcsrv/transport/grpc_metadata.go internal/service/sideeffects.go
git commit -m "chore(admin-api): wire admin gateway + forward admin-secret header"
```

---

## Per-op pattern (CANONICAL — applies to every op in Phases 1–8)

Each operation is implemented with these five units. Phase 1, Task 1.1 shows
the FULL code for `AdminMeta` as the reference. Every later op repeats this
exact structure; its task lists only the concrete deltas (proto RPC + messages,
service method body source, projection notes, REST path/verb).

1. **Proto** — add the RPC to `AuthorizerAdminService` + request/response
   messages to `admin.proto`. REST annotation under `/v1/admin/...`. Run
   `make proto-gen`.
2. **Service method** — implement on `*provider` in the relevant
   `internal/service/admin_*.go` file. First line (except AdminLogin):
   `if err := p.requireSuperAdmin(meta); err != nil { return nil, nil, err }`.
   Body migrated verbatim from the GraphQL resolver, replacing
   `utils.GinContextFromContext(ctx)` usage with `meta`/the gin shim.
3. **Resolver refactor** — replace the body in `internal/graphql/<op>.go` with
   a thin delegation: `res, _, err := g.ServiceProvider.<Method>(ctx, service.MetaFromGin(gc), params); return res, err`.
4. **gRPC handler method** — in `admin.go`, delegate to `h.Service.<Method>`,
   project model→proto, apply side effects.
5. **Test** — integration test exercising the op over gRPC + REST (and a
   fail-closed case for auth-gated reads/mutations).

---

## Phase 1 — Admin auth + meta (4 ops)

### Task 1.1: `_admin_meta` (CANONICAL — full code)

**Files:**
- Modify: `proto/authorizer/v1/admin.proto`, `internal/grpcsrv/handlers/admin.go`, `internal/grpcsrv/handlers/admin_project.go` (create), `internal/graphql/admin_meta.go`
- Create: `internal/service/admin_auth.go`, `internal/integration_tests/admin_grpc_test.go`

- [ ] **Step 1: Add proto RPC + messages**

```proto
// in service AuthorizerAdminService:
  // AdminMeta returns admin-only configuration metadata (configured roles,
  // etc.). Requires super-admin auth.
  rpc AdminMeta(AdminMetaRequest) returns (AdminMetaResponse) {
    option (google.api.http) = {get: "/v1/admin/meta"};
  }

// messages (mirror fields of model.AdminMeta in internal/graph/model):
message AdminMetaRequest {}
message AdminMetaResponse {
  AdminMeta admin_meta = 1;
}
message AdminMeta {
  // mirror every field of model.AdminMeta (e.g. version, configured roles,
  // default roles, protected roles). Use string/bool/repeated string to match
  // the model. EmitUnpopulated keeps zero values visible to REST.
  string version = 1;
  repeated string roles = 2;
  repeated string default_roles = 3;
  repeated string protected_roles = 4;
}
```

> Inspect `internal/graph/model` AdminMeta to confirm exact fields and adjust
> the message fields 1:1 before generating.

- [ ] **Step 2: Generate**

Run: `make proto-gen && make proto-lint`
Expected: PASS.

- [ ] **Step 3: Service method**

```go
// internal/service/admin_auth.go
package service

import (
	"context"

	"github.com/authorizerdev/authorizer/internal/graph/model"
)

// AdminMeta returns admin-only configuration metadata. Requires super admin.
// Logic migrated from internal/graphql/admin_meta.go.
func (p *provider) AdminMeta(ctx context.Context, meta RequestMetadata) (*model.AdminMeta, *ResponseSideEffects, error) {
	if err := p.requireSuperAdmin(meta); err != nil {
		return nil, nil, err
	}
	// <body migrated from graphqlProvider.AdminMeta — build *model.AdminMeta
	// from p.Config; no gin.Context needed beyond the auth check>
	res := &model.AdminMeta{ /* fields from p.Config, per original resolver */ }
	return res, nil, nil
}
```

> Open `internal/graphql/admin_meta.go` and copy its construction logic into
> the body, dropping the inline `IsSuperAdmin` check (now handled by
> requireSuperAdmin).

- [ ] **Step 4: Resolver refactor**

```go
// internal/graphql/admin_meta.go
func (g *graphqlProvider) AdminMeta(ctx context.Context) (*model.AdminMeta, error) {
	gc, _ := utils.GinContextFromContext(ctx)
	res, _, err := g.ServiceProvider.AdminMeta(ctx, service.MetaFromGin(gc))
	return res, err
}
```

- [ ] **Step 5: Projection + handler**

```go
// internal/grpcsrv/handlers/admin_project.go
package handlers

import (
	"github.com/authorizerdev/authorizer/internal/graph/model"
	authorizerv1 "github.com/authorizerdev/authorizer/gen/go/authorizer/v1"
)

func projectAdminMeta(m *model.AdminMeta) *authorizerv1.AdminMeta {
	if m == nil {
		return nil
	}
	return &authorizerv1.AdminMeta{
		Version:        m.Version,
		Roles:          m.Roles,
		DefaultRoles:   m.DefaultRoles,
		ProtectedRoles: m.ProtectedRoles,
	}
}
```

```go
// internal/grpcsrv/handlers/admin.go
func (h *AdminHandler) AdminMeta(ctx context.Context, _ *authorizerv1.AdminMetaRequest) (*authorizerv1.AdminMetaResponse, error) {
	res, _, err := h.Service.AdminMeta(ctx, transport.MetaFromGRPC(ctx))
	if err != nil {
		return nil, err
	}
	return &authorizerv1.AdminMetaResponse{AdminMeta: projectAdminMeta(res)}, nil
}
```

Add imports: `context`, `transport`, `authorizerv1`.

- [ ] **Step 6: Integration test**

```go
// internal/integration_tests/admin_grpc_test.go — follow grpc_surface_test.go
// patterns for spinning the server + dialing. Assert:
//   - GET /v1/admin/meta WITHOUT admin secret -> 401
//   - GET /v1/admin/meta WITH x-authorizer-admin-secret header -> 200 + roles
//   - gRPC AdminMeta with admin-secret metadata -> roles
func TestAdminMeta(t *testing.T) { /* ... */ }
```

- [ ] **Step 7: Verify + commit**

Run: `make proto-gen && go build ./... && go clean --testcache && TEST_DBS="sqlite" go test -p 1 -v -run TestAdminMeta ./internal/integration_tests/`
Expected: PASS.

```bash
git add -A && git commit -m "feat(admin-api): _admin_meta over gRPC + REST"
```

### Task 1.2: `_admin_login`

Deltas from canonical:
- **Proto:** `rpc AdminLogin(AdminLoginRequest) returns (AdminLoginResponse) { option (google.api.http) = {post: "/v1/admin/login" body: "*"}; }`. `AdminLoginRequest { string admin_secret = 1 [(buf.validate.field).required = true]; }`. `AdminLoginResponse { Response response = 1; }` (reuse existing `Response` message; if none, add `message Response { string message = 1; }`).
- **Service:** `AdminLogin(ctx, meta, *model.AdminLoginRequest) (*model.Response, *ResponseSideEffects, error)` in `admin_auth.go`. **No** `requireSuperAdmin` (this establishes auth). Migrate body from `internal/graphql/admin_login.go`: constant-time compare against `p.Config.AdminSecret`, audit events via `p.AuditProvider`, metrics. Instead of `cookie.SetAdminCookie(gc, ...)`, return the cookie in `ResponseSideEffects` (build the admin cookie and append to `side.Cookies`). Inspect `cookie.SetAdminCookie` to replicate cookie name/attrs into a `*http.Cookie`.
- **Resolver refactor:** delegate; apply side effects via `service.ApplyToGin(gc, side)`.
- **Handler:** delegate; `transport.ApplyToGRPC(ctx, side)` then return.
- **Test:** valid secret → 200 + Set-Cookie; invalid secret → 401.

### Task 1.3: `_admin_logout`

Deltas:
- **Proto:** `rpc AdminLogout(AdminLogoutRequest) returns (AdminLogoutResponse) { option (google.api.http) = {post: "/v1/admin/logout"}; }`. `AdminLogoutRequest {}`, `AdminLogoutResponse { Response response = 1; }`.
- **Service:** `AdminLogout(ctx, meta) (*model.Response, *ResponseSideEffects, error)`; call `requireSuperAdmin`; migrate from `admin_logout.go`; clear admin cookie via side effects (deleted cookie).
- **Resolver/handler/test:** canonical. Test: logged-in → 200 + cookie cleared; no auth → 401.

### Task 1.4: `_admin_session`

Deltas:
- **Proto:** `rpc AdminSession(AdminSessionRequest) returns (AdminSessionResponse) { option (google.api.http) = {get: "/v1/admin/session"}; }`. `AdminSessionRequest {}`, `AdminSessionResponse { Response response = 1; }`.
- **Service:** `AdminSession(ctx, meta) (*model.Response, *ResponseSideEffects, error)`; `requireSuperAdmin`; migrate from `admin_session.go`.
- **Resolver/handler/test:** canonical. Test: with admin secret → 200; without → 401.

**Phase 1 gate:** `go build ./... && TEST_DBS="sqlite" go test -p 1 -run 'TestAdmin(Meta|Login|Logout|Session)' ./internal/integration_tests/`

---

## Phase 2 — Users (5 ops)

For each: canonical pattern. `requireSuperAdmin` first. Migrate body from the
named resolver. Reuse the existing proto `User` message for user payloads; add
list-wrapper + pagination messages mirroring the models.

### Task 2.1: `_users`
- **Proto:** `rpc Users(AdminUsersRequest) returns (AdminUsersResponse) { option = {post: "/v1/admin/users" body: "*"}; }`. `AdminUsersRequest { Pagination pagination = 1; }` (reuse `model.PaginatedRequest` shape; reuse common pagination message if present). `AdminUsersResponse { repeated User users = 1; Pagination pagination = 2; }` mirroring `model.Users`.
- **Service:** `Users(ctx, meta, *model.PaginatedRequest) (*model.Users, ...)` in `admin_users.go`, body from `users.go`.
- **Projection:** `projectUsers(*model.Users)` reusing existing `projectUser` + a pagination projection.
- **Test:** list with admin secret → users; without → 401.

### Task 2.2: `_user`
- **Proto:** `rpc User(AdminUserRequest) returns (AdminUserResponse) { option = {post: "/v1/admin/user" body: "*"}; }`. `AdminUserRequest { string id = 1; string email = 2; }` (mirror `model.GetUserRequest`). `AdminUserResponse { User user = 1; }`.
- **Service:** `User(ctx, meta, *model.GetUserRequest)`, body from `user.go`. Projection: existing `projectUser`.

### Task 2.3: `_update_user`
- **Proto:** `rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse) { option = {post: "/v1/admin/update_user" body: "*"}; }`. `UpdateUserRequest` mirroring `model.UpdateUserRequest` (id required + optional profile/role/scoped fields; use proto3 optional or wrappers per existing convention in authorizer.proto). `UpdateUserResponse { User user = 1; }`.
- **Service:** body from `update_user.go`. Projection: `projectUser`.

### Task 2.4: `_delete_user`
- **Proto:** `rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse) { option = {post: "/v1/admin/delete_user" body: "*"}; }`. `DeleteUserRequest { string email = 1 [(buf.validate.field).required = true]; }`. `DeleteUserResponse { Response response = 1; }`.
- **Service:** body from `delete_user.go`.

### Task 2.5: `_verification_requests`
- **Proto:** `rpc VerificationRequests(VerificationRequestsRequest) returns (VerificationRequestsResponse) { option = {post: "/v1/admin/verification_requests" body: "*"}; }`. Request `{ Pagination pagination = 1; }`. Response mirroring `model.VerificationRequests` (`repeated VerificationRequest verification_requests = 1; Pagination pagination = 2;`); add `VerificationRequest` message mirroring `model.VerificationRequest`.
- **Service:** body from `verification_requests.go`. Add `projectVerificationRequests`.

**Phase 2 gate:** `TEST_DBS="sqlite" go test -p 1 -run 'TestAdminUser' ./internal/integration_tests/`

---

## Phase 3 — Access (3 ops)

### Task 3.1: `_revoke_access`
- **Proto:** `rpc RevokeAccess(UpdateAccessRequest) returns (UpdateAccessResponse) { option = {post: "/v1/admin/revoke_access" body: "*"}; }`. `UpdateAccessRequest { string user_id = 1 [(buf.validate.field).required = true]; }` (mirror `model.UpdateAccessRequest`). `UpdateAccessResponse { Response response = 1; }`.
- **Service:** body from `revoke_access.go`.

### Task 3.2: `_enable_access`
- **Proto:** `rpc EnableAccess(UpdateAccessRequest) returns (UpdateAccessResponse) { option = {post: "/v1/admin/enable_access" body: "*"}; }` (reuse messages from 3.1).
- **Service:** body from `enable_access.go`.

### Task 3.3: `_invite_members`
- **Proto:** `rpc InviteMembers(InviteMemberRequest) returns (InviteMembersResponse) { option = {post: "/v1/admin/invite_members" body: "*"}; }`. `InviteMemberRequest { repeated string emails = 1 [(buf.validate.field).repeated.min_items = 1]; string redirect_uri = 2; }` (mirror model). `InviteMembersResponse` mirroring `model.InviteMembersResponse` (likely `repeated User users = 1;` — confirm) — add projection.
- **Service:** body from `invite_members.go`.

**Phase 3 gate:** `TEST_DBS="sqlite" go test -p 1 -run 'TestAdminAccess' ./internal/integration_tests/`

---

## Phase 4 — Webhooks (7 ops)

Add a proto `Webhook` message mirroring `model.Webhook`, `WebhookLog` mirroring
`model.WebhookLog`, and list wrappers. Add `projectWebhook`, `projectWebhooks`,
`projectWebhookLogs` to `admin_project.go`.

### Task 4.1: `_add_webhook`
- **Proto:** `rpc AddWebhook(AddWebhookRequest) returns (AddWebhookResponse) { option = {post: "/v1/admin/add_webhook" body: "*"}; }`. `AddWebhookRequest` mirroring `model.AddWebhookRequest` (event_name(s), endpoint required, enabled, headers map, event_description). `AddWebhookResponse { Response response = 1; }`.
- **Service:** body from `add_webhook.go`.

### Task 4.2: `_update_webhook`
- **Proto:** `rpc UpdateWebhook(UpdateWebhookRequest) returns (UpdateWebhookResponse) { option = {post: "/v1/admin/update_webhook" body: "*"}; }`. `UpdateWebhookRequest` mirroring `model.UpdateWebhookRequest` (id required + optional fields). `UpdateWebhookResponse { Response response = 1; }`.
- **Service:** body from `update_webhook.go`.

### Task 4.3: `_delete_webhook`
- **Proto:** `rpc DeleteWebhook(WebhookRequest) returns (DeleteWebhookResponse) { option = {post: "/v1/admin/delete_webhook" body: "*"}; }`. `WebhookRequest { string id = 1 [(buf.validate.field).required = true]; }`. `DeleteWebhookResponse { Response response = 1; }`.
- **Service:** body from `delete_webhook.go`.

### Task 4.4: `_webhook`
- **Proto:** `rpc Webhook(WebhookRequest) returns (WebhookResponse) { option = {post: "/v1/admin/webhook" body: "*"}; }` (reuse `WebhookRequest` from 4.3). `WebhookResponse { Webhook webhook = 1; }`.
- **Service:** body from `webhook.go`. Projection `projectWebhook`.

### Task 4.5: `_webhooks`
- **Proto:** `rpc Webhooks(AdminWebhooksRequest) returns (AdminWebhooksResponse) { option = {post: "/v1/admin/webhooks" body: "*"}; }`. Request `{ Pagination pagination = 1; }`. Response mirroring `model.Webhooks` (`repeated Webhook webhooks = 1; Pagination pagination = 2;`).
- **Service:** body from `webhooks.go`. Projection `projectWebhooks`.

### Task 4.6: `_webhook_logs`
- **Proto:** `rpc WebhookLogs(ListWebhookLogRequest) returns (WebhookLogsResponse) { option = {post: "/v1/admin/webhook_logs" body: "*"}; }`. `ListWebhookLogRequest` mirroring `model.ListWebhookLogRequest` (pagination + optional webhook_id). Response mirroring `model.WebhookLogs` + `WebhookLog` message.
- **Service:** body from `webhook_logs.go`. Projection `projectWebhookLogs`.

### Task 4.7: `_test_endpoint`
- **Proto:** `rpc TestEndpoint(TestEndpointRequest) returns (TestEndpointResponse) { option = {post: "/v1/admin/test_endpoint" body: "*"}; }`. `TestEndpointRequest` mirroring `model.TestEndpointRequest` (endpoint required, event_name, headers). `TestEndpointResponse` mirroring `model.TestEndpointResponse` (http_status, response, etc.).
- **Service:** body from `test_endpoint.go`. Add `projectTestEndpointResponse`.

**Phase 4 gate:** `TEST_DBS="sqlite" go test -p 1 -run 'TestAdminWebhook' ./internal/integration_tests/`

---

## Phase 5 — Email templates (4 ops)

Add proto `EmailTemplate` mirroring `model.EmailTemplate`, list wrapper, and
`projectEmailTemplate(s)`.

### Task 5.1: `_add_email_template`
- **Proto:** `rpc AddEmailTemplate(AddEmailTemplateRequest) returns (AddEmailTemplateResponse) { option = {post: "/v1/admin/add_email_template" body: "*"}; }`. Request mirroring `model.AddEmailTemplateRequest` (event_name required, subject, template, design). Response `{ Response response = 1; }`.
- **Service:** body from `add_email_template.go`.

### Task 5.2: `_update_email_template`
- **Proto:** `rpc UpdateEmailTemplate(UpdateEmailTemplateRequest) returns (UpdateEmailTemplateResponse) { option = {post: "/v1/admin/update_email_template" body: "*"}; }`. Request mirroring `model.UpdateEmailTemplateRequest` (id required + optional fields). Response `{ Response response = 1; }`.
- **Service:** body from `update_email_template.go`.

### Task 5.3: `_delete_email_template`
- **Proto:** `rpc DeleteEmailTemplate(DeleteEmailTemplateRequest) returns (DeleteEmailTemplateResponse) { option = {post: "/v1/admin/delete_email_template" body: "*"}; }`. `DeleteEmailTemplateRequest { string id = 1 [(buf.validate.field).required = true]; }`. Response `{ Response response = 1; }`.
- **Service:** body from `delete_email_template.go`.

### Task 5.4: `_email_templates`
- **Proto:** `rpc EmailTemplates(AdminEmailTemplatesRequest) returns (AdminEmailTemplatesResponse) { option = {post: "/v1/admin/email_templates" body: "*"}; }`. Request `{ Pagination pagination = 1; }`. Response mirroring `model.EmailTemplates`.
- **Service:** body from `email_templates.go`. Projection `projectEmailTemplates`.

**Phase 5 gate:** `TEST_DBS="sqlite" go test -p 1 -run 'TestAdminEmailTemplate' ./internal/integration_tests/`

---

## Phase 6 — Audit (1 op)

### Task 6.1: `_audit_logs`
- **Proto:** `rpc AuditLogs(ListAuditLogRequest) returns (AuditLogsResponse) { option = {post: "/v1/admin/audit_logs" body: "*"}; }`. `ListAuditLogRequest` mirroring `model.ListAuditLogRequest` (pagination + filters). Response mirroring `model.AuditLogs` + `AuditLog` message.
- **Service:** body from `audit_logs.go`. Add `projectAuditLogs`.

**Phase 6 gate:** `TEST_DBS="sqlite" go test -p 1 -run 'TestAdminAuditLogs' ./internal/integration_tests/`

---

## Phase 7 — FGA admin (8 ops)

Reuse existing proto FGA messages where the public surface defined them
(`FgaModel`, `FgaTuples`, etc.). For inputs/outputs unique to admin FGA, add
messages mirroring the corresponding `model.Fga*` types. Implement methods in
`internal/service/admin_fga.go` (or extend `fga.go`); each calls
`requireSuperAdmin` then the existing FGA engine logic migrated from the
resolver. All FGA admin methods MUST fail closed when `p.AuthzEngine == nil`.

### Task 7.1: `_fga_get_model`
- **Proto:** `rpc FgaGetModel(FgaGetModelRequest) returns (FgaGetModelResponse) { option = {get: "/v1/admin/fga/model"}; }`. `FgaGetModelRequest {}`, `FgaGetModelResponse { FgaModel model = 1; }`.
- **Service:** body from `fga_get_model.go`.

### Task 7.2: `_fga_write_model`
- **Proto:** `rpc FgaWriteModel(FgaWriteModelInput) returns (FgaWriteModelResponse) { option = {post: "/v1/admin/fga/model" body: "*"}; }`. `FgaWriteModelInput` mirroring `model.FgaWriteModelInput`. Response `{ FgaModel model = 1; }`.
- **Service:** body from `fga_write_model.go`.

### Task 7.3: `_fga_write_tuples`
- **Proto:** `rpc FgaWriteTuples(FgaWriteTuplesInput) returns (FgaWriteTuplesResponse) { option = {post: "/v1/admin/fga/tuples" body: "*"}; }`. `FgaWriteTuplesInput` mirroring `model.FgaWriteTuplesInput`. Response `{ Response response = 1; }`.
- **Service:** body from `fga_write_tuples.go`.

### Task 7.4: `_fga_delete_tuples`
- **Proto:** `rpc FgaDeleteTuples(FgaWriteTuplesInput) returns (FgaDeleteTuplesResponse) { option = {post: "/v1/admin/fga/tuples/delete" body: "*"}; }` (reuse input from 7.3). Response `{ Response response = 1; }`.
- **Service:** body from `fga_delete_tuples.go`.

### Task 7.5: `_fga_read_tuples`
- **Proto:** `rpc FgaReadTuples(FgaReadTuplesInput) returns (FgaReadTuplesResponse) { option = {post: "/v1/admin/fga/tuples/read" body: "*"}; }`. `FgaReadTuplesInput` mirroring `model.FgaReadTuplesInput`. Response mirroring `model.FgaTuples` (`FgaTuples tuples = 1;` or `repeated FgaTuple ...`).
- **Service:** body from `fga_read_tuples.go`.

### Task 7.6: `_fga_list_users`
- **Proto:** `rpc FgaListUsers(FgaListUsersInput) returns (FgaListUsersResponse) { option = {post: "/v1/admin/fga/list_users" body: "*"}; }`. Input + response mirroring `model.FgaListUsersInput` / `model.FgaListUsersResponse`.
- **Service:** body from `fga_list_users.go`.

### Task 7.7: `_fga_expand`
- **Proto:** `rpc FgaExpand(FgaExpandInput) returns (FgaExpandResponse) { option = {post: "/v1/admin/fga/expand" body: "*"}; }`. Input + response mirroring `model.FgaExpandInput` / `model.FgaExpandResponse`.
- **Service:** body from `fga_expand.go`.

### Task 7.8: `_fga_reset`
- **Proto:** `rpc FgaReset(FgaResetRequest) returns (FgaResetResponse) { option = {post: "/v1/admin/fga/reset" body: "*"}; }`. `FgaResetRequest {}`, `FgaResetResponse { Response response = 1; }`.
- **Service:** body from `fga_reset.go`.

**Phase 7 gate:** `TEST_DBS="sqlite" go test -p 1 -run 'TestAdminFga' ./internal/integration_tests/`

---

## Phase 8 — Finalize

### Task 8.1: Enable the AdminProvider compile-time assertion

- [ ] Remove the build tag from `admin_provider_test.go`; add to `provider.go`:

```go
var _ AdminProvider = (*provider)(nil)
```

- [ ] Tighten `server.go` to use the embedded-interface `Dependencies.ServiceProvider` (Provider + AdminProvider) and drop the runtime type assertion from Task 0.3.
- [ ] Run: `go build ./... && go vet ./...`
- [ ] Commit: `chore(admin-api): assert AdminProvider implemented; tighten wiring`.

### Task 8.2: Smoke test

**Files:** Modify `internal/e2e/smoke_test.go`.

- [ ] Add a `--- Surface: Admin ---` block after the existing surfaces. Using the admin secret from server args:
  - REST `GET /v1/admin/meta` with header `x-authorizer-admin-secret` → 200, roles present.
  - REST `POST /v1/admin/users` `{}` with admin secret → 200, users array.
  - REST `GET /v1/admin/meta` WITHOUT secret → 401 (fail-closed).
  - gRPC `AuthorizerAdminService/AdminMeta` with `x-authorizer-admin-secret` metadata → roles.
- [ ] Run: `go test -v -run TestReleaseSmoke ./internal/e2e/`
- [ ] Commit: `test(admin-api): admin surface smoke coverage`.

### Task 8.3: Proto lint/breaking + full build

- [ ] Run: `make proto-lint && make proto-breaking && go build ./... && TEST_DBS="sqlite" go test -p 1 ./internal/integration_tests/`
- [ ] Fix any failures. Commit.

### Task 8.4: Docs (authorizer-docs, branch `feat/authorizer-admin-apis`)

**Files:** `docs/core/graphql-api.md`, `docs/core/rest-api.md`, `docs/core/grpc.md`.

- [ ] In each page, split the Table of Contents into **Public APIs** and **Authorizer Admin APIs** sections.
- [ ] `rest-api.md`: add each `/v1/admin/*` endpoint (method, path, request/response, auth header `x-authorizer-admin-secret` or admin cookie) under the new admin section.
- [ ] `grpc.md`: add `AuthorizerAdminService` with each RPC under the admin section; note same server/port as `AuthorizerService`.
- [ ] `graphql-api.md`: ensure the `_`-prefixed ops are documented under the admin section of the TOC.
- [ ] Build docs: `cd authorizer-docs && npm run build` (or the repo's documented build) → zero warnings.
- [ ] Commit on `feat/authorizer-admin-apis`: `docs(core): split Public/Admin API TOC + document admin API`.

---

## Self-review checklist (run before execution)

- [ ] Every op in the 32-op table maps to a task (Phases 1–7). ✓ (4+5+3+7+4+1+8 = 32)
- [ ] No deprecated op included (`_admin_signup`, `_env`, `_update_env`, `_generate_jwt_keys` excluded). ✓
- [ ] Single gRPC server + single gateway (Tasks 0.3, 0.4). ✓
- [ ] Smoke test added (Task 8.2). ✓
- [ ] Docs split TOC on all 3 pages (Task 8.4). ✓
- [ ] Method signatures consistent between `admin_provider.go` and per-op tasks. ✓
- [ ] Before generating each proto message, confirm field-for-field parity with the referenced `internal/graph/model` type.
