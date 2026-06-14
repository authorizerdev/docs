---
sidebar_position: 5
title: FGA Guide — Examples & Patterns
---

# FGA Guide — Examples & Patterns

A hands-on companion to the [Authorization (FGA) reference](./authorization). That page
explains *what* the engine is and the full API surface; this one is a cookbook — from a
first working model to every relationship construct the DSL supports, each with the
tuples to write and the checks that exercise it, shown in raw GraphQL and in the
[Go](https://github.com/authorizerdev/authorizer-go) and
[JavaScript](https://github.com/authorizerdev/authorizer-js) SDKs.

1. [Setup](#setup)
2. [Part 1 — A document-sharing app, end to end](#part-1--a-document-sharing-app-end-to-end)
3. [Part 2 — Advanced patterns](#part-2--advanced-patterns)
4. [Part 3 — DSL construct reference](#part-3--dsl-construct-reference)
5. [Limits & behavior](#limits--behavior)

## Setup

FGA needs a SQL store ([details](./authorization#1-enabling-fga)). With SQLite it is on
by default — this is all you need to follow along:

```bash
docker run -p 8080:8080 quay.io/authorizer/authorizer:latest \
  --database-type=sqlite \
  --database-url=test.db \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

Two API surfaces are involved (full reference: [client API](./authorization#4-checking-access--client-api),
[admin API](./authorization#5-admin-graphql-api)):

| Surface | Operations | Credential |
| --- | --- | --- |
| **Admin** — author the model, grant/revoke | `_fga_write_model`, `_fga_write_tuples`, `_fga_delete_tuples`, … | Admin secret (`X-Authorizer-Admin-Secret` header), server-side only |
| **Client** — answer "may this user…?" | `check_permissions`, `list_permissions` | The caller's own token / session cookie |

All examples below use `http://localhost:8080/graphql`. Subjects are `user:<id>` where
`<id>` is the **Authorizer user id** (the token's `sub` claim) — short ids like
`user:1b9d…` abbreviate full UUIDs.

---

## Part 1 — A document-sharing app, end to end

The "hello world" of ReBAC: users create documents, share them as editor or viewer.

### Step 1 — Define the model

Three role relations and three permission relations. The roles are **concentric**
(`or owner` / `or editor`): one `owner` tuple grants edit and view too.

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

**Dashboard** — open `http://localhost:8080/dashboard` → **Authorization → Step 1 ·
Define the model**. Either use the default **Roles & permissions** matrix (no DSL —
tick which role can do what) or switch to **Advanced (DSL)**, where "Document sharing"
is a one-click example. Save to install.

**GraphQL** (admin):

```bash
curl http://localhost:8080/graphql \
  -H 'Content-Type: application/json' \
  -H 'X-Authorizer-Admin-Secret: admin' \
  -d '{
    "query": "mutation ($params: FgaWriteModelInput!) { _fga_write_model(params: $params) { id } }",
    "variables": { "params": { "dsl": "model\n  schema 1.1\n\ntype user\n\ntype document\n  relations\n    define owner: [user]\n    define editor: [user] or owner\n    define viewer: [user] or editor\n    define can_view: viewer\n    define can_edit: editor\n    define can_delete: owner" } }
  }'
```

### Step 2 — Grant access (write tuples)

Priya creates document 1 and shares it: Marco can edit, Sam can view.

| user | relation | object |
| --- | --- | --- |
| `user:1b9d…` (Priya) | `owner` | `document:1` |
| `user:2c8e…` (Marco) | `editor` | `document:1` |
| `user:3d9f…` (Sam) | `viewer` | `document:1` |

**Dashboard** — **Authorization → Step 2 · Grant access**, add the three tuples (the
"direct grant" template fills the shape for you).

**GraphQL** (admin — your backend calls this on its own "create"/"share" events):

```graphql
mutation {
  _fga_write_tuples(params: {
    tuples: [
      { user: "user:1b9d…", relation: "owner",  object: "document:1" }
      { user: "user:2c8e…", relation: "editor", object: "document:1" }
      { user: "user:3d9f…", relation: "viewer", object: "document:1" }
    ]
  }) { message }
}
```

Revoking is the mirror image — `_fga_delete_tuples` with the same tuple.

### Step 3 — Check permissions

The subject is the **authenticated caller** — resolved from the bearer token / session
cookie you send. Batch several questions in one call; results come back in order.

**GraphQL** (with Marco's token in the `Authorization` header):

```graphql
query {
  check_permissions(params: {
    checks: [
      { relation: "can_view",   object: "document:1" }
      { relation: "can_edit",   object: "document:1" }
      { relation: "can_delete", object: "document:1" }
    ]
  }) {
    results { relation object allowed }
  }
}
```

Expected (Marco is `editor`):

```json
{ "results": [
  { "relation": "can_view",   "object": "document:1", "allowed": true  },
  { "relation": "can_edit",   "object": "document:1", "allowed": true  },
  { "relation": "can_delete", "object": "document:1", "allowed": false }
] }
```

**Go SDK**:

```go
import "github.com/authorizerdev/authorizer-go"

client, _ := authorizer.NewAuthorizerClient("123456", "http://localhost:8080", "", nil)

res, err := client.CheckPermissions(&authorizer.CheckPermissionsRequest{
	Checks: []*authorizer.PermissionCheckInput{
		{Relation: "can_view", Object: "document:1"},
		{Relation: "can_edit", Object: "document:1"},
		{Relation: "can_delete", Object: "document:1"},
	},
}, map[string]string{"Authorization": "Bearer " + marcoToken})
if err != nil { /* fail closed: deny */ }
for _, r := range res.Results {
	fmt.Println(r.Relation, r.Object, r.Allowed) // can_view true, can_edit true, can_delete false
}
```

**JavaScript SDK**:

```js
import { Authorizer } from '@authorizerdev/authorizer-js';

const authorizer = new Authorizer({
  authorizerURL: 'http://localhost:8080',
  redirectURL: 'http://localhost:3000',
  clientID: '123456',
});

const { data, errors } = await authorizer.checkPermissions(
  {
    checks: [
      { relation: 'can_view', object: 'document:1' },
      { relation: 'can_edit', object: 'document:1' },
      { relation: 'can_delete', object: 'document:1' },
    ],
  },
  { Authorization: `Bearer ${marcoToken}` }, // in the browser the session cookie is used automatically
);
// data.results → [ {allowed: true}, {allowed: true}, {allowed: false} ]
```

### Step 4 — List what a user can access

Ideal for list pages: ask once, filter your DB query by the returned ids.

**GraphQL** (with Sam's token):

```graphql
query {
  list_permissions(params: { relation: "can_view", object_type: "document" }) {
    objects     # ["document:1"]
    truncated   # false
  }
}
```

**Go SDK**:

```go
res, err := client.ListPermissions(&authorizer.ListPermissionsRequest{
	Relation:   "can_view",
	ObjectType: "document",
}, map[string]string{"Authorization": "Bearer " + samToken})
// res.Objects → ["document:1"]
```

**JavaScript SDK**:

```js
const { data } = await authorizer.listPermissions(
  { relation: 'can_view', object_type: 'document' },
  { Authorization: `Bearer ${samToken}` },
);
// data.objects → ["document:1"]    data.truncated → false
```

Both filters are optional: omit `relation` to get every permission the subject holds on
that type, omit both to enumerate everything (see [Limits](#limits--behavior)).

From the dashboard, **Users → ⋯ → View Permissions** runs the same query for any user.

---

## Part 2 — Advanced patterns

Each pattern: the DSL, the tuples, and checks with expected results. The patterns
compose — the [hierarchy example](#org--team--project-hierarchy) uses three of them at
once. (Checks below are GraphQL/SDK calls exactly as in Part 1; shown compactly as
`check(subject, relation, object)`.)

### Org → team → project hierarchy

Combines **tuple-to-userset** (`admin from org`, `lead from team`), a **userset
subject** (`team:eng#member` as the *user* of a tuple), and **computed relations**.

```dsl
model
  schema 1.1

type user

type organization
  relations
    define admin: [user]
    define member: [user]

type team
  relations
    define org: [organization]
    define member: [user] or admin from org
    define lead: [user]

type project
  relations
    define team: [team]
    define editor: [user] or lead from team
    define viewer: [user, team#member] or editor
    define can_view: viewer
    define can_edit: editor
```

Tuples — wire the structure once, then grant on the highest sensible level:

```text
user:1b9d…        admin    organization:acme    # Priya is org admin
organization:acme org      team:eng             # team eng belongs to acme
user:2c8e…        member   team:eng             # Marco is on team eng
user:3d9f…        lead     team:eng             # Sam leads team eng
team:eng          team     project:rocket       # project rocket belongs to team eng
team:eng#member   viewer   project:rocket       # ALL of team eng can view rocket
```

Checks and why:

```text
check(user:2c8e…, can_view, project:rocket) → allowed  (member of team:eng → in team:eng#member → viewer)
check(user:2c8e…, can_edit, project:rocket) → denied   (member, not lead)
check(user:3d9f…, can_edit, project:rocket) → allowed  (lead from team)
check(user:1b9d…, can_view, project:rocket) → allowed  (org admin → team member via "admin from org" → team:eng#member)
```

One `member team:eng` tuple on a new hire grants every project the team is wired to.
A multi-level variant of this (org → project → resource with per-resource exceptions)
is worked through in [Real-world recipes](./authorization#9-real-world-recipes).

### Groups as subjects

A tuple's *user* can be a **userset** — "everyone who has relation R on object O":

```dsl
model
  schema 1.1

type user

type team
  relations
    define member: [user]

type document
  relations
    define viewer: [user, team#member]
    define can_view: viewer
```

```text
user:2c8e…       member   team:eng
team:eng#member  viewer   document:roadmap     # one tuple, whole team

check(user:2c8e…, can_view, document:roadmap) → allowed
list(user:2c8e…, can_view, document) → ["document:roadmap"]
```

Adding someone to `team:eng` instantly grants every document the team holds; removing
their one `member` tuple revokes it all.

### Public access (wildcard)

`[user:*]` in a type restriction lets you write a tuple whose subject is *every* user:

```dsl
model
  schema 1.1

type user

type document
  relations
    define owner: [user]
    define viewer: [user, user:*] or owner
    define can_view: viewer
```

```text
user:*  viewer  document:handbook              # "anyone with the link"

check(<any authenticated user>, can_view, document:handbook) → allowed
```

The wildcard is per-object — only `document:handbook` is public. Note `user:*` means
"all users", not a pattern: `user:1b9d*` is not a thing.

### Exclusion — block lists (`but not`)

Deny specific users regardless of any other grant path:

```dsl
model
  schema 1.1

type user

type document
  relations
    define viewer: [user, user:*]
    define blocked: [user]
    define can_view: viewer but not blocked
```

```text
user:*      viewer    document:7
user:5f1b…  blocked   document:7

check(user:5f1b…, can_view, document:7) → denied   (blocked beats the public grant)
check(user:2c8e…, can_view, document:7) → allowed
```

`but not` wins over every grant path — direct, inherited, group, or public.

### Intersection — require both (`and`)

Allowed only when the subject satisfies **every** operand:

```dsl
model
  schema 1.1

type user

type document
  relations
    define approver: [user]
    define legal_reviewer: [user]
    define can_publish: approver and legal_reviewer
```

```text
user:1b9d…  approver        document:contract
user:1b9d…  legal_reviewer  document:contract
user:2c8e…  approver        document:contract

check(user:1b9d…, can_publish, document:contract) → allowed  (both relations)
check(user:2c8e…, can_publish, document:contract) → denied   (approver only)
```

### Contextual tuples — request-time facts

Each entry in `check_permissions.checks` accepts `contextual_tuples`: tuples evaluated
**for that one check only, never persisted**. Use them for facts your app knows at
request time (current device, IP-derived region, an in-progress "what if I shared this?"
preview) without writing to the store.

Model — viewing requires *both* a grant and a trusted device (intersection):

```dsl
model
  schema 1.1

type user

type document
  relations
    define viewer: [user]
    define trusted_device: [user]
    define can_view: viewer and trusted_device
```

Stored tuple: `user:2c8e… viewer document:1`. Your backend asserts the device check as
a contextual tuple:

**GraphQL**:

```graphql
query {
  check_permissions(params: {
    checks: [{
      relation: "can_view"
      object: "document:1"
      contextual_tuples: [
        { user: "user:2c8e…", relation: "trusted_device", object: "document:1" }
      ]
    }]
  }) {
    results { relation object allowed }   # allowed: true — without the contextual tuple: false
  }
}
```

**Go SDK**:

```go
res, err := client.CheckPermissions(&authorizer.CheckPermissionsRequest{
	Checks: []*authorizer.PermissionCheckInput{{
		Relation: "can_view",
		Object:   "document:1",
		ContextualTuples: []*authorizer.FgaTupleInput{
			{User: "user:2c8e…", Relation: "trusted_device", Object: "document:1"},
		},
	}},
}, headers)
```

**JavaScript SDK**:

```js
const { data } = await authorizer.checkPermissions(
  {
    checks: [{
      relation: 'can_view',
      object: 'document:1',
      contextual_tuples: [
        { user: 'user:2c8e…', relation: 'trusted_device', object: 'document:1' },
      ],
    }],
  },
  headers,
);
```

Contextual tuples are available on `check_permissions` only — `list_permissions` always
evaluates against stored tuples.

### Roles as objects — grant a whole role at once

When several object instances should follow the same role assignment, model the role
itself as an object and bind its `assignee` userset:

```dsl
model
  schema 1.1

type user

type role
  relations
    define assignee: [user]

type record
  relations
    define manager: [user, role#assignee]
    define can_edit: manager
```

```text
role:manager#assignee  manager   record:88     # bind the role to the record
role:manager#assignee  manager   record:89
user:4e0a…             assignee  role:manager  # onboard Dana: ONE tuple, both records

check(user:4e0a…, can_edit, record:88) → allowed
check(user:4e0a…, can_edit, record:89) → allowed
```

Offboarding deletes one tuple. (`role:` objects are the one place where the object id
is a name by design; everywhere else use stable ids.) FGA roles are independent of the
instance's `--roles` JWT claim — see [the note on roles](./authorization#3-granting-access--relationship-tuples).

---

## Part 3 — DSL construct reference

Every relationship-definition construct OpenFGA's DSL (`schema 1.1`) supports, and how
it behaves through `check_permissions` / `list_permissions`. All of these are verified
against Authorizer's embedded engine — except where explicitly marked unsupported.

| Construct | Syntax | Grants access to |
| --- | --- | --- |
| [Direct assignment](#direct-assignment--type-restrictions) | `define viewer: [user]` | Subjects with a stored tuple for this exact relation |
| [Type restrictions](#direct-assignment--type-restrictions) | `[user, service_account]` | Tuples whose subject is one of the listed types |
| [Wildcard](#wildcard-public-access) | `[user:*]` | Every subject of that type, once a `user:*` tuple exists |
| [Userset subject](#userset-subjects) | `[team#member]` | Everyone holding `member` on the referenced `team` |
| [Union](#union-or) | `a or b` | Subjects matching *any* operand |
| [Intersection](#intersection-and) | `a and b` | Subjects matching *every* operand |
| [Exclusion](#exclusion-but-not) | `a but not b` | Subjects matching `a` and **not** `b` |
| [Computed userset](#computed-userset) | `define can_view: viewer` | Whoever holds the referenced relation on the same object |
| [Tuple-to-userset](#tuple-to-userset-x-from-y) | `viewer from parent` | Whoever holds `viewer` on the object's `parent` |
| [Conditions](#conditions-cel--with--not-supported) | `[user with cond]` | **Not supported** — see below |

### Direct assignment & type restrictions

```dsl
define viewer: [user]
define auditor: [user, service_account]
```

The bracket list is a **type restriction**: only tuples whose subject matches a listed
type may be written. `_fga_write_tuples` validates every tuple against the active model
— writing `service_account:ci viewer document:1` against `viewer: [user]` is rejected
with an error, not silently dropped. A relation with no direct type restriction (e.g.
a pure computed relation like `define can_view: viewer`) cannot be the relation of any
stored tuple.

Check behavior: `check(user:X, viewer, document:1)` is true iff the tuple
`user:X viewer document:1` exists (or another construct in the same definition grants it).

### Wildcard (public access)

```dsl
define viewer: [user, user:*]
```

Allows the tuple `user:* viewer document:1`, after which **every** subject of type
`user` passes `check(…, viewer, document:1)`, and `document:1` appears in everyone's
`list_permissions` result. The wildcard must be declared in the type restriction —
against plain `[user]`, writing a `user:*` tuple is rejected.

### Userset subjects

```dsl
define viewer: [user, team#member]
```

Allows tuples whose subject is a **userset** — `team:eng#member viewer document:1` —
granting to everyone who holds `member` on `team:eng`, resolved at check time. Group
membership changes propagate instantly to every grant of the userset; no tuple fan-out.

### Union (`or`)

```dsl
define editor: [user] or owner
```

True if **any** operand grants. This is how concentric roles are built (`owner` ⇒
`editor` ⇒ `viewer`): grant the strongest relation with one tuple and the weaker ones
follow. `list_permissions` reflects the union — an owner sees the object listed under
an `editor` filter too.

### Intersection (`and`)

```dsl
define can_publish: approver and legal_reviewer
```

True only if **every** operand grants. See the [worked example](#intersection--require-both-and).
With `list_permissions`, an object is listed only for subjects satisfying all operands.

### Exclusion (`but not`)

```dsl
define can_view: viewer but not blocked
```

True if the left side grants **and** the right side does not. The exclusion overrides
every other path (direct, group, inherited, wildcard). Excluded objects also disappear
from the subject's `list_permissions` results.

:::tip Combining operators
Keep each `define` to a single operator and name intermediate relations
(`define viewer: [user] or editor`, then `define can_view: viewer but not blocked`)
instead of mixing `or` / `and` / `but not` in one expression. It reads better and
side-steps precedence questions entirely.
:::

### Computed userset

```dsl
define viewer: [user]
define can_view: viewer
```

`can_view` has no tuples of its own; it *is* `viewer` on the same object. Use it to
separate **role** relations (granted by tuples) from **permission** relations (what code
checks) — your handlers keep checking `can_view` even when its definition evolves.

### Tuple-to-userset (`X from Y`)

```dsl
type folder
  relations
    define viewer: [user]

type document
  relations
    define parent: [folder]
    define viewer: [user] or viewer from parent
```

"Whoever is `viewer` of this document's `parent`." Requires (1) a linking relation
(`parent: [folder]`) and a structural tuple `folder:f1 parent document:1`, and (2) the
referenced relation (`viewer`) defined on the linked type. Chains transitively across
levels — see the [hierarchy example](#org--team--project-hierarchy). The linking
relation must be a direct relation (it cannot itself be computed).

```text
folder:f1   parent  document:1
user:2c8e…  viewer  folder:f1

check(user:2c8e…, viewer, document:1) → allowed
```

### Conditions (CEL / `with`) — NOT supported

OpenFGA upstream also defines **parameterized conditions** (ABAC): CEL expressions
attached to the model, referenced as `[user with condition_name]`, with condition
context stored on tuples and request context passed on checks.

**Authorizer's API does not expose them.** A model containing `condition` blocks is
accepted by `_fga_write_model` (the DSL parses), but:

- `FgaTupleInput` has no condition field — a tuple targeting a `[user with cond]`
  restriction cannot be written, because the required condition cannot be attached.
- `check_permissions` has no `context` parameter — request-time condition context
  (e.g. `current_time`) cannot be supplied, so a conditioned grant could never evaluate.

Until these are exposed, do **not** use `condition` / `with` in your model. For
request-time facts use [contextual tuples](#contextual-tuples--request-time-facts); for
time-bound access, schedule a `_fga_delete_tuples` call from your application instead.

---

## Limits & behavior

| Behavior | Detail |
| --- | --- |
| **Batch size** | `check_permissions` accepts at most **100** checks per request. |
| **List cap** | `list_permissions` returns at most **1000** entries; `truncated: true` signals more exist. Prefer setting both `relation` and `object_type` — an unfiltered call enumerates every (type, relation) pair in the model. |
| **Fail closed** | Any engine error denies the whole call — an error response is a deny, never an implicit allow. |
| **Subject trust gate** | The subject is the caller's token subject. An explicit `user` parameter is honored only for super-admins or when it equals the caller's own subject; anything else errors. |
| **Tuple validation** | `_fga_write_tuples` validates each tuple against the active model (type exists, relation defined, subject type allowed). |
| **Response shape** | `list_permissions` returns `objects`, `permissions { object relation }`, and `truncated` — surfaced identically by the Go (`Objects`/`Permissions`/`Truncated`) and JS SDKs. |
| **Model changes** | Saving a model creates a new immutable active version; tuples are kept. See [versioning](./authorization#2-the-authorization-model) and [reset semantics](./authorization#7-operational-notes). |

**Debugging a decision** — the admin-only [`_fga_expand` and `_fga_list_users`](./authorization#5-admin-graphql-api)
queries reveal *why* a check passes (the full userset tree / every subject holding a
relation), and the dashboard's **Users → View Permissions** shows any user's access at
a glance. Engine throughput and allow/deny rates are exported as
[Prometheus metrics](./metrics-monitoring#authorization-fga-metrics).

**Further reading** — [Authorization (FGA) reference](./authorization) ·
[Real-world recipes](./authorization#9-real-world-recipes) ·
[OpenFGA modeling guide](https://openfga.dev/docs/modeling/getting-started) ·
[OpenFGA configuration language](https://openfga.dev/docs/configuration-language).
