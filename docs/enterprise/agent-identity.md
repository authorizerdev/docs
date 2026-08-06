---
sidebar_position: 8
title: Agent Identity & Permissions
---

# Agent Identity & Permissions

[Token exchange](./token-exchange) gives you a token that carries **both** identities — `sub` is the user, `act.sub` is the agent. This page is about what Authorizer then *does* with that second identity when the agent asks a permission question.

The short version: an agent's effective authority is the **intersection** of its own permissions and its user's.

```
effective authority  =  perms(agent)  ∩  perms(user)
```

Evaluated per action, at request time, on both `check_permissions` and `list_permissions`.

## Why an intersection

Give an agent a token and it holds the user's authority. Give it its own grants and it holds those. Neither alone is safe:

- **Only the user's authority** — a compromised or confused agent can do anything its user can. The classic [Confused Deputy](https://en.wikipedia.org/wiki/Confused_deputy_problem): a calendar-reading agent tricked into reading payroll, because its user *can* read payroll.
- **Only the agent's authority** — the agent acts on resources its user was never allowed near, and "on behalf of Alice" becomes a fiction.

Intersecting both means an agent can only ever do things that **it** is trusted with **and** that its **user** could have done themselves. Neither identity can widen the other. This matches how WorkOS, Auth0 FGA and OpenFGA model agentic access.

## Turning it on

**Declare `type agent` in your authorization model.** That is the whole opt-in — there is no flag.

```dsl
model
  schema 1.1

type user
type agent

type document
  relations
    define viewer: [user, agent]
    define can_view: viewer
```

Declaring the type IS the opt-in because the feature is meaningless without a model that can express agent grants, and because of how OpenFGA fails: checking `agent:x` against a model with **no** `agent` type does not return `false`, it **errors** — and permission checks fail closed on errors. A flag that could be switched on against an unprepared model would deny every permission check for every delegated caller: a total authorization outage, not a graceful degradation. Auto-detection makes that state unreachable.

Detection is cached per authorization-model id, so writing a new model version takes effect immediately. The model-id lookup itself still runs per delegated request; only the type enumeration is cached.

:::note Before you declare the type
The moment `type agent` appears in your model, every delegated caller must ALSO satisfy the agent half. Grant your agents before you deploy the model, or their calls start being denied. The [`denied_by_agent` metric](#observability) tells you exactly this is happening.
:::

## Granting an agent

The agent's subject is `agent:<client_id>` — the `client_id` of the [`service_account`](../core/client-registry) that authenticated the exchange, which is the same value that appears as `act.sub` on the token. Grant it like any other subject:

```bash
# Alice can view the document
curl … -d '{"query":"mutation { _fga_write_tuples(params: { tuples: [
  { user: \"user:alice-id\", relation: \"viewer\", object: \"document:q4-plan\" }
]}) { message } }"}'

# The calendar agent may view it too
curl … -d '{"query":"mutation { _fga_write_tuples(params: { tuples: [
  { user: \"agent:calendar-agent-client-id\", relation: \"viewer\", object: \"document:q4-plan\" }
]}) { message } }"}'
```

Now `check_permissions` with a delegated token returns `allowed: true` only while **both** tuples exist. Delete either one and it is `false`.

### One user, many agents

Agents are independent subjects, so a user can delegate to as many as they like and each carries its own, separately revocable reach:

| Grant | Effect |
|-------|--------|
| `agent:calendar-bot` → `viewer` on `document:*` | that agent may read documents Alice can read |
| `agent:finance-bot` → nothing | that agent can do nothing for Alice, whatever her own access |

Revoking one agent's tuple does not touch the user or any other agent.

### Agent-to-agent (multi-hop)

Only the **immediate** actor participates in the decision. In a chain `app → agent → sub-agent`, the check is `perms(sub-agent) ∩ perms(user)` — prior actors nested deeper in `act` are recorded for audit but never grant or deny. They were asserted upstream, not verified here, so treating them as authority would let a middle hop vouch for itself.

Since scope attenuation is monotonic across hops (see [token exchange](./token-exchange#scope-attenuation)), a longer chain can only ever be narrower.

## Calling Authorizer's own API

A delegated token is bound to exactly one `resource` (RFC 8707) and is only accepted there. To let an agent ask **Authorizer** about its own authority, exchange for Authorizer's own URL:

```bash
curl -X POST $AUTHORIZER_URL/oauth/token \
  -u "$AGENT_CLIENT_ID:$AGENT_CLIENT_SECRET" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:token-exchange" \
  -d "subject_token=$USER_ACCESS_TOKEN" \
  -d "subject_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "actor_token=$AGENT_TOKEN" \
  -d "actor_token_type=urn:ietf:params:oauth:token-type:access_token" \
  -d "resource=$AUTHORIZER_URL"          # ← Authorizer itself
```

Present the result as a normal bearer token:

```graphql
query {
  check_permissions(params: {
    checks: [{ relation: "can_view", object: "document:q4-plan" }]
  }) {
    results { relation object allowed }   # intersected: agent AND user
  }
}
```

A token exchanged for `https://calendar.example` will **not** authenticate here, and vice versa. That is the audience binding doing its job, not a misconfiguration.

### The subject cannot be changed

`check_permissions` and `list_permissions` accept an optional `user`. For a delegated caller it may only ever be the caller's own subject — supplied or not, the agent half is still applied. Naming any other subject is rejected outright, even if the request also carries an admin credential. An agent must not be able to shed its own constraint, or probe access that neither half of its intersection has.

## Revocation

| Lever | Stops a delegated token at Authorizer's API? | Stops it at a downstream resource server? |
|-------|---|---|
| Its 5-minute TTL expiring | Yes | Yes |
| User logs out (that session) | Yes | No |
| Password reset / email change | Yes | No |
| Admin wipes the user's sessions | Yes | No |
| User revoked or deprovisioned ([SCIM](./scim) `active:false`) | Yes | No |
| Service-account subject deactivated | Yes | No |
| Deleting the agent's FGA tuples | Yes — the next check denies | n/a |
| **The agent's own service account deactivated** | **No** — see below | No |

:::warning Deactivating the agent does not stop tokens it already holds
Only the **subject** is checked for liveness at validation time; the acting
agent is not. Deactivating an agent's service account blocks the **next**
exchange, but a token it minted moments earlier keeps working until its
5-minute TTL expires. Do not treat "disable the agent" as immediate
containment — to cut an agent off now, delete its FGA tuples, which the very
next check honours.
:::

A delegated token carries an opaque `sid` naming the session it was derived from, so at Authorizer's own API it is exactly as revocable as the credential that seeded it. A **downstream resource server** verifies the token offline against [`/.well-known/jwks.json`](../core/oauth2-oidc) and cannot see any of that — there, the short TTL remains the only bound. Keep it that way: do not build a resource server that treats a delegated token as long-lived.

## Audit

A delegated action is recorded as the **agent**, with the user preserved alongside:

| Field | Value |
|-------|-------|
| `actor_id` | the agent's `client_id` |
| `actor_type` | `agent` |
| `actor_email` | *(empty — an agent has no mailbox)* |
| `metadata` | gains `delegated_user_id=…` and, when known, `delegated_user_email=…` |

Without this an agent's actions are indistinguishable from the user's own — same id, same type, no trace anything automated was involved. RFC 8693 §1.1 draws exactly this line: delegation is "A representing B" with A keeping its identity, as against impersonation where A is indistinguishable from B. It cannot be reconstructed after the fact, because the information was never written.

## Observability {#observability}

`authorizer_fga_delegated_checks_total{operation, outcome}` counts every delegated decision. The `outcome` label is what makes an intersection denial diagnosable:

| `outcome` | Meaning | What to do |
|-----------|---------|-----------|
| `allowed` | both halves permitted | — |
| `denied_by_agent` | the agent has no grant; the user may well have access | grant the **agent** a tuple |
| `denied_by_user` | the agent had its grant, the user does not have access | **do not** widen the agent — this is the Confused Deputy case working as intended |
| `not_enforced` | a delegated caller arrived but the model declares no `agent` type, so it was authorized as the **user alone** | declare `type agent` and grant your agents |

`not_enforced` is the one to alert on: it is the only outcome that reports a security property *not* being enforced, and it is silent by construction — the request succeeds and nothing in the response says the agent was unconstrained.

`allowed`, `denied_by_agent` and `denied_by_user` are emitted by
**`check_permissions` only**. `list_permissions` intersects object *sets*
rather than folding a per-check decision, so the only outcome it can ever
report is `not_enforced`.

Ordinary (non-delegated) callers do not appear in this series at all; they are counted in `authorizer_fga_checks_total` exactly as before.

## What does not change

Delegation is additive. If your model has no `agent` type, every one of these behaves precisely as it did before:

- OIDC, SAML, SCIM, OAuth 2.1 flows and `client_credentials` (M2M).
- `check_permissions` / `list_permissions` for user and service-account callers.
- A machine token still resolves to `service_account:<client_id>`; a delegated token always resolves to `user:<sub>` and never to a service account, regardless of what it carries.

## Failure modes

Everything fails closed:

| Situation | Result |
|-----------|--------|
| The model cannot be read to detect the agent type | the delegated request is **denied** (ordinary callers are unaffected) |
| The engine errors on any check | the whole call is denied |
| The agent's `client_id` has an unexpected shape | denied — it is never concatenated into a subject string unchecked |
| The delegating user cannot be confirmed active | denied |
| The originating session is gone | denied |

## See also

- [Token Exchange & Delegation](./token-exchange) — how the token is minted, scoped and chained
- [Authorization (FGA)](../core/authorization) — the model, tuples and the permission APIs
- [Client Registry](../core/client-registry) — registering an agent as a `service_account`
- [`with-agent-permissions`](https://github.com/authorizerdev/examples/tree/main/with-agent-permissions) — **runnable demo of everything on this page**: the intersection, enumeration, the explicit-`user` gate, per-agent revocation, and the model-declares-agent opt-in
- [`with-agent-delegation`](https://github.com/authorizerdev/examples/tree/main/with-agent-delegation) — runnable multi-hop example of minting the token itself (scope attenuation, `act` chain)
