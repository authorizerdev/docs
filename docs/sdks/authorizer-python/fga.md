---
sidebar_position: 3
title: Fine-Grained Authorization
---

# Fine-Grained Authorization (FGA)

Authorizer ships with an embedded [OpenFGA](https://openfga.dev) relationship-based
authorization (ReBAC) engine. The Python SDK exposes two client-facing methods to query
it: `check_permissions` and `list_permissions`. Both take a request dataclass and an
optional `headers` dict — pass the user's access token as `Authorization: Bearer <token>`.

> The subject is pinned server-side from the caller's token. The optional `user` field is
> honored only for super-admins or when it equals the caller's own subject. See
> [Authorization (FGA)](../../core/authorization) for the model and the
> [FGA Guide](../../core/fga-guide) for building one.

## `check_permissions`

Evaluate one or more permission checks in a single call (1–100). `results` come back in
the same order as `checks` and echo each pair.

```python
from authorizer import (
    AuthorizerClient,
    CheckPermissionsRequest,
    PermissionCheckInput,
)

client = AuthorizerClient("YOUR_CLIENT_ID", "https://your-instance.authorizer.dev")
auth = {"Authorization": "Bearer USER_ACCESS_TOKEN"}

res = client.check_permissions(
    CheckPermissionsRequest(
        checks=[
            PermissionCheckInput(relation="can_view", object="document:1"),
            PermissionCheckInput(relation="can_edit", object="document:1"),
        ]
    ),
    headers=auth,
)

for r in res.results:
    print(r.relation, r.object, r.allowed)
# can_view document:1 True
# can_edit document:1 False
```

### Contextual tuples

Each check accepts optional `contextual_tuples` — extra `{ user, relation, object }`
tuples evaluated for that one check only and never persisted. Useful for "what-if" checks
and request-time facts:

```python
from authorizer import (
    AuthorizerClient,
    CheckPermissionsRequest,
    PermissionCheckInput,
    FgaTupleInput,
)

client = AuthorizerClient("YOUR_CLIENT_ID", "https://your-instance.authorizer.dev")
auth = {"Authorization": "Bearer USER_ACCESS_TOKEN"}

res = client.check_permissions(
    CheckPermissionsRequest(
        checks=[
            PermissionCheckInput(
                relation="can_view",
                object="document:1",
                contextual_tuples=[
                    FgaTupleInput(user="user:alice", relation="member", object="team:eng"),
                ],
            ),
        ]
    ),
    headers=auth,
)
print(res.results[0].allowed)
```

## `list_permissions`

List what the subject can access. With both `relation` and `object_type` set it answers
"which `object_type`s can I `relation`?"; either or both filters may be omitted, so an
empty request returns every permission the subject holds.

```python
from authorizer import AuthorizerClient, ListPermissionsRequest

client = AuthorizerClient("YOUR_CLIENT_ID", "https://your-instance.authorizer.dev")
auth = {"Authorization": "Bearer USER_ACCESS_TOKEN"}

res = client.list_permissions(
    ListPermissionsRequest(relation="can_view", object_type="document"),
    headers=auth,
)

print(res.objects)      # ['document:1', 'document:42']
for p in res.permissions:
    print(p.object, p.relation)
print("truncated:", res.truncated)
```

`truncated` is `True` when the result was capped at **1000** entries and more permissions
exist — narrow the query with `relation` / `object_type` to retrieve the rest.

## Async usage

Both methods are available on `AsyncAuthorizerClient` — `await` them:

```python
import asyncio
from authorizer import (
    AsyncAuthorizerClient,
    CheckPermissionsRequest,
    PermissionCheckInput,
)

async def main() -> None:
    auth = {"Authorization": "Bearer USER_ACCESS_TOKEN"}
    async with AsyncAuthorizerClient(
        "YOUR_CLIENT_ID", "https://your-instance.authorizer.dev"
    ) as client:
        res = await client.check_permissions(
            CheckPermissionsRequest(
                checks=[PermissionCheckInput(relation="can_view", object="document:1")]
            ),
            headers=auth,
        )
        print(res.results[0].allowed)

asyncio.run(main())
```

## Permission-aware retrieval

A common pattern (e.g. for RAG / AI assistants) is to **pre-filter** what a user is
allowed to see before retrieving or ranking it — call `list_permissions` to get the set
of accessible object ids, then restrict your query to that set so disallowed content is
never returned:

```python
allowed = client.list_permissions(
    ListPermissionsRequest(relation="can_view", object_type="document"),
    headers=auth,
).objects

# e.g. pass `allowed` as a filter to your vector store / database query.
visible_docs = [d for d in candidate_docs if d.id in set(allowed)]
```

## See also

- [Authorization (FGA)](../../core/authorization) — the relationship model & API surface.
- [FGA Guide](../../core/fga-guide) — building a model, writing tuples, DSL reference.
- [Functions](./functions) — the full SDK method reference.
