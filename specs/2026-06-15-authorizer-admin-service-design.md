# AuthorizerAdminService — Design Spec

**Date:** 2026-06-15
**Status:** Approved (design)
**Repo:** `authorizerdev/authorizer` (server) + `authorizerdev/authorizer-docs` (docs)

## Goal

Expose Authorizer's admin (super-admin-only) operations — the `_`-prefixed
GraphQL queries and mutations — as a new gRPC service `AuthorizerAdminService`,
with a REST surface via grpc-gateway, mirroring the multi-protocol pattern
already shipped for the public `AuthorizerService` (PR #620).

Business logic is migrated into the transport-agnostic `internal/service`
package; GraphQL resolvers, the gRPC handler, and the REST gateway all become
thin adapters over the same service methods (single source of truth).

The admin service is served by the **same** `*grpc.Server` instance and the
**same** grpc-gateway mux as the public service — one gRPC port and one REST
port serve both surfaces. No separate admin server or port.

## Scope

All **active** `_`-prefixed GraphQL admin operations. The four deprecated
admin operations (resolvers under `internal/graphql/_deprecated_*.go` that
return `"deprecated"`) are **excluded**:

- `_admin_signup` (admin secret is CLI-only in v2)
- `_env`, `_update_env` (config is CLI flags in v2; replaced by `_admin_meta`)
- `_generate_jwt_keys` (JWT keys are CLI flags in v2)

That leaves **32 operations**.

### Operations by domain group

| Group | Ops | Count |
|---|---|---|
| Admin auth | `_admin_login`, `_admin_logout`, `_admin_session` | 3 |
| Admin meta | `_admin_meta` | 1 |
| Users | `_users`, `_user`, `_update_user`, `_delete_user`, `_verification_requests` | 5 |
| Access | `_revoke_access`, `_enable_access`, `_invite_members` | 3 |
| Webhooks | `_add_webhook`, `_update_webhook`, `_delete_webhook`, `_webhook`, `_webhooks`, `_webhook_logs`, `_test_endpoint` | 7 |
| Email templates | `_add_email_template`, `_update_email_template`, `_delete_email_template`, `_email_templates` | 4 |
| Audit | `_audit_logs` | 1 |
| FGA admin | `_fga_write_model`, `_fga_write_tuples`, `_fga_delete_tuples`, `_fga_reset`, `_fga_get_model`, `_fga_read_tuples`, `_fga_list_users`, `_fga_expand` | 8 |

**Total: 32**

## Architecture

Mirrors the public-API surface end to end.

### 1. Proto (`proto/authorizer/v1/admin.proto`)

- New file, package `authorizer.v1` (same package as `authorizer.proto`, so
  it can reference existing messages: `User`, pagination, FGA types, etc.).
- `service AuthorizerAdminService` with one RPC per op (32 RPCs).
- Request/response messages reuse existing types from `authorizer.proto` /
  `types.proto` / `common/v1` where they already exist; add admin-only
  messages (e.g. `Webhook`, `EmailTemplate`, `AuditLog`, `Env`-less
  `AdminMeta`, user-list pagination wrappers) as needed.
- `protovalidate` rules mirror the GraphQL required fields.
- REST annotations (`google.api.http`) under base path `/v1/admin/*`:
  - **GET** for no-body reads: `_admin_session`, `_admin_meta`, `_fga_get_model`.
  - **POST** for everything else (mutations and reads that take params,
    matching the public convention where `check_permissions`/`list_permissions`
    use POST).
- Generated via `make proto-gen` (`buf generate`). The merged OpenAPI doc
  picks up the admin service automatically.

### 2. Service layer (`internal/service/admin_*.go`)

- New files grouped by domain (e.g. `admin_users.go`, `admin_webhooks.go`,
  `admin_email_templates.go`, `admin_access.go`, `admin_audit.go`,
  `admin_meta.go`, `admin_auth.go`; FGA admin extends the existing `fga.go`).
- A new `service.AdminProvider` interface declares the 32 methods. The
  existing concrete `*provider` struct implements **both** `Provider` and
  `AdminProvider` (one struct, two cohesive interfaces — keeps the public
  `Provider` focused).
- Each method signature follows the public pattern:
  `Method(ctx, meta RequestMetadata, params *model.X) (*model.Y, *ResponseSideEffects, error)`.
- Logic is migrated from the corresponding `internal/graphql` admin resolver.

### 3. Admin authentication

- Shared helper `requireSuperAdmin(meta RequestMetadata) error` builds the gin
  shim (`gc := &gin.Context{Request: meta.Request}`) and calls
  `TokenProvider.IsSuperAdmin(gc)`; returns a typed `Unauthenticated` service
  error if false. Called at the top of every admin method except
  `_admin_login` (which establishes the session).
- `IsSuperAdmin` accepts either the admin session cookie or the
  `x-authorizer-admin-secret` header (unless `--disable-admin-header-auth`).
- `_admin_login` validates the admin secret (constant-time) and sets the admin
  cookie via `ResponseSideEffects`; `_admin_logout` clears it. The gRPC handler
  applies side-effects via `transport.ApplyToGRPC`; grpc-gateway promotes them
  to `Set-Cookie` for REST.

### 4. gRPC handler (`internal/grpcsrv/handlers/admin.go`)

- New `AdminHandler{Service: service.AdminProvider}` embeds
  `authorizerv1.UnimplementedAuthorizerAdminServiceServer`.
- Each method delegates to the service, projects model → proto (reuse and
  extend the projection helpers in `handlers/project.go`), and applies side
  effects.
- Registered on the **same** `*grpc.Server` in `internal/grpcsrv/server.go`
  alongside `AuthorizerService`.

### 5. REST gateway (`internal/gateway/mount.go`)

- Add `RegisterAuthorizerAdminServiceHandler` to `registerAll`.
- Add `runtime.WithIncomingHeaderMatcher` so the custom
  `x-authorizer-admin-secret` header is forwarded to the gRPC layer (the
  default matcher only forwards permanent headers such as `Authorization` and
  `Cookie`). The matcher falls back to `runtime.DefaultHeaderMatcher` for all
  other headers so existing behavior is unchanged.
- Extend `transport.MetaFromGRPC` / `synthRequest` to copy
  `x-authorizer-admin-secret` from incoming metadata onto the synthesized
  `*http.Request` so `IsSuperAdmin` sees it over REST.

### 6. GraphQL resolvers (`internal/graphql/*.go`)

- Refactor the 32 active admin resolvers into thin delegating adapters over
  `ServiceProvider` (the `meta.go` pattern), so logic lives only in
  `internal/service`. Deprecated resolvers are left untouched.

## Testing

- Per-op coverage following existing conventions (integration tests under
  `internal/integration_tests/`, service unit tests where the public ops have
  them).
- Extend `internal/e2e/smoke_test.go`: after admin login, exercise
  representative admin ops over **REST and gRPC** (`_admin_meta`, `_users`
  list, a webhook read), plus a **fail-closed** check (missing/invalid admin
  secret → `401` / `Unauthenticated`).
- `make proto-lint` and `make proto-breaking` must pass (admin.proto is
  additive — no breaking change to the public service).

## Documentation (`authorizer-docs`)

Update the three API reference pages under `docs/core/`:

- `graphql-api.md`, `rest-api.md`, `grpc.md`.
- Add the admin operations to each page.
- Split each page's Table of Contents into two sections:
  **Public APIs** and **Authorizer Admin APIs**.

## Delivery

Single feature branch / PR. The implementation plan checkpoints by domain
group (auth → meta → users → access → webhooks → email-templates → audit →
fga) so work is resumable if interrupted. Order: proto first (one group at a
time), then service + handler + resolver refactor + tests per group, then
gateway wiring, then smoke test, then docs.

## Non-goals

- No MCP exposure of admin operations (admin surface stays off MCP).
- No changes to admin auth semantics (same admin secret / cookie / header).
- No new admin operations beyond the existing GraphQL surface.
- Deprecated admin operations are not ported.
