---
sidebar_position: 6
title: REST API
---

# REST API

Alongside the [GraphQL API](./graphql-api), every Authorizer operation is also exposed
as a plain **JSON-over-HTTP REST endpoint** under the `/v1/` prefix. The REST surface is
generated from the same gRPC service definition via
[grpc-gateway](https://github.com/grpc-ecosystem/grpc-gateway), so each REST endpoint
maps one-to-one to a GraphQL query/mutation and shares the exact same request and
response fields.

Use REST when a GraphQL client is overkill — server-to-server calls, shell scripts,
webhooks, or platforms where a simple `POST` with a JSON body is the path of least
resistance.

> The same server also speaks **[gRPC](./grpc)** (default port `9091`, set with
> `--grpc-port`) and **[GraphQL](./graphql-api)** (`POST /graphql`). All three are backed by
> the same service layer, so they behave identically.

> **Availability:** the `/v1` REST gateway is mounted only when the gRPC server is enabled
> (the default). It mirrors the full public and admin service surface — see
> [Available endpoints](#public-api-endpoints) below.

Table of Contents

- [Base URL & transport](#base-url--transport)
- [Authentication](#authentication)
- [Public Endpoints](#public-api-endpoints)
  - [`POST /v1/signup`](#post-v1signup)
  - [`POST /v1/login`](#post-v1login)
  - [`POST /v1/magic_link_login`](#post-v1magic_link_login)
  - [`POST /v1/verify_email`](#post-v1verify_email)
  - [`POST /v1/resend_verify_email`](#post-v1resend_verify_email)
  - [`POST /v1/verify_otp`](#post-v1verify_otp)
  - [`POST /v1/resend_otp`](#post-v1resend_otp)
  - [`POST /v1/forgot_password`](#post-v1forgot_password)
  - [`POST /v1/reset_password`](#post-v1reset_password)
  - [`POST /v1/logout`](#post-v1logout)
  - [`GET /v1/profile`](#get-v1profile)
  - [`POST /v1/update_profile`](#post-v1update_profile)
  - [`POST /v1/deactivate_account`](#post-v1deactivate_account)
  - [`POST /v1/session`](#post-v1session)
  - [`POST /v1/revoke`](#post-v1revoke)
  - [`POST /v1/validate_jwt_token`](#post-v1validate_jwt_token)
  - [`POST /v1/validate_session`](#post-v1validate_session)
  - [`GET /v1/meta`](#get-v1meta)
  - [`POST /v1/check_permissions`](#post-v1check_permissions)
  - [`POST /v1/list_permissions`](#post-v1list_permissions)
- [Authorizer Admin API Endpoints](#authorizer-admin-api-endpoints)
  - [Admin Authentication](#admin-authentication)
    - [`POST /v1/admin/login`](#post-v1adminlogin)
    - [`POST /v1/admin/logout`](#post-v1adminlogout)
    - [`GET /v1/admin/session`](#get-v1adminsession)
    - [`GET /v1/admin/meta`](#get-v1adminmeta)
  - [Users](#users)
    - [`POST /v1/admin/users`](#post-v1adminusers)
    - [`POST /v1/admin/user`](#post-v1adminuser)
    - [`POST /v1/admin/update_user`](#post-v1adminupdate_user)
    - [`POST /v1/admin/delete_user`](#post-v1admindelete_user)
    - [`POST /v1/admin/verification_requests`](#post-v1adminverification_requests)
  - [Access Control](#access-control)
    - [`POST /v1/admin/revoke_access`](#post-v1adminrevoke_access)
    - [`POST /v1/admin/enable_access`](#post-v1adminenable_access)
    - [`POST /v1/admin/invite_members`](#post-v1admininvite_members)
  - [Webhooks](#webhooks)
    - [`POST /v1/admin/add_webhook`](#post-v1adminadd_webhook)
    - [`POST /v1/admin/update_webhook`](#post-v1adminupdate_webhook)
    - [`POST /v1/admin/delete_webhook`](#post-v1admindelete_webhook)
    - [`POST /v1/admin/webhook`](#post-v1adminwebhook)
    - [`POST /v1/admin/webhooks`](#post-v1adminwebhooks)
    - [`POST /v1/admin/webhook_logs`](#post-v1adminwebhook_logs)
    - [`POST /v1/admin/test_endpoint`](#post-v1admintest_endpoint)
  - [Email Templates](#email-templates)
    - [`POST /v1/admin/add_email_template`](#post-v1adminadd_email_template)
    - [`POST /v1/admin/update_email_template`](#post-v1adminupdate_email_template)
    - [`POST /v1/admin/delete_email_template`](#post-v1admindelete_email_template)
    - [`POST /v1/admin/email_templates`](#post-v1adminemail_templates)
  - [Audit Logs](#audit-logs)
    - [`POST /v1/admin/audit_logs`](#post-v1adminaudit_logs)
  - [Authorization (FGA)](#authorization-fga)
    - [`GET /v1/admin/fga/model`](#get-v1adminfgamodel)
    - [`POST /v1/admin/fga/model`](#post-v1adminfgamodel)
    - [`POST /v1/admin/fga/tuples`](#post-v1-admin-fga-tuples)
    - [`POST /v1/admin/fga/tuples/delete`](#post-v1adminfgatuplesdelete)
    - [`POST /v1/admin/fga/tuples/read`](#post-v1adminfgatuplesread)
    - [`POST /v1/admin/fga/list_users`](#post-v1adminfgalist_users)
    - [`POST /v1/admin/fga/expand`](#post-v1adminfgaexpand)
    - [`POST /v1/admin/fga/reset`](#post-v1adminfgareset)
- [Errors](#errors)
- [See also](#see-also)

## Base URL & transport

| Property        | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Base path       | `/v1`                                                                  |
| HTTP port       | `--http-port` (default `8080`)                                         |
| Content type    | `application/json` for request and response bodies                     |
| Field casing    | `snake_case` (proto field names), matching the GraphQL field names     |
| gRPC port       | `--grpc-port` (default `9091`) — same operations over native gRPC      |

So if your instance is at `https://auth.example.com`, the permission-check endpoint is
`https://auth.example.com/v1/check_permissions`.

## Authentication

Authenticated endpoints accept the user's credentials in either of two ways — exactly as
the GraphQL API does:

- **Bearer token** — `Authorization: Bearer <access_token>`
- **Session cookie** — the `Set-Cookie` headers returned by `signup`, `login`, `session`,
  `verify_email`, and `verify_otp` are honored on subsequent calls. MFA-challenge flows
  (`login`/`forgot_password`/`resend_otp` when OTP/TOTP is required) set a short-lived MFA
  cookie the same way. Browser clients store and resend these automatically; the cookie
  pair is host-scoped and domain-scoped, exactly as on the GraphQL surface.

```bash
curl -X GET https://auth.example.com/v1/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Super-admin-only operations (the `_fga_*` model/tuple management mutations, env, users,
webhooks, etc.) are **not** part of the REST surface — they remain GraphQL-only and
require the admin secret / admin session. See [GraphQL API](./graphql-api) for those.

> **CSRF note:** From `v2.3.0` onward, state-changing `POST` requests are rejected with
> `403` unless they carry an `Origin` (or `Referer`) header. Browsers send this
> automatically; server-side clients should set `Origin` explicitly. The official SDKs do
> this for you.

## Public API Endpoints

Every endpoint below accepts/returns the same fields as its GraphQL counterpart. For the
full field-by-field breakdown of each request and response, follow the linked anchor in
the [GraphQL API reference](./graphql-api).

> **Response shape — no envelope wrapper.** Each endpoint returns the bare domain object,
> byte-identical to the GraphQL response. `signup`, `login`, `verify_email`, `verify_otp`,
> and `session` return the `AuthResponse` fields at the top level
> (`{ "message", "access_token", "id_token", "refresh_token", "expires_in", "user", … }`) —
> **not** wrapped under an `auth` key. `profile` returns the `User` object directly and
> `meta` returns the `Meta` object directly. The remaining endpoints return
> `{ "message": "…" }` (or their documented fields).

### `POST /v1/signup`

Register a new user. Request/response fields match [`signup`](./graphql-api#signup).

### `POST /v1/login`

Authenticate with email/phone + password. Returns tokens, or an MFA challenge flag
(`should_show_email_otp_screen` / `should_show_totp_screen`) when OTP/TOTP is enabled.
Mirrors [`login`](./graphql-api#login).

```bash
curl -X POST https://auth.example.com/v1/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "jane@example.com", "password": "Test@123", "scope": ["openid", "profile", "email"] }'
```

### `POST /v1/magic_link_login`

Start a passwordless login; emails a magic link. Mirrors [`magic_link_login`](./graphql-api#magic_link_login).

### `POST /v1/verify_email`

Complete email verification using the token from the verification email. Mirrors [`verify_email`](./graphql-api#verify_email).

### `POST /v1/resend_verify_email`

Re-send the email-verification message. Mirrors [`resend_verify_email`](./graphql-api#resend_verify_email).

### `POST /v1/verify_otp`

Complete an MFA challenge by submitting the email/phone OTP. Mirrors [`verify_otp`](./graphql-api#verify_otp).

### `POST /v1/resend_otp`

Re-send the MFA OTP. Mirrors [`resend_otp`](./graphql-api#resend_otp).

### `POST /v1/forgot_password`

Start password reset; emails a reset link. Mirrors [`forgot_password`](./graphql-api#forgot_password).

### `POST /v1/reset_password`

Set a new password using the reset token. Mirrors [`reset_password`](./graphql-api#reset_password).

### `POST /v1/logout`

Invalidate the current session *(auth)*. Mirrors [`logout`](./graphql-api#logout).

### `GET /v1/profile`

Get the authenticated user's profile *(auth)*. Mirrors [`profile`](./graphql-api#profile).

### `POST /v1/update_profile`

Update the authenticated user's profile *(auth)*. Mirrors [`update_profile`](./graphql-api#update_profile).

### `POST /v1/deactivate_account`

Deactivate (soft-delete) the authenticated user's account *(auth)*. Mirrors [`deactivate_account`](./graphql-api#deactivate_account).

### `POST /v1/session`

Refresh / fetch the current session *(auth)*. Mirrors [`session`](./graphql-api#session).

### `POST /v1/revoke`

Revoke a refresh token. Mirrors [`revoke`](./graphql-api#revoke).

### `POST /v1/validate_jwt_token`

Validate a JWT and, optionally, required relations. Mirrors [`validate_jwt_token`](./graphql-api#validate_jwt_token).

### `POST /v1/validate_session`

Validate a session cookie and required relations. Mirrors [`validate_session`](./graphql-api#validate_session).

### `GET /v1/meta`

Server feature flags & provider availability. Mirrors [`meta`](./graphql-api#meta).

### `POST /v1/check_permissions`

Answer authorization questions against the embedded [FGA (ReBAC) engine](./authorization)
— evaluate one or more permission checks in a single call. At least one, at most **100**
checks. `results` come back in the same order as `checks` and echo each pair. The subject
is pinned server-side from the caller's token/cookie; the optional `user` field is honored
only for super-admins or when it equals the caller's own subject.

**Request body**

| Field    | Type                       | Description                                                                                       | Required |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| `checks` | `PermissionCheckInput[]`   | Each `{ relation, object, contextual_tuples? }`. 1–100 entries.                                  | yes      |
| `user`   | `string`                   | Explicit subject (`type:id`, or a bare id treated as `user:<id>`). Super-admin / self only.       | no       |

`contextual_tuples` are extra `{ user, relation, object }` tuples evaluated for that one
check only and never persisted — useful for "what-if" checks and request-time facts.

```bash
curl -X POST https://auth.example.com/v1/check_permissions \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "checks": [
      { "relation": "can_view", "object": "document:1" },
      { "relation": "can_edit", "object": "document:1" }
    ]
  }'
```

```json
{
  "results": [
    { "relation": "can_view", "object": "document:1", "allowed": true },
    { "relation": "can_edit", "object": "document:1", "allowed": false }
  ]
}
```

With a contextual tuple:

```bash
curl -X POST https://auth.example.com/v1/check_permissions \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "checks": [
      {
        "relation": "can_view",
        "object": "document:1",
        "contextual_tuples": [
          { "user": "user:alice", "relation": "member", "object": "team:eng" }
        ]
      }
    ]
  }'
```

### `POST /v1/list_permissions`

List what the subject can access. With both `relation` and `object_type` set it answers
"which `object_type`s can I `relation`?"; either or both filters may be omitted, so an
empty body returns every permission the subject holds.

**Request body**

| Field         | Type     | Description                                              | Required |
| ------------- | -------- | ------------------------------------------------------- | -------- |
| `relation`    | `string` | Optional relation filter (e.g. `can_view`).             | no       |
| `object_type` | `string` | Optional object-type filter (e.g. `document`).          | no       |
| `user`        | `string` | Optional explicit subject; same trust rules as above.   | no       |

```bash
curl -X POST https://auth.example.com/v1/list_permissions \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "relation": "can_view", "object_type": "document" }'
```

```json
{
  "objects": ["document:1", "document:42"],
  "permissions": [
    { "object": "document:1", "relation": "can_view" },
    { "object": "document:42", "relation": "can_view" }
  ],
  "truncated": false
}
```

`truncated` is `true` when the result was capped at **1000** entries and more permissions
exist — narrow the query with `relation` / `object_type` to page through them.

## Authorizer Admin API Endpoints

All admin endpoints require super-admin authentication via the `x-authorizer-admin-secret` request header or an `authorizer.admin` session cookie (set by `POST /v1/admin/login`). Except `POST /v1/admin/login`, which may be called without an existing session. The operations are grouped by domain below; each mirrors its GraphQL counterpart for request/response fields.

> **Note:** Admin operations are available over all three surfaces — REST (below), native gRPC (`AuthorizerAdminService`, see the [gRPC API](./grpc#authorizer-admin-methods)), and the [GraphQL API](./graphql-api) (the `_`-prefixed operations).

### Admin Authentication

#### `POST /v1/admin/login`

Authenticate as super-admin with the admin secret. Returns a session token.

**Request body**

| Field           | Type     | Description             | Required |
| --------------- | -------- | ----------------------- | -------- |
| `admin_secret`  | `string` | The admin secret value. | yes      |

**Response** `{ message: string }`

#### `POST /v1/admin/logout`

Invalidate the current admin session.

**Response** `{ message: string }`

#### `GET /v1/admin/session`

Verify the current admin session is valid.

**Response** `{ message: string }`

#### `GET /v1/admin/meta`

Get admin-level metadata about the server (version, feature flags).

**Response** — same as [`GET /v1/meta`](#get-v1meta) but with admin-only fields

### Users

#### `POST /v1/admin/users`

List all users with pagination.

**Request body**

| Field        | Type                | Description  | Required |
| ------------ | ------------------- | ------------ | -------- |
| `pagination` | `{ page, limit }`   | Page & limit. | no       |

**Response** `{ users: User[], pagination: { page, limit, total, offset } }`

#### `POST /v1/admin/user`

Get a specific user by id or email.

**Request body**

| Field | Type     | Description     | Required |
| ----- | -------- | --------------- | -------- |
| `id`  | `string` | User id.        | no       |
| `email` | `string` | User email.    | no       |

**Response** `User`

#### `POST /v1/admin/update_user`

Update user profile fields (email, roles, name, etc.).

**Request body** — see [`_update_user`](./graphql-api#_update_user) for the full field list.

**Response** `User`

#### `POST /v1/admin/delete_user`

Delete a user by email (and all associated OTP/verification data).

**Request body**

| Field   | Type     | Description | Required |
| ------- | -------- | ----------- | -------- |
| `email` | `string` | User email. | yes      |

**Response** `{ message: string }`

#### `POST /v1/admin/verification_requests`

List pending verification requests (email, phone OTP, etc.) with optional pagination.

**Request body**

| Field        | Type              | Description  | Required |
| ------------ | ----------------- | ------------ | -------- |
| `pagination` | `{ page, limit }` | Page & limit. | no       |

**Response** `{ verification_requests: VerificationRequest[], pagination: { ... } }`

### Access Control

#### `POST /v1/admin/revoke_access`

Revoke a user's access (set revoked_timestamp), firing the `user.access_revoked` webhook.

**Request body**

| Field   | Type     | Description | Required |
| ------- | -------- | ----------- | -------- |
| `user_id` | `string` | User id.  | yes      |

**Response** `{ message: string }`

#### `POST /v1/admin/enable_access`

Re-enable a previously revoked user (clear revoked_timestamp), firing the `user.access_enabled` webhook.

**Request body**

| Field   | Type     | Description | Required |
| ------- | -------- | ----------- | -------- |
| `user_id` | `string` | User id.  | yes      |

**Response** `{ message: string }`

#### `POST /v1/admin/invite_members`

Invite users to the platform by email, sending them an invitation link.

**Request body**

| Field          | Type       | Description                            | Required |
| -------------- | ---------- | -------------------------------------- | -------- |
| `emails`       | `string[]` | Email addresses to invite.             | yes      |
| `redirect_uri` | `string`   | Where to redirect after signup.        | no       |

**Response** `{ message: string }`

### Webhooks

#### `POST /v1/admin/add_webhook`

Register a new webhook for an event.

**Request body** — see [`_add_webhook`](./graphql-api#_add_webhook) for field details.

**Response** `{ message: string }`

#### `POST /v1/admin/update_webhook`

Update an existing webhook (endpoint, headers, enabled state, etc.).

**Request body** — see [`_update_webhook`](./graphql-api#_update_webhook) for field details.

**Response** `{ message: string }`

#### `POST /v1/admin/delete_webhook`

Delete a webhook by id.

**Request body**

| Field | Type     | Description  | Required |
| ----- | -------- | ------------ | -------- |
| `id`  | `string` | Webhook id.  | yes      |

**Response** `{ message: string }`

#### `POST /v1/admin/webhook`

Get a webhook by id.

**Request body**

| Field | Type     | Description  | Required |
| ----- | -------- | ------------ | -------- |
| `id`  | `string` | Webhook id.  | yes      |

**Response** `Webhook`

#### `POST /v1/admin/webhooks`

List all webhooks with pagination.

**Request body**

| Field        | Type              | Description  | Required |
| ------------ | ----------------- | ------------ | -------- |
| `pagination` | `{ page, limit }` | Page & limit. | no       |

**Response** `{ webhooks: Webhook[], pagination: { ... } }`

#### `POST /v1/admin/webhook_logs`

List webhook delivery logs with optional pagination and webhook_id filter.

**Request body**

| Field        | Type              | Description      | Required |
| ------------ | ----------------- | -------------- | -------- |
| `pagination` | `{ page, limit }` | Page & limit.  | no       |
| `webhook_id` | `string`          | Filter by hook. | no       |

**Response** `{ webhook_logs: WebhookLog[], pagination: { ... } }`

#### `POST /v1/admin/test_endpoint`

Send a test webhook payload to an endpoint and return the response.

**Request body**

| Field        | Type                | Description          | Required |
| ------------ | ------------------- | -------------------- | -------- |
| `event_name` | `string`            | Event to simulate.   | yes      |
| `endpoint`   | `string`            | URL to call.         | yes      |
| `headers`    | `map[string]string` | Extra HTTP headers.  | no       |

**Response** `{ http_status: int, response: string }`

### Email Templates

#### `POST /v1/admin/add_email_template`

Create a new email template for an event.

**Request body** — see [`_add_email_template`](./graphql-api#_add_email_template) for field details.

**Response** `{ message: string }`

#### `POST /v1/admin/update_email_template`

Update an email template.

**Request body** — see [`_update_email_template`](./graphql-api#_update_email_template) for field details.

**Response** `{ message: string }`

#### `POST /v1/admin/delete_email_template`

Delete an email template by id.

**Request body**

| Field | Type     | Description  | Required |
| ----- | -------- | ------------ | -------- |
| `id`  | `string` | Template id. | yes      |

**Response** `{ message: string }`

#### `POST /v1/admin/email_templates`

List email templates with pagination.

**Request body**

| Field        | Type              | Description  | Required |
| ------------ | ----------------- | ------------ | -------- |
| `pagination` | `{ page, limit }` | Page & limit. | no       |

**Response** `{ email_templates: EmailTemplate[], pagination: { ... } }`

### Audit Logs

#### `POST /v1/admin/audit_logs`

Retrieve audit log entries with optional filtering and pagination.

**Request body**

| Field        | Type              | Description              | Required |
| ------------ | ----------------- | ----------------------- | -------- |
| `pagination` | `{ page, limit }` | Page & limit.            | no       |
| `actor_id`   | `string`          | Filter by actor id.      | no       |
| `action`     | `string`          | Filter by action type.   | no       |
| `resource`   | `string`          | Filter by resource type. | no       |

**Response** `{ audit_logs: AuditLog[], pagination: { ... } }`

### Authorization (FGA)

Manage the embedded fine-grained authorization (FGA) engine: the authorization model and relationship tuples. See [Authorization (FGA)](./authorization) for the conceptual model.

#### `GET /v1/admin/fga/model`

Retrieve the active authorization model as FGA DSL. An empty store returns an empty model (not an error).

**Response** `{ id: string, dsl: string }`

#### `POST /v1/admin/fga/model`

Install a new authorization model version from FGA DSL. Models are versioned and append-only.

**Request body**

| Field | Type     | Description | Required |
| ----- | -------- | ----------- | -------- |
| `dsl` | `string` | FGA DSL.    | yes      |

**Response** `{ id: string, dsl: string }`

#### `POST /v1/admin/fga/tuples` {#post-v1-admin-fga-tuples}

Write (persist) relationship tuples.

**Request body**

| Field   | Type                      | Description         | Required |
| ------- | ------------------------- | ------------------- | -------- |
| `tuples` | `{ user, relation, object }[]` | Tuples to write.  | yes      |

**Response** `{ message: string }`

#### `POST /v1/admin/fga/tuples/delete`

Delete relationship tuples.

**Request body**

| Field   | Type                      | Description         | Required |
| ------- | ------------------------- | ------------------- | -------- |
| `tuples` | `{ user, relation, object }[]` | Tuples to delete. | yes      |

**Response** `{ message: string }`

#### `POST /v1/admin/fga/tuples/read`

Read stored tuples with optional filtering and pagination.

**Request body**

| Field               | Type      | Description              | Required |
| ------------------- | --------- | ------------------------ | -------- |
| `user`              | `string`  | Filter by user.          | no       |
| `relation`          | `string`  | Filter by relation.      | no       |
| `object`            | `string`  | Filter by object.        | no       |
| `page_size`         | `int`     | Max tuples per page.     | no       |
| `continuation_token`| `string`  | Pagination token.        | no       |

**Response** `{ tuples: { user, relation, object }[], continuation_token: string }`

#### `POST /v1/admin/fga/list_users`

List fully-qualified user ids that have a relation on an object (reveals the access graph; admin-only).

**Request body**

| Field      | Type     | Description            | Required |
| ---------- | -------- | ---------------------- | -------- |
| `object`   | `string` | Object to inspect.     | yes      |
| `relation` | `string` | Relation to resolve.   | yes      |
| `user_type`| `string` | Type of users to list. | yes      |

**Response** `{ users: string[] }`

#### `POST /v1/admin/fga/expand`

Expand the relationship/userset tree for a relation on an object (admin-only; useful for debugging). Returns the OpenFGA userset tree as a JSON string.

**Request body**

| Field      | Type     | Description          | Required |
| ---------- | -------- | -------------------- | -------- |
| `relation` | `string` | Relation to expand.  | yes      |
| `object`   | `string` | Object to expand on. | yes      |

**Response** `{ tree: string }`

#### `POST /v1/admin/fga/reset`

Delete the entire fine-grained authorization store (model, all versions, and all tuples) and start fresh. Refused if any tuples still exist. Destructive and audited.

**Request body** — empty

**Response** `{ message: string }`

## Errors

REST errors follow the grpc-gateway convention: a non-`200` HTTP status with a JSON body
containing a `code` and `message`.

```json
{
  "code": 7,
  "message": "fga is not enabled on this server"
}
```

Common cases:

| Situation                                  | HTTP status        |
| ------------------------------------------ | ------------------ |
| Missing/invalid credentials                | `401 Unauthorized` |
| Explicit `user` not permitted for caller   | `403 Forbidden`    |
| FGA not enabled (`--fga-store` unset)      | `400 Bad Request`  |
| Validation failure (e.g. `> 100` checks)   | `400 Bad Request`  |

## See also

- [GraphQL API](./graphql-api) — the full field-level reference shared by all transports.
- [gRPC API](./grpc) — the same operations over native gRPC (BSR module, reflection, health).
- [Authorization (FGA)](./authorization) — the relationship model behind the permission endpoints.
- [Endpoints](./endpoints) — OAuth/OIDC and operational endpoints (`/authorize`, `/oauth/token`, `/.well-known/*`, `/healthz`).
- [MCP Server](./mcp) — exposing `check_permissions` / `list_permissions` to LLM agents.
