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
> (the default). The surface is being migrated incrementally — see
> [Available endpoints](#endpoint-reference) below for what is live today.

Table of Contents

- [Base URL & transport](#base-url--transport)
- [Authentication](#authentication)
- [Endpoint reference](#endpoint-reference)
  - [`POST /v1/signup`](#post-v1signup)
  - [`POST /v1/logout`](#post-v1logout)
  - [`GET /v1/profile`](#get-v1profile)
  - [`POST /v1/session`](#post-v1session)
  - [`POST /v1/revoke`](#post-v1revoke)
  - [`POST /v1/validate_jwt_token`](#post-v1validate_jwt_token)
  - [`POST /v1/validate_session`](#post-v1validate_session)
  - [`GET /v1/meta`](#get-v1meta)
  - [`POST /v1/check_permissions`](#post-v1check_permissions)
  - [`POST /v1/list_permissions`](#post-v1list_permissions)
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
- **Session cookie** — the `Set-Cookie` returned by `login`/`session` is honored on
  subsequent calls.

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

## Endpoint reference

Every endpoint below accepts/returns the same fields as its GraphQL counterpart. For the
full field-by-field breakdown of each request and response, follow the linked anchor in
the [GraphQL API reference](./graphql-api).

Super-admin-only operations (the `_fga_*` model/tuple management mutations, env, users,
webhooks, etc.) are **not** part of the REST surface — they remain GraphQL-only.

> **Migration in progress.** The remaining authentication operations — `login`,
> `magic_link_login`, `verify_email`, `resend_verify_email`, `verify_otp`, `resend_otp`,
> `forgot_password`, `reset_password`, `update_profile`, and `deactivate_account` — are
> defined in the schema but not yet served over REST/gRPC; they return `501`/`UNIMPLEMENTED`
> for now. Use the [GraphQL API](./graphql-api) for these flows until their migration lands.

### `POST /v1/signup`

Register a new user. Request/response fields match [`signup`](./graphql-api#signup).

### `POST /v1/logout`

Invalidate the current session *(auth)*. Mirrors [`logout`](./graphql-api#logout).

### `GET /v1/profile`

Get the authenticated user's profile *(auth)*. Mirrors [`profile`](./graphql-api#profile).

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
| Endpoint not yet migrated to REST/gRPC     | `501 Not Implemented` |

## See also

- [GraphQL API](./graphql-api) — the full field-level reference shared by all transports.
- [gRPC API](./grpc) — the same operations over native gRPC (BSR module, reflection, health).
- [Authorization (FGA)](./authorization) — the relationship model behind the permission endpoints.
- [Endpoints](./endpoints) — OAuth/OIDC and operational endpoints (`/authorize`, `/oauth/token`, `/.well-known/*`, `/healthz`).
- [MCP Server](./mcp) — exposing `check_permissions` / `list_permissions` to LLM agents.
