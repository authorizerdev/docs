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
- [Available methods](#available-methods)
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
- [Calling with `grpcurl`](#calling-with-grpcurl)
- [Health checks](#health-checks)
- [Errors](#errors)
- [See also](#see-also)

## Service & transport

| Property              | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Proto package         | `authorizer.v1`                                                    |
| Service               | `AuthorizerService`                                                |
| Port                  | `--grpc-port` (default `9091`)                                     |
| TLS                   | `--grpc-tls-cert` + `--grpc-tls-key`; `--grpc-insecure` for dev    |
| Server reflection     | `--enable-grpc-reflection` (default `true`)                        |
| Health checking       | `grpc.health.v1.Health` (always registered)                       |

The gRPC server is enabled by default. Auth flows over gRPC exactly as it does over REST:
attach the user's credential as request metadata —
`authorization: Bearer <access_token>` — or a session cookie.

## Protobuf schema

The schema is published to the **[Buf Schema Registry](https://buf.build/authorizerdev/authorizer)**
as the module `buf.build/authorizerdev/authorizer`. You can generate a typed client for any
language without copying `.proto` files around.

`buf.gen.yaml`:

```yaml
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
languages. Prefer not to codegen yourself? The official [Go](../sdks/authorizer-go/),
[JavaScript](../sdks/authorizer-js/), and [Python](../sdks/authorizer-python/) SDKs wrap the
API for you.

## Available methods

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
