---
sidebar_position: 4
title: Authorization (FGA)
---

# Authorization (Fine-Grained)

Authorizer ships a built-in fine-grained authorization (FGA) engine alongside its authentication features. FGA is **opt-in per request** and **always enforcing** — a request that asks for a permission the policy graph does not grant is rejected with `unauthorized`.

This page covers:

1. The data model — **resources, scopes, policies, permissions**.
2. How a caller asserts a permission via `required_permissions` on `session`, `validate_session`, and `validate_jwt_token`.
3. How an admin defines the policy graph via the `_authz_add_resource` / `_authz_add_scope` / `_authz_add_policy` / `_authz_add_permission` GraphQL mutations.
4. How a client reads its own granted permissions via the `permissions` query.
5. Decision strategies, principal targets, and operational observability.

---

## 1. Model

| Concept | Purpose | Example |
| --- | --- | --- |
| **Resource** | A noun the application protects. | `docs`, `billing`, `org` |
| **Scope** | A verb / action on a resource. | `read`, `write`, `admin` |
| **Policy** | A rule that says **who** matches — a principal selector. Targets a role, a user ID, or an attribute. | "all users with role=`user`" |
| **Permission** | The binding `(resource, [scopes], [policies], decision_strategy)`. Allows scopes on the resource when at least one policy matches (per decision strategy). | "policy `user-role-can-read` grants `docs:read`" |
| **Principal** | The caller being checked. `{id, type, roles, max_scopes?}`. `type` is `user`, `client`, or `agent`. `max_scopes` (optional) is a ceiling — even if a policy grants more, scopes outside `max_scopes` are denied. | `{id: "u-1", type: "user", roles: ["user"]}` |

**Evaluator contract:** `CheckPermission(principal, resource, scope) → {allowed, matched_policy}`.

- If no permission row exists for `(resource, scope)`, the result is **deny**. No policy is consulted.
- If permissions exist, each is evaluated via its `decision_strategy` (see §6). An explicit deny short-circuits the request unless overridden by strategy.
- Errors (DB, invalid input) **always fail closed** — the caller sees `unauthorized`.

---

## 2. Asserting permissions on session APIs

Three GraphQL operations accept an optional `required_permissions: [PermissionInput!]`:

| Operation | Use case |
| --- | --- |
| `session` | SSO bootstrap. Returns `access_token` only if the cookie's user has every listed permission. Rotates the session cookie on success. |
| `validate_session` | Server-rendered apps with cookies. Validates the cookie **and** the permission set. Does not rotate. |
| `validate_jwt_token` | API gateway / service middleware. Validates a JWT **and** the permission set. Does not rotate. |

**Input shape:**

```graphql
input PermissionInput {
  resource: String!
  scope: String!
}
```

Semantics: every entry in `required_permissions` must be allowed (AND). Any deny — or any unknown `(resource, scope)` pair — returns `unauthorized`.

### Examples

```graphql
# session
query {
  session(params: {
    required_permissions: [
      { resource: "docs", scope: "read" }
    ]
  }) {
    access_token
    user { id email roles }
  }
}

# validate_jwt_token — multiple required permissions are ANDed
query {
  validate_jwt_token(params: {
    token_type: "access_token",
    token: "<jwt>",
    required_permissions: [
      { resource: "docs",    scope: "read" },
      { resource: "billing", scope: "view" }
    ]
  }) { is_valid claims }
}

# validate_session
query {
  validate_session(params: {
    cookie: "<session-cookie>",
    required_permissions: [
      { resource: "docs", scope: "write" }
    ]
  }) { is_valid user { id roles } }
}
```

Omit `required_permissions` to preserve pre-FGA behavior — the call returns/validates as before.

---

## 3. Building the policy graph (admin mutations)

All admin mutations require the super-admin secret (cookie or `X-Authorizer-Admin-Secret`). They are prefixed with `_authz_` to namespace the authorization API distinctly from other admin operations.

### Step 1 — Define resources and scopes

```graphql
mutation { _authz_add_resource(params: { name: "docs" })  { id name } }
mutation { _authz_add_scope(params:    { name: "read" })  { id name } }
mutation { _authz_add_scope(params:    { name: "write" }) { id name } }
```

List, update, and delete each have symmetric operations: `_authz_resources` (list query), `_authz_update_resource`, `_authz_delete_resource`, and the same set for `scope` (`_authz_scopes`, `_authz_update_scope`, `_authz_delete_scope`).

### Step 2 — Define a policy (who matches)

A policy is a principal selector. The `type` field controls which target is honored:

| `type`      | `target_type` accepts | Notes |
| ----------- | -------------------- | ----- |
| `role`      | `role`               | `target_value` must be a configured role (see `--roles`). |
| `user`      | `user`               | `target_value` is the user's **ID** (not email). |
| `attribute` | `attribute`          | Custom attribute match — `target_value` is the JSON key the principal must satisfy. |

```graphql
mutation {
  _authz_add_policy(params: {
    name: "user-role-can-read",
    type: "role",
    targets: [{ target_type: "role", target_value: "user" }]
  }) { id }
}
```

### Step 3 — Bind it all together with a permission

```graphql
mutation {
  _authz_add_permission(params: {
    name: "docs-read",
    resource_id: "<resource-id>",
    scope_ids:   ["<read-scope-id>"],
    policy_ids:  ["<policy-id>"],
    decision_strategy: "affirmative"
  }) { id }
}
```

`scope_ids` can include multiple scopes — one permission row can cover `read` + `write`. `policy_ids` likewise can include multiple policies; their combination follows `decision_strategy` (see §6).

---

## 4. Reading granted permissions — `permissions`

A signed-in caller can ask "what am I allowed to do?" without enumerating every `(resource, scope)` pair:

```graphql
query {
  permissions {
    resource
    scope
  }
}
```

Returns the flat list of `(resource, scope)` pairs granted to the caller's principal. Useful for:

- Building UIs that hide/show actions based on the current user.
- JWT embedding — bake the list into a custom claim if you want a stateless authz check downstream.

---

## 5. Principal types

`CheckPermission` evaluates against a `Principal`. Authorizer derives the principal automatically from the calling identity:

| Auth method | `principal.type` | `principal.id` |
| ----------- | ---------------- | -------------- |
| User session / JWT | `user`   | user's UUID |
| Machine-to-machine client credentials | `client` | client ID |
| Agent token (planned) | `agent`  | agent ID |

`max_scopes` is an optional **delegation ceiling** carried on the principal — e.g. a downstream token issued via OAuth's `scope=` param can be ceilinged so it never exceeds the granted set even if policies later widen.

---

## 6. Decision strategies

A permission can attach multiple policies. Their verdicts combine via `decision_strategy`:

| Strategy | Semantics | When to use |
| -------- | --------- | ----------- |
| `affirmative` (default) | Any policy granting access wins; deny only if all deny. | Most-permissive — additive role grants. |
| `consensus` | More grants than denies → allow. Equal split → deny. | Voting-style approval. |
| `unanimous` | All policies must grant; any deny denies. | Strict — e.g. "billing-admin AND on-call". |

An **explicit deny** from any policy in `unanimous` or `consensus` short-circuits to deny.

---

## 7. Observability

Two Prometheus counters surface authorization behavior. Detailed shapes live in [Metrics & Monitoring](./metrics-monitoring#authorization-metrics).

| Counter | What it measures |
| ------- | ---------------- |
| `authorizer_required_permissions_checks_total{endpoint, outcome}` | Per-endpoint outcome of `required_permissions`: `granted`, `denied`, `not_requested`, `error`. **Use this for FGA adoption + denial alerting.** |
| `authorizer_authz_checks_total{result}` | Per-`CheckPermission` evaluator outcome: `allowed`, `denied`, `unmatched`, `error`. Lower-level than the above. |
| `authorizer_authz_unmatched_total` | Subset of evaluator calls that found no permission row for `(resource, scope)`. Watch this when adding new `required_permissions` call sites to find gaps in your policy graph. |

`outcome="error"` on `authorizer_required_permissions_checks_total` is an operational signal — a DB/storage failure is preventing the check from completing. Page on it.

---

## 8. Caching

`CheckPermission` results are cached for `--authorization-cache-ttl` seconds (default `300`, set `0` to disable). The cache is delegated to your configured `memory_store` — Redis when `--redis-url` is set, the database when only `--database-type` is configured, an in-process fallback otherwise.

Cache is invalidated automatically when an admin mutation changes any resource, scope, policy, or permission. There is no per-request cache bypass.

---

## 9. Common patterns

### Gating an API gateway route

Use `validate_jwt_token` from your gateway middleware:

```graphql
query {
  validate_jwt_token(params: {
    token_type: "access_token",
    token: "<bearer>",
    required_permissions: [{ resource: "billing", scope: "view" }]
  }) { is_valid }
}
```

Cache the result for the JWT's remaining lifetime. The server already caches the underlying evaluator result for `--authorization-cache-ttl`; an extra layer at the gateway saves the network hop.

### Server-rendered app with cookies

Use `validate_session` on each protected page render:

```graphql
query {
  validate_session(params: {
    cookie: "<cookie>",
    required_permissions: [{ resource: "admin", scope: "view" }]
  }) { is_valid user { id roles } }
}
```

### Bootstrapping SSO with a permission gate

`session` mints a fresh access token but only when the policy graph allows the listed permissions:

```graphql
query {
  session(params: {
    required_permissions: [{ resource: "dashboard", scope: "view" }]
  }) {
    access_token
    user { id }
  }
}
```

---

## 10. Adopting FGA in an existing deployment

FGA is opt-in per call. Existing callers that don't pass `required_permissions` see no behavior change.

To roll it out:

1. **Define the policy graph first.** Add resources, scopes, policies, and permissions via the dashboard (or the admin GraphQL mutations above) before any caller starts asserting them. Any `required_permissions` pointing at an undefined `(resource, scope)` returns `unauthorized` immediately — there is no permissive "log but allow" fallback.
2. **Adopt incrementally.** Add `required_permissions` to one endpoint at a time. Watch `authorizer_required_permissions_checks_total{endpoint, outcome}` per endpoint:
   - `outcome="not_requested"` falling = adoption rising.
   - `outcome="denied"` rising = policy gap or attacker probe.
   - `outcome="error"` non-zero = page; storage / validation failure.
3. **Build the dashboards.** See [Metrics & Monitoring §Authorization Metrics](./metrics-monitoring#authorization-metrics) for PromQL examples.
