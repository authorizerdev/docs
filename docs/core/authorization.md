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
4. [Checking access](#4-checking-access--client-api) — `check_permissions`, `list_permissions`.
5. [Admin GraphQL API](#5-admin-graphql-api) — the `_fga_*` operations the dashboard uses.
6. [SDKs](#6-sdks) and [operational notes](#7-operational-notes).
7. [Using FGA from your application](#8-using-fga-from-your-application) — middleware, the tuple lifecycle, list filtering.
8. [Real-world recipes](#9-real-world-recipes) — document sharing, multi-tenant SaaS, job roles, time-bound access, block lists.
9. [Cheat sheet](#10-cheat-sheet) — app event → FGA operation.

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
(`[user, team#member]`), **public access** (`[user:*]`), and **exclusions**
(`viewer but not blocked`). OpenFGA's parameterized **conditions** (ABAC/CEL,
`[user with someCondition]`) are **not usable through Authorizer's API**: tuples
cannot carry a condition and checks cannot supply condition context — use
[contextual tuples](#4-checking-access--client-api) or scheduled tuple deletion
instead.

### From the dashboard

Open **`/dashboard` → Authorization → Step 1 · Define the model**. Two ways in:

- **Roles &amp; permissions** (the default) — a simple matrix: list your roles
  (`admin`, `editor`, `viewer`) and the actions they can take (`view`, `edit`, `delete`),
  then tick which role can do what. The dashboard turns the matrix into a valid OpenFGA
  RBAC model for you — no DSL to learn. It starts from a standard
  `admin / editor / viewer` set; your configured instance roles (`--roles`) are offered
  as one-click additions.
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
user:1b9d…   viewer   document:1      → this user can view document 1
user:2c8e…   owner    document:1      → this user owns document 1 (⇒ editor, viewer)
team:9#member  viewer  document:1   → every member of team:9 can view it
user:*       viewer   document:5      → document 5 is public
```

:::info Identify users by id, not name
The subject is `user:<id>` — the **Authorizer user id** (the token's `sub` claim,
shown on the dashboard's Users page). Names and emails aren't unique and can change;
the id is stable. Short ids like `user:1b9d…` on this page abbreviate full UUIDs.
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

The client-facing surface is exactly **two queries**. The subject defaults to the
**authenticated caller** — resolved server-side from the bearer token or session
cookie. An optional `user` ("type:id", or a bare id treated as `user:<id>`) is
honored only when the caller is a **super-admin** or when it **equals the
caller's own token subject**; anything else is rejected, never silently ignored.

### `check_permissions` — one or many questions

A single check is simply a list of one. Results come back **in order** and echo
the checked pair, so batch responses are self-describing.

```graphql
query {
  check_permissions(params: {
    checks: [
      { relation: "can_view", object: "document:1" },
      { relation: "can_edit", object: "document:1" }
    ]
  }) {
    results { relation object allowed }
  }
}
```

Each check also accepts optional `contextual_tuples` (evaluated for that one
call only, never persisted) — handy for "what-if" checks or request-time facts:

```graphql
query {
  check_permissions(params: {
    checks: [{
      relation: "can_view",
      object: "document:1",
      contextual_tuples: [
        { user: "user:1b9d…", relation: "viewer", object: "document:1" }
      ]
    }]
  }) {
    results { relation object allowed }
  }
}
```

### `list_permissions` — what can I access?

Returns the fully-qualified ids of every object of a type the subject holds the
permission on — ideal for filtering a list down to what the user may see.

```graphql
query {
  list_permissions(params: { relation: "can_view", object_type: "document" }) {
    objects                          # ["document:1", "document:7", ...]
    permissions { object relation }  # (object, relation) detail pairs
    truncated                        # true if capped at 1000 entries
  }
}
```

Both filters are optional. Omit `relation`, `object_type`, or both, and every
matching (type, relation) pair of the active model is enumerated — an empty
input returns **all** permissions the subject holds. The `permissions` field
carries the per-relation detail (relevant when no `relation` filter was
supplied); `truncated` is `true` when the result was capped at 1000 entries.

From the dashboard: open **Users → ⋯ → View Permissions** to run
`list_permissions` for any user (the admin session may specify a subject) and
see exactly which objects they hold a permission on.

### Gating sessions on permissions — `required_relations`

The session and token-validation queries (`session`, `validate_jwt_token`,
`validate_session`) accept an optional `required_relations` list of
`{ relation, object }` pairs. Each pair is checked against the authenticated
caller with **AND semantics, fail-closed** — one denied relation invalidates
the whole result. This lets a gateway validate "logged in **and** may edit
document 1" in a single call. See the
[GraphQL API reference](./graphql-api#validate_jwt_token).

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
| `_fga_read_tuples(params: { user?, relation?, object?, page_size?, continuation_token? })` | query | Page through stored tuples; empty filter fields act as wildcards. |
| `_fga_list_users(params: { object, relation, user_type })` | query | List the users of `user_type` that have a relation on an object (reveals the access graph — admin only). |
| `_fga_expand(params: { relation, object })` | query | Expand the relationship/userset tree for a `(relation, object)`, returned as a JSON string (admin only). |
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
    tuples: [{ user: "user:1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", relation: "viewer", object: "document:1" }]
  }) { message }
}
```

Full parameter tables and examples for every operation live in the
[GraphQL API reference](./graphql-api#authorization-fga).

---

## 6. SDKs

The official SDKs expose the read-side client API (model/tuple authoring stays in the
dashboard / admin API):

- **Go** — `CheckPermissions`, `ListPermissions`. See the
  [Go SDK guide](/sdks/authorizer-go#step-4-fine-grained-authorization-fga) and the
  [authorizer-go README](https://github.com/authorizerdev/authorizer-go).
- **JavaScript / TypeScript** — `checkPermissions`, `listPermissions`. See the
  [JS SDK functions](/sdks/authorizer-js/functions#--checkpermissions) and the
  [authorizer-js README](https://github.com/authorizerdev/authorizer-js).

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

---

## 8. Using FGA from your application

Your application keeps doing what it does; Authorizer answers one extra question per
request: **"may this user do this to this object?"**

```text
                 ┌──────────────┐  login   ┌─────────────┐
                 │   Your app   │ ───────► │  Authorizer  │
                 │  (frontend)  │ ◄─────── │              │
                 └──────┬───────┘  token   │  ┌────────┐  │
                        │ API call + token │  │ OpenFGA│  │
                 ┌──────▼───────┐          │  │ engine │  │
                 │ Your backend │ ───────► │  └────────┘  │
                 │              │  check_  │              │
                 └──────────────┘permissions└─────────────┘
```

There are exactly **two touchpoints**:

| Touchpoint | When | API | Credential |
| --- | --- | --- | --- |
| **Write tuples** | On your domain events — a document is created, a user joins a project, someone clicks "Share", access is revoked | `_fga_write_tuples` / `_fga_delete_tuples` | Admin secret, **server-side only** |
| **Check access** | On every read/write your backend serves | `check_permissions`, `list_permissions` | The **caller's own token** by default — an explicit `user` is honored only for super-admins or self |

### Writing tuples from your domain events

Grant and revoke access by writing tuples when things happen in **your** system —
this is the part teams most often miss. Typical lifecycle:

| Event in your app | Tuple operation |
| --- | --- |
| User creates a document | write `user:<id>` `owner` `document:<docId>` |
| Document is filed in a folder | write `folder:<fid>` `parent_folder` `document:<docId>` |
| User clicks "Share with Bob (can edit)" | write `user:<bobId>` `editor` `document:<docId>` |
| User joins an organization | write `user:<id>` `member` `organization:<orgId>` |
| "Make public" toggle | write `user:*` `viewer` `document:<docId>` |
| Access revoked / user offboarded | `_fga_delete_tuples` the matching tuple(s) |

Server-side helper (any language — it's one GraphQL call):

```js
// Server-side only: uses the admin secret.
async function writeTuples(tuples) {
  await fetch('https://auth.yourapp.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Authorizer-Admin-Secret': process.env.AUTHORIZER_ADMIN_SECRET,
    },
    body: JSON.stringify({
      query: `mutation ($params: FgaWriteTuplesInput!) {
        _fga_write_tuples(params: $params) { message }
      }`,
      variables: { params: { tuples } },
    }),
  });
}

// On "document created":
await writeTuples([
  { user: `user:${creatorId}`, relation: 'owner', object: `document:${docId}` },
]);
```

### Checking access in your backend

Use the SDKs ([authorizer-js](https://github.com/authorizerdev/authorizer-js),
[authorizer-go](https://github.com/authorizerdev/authorizer-go)) or one GraphQL
call. Express middleware:

```js
import { Authorizer } from '@authorizerdev/authorizer-js';

const auth = new Authorizer({
  authorizerURL: 'https://auth.yourapp.com',
  redirectURL: 'https://yourapp.com',
  clientID: process.env.AUTHORIZER_CLIENT_ID,
});

// requirePermission('can_edit', req => `document:${req.params.id}`)
const requirePermission = (relation, objectFor) => async (req, res, next) => {
  const { data } = await auth.checkPermissions(
    { checks: [{ relation, object: objectFor(req) }] },
    { Authorization: req.headers.authorization }, // forward the caller's token
  );
  if (!data?.results?.[0]?.allowed)
    return res.status(403).json({ error: 'forbidden' });
  next();
};

app.get('/documents/:id',
  requirePermission('can_view', (req) => `document:${req.params.id}`),
  getDocumentHandler);

app.put('/documents/:id',
  requirePermission('can_edit', (req) => `document:${req.params.id}`),
  updateDocumentHandler);
```

The same middleware in Go:

```go
func RequirePermission(relation string, objectFor func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			res, err := authorizerClient.CheckPermissions(&authorizer.CheckPermissionsRequest{
				Checks: []*authorizer.PermissionCheckInput{
					{Relation: relation, Object: objectFor(r)},
				},
			}, map[string]string{"Authorization": r.Header.Get("Authorization")})
			if err != nil || len(res.Results) == 0 || !res.Results[0].Allowed {
				http.Error(w, "forbidden", http.StatusForbidden) // fail closed
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

### Filtering lists — don't check one by one

For "show me my documents", ask once and filter your DB query by the result:

```js
const { data } = await auth.listPermissions(
  { relation: 'can_view', object_type: 'document' },
  { Authorization: req.headers.authorization },
);
// data.objects => ['document:1', 'document:7', ...]
const ids = data.objects.map((o) => o.split(':')[1]);
const docs = await db.documents.findMany({ where: { id: { in: ids } } });
```

For rendering one page with many permission flags (can the user edit? delete?
share?), pass several checks to `check_permissions` — one round trip, results in order.

---

---

## 9. Real-world recipes

Complete worked scenarios — each with the model, the tuples, and the checks your
app runs. Every model below is also a one-click example in the dashboard model
editor (**Step 1 → Advanced → Browse examples**) and is validated against the
embedded engine in CI.

### Document collaboration (Google-Docs-style sharing)

**Scenario.** Users create documents, share them with specific people as editor or
viewer, and optionally make them public.

**Model** (concentric: an `owner` is an `editor` is a `viewer` — one tuple grants
the whole stack):

```dsl
model
  schema 1.1

type user

type document
  relations
    define owner: [user]
    define editor: [user] or owner
    define viewer: [user, user:*] or editor
    define can_view: viewer
    define can_edit: editor
    define can_delete: owner
```

**Your app writes tuples on these events:**

```text
# Priya creates doc 42:
user:1b9d…   owner    document:42

# Priya shares with Marco as editor, with Sam as viewer:
user:2c8e…   editor   document:42
user:3d9f…   viewer   document:42

# Priya hits "anyone with the link can view":
user:*       viewer   document:42
```

**Your backend checks:**

```text
check_permissions(can_edit,   document:42)  with Marco's token → allowed
check_permissions(can_delete, document:42)  with Marco's token → denied  (owner only)
```

"Unshare" is just `_fga_delete_tuples` on the same tuple. No schema migration, no
`document_permissions` join table in your DB.

---

### B2B multi-tenant SaaS (org → project → resource)

**Scenario.** Customers are organizations; each has projects containing resources.
An org-wide grant must cover everything beneath it — **without one tuple per
resource** — while still allowing per-resource exceptions.

**Model:**

```dsl
model
  schema 1.1

type user

type organization
  relations
    define admin: [user]
    define editor: [user] or admin
    define viewer: [user] or editor
    define can_view: viewer
    define can_edit: editor

type project
  relations
    define org: [organization]
    define editor: [user] or editor from org
    define viewer: [user] or editor or viewer from org
    define can_view: viewer
    define can_edit: editor

type resource
  relations
    define project: [project]
    define editor: [user] or editor from project
    define viewer: [user] or editor or viewer from project
    define can_view: viewer
    define can_edit: editor
```

**Wire the structure once** (when an org/project/resource is created in your app):

```text
organization:101   org       project:201
project:201      project   resource:301
project:201      project   resource:302
```

**Grant once, high in the tree:**

```text
user:1b9d…   viewer   organization:101        ← ONE tuple
```

Now every check below inherits, with zero per-resource tuples:

```text
check_permissions(can_view, resource:301)  → allowed   (viewer from project ← from org)
check_permissions(can_view, resource:302)  → allowed
check_permissions(can_edit, resource:301)  → denied    (viewers don't edit)
```

**Fine-grained exception on top** — an external contractor edits one resource only:

```text
user:2c8e…   editor   resource:301

check_permissions(can_edit, resource:301)  → allowed
check_permissions(can_view, resource:302)  → denied    (nothing leaks to siblings)
```

When a new resource is created, your app writes **one structural tuple**
(`project:201 project resource:303`) and every existing org-level grant
applies to it instantly. Tenant isolation falls out of the graph: members of
`organization:101` simply have no path to `organization:102` objects.

---

### Approval workflow with job roles

**Scenario.** An HR or finance system where `labour`, `manager`, and `executive`
staff have escalating permissions on records — managers edit, executives approve
and delete.

**Model** (`role#assignee` lets you grant a whole role with one tuple):

```dsl
model
  schema 1.1

type user

type role
  relations
    define assignee: [user]

type record
  relations
    define labour: [user, role#assignee]
    define manager: [user, role#assignee]
    define executive: [user, role#assignee]
    define can_delete: executive
    define can_approve: executive
    define can_edit: manager or can_delete
    define can_view: labour or can_edit
```

**Tuples:**

```text
# Bind each role group to the records it covers (once per record type/instance):
role:manager#assignee     manager     record:88
role:executive#assignee   executive   record:88

# Onboarding Dana as a manager is now ONE tuple, covering every bound record:
user:4e0a…   assignee   role:manager
```

**Checks:**

```text
check_permissions(can_edit,    record:88)  with Dana's token → allowed
check_permissions(can_approve, record:88)  with Dana's token → denied
```

Offboarding = delete Dana's one `assignee` tuple; every record access disappears
with it.

---

### Time-bound contractor access

**Scenario.** A contractor gets access that must expire automatically — no cron
job to revoke it.

OpenFGA models expiry with [parameterized conditions](https://openfga.dev/docs/modeling/conditions)
(`[user with non_expired_grant]`), but those are **not usable through
Authorizer's API** — `_fga_write_tuples` cannot attach a condition to a tuple
and `check_permissions` cannot supply condition context, so a condition-gated
grant would never evaluate to allowed. Use one of these instead:

- **Scheduled revocation.** Grant a plain tuple and have your application (a
  job queue, cron, or workflow engine) call `_fga_delete_tuples` at the expiry
  time. Deletion is immediate and complete — the next check is denied.

```dsl
model
  schema 1.1

type user

type document
  relations
    define viewer: [user]
    define can_view: viewer
```

```text
user:ctr-9a2…  viewer  document:sow-2026        # written at grant time
# at expiry: _fga_delete_tuples removes the same tuple → access gone
```

- **Contextual tuples.** Don't persist the grant at all: your backend decides
  per-request whether the contract window is still open and, if so, passes the
  `viewer` tuple as a [contextual tuple](#4-checking-access--client-api) on the
  check. No tuple exists to clean up; expiry is enforced by your own clock.

---

### Suspending a user (block list)

**Scenario.** Broad access stays in place, but specific users must be locked out
of specific objects — overriding anything else that grants them access.

**Model:**

```dsl
model
  schema 1.1

type user

type document
  relations
    define viewer: [user]
    define blocked: [user]
    define can_view: viewer but not blocked
```

```text
user:*      viewer    document:7     # everyone can read the handbook
user:5f1b…  blocked   document:7     # …except this account

check_permissions(can_view, document:7) with 5f1b…'s token → denied
```

`but not` always wins over every grant path — direct, inherited, or public.

---

---

## 10. Cheat sheet

App event → FGA operation:

| Your app does | You call |
| --- | --- |
| Serve any protected read/write | `check_permissions` (caller's token) |
| Render a list page | `list_permissions`, filter your DB query by the ids |
| Render one item with many action buttons | `check_permissions` with several checks |
| Create a resource | `_fga_write_tuples`: owner + structural parent tuple |
| Share / grant / promote | `_fga_write_tuples`: one tuple |
| Revoke / unshare / offboard | `_fga_delete_tuples`: the matching tuple(s) |
| Reorganize (move project to new org) | delete + write the structural tuple |
| Debug "why can X see Y?" | `_fga_expand` (admin), or **Users → View Permissions** for any subject |
