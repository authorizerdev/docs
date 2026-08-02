---
sidebar_position: 7
title: Token Exchange & Delegation
---

# Token Exchange & Delegation (RFC 8693)

Authorizer implements [RFC 8693 OAuth 2.0 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693) in a **delegation-only profile**: an agent (a `service_account` from the [client registry](../core/client-registry)) trades a user's token plus its own token for a short-lived, down-scoped, audience-bound token that carries *both* identities. Built for AI agents and service-to-service acting-on-behalf-of.

Three guarantees on every downstream call:

1. **Both identities travel together** — the resource server sees *agent X acting for user Y* (`sub` = user, `act.sub` = agent).
2. **Least privilege** — the token is attenuated to the intersection of what the user has, what the agent may ever have, and what was asked for.
3. **The chain is auditable** — `app → agent → user` is recorded in the audit log.

## The `act` claim

```jsonc
{
  "iss": "https://your-authorizer.example",
  "sub": "user-alice-id",              // whose authority is exercised
  "aud": "https://calendar.example",   // the bound resource (RFC 8707)
  "scope": ["calendar:read"],          // attenuated
  "exp": 1712500300,                   // now + 5 minutes
  "client_id": "agent-client-id",      // RFC 9068: the calling agent
  "act": {                             // who is acting
    "sub": "agent-client-id",
    "act": { "sub": "app-client-id" }  // nested: prior hop, if re-exchanged
  }
}
```

`sub` stays the **user**; `act.sub` is the **immediate actor** — always the *authenticated* agent's registered `client_id`, never a token-supplied claim; nested `act` encodes multi-hop delegation. The JWT header carries `typ: at+jwt` (RFC 9068). `act` and `client_id` are reserved claims — the custom access token script cannot forge them (it is not run for delegated tokens at all).

## Request

`POST /oauth/token` with the calling agent authenticated as a `service_account` (`client_secret_basic`, `client_secret_post`, or an RFC 7523 [`client_assertion`](./workload-identity)):

| Parameter | Required | Notes |
|-----------|----------|-------|
| `grant_type` | Yes | `urn:ietf:params:oauth:grant-type:token-exchange` |
| `subject_token` | Yes | The user's Authorizer access token — the authority being exercised |
| `subject_token_type` | Yes | `urn:ietf:params:oauth:token-type:access_token` or `urn:ietf:params:oauth:token-type:jwt` |
| `actor_token` | Yes | The agent's own access token (from `client_credentials`). Omitting it is rejected — subject-only exchange is impersonation, which this endpoint does not serve |
| `actor_token_type` | Yes | Same URNs as `subject_token_type` |
| `resource` | Yes | **Exactly one** (RFC 8707). Zero or repeated values are rejected — a multi-audience delegated token would be replayable across resource servers |
| `scope` | No | Requested down-scope (space-separated) |

```bash
# 1. Agent gets its own token
AGENT_TOKEN=$(curl -s -X POST $AUTHORIZER_URL/oauth/token \
  -u "$AGENT_CLIENT_ID:$AGENT_CLIENT_SECRET" \
  -d "grant_type=client_credentials" | jq -r .access_token)

# 2. Exchange: user's token + agent's token → delegated token
curl -s -X POST $AUTHORIZER_URL/oauth/token \
  -u "$AGENT_CLIENT_ID:$AGENT_CLIENT_SECRET" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:token-exchange" \
  -d "subject_token=$USER_ACCESS_TOKEN" \
  -d "subject_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "actor_token=$AGENT_TOKEN" \
  -d "actor_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "resource=https://calendar.example" \
  -d "scope=calendar:read"
```

**Response** (RFC 8693 §2.2):

```json
{
  "access_token": "eyJhbG...",
  "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "calendar:read"
}
```

## Scope attenuation

The delegated token's scope is always:

```
effective = subject_token.scope ∩ agent.allowed_scopes ( ∩ requested scope, when given )
```

- The agent's [`allowed_scopes`](../core/client-registry) is its **delegation ceiling** — it can never exceed it, even when the subject is an admin. An agent with an empty ceiling can delegate nothing (`invalid_scope`).
- Because the subject token's own scope is always intersected, attenuation is **monotonic**: re-exchanging an already-narrowed delegated token can only narrow further — never restore scope.
- An empty intersection is rejected with `invalid_scope`, never silently widened.

## Multi-hop delegation

A delegated token can itself be the `subject_token` of a further exchange (app → agent → sub-agent). The prior `act` chain nests under the new actor. The chain depth is capped at **4**; deeper chains are rejected with `invalid_request`.

A runnable 4-hop example (`orchestrator → research-agent → crm-reader → export-agent`, plus live rejections for a 5th hop, scope re-widening, and actor-token substitution) is in [`with-agent-delegation`](https://github.com/authorizerdev/examples/tree/main/with-agent-delegation).

## Resource binding & validation

- `aud` on the delegated token is the single `resource` — it is only valid at that resource server.
- Delegated tokens are **stateless**: the downstream resource server validates them via local JWT verification against [`/.well-known/jwks.json`](../core/oauth2-oidc) (checking `iss`, `aud`, `exp`, `scope`) and/or `POST /oauth/introspect`.
- They are **not refreshable**. TTL is fixed at **5 minutes**; the agent re-exchanges when it needs more time. The short TTL is the baseline revocation story — revoking the user stops the *next* exchange immediately (see below), and in-flight tokens die within the window.

## Security invariants

| Invariant | Enforcement |
|-----------|-------------|
| Delegation only — no impersonation | `actor_token` is mandatory; a subject-only exchange is rejected |
| Actor is the authenticated caller | The `actor_token`'s `sub` must be the authenticated agent — a valid-but-unrelated token cannot stand in as the actor |
| Actor identity is unforgeable | `act.sub` is stamped from the agent's registered `client_id`, never from a request or token claim |
| Only Authorizer-issued tokens | Both tokens must verify against this server's signing key, with `iss` bound to this host and `token_type=access_token` |
| Revoked users cannot seed delegation | A deactivated/revoked subject user (e.g. [SCIM](./scim) `active:false`) is rejected fail-closed; a user that cannot be loaded is also rejected (a DB error never fails open) |
| Non-widening | Monotonic scope intersection (above) |
| Bounded chains | `act` depth ≤ 4 |
| Auditable | Every exchange logs actor, `on_behalf_of` (+ type `user`/`agent`), the serialized delegation chain (`app>agent>user`), and the bound resource in the audit log metadata |

## Errors

| Error | Cause |
|-------|-------|
| `invalid_request` | Missing/unsupported token types, missing `actor_token`, `resource` count ≠ 1, chain too deep |
| `invalid_grant` | Subject or actor token invalid/expired, actor token not the caller's, subject revoked or unverifiable |
| `invalid_scope` | Empty agent ceiling, or empty intersection after attenuation |
| `invalid_client` / `unauthorized_client` | Client authentication failed, or the caller is not a `service_account` |
