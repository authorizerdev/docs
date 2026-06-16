---
sidebar_position: 4
title: Protocols & Admin API
---

# Protocols & Admin API

_Added in `authorizer-py` for Authorizer **2.3.0-rc.9**._

## Protocol selection

Both the sync (`AuthorizerClient`) and async (`AsyncAuthorizerClient`) user clients can
talk to the server over three wire protocols. **`graphql` is the default** and is 100%
backward compatible — existing code keeps working unchanged.

| `protocol=` | Transport                       | Notes                                          |
| ----------- | ------------------------------- | ---------------------------------------------- |
| `"graphql"` | `POST /graphql`                 | Default.                                       |
| `"rest"`    | Typed `POST/GET /v1/...` routes | Same flat responses as GraphQL.                |
| `"grpc"`    | Generated gRPC stub             | Uses a **separate endpoint** (default `:9091`). |

As of 2.3.0-rc.9 all public methods work over every protocol, and all three return
**identical flat response shapes**.

```python
from authorizer import AuthorizerClient, LoginRequest

# REST
client = AuthorizerClient(
    client_id="YOUR_CLIENT_ID",
    authorizer_url="https://your-instance.authorizer.dev",
    protocol="rest",
)
token = client.login(LoginRequest(email="user@example.com", password="Abc@123"))
```

### gRPC

gRPC requires the optional extra:

```bash
pip install 'authorizer-py[grpc]'
```

It listens on its own port, separate from the HTTP URL. When `grpc_endpoint` is omitted,
the target is derived from `authorizer_url`'s host with the default gRPC port `9091`.

```python
client = AuthorizerClient(
    client_id="YOUR_CLIENT_ID",
    authorizer_url="https://your-instance.authorizer.dev",
    protocol="grpc",
    grpc_endpoint="your-instance.authorizer.dev:9091",  # optional
)
```

> OAuth endpoints (`/oauth/token`, `/oauth/revoke`) always use REST regardless of the
> selected protocol.

## Admin client

The admin API is a **separate client** constructed with the admin secret (the value of
`--admin-secret`) — `AuthorizerAdminClient` (sync) and `AsyncAuthorizerAdminClient`
(async). Admin auth is sent on every call as the `x-authorizer-admin-secret` header (gRPC:
metadata key `x-authorizer-admin-secret`).

```python
from authorizer import AuthorizerAdminClient

admin = AuthorizerAdminClient(
    authorizer_url="https://your-instance.authorizer.dev",
    admin_secret="YOUR_ADMIN_SECRET",
)

# List users
res = admin.users()
for u in res.users:
    print(u.email)

admin.close()
```

The async client mirrors the sync one method-for-method; `await` the calls and use
`async with` / `await admin.aclose()`.

### Constructor options

```python
AuthorizerAdminClient(
    authorizer_url: str,
    admin_secret: str,
    extra_headers: dict[str, str] | None = None,
    protocol: str = "graphql",
    grpc_endpoint: str = "",
)
```

| Parameter        | Description                                                         | Required |
| ---------------- | ------------------------------------------------------------------ | -------- |
| `authorizer_url` | Base URL of your Authorizer instance, **no trailing slash**.       | yes      |
| `admin_secret`   | Value of `--admin-secret`.                                         | yes      |
| `extra_headers`  | Extra headers sent on every admin request.                         | no       |
| `protocol`       | `"graphql"` (default), `"rest"`, or `"grpc"`.                      | no       |
| `grpc_endpoint`  | gRPC target (default: URL host + `:9091`).                         | no       |

### Admin methods

Each method declares which protocols support it. Calling a method on an unsupported
protocol raises a clear error early rather than emitting a 404.

> **⚠ Destructive:** `delete_user`, `delete_webhook`, `delete_email_template`,
> `fga_write_model` (overwrites the model), `fga_delete_tuples`, and `fga_reset` (wipes all
> FGA data) permanently change or remove data.

#### Auth, session & meta

| Method          | Description                              | grpc | rest | gql |
| --------------- | ---------------------------------------- | :--: | :--: | :-: |
| `admin_login`   | Exchange the admin secret for a session. | ✓ | ✓ | ✓ |
| `admin_logout`  | End the admin session.                   | ✓ | ✓ |   |
| `admin_session` | Get the current admin session.           | ✓ | ✓ |   |
| `admin_meta`    | Server metadata / feature flags.         | ✓ | ✓ |   |

#### Users & access

| Method                   | Description                         | grpc | rest | gql |
| ------------------------ | ----------------------------------- | :--: | :--: | :-: |
| `users`                  | List users (paginated).             | ✓ | ✓ | ✓ |
| `user`                   | Get a single user.                  | ✓ | ✓ | ✓ |
| `update_user`            | Update a user.                      | ✓ | ✓ | ✓ |
| `delete_user`            | **Delete a user.**                  | ✓ | ✓ | ✓ |
| `verification_requests`  | List pending verification requests. | ✓ | ✓ | ✓ |
| `revoke_access`          | Revoke a user's access.              | ✓ | ✓ | ✓ |
| `enable_access`          | Re-enable a user's access.           | ✓ | ✓ | ✓ |
| `invite_members`         | Invite members by email.            | ✓ | ✓ | ✓ |

#### Webhooks

| Method           | Description                      | grpc | rest | gql |
| ---------------- | -------------------------------- | :--: | :--: | :-: |
| `add_webhook`    | Create a webhook.                | ✓ | ✓ | ✓ |
| `update_webhook` | Update a webhook.                | ✓ | ✓ | ✓ |
| `delete_webhook` | **Delete a webhook.**            | ✓ | ✓ | ✓ |
| `get_webhook`    | Get a single webhook.            | ✓ | ✓ | ✓ |
| `webhooks`       | List webhooks.                   | ✓ | ✓ | ✓ |
| `webhook_logs`   | List webhook delivery logs.      | ✓ | ✓ | ✓ |
| `test_endpoint`  | Send a test event to a webhook.  | ✓ | ✓ | ✓ |

#### Email templates

| Method                  | Description                  | grpc | rest | gql |
| ----------------------- | ---------------------------- | :--: | :--: | :-: |
| `add_email_template`    | Create an email template.    | ✓ | ✓ | ✓ |
| `update_email_template` | Update an email template.    | ✓ | ✓ | ✓ |
| `delete_email_template` | **Delete an email template.**| ✓ | ✓ | ✓ |
| `email_templates`       | List email templates.        | ✓ | ✓ | ✓ |

#### Audit

| Method       | Description       | grpc | rest | gql |
| ------------ | ----------------- | :--: | :--: | :-: |
| `audit_logs` | List audit logs.  | ✓ | ✓ | ✓ |

#### FGA admin

| Method              | Description                              | grpc | rest | gql |
| ------------------- | ---------------------------------------- | :--: | :--: | :-: |
| `fga_get_model`     | Get the current FGA model.               | ✓ | ✓ |   |
| `fga_write_model`   | **Write/overwrite the FGA model.**       | ✓ | ✓ | ✓ |
| `fga_write_tuples`  | Write relationship tuples.               | ✓ | ✓ | ✓ |
| `fga_delete_tuples` | **Delete relationship tuples.**          | ✓ | ✓ | ✓ |
| `fga_read_tuples`   | Read relationship tuples.                | ✓ | ✓ | ✓ |
| `fga_list_users`    | List users with a relation to an object. | ✓ | ✓ | ✓ |
| `fga_expand`        | Expand a relation into its userset.      | ✓ | ✓ | ✓ |
| `fga_reset`         | **Reset all FGA data.**                  | ✓ | ✓ |   |

#### GraphQL-only extras

These have no REST / gRPC equivalent and work **over GraphQL only**:

| Method               | Description                          |
| -------------------- | ------------------------------------ |
| `admin_signup`       | Bootstrap the first admin.           |
| `update_env`         | Update server environment/config.    |
| `generate_jwt_keys`  | Generate a new JWT signing key pair. |
