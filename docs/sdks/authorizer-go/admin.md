---
sidebar_position: 3
title: Protocols & Admin API
---

# Protocols & Admin API

_Added in authorizer-go for Authorizer **2.3.0-rc.9**._

## Protocol selection

The user client can talk to the server over three wire protocols. **`graphql` is the
default** and is 100% backward compatible — existing code keeps working unchanged.

| Protocol           | Transport                       | Notes                                          |
| ------------------ | ------------------------------- | ---------------------------------------------- |
| `ProtocolGraphQL`  | `POST /graphql`                 | Default.                                       |
| `ProtocolREST`     | Typed `POST/GET /v1/...` routes | Same flat responses as GraphQL.                |
| `ProtocolGRPC`     | Generated gRPC stub             | Uses a **separate endpoint** (default `:9091`). |

Pass `WithProtocol` to `NewAuthorizerClient`. As of 2.3.0-rc.9 all 20 public methods work
over every protocol, and all three return **identical flat response shapes**.

```go
// REST (default endpoint, no extra config)
client, err := authorizer.NewAuthorizerClient(
    "YOUR_CLIENT_ID", "YOUR_AUTHORIZER_URL", "", nil,
    authorizer.WithProtocol(authorizer.ProtocolREST),
)
```

### gRPC

gRPC listens on its own port, separate from the HTTP URL. When `WithGRPCEndpoint` is
omitted, the target is derived from the Authorizer URL's host with the default gRPC port
`9091`.

```go
client, err := authorizer.NewAuthorizerClient(
    "YOUR_CLIENT_ID", "https://your-instance.authorizer.dev", "", nil,
    authorizer.WithProtocol(authorizer.ProtocolGRPC),
    authorizer.WithGRPCEndpoint("your-instance.authorizer.dev:9091"), // optional
)
if err != nil {
    panic(err)
}

res, err := client.Login(&authorizer.LoginInput{Email: "user@example.com", Password: "Abc@123"})
```

> OAuth endpoints (`/oauth/token`, `/oauth/revoke`) always use REST regardless of the
> selected protocol.

## Admin client

The admin API is a **separate client** constructed with the admin secret (the value of
`--admin-secret`). Admin auth is sent on every call as the `x-authorizer-admin-secret`
header (gRPC: metadata key `x-authorizer-admin-secret`).

```go
admin, err := authorizer.NewAuthorizerAdminClient(
    "https://your-instance.authorizer.dev", "YOUR_ADMIN_SECRET",
)
if err != nil {
    panic(err)
}

// List users
res, err := admin.Users(&authorizerv1.UsersRequest{})
if err != nil {
    panic(err)
}
for _, u := range res.Users {
    fmt.Println(u.Email)
}
```

Request/response types come from the generated proto package
(`authorizerv1 "github.com/authorizerdev/authorizer-go/gen/..."`); import it alongside the SDK.

### Admin client options

| Option                       | Description                                                              |
| ---------------------------- | ------------------------------------------------------------------------ |
| `WithAdminProtocol(p)`       | Wire transport. Defaults to `ProtocolGraphQL`.                           |
| `WithAdminGRPCEndpoint(addr)`| gRPC target (default: URL host + `:9091`).                              |
| `WithAdminExtraHeaders(h)`   | Extra headers sent on every admin request.                              |

```go
admin, err := authorizer.NewAuthorizerAdminClient(
    "https://your-instance.authorizer.dev", "YOUR_ADMIN_SECRET",
    authorizer.WithAdminProtocol(authorizer.ProtocolGRPC),
    authorizer.WithAdminGRPCEndpoint("your-instance.authorizer.dev:9091"),
)
```

### Admin methods

Each method declares which protocols support it. Calling a method on an unsupported
protocol raises a clear error early (e.g. _"AdminMeta is not available over graphql"_)
rather than emitting a 404. The protocol columns below also apply to the Python and JS
admin clients (JS supports graphql + rest only).

> **⚠ Destructive:** `DeleteUser`, `DeleteWebhook`, `DeleteEmailTemplate`,
> `FgaWriteModel` (overwrites the model), `FgaDeleteTuples`, and `FgaReset` (wipes all FGA
> data) permanently change or remove data.

#### Auth, session & meta

| Method        | Description                                  | grpc | rest | gql |
| ------------- | -------------------------------------------- | :--: | :--: | :-: |
| `AdminLogin`  | Exchange the admin secret for a session.     | ✓ | ✓ | ✓ |
| `AdminLogout` | End the admin session.                       | ✓ | ✓ |   |
| `AdminSession`| Get the current admin session.               | ✓ | ✓ |   |
| `AdminMeta`   | Server metadata / feature flags.             | ✓ | ✓ |   |

#### Users & access

| Method                  | Description                                   | grpc | rest | gql |
| ----------------------- | --------------------------------------------- | :--: | :--: | :-: |
| `Users`                 | List users (paginated).                       | ✓ | ✓ | ✓ |
| `User`                  | Get a single user.                            | ✓ | ✓ | ✓ |
| `UpdateUser`            | Update a user.                                | ✓ | ✓ | ✓ |
| `DeleteUser`            | **Delete a user.**                            | ✓ | ✓ | ✓ |
| `VerificationRequests`  | List pending verification requests.           | ✓ | ✓ | ✓ |
| `RevokeAccess`          | Revoke a user's access.                        | ✓ | ✓ | ✓ |
| `EnableAccess`          | Re-enable a user's access.                     | ✓ | ✓ | ✓ |
| `InviteMembers`         | Invite members by email.                      | ✓ | ✓ | ✓ |

#### Webhooks

| Method          | Description                       | grpc | rest | gql |
| --------------- | -------------------------------- | :--: | :--: | :-: |
| `AddWebhook`    | Create a webhook.                | ✓ | ✓ | ✓ |
| `UpdateWebhook` | Update a webhook.                | ✓ | ✓ | ✓ |
| `DeleteWebhook` | **Delete a webhook.**            | ✓ | ✓ | ✓ |
| `GetWebhook`    | Get a single webhook.            | ✓ | ✓ | ✓ |
| `Webhooks`      | List webhooks.                   | ✓ | ✓ | ✓ |
| `WebhookLogs`   | List webhook delivery logs.      | ✓ | ✓ | ✓ |
| `TestEndpoint`  | Send a test event to a webhook.  | ✓ | ✓ | ✓ |

#### Email templates

| Method                 | Description                  | grpc | rest | gql |
| ---------------------- | ---------------------------- | :--: | :--: | :-: |
| `AddEmailTemplate`     | Create an email template.    | ✓ | ✓ | ✓ |
| `UpdateEmailTemplate`  | Update an email template.    | ✓ | ✓ | ✓ |
| `DeleteEmailTemplate`  | **Delete an email template.**| ✓ | ✓ | ✓ |
| `EmailTemplates`       | List email templates.        | ✓ | ✓ | ✓ |

#### Audit

| Method      | Description       | grpc | rest | gql |
| ----------- | ----------------- | :--: | :--: | :-: |
| `AuditLogs` | List audit logs.  | ✓ | ✓ | ✓ |

#### FGA admin

| Method            | Description                              | grpc | rest | gql |
| ----------------- | ---------------------------------------- | :--: | :--: | :-: |
| `FgaGetModel`     | Get the current FGA model.               | ✓ | ✓ |   |
| `FgaWriteModel`   | **Write/overwrite the FGA model.**       | ✓ | ✓ | ✓ |
| `FgaWriteTuples`  | Write relationship tuples.               | ✓ | ✓ | ✓ |
| `FgaDeleteTuples` | **Delete relationship tuples.**          | ✓ | ✓ | ✓ |
| `FgaReadTuples`   | Read relationship tuples.                | ✓ | ✓ | ✓ |
| `FgaListUsers`    | List users with a relation to an object. | ✓ | ✓ | ✓ |
| `FgaExpand`       | Expand a relation into its userset.      | ✓ | ✓ | ✓ |
| `FgaReset`        | **Reset all FGA data.**                  | ✓ | ✓ |   |

#### GraphQL-only extras

These have no proto / REST / gRPC equivalent and work **over GraphQL only**:

| Method            | Description                          |
| ----------------- | ------------------------------------ |
| `AdminSignup`     | Bootstrap the first admin.           |
| `UpdateEnv`       | Update server environment/config.    |
| `GenerateJWTKeys` | Generate a new JWT signing key pair. |
