---
sidebar_position: 4
title: Authorization (FGA)
---

# Authorization (Fine-Grained)

Authorizer ships a built-in **fine-grained authorization (FGA)** engine powered by an
embedded [OpenFGA](https://openfga.dev) instance — the open-source implementation of
Google's [Zanzibar](https://research.google/pubs/pub48190/) relationship-based access
control (ReBAC) model. Instead of static `role → permission` tables, you describe your
domain as **types** and **relations**, grant access with **relationship tuples**, and
ask the engine `Check(user, relation, object)` at request time.

FGA is **opt-in** and runs **in-process** — there is no extra service to deploy and no
network hop on a check.

This page covers:

1. [Enabling FGA](#1-enabling-fga)
2. [The authorization model](#2-the-authorization-model) — types, relations, the DSL, and the dashboard.
3. [Granting access](#3-granting-access--relationship-tuples) — relationship tuples.
4. [Checking access](#4-checking-access--client-api) — `fga_check`, `fga_batch_check`, `fga_list_objects`.
5. [Admin GraphQL API](#5-admin-graphql-api) — the `_fga_*` operations the dashboard uses.
6. [SDKs](#6-sdks) and [operational notes](#7-operational-notes).

Looking for complete worked scenarios — document sharing, multi-tenant SaaS
hierarchies, job-role workflows — and the backend middleware to enforce them?
See **[Authorization recipes](./authorization-recipes)**.

---

## 1. Enabling FGA

The engine stores its model and tuples in a SQL datastore.

- **SQL main database** (SQLite, Postgres, MySQL, …): FGA is **enabled by default** and
  reuses your main database. Nothing to configure.
- **NoSQL main database** (MongoDB, DynamoDB, …): OpenFGA can't use these, so FGA is
  **disabled** unless you point it at a SQL store with `--fga-store`.

| Flag | Purpose |
| --- | --- |
| `--fga-store` | Override the OpenFGA datastore: `sqlite`, `postgres`, `mysql`, or `memory` (dev only — non-persistent). Defaults to the main database when it is SQL-compatible. |
| `--fga-store-url` | Connection URI for an overridden `--fga-store` (a `file:` URI for SQLite, a DSN for Postgres/MySQL). Ignored when FGA reuses the main database. |

```bash
# Reuses Postgres main DB — FGA on automatically:
authorizer --database-type postgres --database-url "postgresql://..."

# MongoDB main DB — give FGA its own Postgres store to turn it on:
authorizer --database-type mongodb --database-url "mongodb://..." \
  --fga-store postgres --fga-store-url "postgresql://user:pass@host:5432/fga"
```

When FGA is disabled, every FGA GraphQL operation returns
`fine-grained authorization is not enabled` and the rest of the server runs normally.

---

## 2. The authorization model

The model is your permission **rulebook**. It declares the object **types** you protect,
the **relations** on each type (`owner`, `editor`, `viewer`, `can_view`…), and how those
relations are computed from one another. You write it once; access is then granted with
data (tuples), not by editing the model.

It is expressed in OpenFGA's [DSL](https://openfga.dev/docs/configuration-language):

```dsl
model
  schema 1.1

type user

type document
  relations
    define owner: [user]
    define editor: [user] or owner
    define viewer: [user] or editor
    define can_view: viewer
    define can_edit: editor
    define can_delete: owner
```

Reading it: an `owner` is also an `editor` (`or owner`), an `editor` is also a `viewer`,
and the permission relations (`can_view`, `can_edit`, `can_delete`) resolve through them.
A single `owner` tuple therefore grants view, edit, and delete.

The DSL also supports **hierarchies** (`viewer from parent`), **group usersets**
(`[user, team#member]`), **public access** (`[user:*]`), **exclusions**
(`viewer but not blocked`), and **conditions** (ABAC, e.g. time-bound grants).

### From the dashboard

Open **`/dashboard` → Authorization → Step 1 · Define the model**. Two ways in:

- **Roles &amp; permissions** (the default) — a simple matrix: list your roles
  (`admin`, `editor`, `viewer`) and the actions they can take (`view`, `edit`, `delete`),
  then tick which role can do what. The dashboard turns the matrix into a valid OpenFGA
  RBAC model for you — no DSL to learn. The configured instance roles (`--roles`) are
  used to seed it.
- **Advanced (DSL)** — the raw editor with a catalog of ready-made examples (document
  sharing, folder hierarchy, organizations &amp; teams, RBAC, groups, block lists,
  multi-tenant SaaS, GitHub-style repos, time-bound conditions) and a plain-English
  summary of whatever you type.

### Versioning

There is always exactly **one active model**. Saving creates a new **immutable version**
and makes it active; earlier versions are retained so in-flight requests stay valid.
OpenFGA models are **append-only** — an individual version cannot be deleted. To change
the rules, save a new version. To wipe everything and start over, **reset** the store
(see [§7](#7-operational-notes)).

---

## 3. Granting access — relationship tuples

A **relationship tuple** is a single fact: _`user` is `relation` of `object`_. Tuples are
the data that actually grants access; add and remove them any time without touching the
model.

```text
user:alice   viewer   document:1      → Alice can view document 1
user:bob     owner    document:1      → Bob owns document 1 (⇒ editor, viewer)
team:eng#member  viewer  document:1   → every member of team:eng can view it
user:*       viewer   document:5      → document 5 is public
```

:::info Identify users by id, not name
In real tuples the subject is `user:<id>` — the **Authorizer user id** (the token's
`sub` claim). Names and emails aren't unique and can change; the id is stable.
`user:alice` is used on this page for readability only.
:::

Note that FGA relation names are **independent of the instance's `--roles`** (the JWT
`roles` claim): app roles stay global and coarse, FGA relations are object-scoped and
usually more granular. The dashboard's model builder seeds from your configured roles
as a convenience, but the two sets are free to differ.

From the dashboard: **Step 2 · Grant access** — add tuples inline, with one-click
templates for the common shapes (direct grant, assign a role, grant a whole role, public
access, grant-on-a-folder-that-cascades).

:::tip
To avoid one tuple per object id, grant on a container (`folder`, `organization`) and let
resources inherit via a `… from parent` relation, or use `user:*` for public access.
:::

---

## 4. Checking access — client API

These three queries are the **client-facing** surface — they answer questions for the
**authenticated caller**. The subject is pinned server-side from the request (bearer
token or session cookie); it cannot be spoofed from the client. A super-admin may pass an
optional `user` to check on behalf of another subject; a non-trusted caller supplying
`user` is rejected.

### `fga_check` — one question

```graphql
query {
  fga_check(params: { relation: "can_view", object: "document:1" }) {
    allowed
  }
}
```

### `fga_batch_check` — many at once

Results are returned positionally, aligned with the `checks` you sent.

```graphql
query {
  fga_batch_check(params: {
    checks: [
      { relation: "can_view", object: "document:1" },
      { relation: "can_edit", object: "document:1" }
    ]
  }) {
    results { allowed }
  }
}
```

### `fga_list_objects` — what can I access?

Returns the fully-qualified ids of every object of a type the caller relates to — ideal
for filtering a list down to what the user is allowed to see.

```graphql
query {
  fga_list_objects(params: { relation: "can_view", object_type: "document" }) {
    objects   # ["document:1", "document:7", ...]
  }
}
```

All three also accept optional `contextual_tuples` (evaluated for that one call only,
never persisted) — handy for "what-if" checks or passing request-time facts.

From the dashboard: **Step 3 · Test access** runs `fga_check` for the logged-in admin so
you can verify the model and tuples interactively.

---

## 5. Admin GraphQL API

Authoring the model and tuples is an admin task. These operations require the super-admin
secret (cookie or `X-Authorizer-Admin-Secret`) and are prefixed `_fga_` to namespace the
admin authorization API. The dashboard calls exactly these under the hood, so the UI and
the API are interchangeable.

| Operation | Type | Purpose |
| --- | --- | --- |
| `_fga_write_model(params: { dsl })` | mutation | Install a new authorization-model version from its DSL. |
| `_fga_get_model` | query | Fetch the active model (id + DSL). |
| `_fga_write_tuples(params: { tuples })` | mutation | Add relationship tuples. |
| `_fga_delete_tuples(params: { tuples })` | mutation | Remove relationship tuples. |
| `_fga_read_tuples(params: { page_size, continuation_token })` | query | Page through stored tuples. |
| `_fga_list_users(params)` | query | List the users that have a relation on an object (reveals the access graph — admin only). |
| `_fga_expand(params)` | query | Expand the relationship/userset tree for a `(relation, object)` (admin only). |
| `_fga_reset` | mutation | Delete the model, **all** versions, and **all** tuples, then start a fresh empty store. Refused while any tuple still exists. |

```graphql
# Install a model:
mutation {
  _fga_write_model(params: { dsl: "model\n  schema 1.1\n\ntype user\n\ntype document\n  relations\n    define viewer: [user]\n    define can_view: viewer" }) {
    id
  }
}

# Grant access:
mutation {
  _fga_write_tuples(params: {
    tuples: [{ user: "user:alice", relation: "viewer", object: "document:1" }]
  }) { message }
}
```

---

## 6. SDKs

The official SDKs expose the read-side client API (model/tuple authoring stays in the
dashboard / admin API):

- **Go** — `FgaCheck`, `FgaBatchCheck`, `FgaListObjects`. See the
  [authorizer-go README](https://github.com/authorizerdev/authorizer-go#fine-grained-authorization-fga).
- **JavaScript / TypeScript** — `fgaCheck`, `fgaBatchCheck`, `fgaListObjects`. See the
  [authorizer-js README](https://github.com/authorizerdev/authorizer-js#fine-grained-authorization-fga).

For each, pass the caller's auth header in server contexts; in the browser the session
cookie is used automatically.

---

## 7. Operational notes

- **Fail closed.** If a check can't be completed (engine disabled, store error), the
  caller is denied — never silently allowed.
- **Resetting.** `_fga_reset` (dashboard: Step 1 → _Danger zone_) is the only way to
  remove a model and its past versions, because OpenFGA models are append-only. It is
  **refused while any relationship tuples still exist**, so live grants are never dropped
  silently — delete the tuples first. The action is audited (`admin.fga_reset`).
- **Auditing.** Model writes, tuple writes/deletes, and resets are recorded as admin
  audit events, visible under **Audit Logs** in the dashboard.
- **Metrics.** The engine exports Prometheus metrics — `authorizer_fga_checks_total`
  (allow/deny/error), `authorizer_fga_check_duration_seconds`, and
  `authorizer_fga_operations_total` — for adoption tracking and denial/error alerting.
  See [Metrics & Monitoring → Authorization (FGA) Metrics](./metrics-monitoring#authorization-fga-metrics).
- **Learn the model language.** See the OpenFGA docs:
  [modeling guide](https://openfga.dev/docs/modeling/getting-started) and
  [configuration language](https://openfga.dev/docs/configuration-language).
