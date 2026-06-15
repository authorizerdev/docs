---
sidebar_position: 8
title: gRPC API
---

# gRPC API

Authorizer exposes its service over native **gRPC**, alongside the
[GraphQL](./graphql-api) and [REST](./rest-api) surfaces. All three are backed by the same
service layer and the same Protocol Buffers definition, so they behave identically — gRPC
just gives you a strongly-typed, high-performance binary transport for server-to-server
calls.

Table of Contents

- [Service & transport](#service--transport)
- [Protobuf schema](#protobuf-schema)
- [Public Methods](#public-methods)
  - [`Meta`](#meta)
  - [`Signup`](#signup)
  - [`Session`](#session)
  - [`Profile`](#profile)
  - [`Logout`](#logout)
  - [`Revoke`](#revoke)
  - [`ValidateJwtToken`](#validatejwttoken)
  - [`ValidateSession`](#validatesession)
  - [`CheckPermissions`](#checkpermissions)
  - [`ListPermissions`](#listpermissions)
- [Authorizer Admin Methods](#authorizer-admin-methods)
  - [Admin Authentication](#admin-authentication)
    - [`AdminLogin`](#adminlogin)
    - [`AdminLogout`](#adminlogout)
    - [`AdminSession`](#adminsession)
    - [`AdminMeta`](#adminmeta)
  - [User Management](#user-management)
    - [`Users`](#users)
    - [`User`](#user)
    - [`UpdateUser`](#updateuser)
    - [`DeleteUser`](#deleteuser)
    - [`VerificationRequests`](#verificationrequests)
  - [Access Control](#access-control)
    - [`RevokeAccess`](#revokeaccess)
    - [`EnableAccess`](#enableaccess)
    - [`InviteMembers`](#invitemembers)
  - [Webhook Management](#webhook-management)
    - [`AddWebhook`](#addwebhook)
    - [`UpdateWebhook`](#updatewebhook)
    - [`DeleteWebhook`](#deletewebhook)
    - [`GetWebhook`](#getwebhook)
    - [`Webhooks`](#webhooks)
    - [`WebhookLogs`](#webhooklogs)
    - [`TestEndpoint`](#testendpoint)
  - [Email Template Management](#email-template-management)
    - [`AddEmailTemplate`](#addemailtemplate)
    - [`UpdateEmailTemplate`](#updateemailtemplate)
    - [`DeleteEmailTemplate`](#deleteemailtemplate)
    - [`EmailTemplates`](#emailtemplates)
  - [Audit Logs](#audit-logs)
    - [`AuditLogs`](#auditlogs)
  - [Authorization (FGA)](#authorization-fga)
    - [`FgaGetModel`](#fgagetmodel)
    - [`FgaWriteModel`](#fgawritemodel)
    - [`FgaWriteTuples`](#fgawritetuples)
    - [`FgaDeleteTuples`](#fgadeletetuples)
    - [`FgaReadTuples`](#fgaread-tuples)
    - [`FgaListUsers`](#fgalistusers)
    - [`FgaExpand`](#fgaexpand)
    - [`FgaReset`](#fgareset)
- [Calling with `grpcurl`](#calling-with-grpcurl)
- [Health checks](#health-checks)
- [Errors](#errors)
- [See also](#see-also)

## Service & transport

| Property              | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Proto package         | `authorizer.v1`                                                    |
| Services              | `AuthorizerService` (public) + `AuthorizerAdminService` (admin)   |
| BSR module            | [`buf.build/authorizerdev/authorizer`](https://buf.build/authorizerdev/authorizer) |
| Port                  | `--grpc-port` (default `9091`) — same server, both services       |
| TLS                   | `--grpc-tls-cert` + `--grpc-tls-key`; `--grpc-insecure` for dev    |
| Server reflection     | `--enable-grpc-reflection` (default `true`)                        |
| Health checking       | `grpc.health.v1.Health` (always registered)                       |

The gRPC server is enabled by default. Auth flows over gRPC exactly as it does over REST:
attach the user's credential as request metadata —
`authorization: Bearer <access_token>` — or a session cookie.

## Protobuf schema

The schema is published to the **[Buf Schema Registry](https://buf.build/authorizerdev/authorizer)**
as the module `buf.build/authorizerdev/authorizer` (package `authorizer.v1`, with shared
messages in `authorizer.common.v1`). You can generate a typed client for any language
without copying `.proto` files around:

```yaml
# buf.gen.yaml
version: v2
inputs:
  - module: buf.build/authorizerdev/authorizer
plugins:
  - remote: buf.build/grpc/go
    out: gen
    opt: paths=source_relative
  - remote: buf.build/protocolbuffers/go
    out: gen
    opt: paths=source_relative
```

```bash
buf generate
```

Swap the remote plugins for `buf.build/grpc/python`, `.../grpc/web`, etc. to target other
languages.

**Other options:**

- **Vendor the source** — the `.proto` files live in the
  [`proto/` directory of the repo](https://github.com/authorizerdev/authorizer/tree/main/proto);
  run `buf generate` or `protoc` against them directly.
- **No protos at all** — since [server reflection](#service--transport) is enabled by
  default, [`grpcurl`](#calling-with-grpcurl), Postman, etc. can call the API without any
  schema files.
- **Skip codegen** — the official [Go](../sdks/authorizer-go/),
  [JavaScript](../sdks/authorizer-js/), and [Python](../sdks/authorizer-python/) SDKs wrap
  the API for you.

## Public Methods

> The gRPC / REST surface is being migrated incrementally. The methods below are
> implemented today; the remaining authentication operations (login, magic-link, OTP,
> email verification, forgot/reset password, profile update, account deactivation) are
> currently served by the [GraphQL API](./graphql-api) and return `UNIMPLEMENTED` over
> gRPC until their migration lands.

Each message mirrors its GraphQL/REST counterpart — see the linked
[GraphQL API reference](./graphql-api) anchor for field-level details.

### `Meta`

*Public.* Server feature flags & provider availability. Mirrors [`meta`](./graphql-api#meta).

### `Signup`

*Public.* Register a new user. Mirrors [`signup`](./graphql-api#signup).

### `Session`

*Authenticated.* Refresh / fetch the current session. Mirrors [`session`](./graphql-api#session).

### `Profile`

*Authenticated.* The authenticated user's profile. Mirrors [`profile`](./graphql-api#profile).

### `Logout`

*Authenticated.* Invalidate the current session. Mirrors [`logout`](./graphql-api#logout).

### `Revoke`

*Public.* Revoke a refresh token. Mirrors [`revoke`](./graphql-api#revoke).

### `ValidateJwtToken`

*Public.* Validate a JWT and optional required relations. Mirrors [`validate_jwt_token`](./graphql-api#validate_jwt_token).

### `ValidateSession`

*Authenticated.* Validate a session cookie and required relations. Mirrors [`validate_session`](./graphql-api#validate_session).

### `CheckPermissions`

*Authenticated.* Batch-evaluate FGA `(relation, object)` checks. Mirrors [`check_permissions`](./graphql-api#check_permissions).

### `ListPermissions`

*Authenticated.* List objects/relations the subject can access. Mirrors [`list_permissions`](./graphql-api#list_permissions).

## Authorizer Admin Methods

The `AuthorizerAdminService` is served on the same gRPC port and address as `AuthorizerService`. All admin methods require super-admin authentication via the `x-authorizer-admin-secret` request metadata (the admin secret configured with `--admin-secret`) or an `authorizer.admin` session cookie. Except `AdminLogin`, which does not require an existing session.

### Admin Authentication

#### `AdminLogin`

*Public (for admin-secret).* Authenticate as super-admin with the admin secret. Returns an auth response with session token.

#### `AdminLogout`

*Admin-only.* Invalidate the current admin session.

#### `AdminSession`

*Admin-only.* Verify the current admin session is valid.

#### `AdminMeta`

*Admin-only.* Get admin-level server metadata (version, feature flags with admin-only fields).

### User Management

#### `Users`

*Admin-only.* List all users with pagination. Mirrors [`_users`](./graphql-api#_users).

#### `User`

*Admin-only.* Get a specific user by id or email. Mirrors [`_user`](./graphql-api#_user).

#### `UpdateUser`

*Admin-only.* Update user profile fields (email, roles, name, etc.). Mirrors [`_update_user`](./graphql-api#_update_user).

#### `DeleteUser`

*Admin-only.* Delete a user by email and all associated OTP/verification data. Mirrors [`_delete_user`](./graphql-api#_delete_user).

#### `VerificationRequests`

*Admin-only.* List pending verification requests with optional pagination. Mirrors [`_verification_requests`](./graphql-api#_verification_requests).

### Access Control

#### `RevokeAccess`

*Admin-only.* Revoke a user's access (set revoked_timestamp) and fire the `user.access_revoked` webhook. Mirrors [`_revoke_access`](./graphql-api#_revoke_access).

#### `EnableAccess`

*Admin-only.* Re-enable a previously revoked user (clear revoked_timestamp) and fire the `user.access_enabled` webhook. Mirrors [`_enable_access`](./graphql-api#_enable_access).

#### `InviteMembers`

*Admin-only.* Invite users to the platform by email with an invitation link. Mirrors [`_invite_members`](./graphql-api#_invite_members).

### Webhook Management

#### `AddWebhook`

*Admin-only.* Register a new webhook for an event. Mirrors [`_add_webhook`](./graphql-api#_add_webhook).

#### `UpdateWebhook`

*Admin-only.* Update an existing webhook (endpoint, headers, enabled state, etc.). Mirrors [`_update_webhook`](./graphql-api#_update_webhook).

#### `DeleteWebhook`

*Admin-only.* Delete a webhook by id. Mirrors [`_delete_webhook`](./graphql-api#_delete_webhook).

#### `GetWebhook`

*Admin-only.* Get a webhook by id. Mirrors [`_webhook`](./graphql-api#_webhook).

#### `Webhooks`

*Admin-only.* List all webhooks with pagination. Mirrors [`_webhooks`](./graphql-api#_webhooks).

#### `WebhookLogs`

*Admin-only.* List webhook delivery logs with optional pagination and webhook_id filter. Mirrors [`_webhook_logs`](./graphql-api#_webhook_logs).

#### `TestEndpoint`

*Admin-only.* Send a test webhook payload to an endpoint and return the HTTP response. Mirrors [`_test_endpoint`](./graphql-api#_test_endpoint).

### Email Template Management

#### `AddEmailTemplate`

*Admin-only.* Create a new email template for an event. Mirrors [`_add_email_template`](./graphql-api#_add_email_template).

#### `UpdateEmailTemplate`

*Admin-only.* Update an email template. Mirrors [`_update_email_template`](./graphql-api#_update_email_template).

#### `DeleteEmailTemplate`

*Admin-only.* Delete an email template by id. Mirrors [`_delete_email_template`](./graphql-api#_delete_email_template).

#### `EmailTemplates`

*Admin-only.* List email templates with pagination. Mirrors [`_email_templates`](./graphql-api#_email_templates).

### Audit Logs

#### `AuditLogs`

*Admin-only.* Retrieve audit log entries with optional filtering by actor, action, or resource and pagination. Mirrors [`_audit_logs`](./graphql-api#_audit_logs).

### Authorization (FGA)

Manage the embedded fine-grained authorization (FGA) engine. See [Authorization (FGA)](./authorization) for the conceptual model.

#### `FgaGetModel`

*Admin-only.* Retrieve the active authorization model as FGA DSL. An empty store returns an empty model (not an error).

#### `FgaWriteModel`

*Admin-only.* Install a new authorization model version from FGA DSL. Models are versioned and append-only. Audited.

#### `FgaWriteTuples`

*Admin-only.* Write (persist) relationship tuples. Audited.

#### `FgaDeleteTuples`

*Admin-only.* Delete relationship tuples. Audited.

#### `FgaReadTuples` {#fgaread-tuples}

*Admin-only.* Read stored tuples with optional filtering by user, relation, or object and pagination.

#### `FgaListUsers`

*Admin-only.* List fully-qualified user ids that have a relation on an object (reveals the access graph).

#### `FgaExpand`

*Admin-only.* Expand the relationship/userset tree for a relation on an object (useful for debugging).

#### `FgaReset`

*Admin-only.* Delete the entire fine-grained authorization store (model, all versions, and all tuples) and start fresh. Refused if any tuples still exist. Destructive and audited.

## Calling with `grpcurl`

With reflection enabled you can explore and call the service directly:

```bash
# List services
grpcurl -plaintext localhost:9091 list

# Describe a method
grpcurl -plaintext localhost:9091 describe authorizer.v1.AuthorizerService.CheckPermissions

# Check permissions (authenticated)
grpcurl -plaintext \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -d '{"checks":[{"relation":"can_view","object":"document:1"}]}' \
  localhost:9091 authorizer.v1.AuthorizerService/CheckPermissions
```

```json
{
  "results": [
    { "relation": "can_view", "object": "document:1", "allowed": true }
  ]
}
```

Drop `-plaintext` and use the TLS material when `--grpc-tls-cert` / `--grpc-tls-key` are
configured.

## Health checks

The standard gRPC health-checking protocol is registered, so Kubernetes `grpc` liveness/
readiness probes work out of the box:

```yaml
livenessProbe:
  grpc:
    port: 9091
```

Or with `grpc-health-probe` / `grpcurl`:

```bash
grpcurl -plaintext localhost:9091 grpc.health.v1.Health/Check
# {"status": "SERVING"}
```

## Errors

gRPC returns standard status codes; the HTTP [REST gateway](./rest-api) maps these to HTTP
statuses. Common cases:

| Status                  | Meaning                                              |
| ----------------------- | ---------------------------------------------------- |
| `UNAUTHENTICATED`       | Missing or invalid credentials.                      |
| `PERMISSION_DENIED`     | Explicit `user` not permitted for the caller.        |
| `FAILED_PRECONDITION`   | FGA not enabled (`--fga-store` unset).               |
| `INVALID_ARGUMENT`      | Validation failure (e.g. `> 100` checks).            |
| `UNIMPLEMENTED`         | Method not yet migrated to gRPC — use GraphQL.       |

## See also

- [REST API](./rest-api) — the same operations as JSON over HTTP (`/v1`).
- [GraphQL API](./graphql-api) — the full field-level reference and complete auth surface.
- [MCP Server](./mcp) — exposing `check_permissions` / `list_permissions` to AI agents.
