---
sidebar_position: 4
title: Authorization Recipes (FGA)
---

# Authorization recipes — real-world FGA

The [Authorization (FGA)](./authorization) page documents the engine and its API.
This page shows how to actually **use it from your application**: the integration
pattern, then five complete real-world recipes — each with the model, the tuples,
and the code your app runs.

All models on this page are validated against the embedded engine in CI, and every
one is also available as a one-click example in the dashboard model editor
(**Authorization → Step 1 → Advanced → Browse examples**).

---

## 1. How FGA fits into your system

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
                 │              │ fga_check│              │
                 └──────────────┘  allowed?└─────────────┘
```

There are exactly **two touchpoints**:

| Touchpoint | When | API | Credential |
| --- | --- | --- | --- |
| **Write tuples** | On your domain events — a document is created, a user joins a project, someone clicks "Share", access is revoked | `_fga_write_tuples` / `_fga_delete_tuples` | Admin secret, **server-side only** |
| **Check access** | On every read/write your backend serves | `fga_check`, `fga_batch_check`, `fga_list_objects` | The **caller's own token** — the subject is pinned server-side and cannot be spoofed |

### Identify users by id, never by name

A tuple's subject is `user:<id>` where `<id>` is the **Authorizer user id** (the
`sub` claim of the token your backend already receives). Emails and display names
are not unique and change; the id is stable for the lifetime of the account.

```text
user:1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed   ✅
user:alice@example.com                       ❌
```

The recipes below use short ids like `user:1b9d…` for readability.

### Your app's roles vs FGA roles — they can differ

Authorizer's instance roles (`--roles`, the JWT `roles` claim) are **global and
coarse** — "is this person an admin at all". FGA relations are **object-scoped** —
"editor *of* `document:1`". They are decoupled on purpose: keep using the `roles`
claim for coarse route gating, and FGA for per-object decisions. An FGA role name
does not have to exist in `--roles`.

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
  const { data } = await auth.fgaCheck(
    { relation, object: objectFor(req) },
    { Authorization: req.headers.authorization }, // forward the caller's token
  );
  if (!data?.allowed) return res.status(403).json({ error: 'forbidden' });
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
			res, err := authorizerClient.FgaCheck(&authorizer.FgaCheckRequest{
				Relation: relation,
				Object:   objectFor(r),
			}, map[string]string{"Authorization": r.Header.Get("Authorization")})
			if err != nil || !res.Allowed {
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
const { data } = await auth.fgaListObjects(
  { relation: 'can_view', object_type: 'document' },
  { Authorization: req.headers.authorization },
);
// data.objects => ['document:1', 'document:7', ...]
const ids = data.objects.map((o) => o.split(':')[1]);
const docs = await db.documents.findMany({ where: { id: { in: ids } } });
```

For rendering one page with many permission flags (can the user edit? delete?
share?), use `fga_batch_check` — one round trip, results in order.

---

## 2. Recipe: document collaboration (Google-Docs-style sharing)

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
fga_check(can_edit,   document:42)  with Marco's token → allowed
fga_check(can_delete, document:42)  with Marco's token → denied  (owner only)
```

"Unshare" is just `_fga_delete_tuples` on the same tuple. No schema migration, no
`document_permissions` join table in your DB.

---

## 3. Recipe: B2B multi-tenant SaaS (org → project → resource)

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
organization:acme   org       project:webapp
project:webapp      project   resource:doc1
project:webapp      project   resource:doc2
```

**Grant once, high in the tree:**

```text
user:1b9d…   viewer   organization:acme        ← ONE tuple
```

Now every check below inherits, with zero per-resource tuples:

```text
fga_check(can_view, resource:doc1)  → allowed   (viewer from project ← from org)
fga_check(can_view, resource:doc2)  → allowed
fga_check(can_edit, resource:doc1)  → denied    (viewers don't edit)
```

**Fine-grained exception on top** — an external contractor edits one resource only:

```text
user:2c8e…   editor   resource:doc1

fga_check(can_edit, resource:doc1)  → allowed
fga_check(can_view, resource:doc2)  → denied    (nothing leaks to siblings)
```

When a new resource is created, your app writes **one structural tuple**
(`project:webapp project resource:doc3`) and every existing org-level grant
applies to it instantly. Tenant isolation falls out of the graph: members of
`organization:acme` simply have no path to `organization:globex` objects.

---

## 4. Recipe: approval workflow with job roles

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
role:manager#assignee     manager     record:expense-report-7
role:executive#assignee   executive   record:expense-report-7

# Onboarding Dana as a manager is now ONE tuple, covering every bound record:
user:4e0a…   assignee   role:manager
```

**Checks:**

```text
fga_check(can_edit,    record:expense-report-7)  with Dana's token → allowed
fga_check(can_approve, record:expense-report-7)  with Dana's token → denied
```

Offboarding = delete Dana's one `assignee` tuple; every record access disappears
with it.

---

## 5. Recipe: time-bound contractor access

**Scenario.** A contractor gets access that must expire automatically — no cron
job to revoke it.

**Model** (an ABAC condition on the grant):

```dsl
model
  schema 1.1

type user

type document
  relations
    define viewer: [user with non_expired_grant]
    define can_view: viewer

condition non_expired_grant(current_time: timestamp, grant_time: timestamp, grant_duration: duration) {
  current_time < grant_time + grant_duration
}
```

Write the tuple with its condition context (grant time + duration), then pass
`current_time` as request-time context on each check. Once
`grant_time + grant_duration` passes, the same check flips to **denied** — no
cleanup required. See [OpenFGA conditions](https://openfga.dev/docs/modeling/conditions)
for the tuple-condition syntax.

---

## 6. Recipe: suspending a user (block list)

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
user:*      viewer    document:handbook     # everyone can read the handbook
user:5f1b…  blocked   document:handbook     # …except this account

fga_check(can_view, document:handbook) with 5f1b…'s token → denied
```

`but not` always wins over every grant path — direct, inherited, or public.

---

## Cheat sheet: app event → FGA operation

| Your app does | You call |
| --- | --- |
| Serve any protected read/write | `fga_check` (caller's token) |
| Render a list page | `fga_list_objects`, filter your DB query by the ids |
| Render one item with many action buttons | `fga_batch_check` |
| Create a resource | `_fga_write_tuples`: owner + structural parent tuple |
| Share / grant / promote | `_fga_write_tuples`: one tuple |
| Revoke / unshare / offboard | `_fga_delete_tuples`: the matching tuple(s) |
| Reorganize (move project to new org) | delete + write the structural tuple |
| Debug "why can X see Y?" | `_fga_expand` (admin), or the dashboard **Step 3 · Test access** with any subject |

Start in the dashboard (define model → grant → test), then wire the two
touchpoints above into your backend. The [Authorization (FGA)](./authorization)
page has the full API reference.
