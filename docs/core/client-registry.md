---
sidebar_position: 6
title: Client Registry
---

# Client Registry

Authorizer maintains a **client registry** — one authoritative table of every OAuth client that can authenticate against the instance. It holds two kinds of clients:

| Kind | What it is | Grants |
|------|------------|--------|
| `interactive` | Human-facing login client (browser/app redirect flows). The instance's **reserved client** — seeded at boot from `--client-id` / `--client-secret` — is this kind. | `authorization_code`, `refresh_token` |
| `service_account` | Machine/workload identity (backend services, CI jobs, AI agents). Created by admins via the admin API. | `client_credentials`, [token exchange](../enterprise/token-exchange) |

`kind` is **immutable** after creation. Clients created through the admin API today are `service_account` clients; the interactive kind is currently reserved for the boot-seeded client, so existing single-client deployments keep working unchanged.

## `client_id` vs. internal `id`

Every client has two identifiers:

- **`id`** — the internal surrogate primary key (UUID). Used to address the client in admin operations (`_update_client`, `_rotate_client_secret`, …).
- **`client_id`** — the public OAuth identifier presented at `/authorize` and `/oauth/token`. Unique across the registry and **immutable**.

For admin-created clients, `client_id` defaults to the internal `id` — the UUID returned by `_create_client` is the value you pass as `client_id` at the token endpoint. For the reserved boot client, `client_id` is the literal `--client-id` value, so every existing token `aud`, JWKS `kid`, and introspection `client_id` keeps keying on that exact string.

## Client secrets

- Generated server-side; stored only as a **bcrypt hash** (cost 12).
- The plaintext is returned **exactly once** — in the `_create_client` response and again in the `_rotate_client_secret` response. It can never be retrieved afterwards; store it in your secret manager immediately.
- Rotating a client's secret does **not** affect browser session-cookie encryption (that stays bound to the instance's `--client-secret`).
- Secret verification is constant-time; an unknown `client_id` and a wrong secret are indistinguishable to a caller.

## Scopes are an allow-list

`allowed_scopes` is the client's authorization ceiling:

- A `client_credentials` request may only ask for a **subset** of `allowed_scopes`; anything outside it fails with `invalid_scope` (no silent downgrade).
- Omitting `scope` grants the full authorized set.
- An **empty allow-list is deny-all** — `_create_client` requires at least one non-empty scope.
- In [token exchange](../enterprise/token-exchange), `allowed_scopes` is the agent's delegation ceiling.

## Admin API

All operations require super-admin authentication (`x-authorizer-admin-secret` header or the `authorizer.admin` cookie from `_admin_login`) and are also available over gRPC/REST via `AuthorizerAdminService` (`CreateClient`, `UpdateClient`, `DeleteClient`, `RotateClientSecret`, `GetClient`, `Clients` — see the [gRPC reference](./grpc)).

| Operation | Type | Purpose |
|-----------|------|---------|
| `_create_client` | mutation | Register a service account; returns the secret **once** |
| `_update_client` | mutation | Update `name`, `description`, `allowed_scopes`, `is_active` |
| `_rotate_client_secret` | mutation | Invalidate the old secret, return a new one **once** |
| `_delete_client` | mutation | Remove the client |
| `_client` | query | Fetch one client by `id` |
| `_clients` | query | Paginated list |

### Create a service account

```graphql
mutation {
  _create_client(
    params: {
      name: "payments-worker"
      description: "Nightly settlement job"
      allowed_scopes: ["read:payments", "write:settlements"]
    }
  ) {
    client {
      id
      name
      allowed_scopes
      is_active
    }
    client_secret # shown ONCE — store it now
  }
}
```

### Manage clients

```graphql
# Disable a client (blocks new token issuance immediately;
# already-issued tokens live until their exp)
mutation {
  _update_client(params: { id: "CLIENT_UUID", is_active: false }) {
    id
    is_active
  }
}

# Rotate the secret
mutation {
  _rotate_client_secret(params: { id: "CLIENT_UUID" }) {
    client { id }
    client_secret # the new secret, shown ONCE
  }
}

# List
query {
  _clients {
    pagination { total }
    clients { id name allowed_scopes is_active created_at }
  }
}
```

Client responses never contain a secret or secret hash — there is no `client_secret` field on the `Client` type by design.

## Authenticating: `client_credentials`

Service accounts get tokens with the RFC 6749 §4.4 grant at `POST /oauth/token`:

```bash
curl -s -X POST $AUTHORIZER_URL/oauth/token \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "scope=read:payments"
```

```json
{
  "access_token": "eyJhbG...",
  "token_type": "Bearer",
  "expires_in": 1800,
  "scope": "read:payments"
}
```

Rules:

- Client authentication via `client_secret_basic` (HTTP Basic) or `client_secret_post` (form body) — never both; presenting more than one method is rejected (RFC 6749 §2.3).
- The grant is **machine-only**: an interactive `client_id` is rejected with `unauthorized_client` before secret verification, so it can't be used to confirm a guessed secret.
- No `refresh_token`, no `id_token` — re-authenticate on expiry.
- Discovery (`/.well-known/openid-configuration`) advertises `client_credentials` in `grant_types_supported`.
- Success and failure are both audited (`token.client_credentials` / `token.client_credentials_failed` audit events).

## Secretless authentication: client assertions & trusted issuers

Instead of a stored secret, a service account can authenticate with a signed JWT it already possesses — a Kubernetes ServiceAccount token or a SPIFFE JWT-SVID — presented as an RFC 7523 `client_assertion`:

```
POST /oauth/token
grant_type=client_credentials
&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
&client_assertion=<external JWT>
```

The assertion is validated against a **trusted issuer** the admin registers for that service account (`_add_trusted_issuer` / `_update_trusted_issuer` / `_delete_trusted_issuer` / `_trusted_issuer` / `_trusted_issuers`): issuer URL, key source (OIDC discovery or a static JWKS URL), expected audience, and an exact-match subject allow-list (empty = deny-all).

Setup, validation rules, and Kubernetes/SPIFFE walkthroughs: [Workload Identity](../enterprise/workload-identity).

## Backward compatibility

The registry is additive. On upgrade:

- The reserved client is seeded idempotently from `--client-id` / `--client-secret` (booting twice, or two instances at once, still yields one row).
- Existing tokens keep validating; `aud` stays the configured `--client-id`.
- Existing session cookies keep decrypting; cookie crypto is not coupled to per-client secrets.
- Discovery and JWKS shapes are unchanged.
