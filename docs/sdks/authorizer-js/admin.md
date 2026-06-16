---
sidebar_position: 3
title: Protocols & Admin API
---

# Protocols & Admin API

_Added in `@authorizerdev/authorizer-js` for Authorizer **2.3.0-rc.9**._

## Protocol selection

The `Authorizer` client can talk to the server over two wire protocols. **`graphql` is the
default** and is 100% backward compatible — existing code keeps working unchanged.

| `protocol` | Transport                       | Notes                           |
| ---------- | ------------------------------- | ------------------------------- |
| `'graphql'`| `POST /graphql`                 | Default.                        |
| `'rest'`   | Typed `POST/GET /v1/...` routes | Same flat responses as GraphQL. |

> **No gRPC in JS.** Browsers cannot speak raw gRPC. Passing `protocol: 'grpc'` throws a
> clear error at construction time. Use the [Go](../authorizer-go/admin) or
> [Python](../authorizer-python/admin) SDKs for gRPC.

As of 2.3.0-rc.9 all public methods work over both protocols, and both return **identical
flat response shapes**.

```js
import { Authorizer } from '@authorizerdev/authorizer-js'

const authRef = new Authorizer({
  authorizerURL: 'YOUR_AUTHORIZER_URL',
  redirectURL: window.location.origin,
  clientID: 'YOUR_CLIENT_ID',
  protocol: 'rest', // 'graphql' (default) | 'rest'
})

await authRef.login({ email: 'user@example.com', password: 'Abc@123' })
```

> OAuth endpoints (`/oauth/token`, `/oauth/revoke`) always use REST regardless of the
> selected protocol.

## Admin client

The admin API is a **separate client**, `AuthorizerAdmin`, constructed with the admin
secret (the value of `--admin-secret`). Admin auth is sent on every call as the
`x-authorizer-admin-secret` header.

> Keep the admin secret on the **server side** — never ship it to a browser bundle.

```js
import { AuthorizerAdmin } from '@authorizerdev/authorizer-js'

const admin = new AuthorizerAdmin({
  authorizerURL: 'https://your-instance.authorizer.dev',
  adminSecret: 'YOUR_ADMIN_SECRET',
  protocol: 'graphql', // 'graphql' (default) | 'rest'
})

// List users
const { data, errors } = await admin.users()
if (!errors?.length) {
  data.users.forEach((u) => console.log(u.email))
}
```

### Config

| Key             | Description                                                   |
| --------------- | ------------------------------------------------------------- |
| `authorizerURL` | Base URL of your Authorizer instance.                         |
| `adminSecret`   | Value of `--admin-secret`, sent as `x-authorizer-admin-secret`.|
| `protocol`      | `'graphql'` (default) or `'rest'`. gRPC is not supported.     |

### Admin methods

Each method declares which protocols support it. Calling a method on an unsupported
protocol returns a clear error rather than emitting a 404.

> **⚠ Destructive:** `deleteUser`, `deleteWebhook`, `deleteEmailTemplate`,
> `fgaWriteModel` (overwrites the model), `fgaDeleteTuples`, and `fgaReset` (wipes all FGA
> data) permanently change or remove data.

#### Auth, session & meta

| Method         | Description                              | rest | gql |
| -------------- | ---------------------------------------- | :--: | :-: |
| `adminLogin`   | Exchange the admin secret for a session. | ✓ | ✓ |
| `adminLogout`  | End the admin session.                   | ✓ |   |
| `adminSession` | Get the current admin session.           | ✓ |   |
| `adminMeta`    | Server metadata / feature flags.         | ✓ |   |

#### Users & access

| Method                 | Description                         | rest | gql |
| ---------------------- | ----------------------------------- | :--: | :-: |
| `users`                | List users (paginated).             | ✓ | ✓ |
| `user`                 | Get a single user.                  | ✓ | ✓ |
| `updateUser`           | Update a user.                      | ✓ | ✓ |
| `deleteUser`           | **Delete a user.**                  | ✓ | ✓ |
| `verificationRequests` | List pending verification requests. | ✓ | ✓ |
| `revokeAccess`         | Revoke a user's access.              | ✓ | ✓ |
| `enableAccess`         | Re-enable a user's access.           | ✓ | ✓ |
| `inviteMembers`        | Invite members by email.            | ✓ | ✓ |

#### Webhooks

| Method          | Description                      | rest | gql |
| --------------- | -------------------------------- | :--: | :-: |
| `addWebhook`    | Create a webhook.                | ✓ | ✓ |
| `updateWebhook` | Update a webhook.                | ✓ | ✓ |
| `deleteWebhook` | **Delete a webhook.**            | ✓ | ✓ |
| `getWebhook`    | Get a single webhook.            | ✓ | ✓ |
| `webhooks`      | List webhooks.                   | ✓ | ✓ |
| `webhookLogs`   | List webhook delivery logs.      | ✓ | ✓ |
| `testEndpoint`  | Send a test event to a webhook.  | ✓ | ✓ |

#### Email templates

| Method                | Description                  | rest | gql |
| --------------------- | ---------------------------- | :--: | :-: |
| `addEmailTemplate`    | Create an email template.    | ✓ | ✓ |
| `updateEmailTemplate` | Update an email template.    | ✓ | ✓ |
| `deleteEmailTemplate` | **Delete an email template.**| ✓ | ✓ |
| `emailTemplates`      | List email templates.        | ✓ | ✓ |

#### Audit

| Method      | Description       | rest | gql |
| ----------- | ----------------- | :--: | :-: |
| `auditLogs` | List audit logs.  | ✓ | ✓ |

#### FGA admin

| Method            | Description                              | rest | gql |
| ----------------- | ---------------------------------------- | :--: | :-: |
| `fgaGetModel`     | Get the current FGA model.               | ✓ |   |
| `fgaWriteModel`   | **Write/overwrite the FGA model.**       | ✓ | ✓ |
| `fgaWriteTuples`  | Write relationship tuples.               | ✓ | ✓ |
| `fgaDeleteTuples` | **Delete relationship tuples.**          | ✓ | ✓ |
| `fgaReadTuples`   | Read relationship tuples.                | ✓ | ✓ |
| `fgaListUsers`    | List users with a relation to an object. | ✓ | ✓ |
| `fgaExpand`       | Expand a relation into its userset.      | ✓ | ✓ |
| `fgaReset`        | **Reset all FGA data.**                  | ✓ |   |

#### GraphQL-only extras

These have no REST equivalent and work **over GraphQL only**:

| Method            | Description                          |
| ----------------- | ------------------------------------ |
| `adminSignup`     | Bootstrap the first admin.           |
| `updateEnv`       | Update server environment/config.    |
| `generateJWTKeys` | Generate a new JWT signing key pair. |
