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

Pass `WithProtocol` to `NewAuthorizerClient`. Public methods work over every protocol, and
all three return **identical flat response shapes**. `GetToken` and `RevokeToken` always
use REST (see the OAuth note below).

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

res, err := client.Login(&authorizer.LoginRequest{Email: authorizer.NewStringRef("user@example.com"), Password: "Abc@123"})
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

Request/response types for the proto-backed methods come from the generated package
`authorizerv1 "github.com/authorizerdev/authorizer-proto-go/authorizer/v1"`. It is a
public module of its own, so application code can import it directly — it is pulled in
transitively when you `go get github.com/authorizerdev/authorizer-go/v2`. The Go-native
admin operations (organizations, org SSO connections, SCIM, org domains — see below)
declare their request/response types directly in the top-level `authorizer` package
instead.

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
protocol raises a clear error early (e.g. _"AdminMeta not available over graphql; use grpc
or rest"_) rather than emitting a 404. The protocol columns below also apply to the Python
and JS admin clients (JS supports graphql + rest only).

> **⚠ Destructive:** `DeleteUser`, `DeleteWebhook`, `DeleteEmailTemplate`,
> `FgaWriteModel` (overwrites the model), `FgaDeleteTuples`, `FgaReset` (wipes all FGA
> data), `DeleteClient`, `DeleteTrustedIssuer`, `DeleteSamlServiceProvider`,
> `RetireSamlIdpKey`, `DeleteOrganization`, `DeleteOrgOIDCConnection`,
> `DeleteOrgSAMLConnection`, `DeleteScimEndpoint`, and `DeleteOrgDomain`
> permanently change or remove data.

#### Auth, session & meta

| Method        | Description                                  | grpc | rest | gql |
| ------------- | -------------------------------------------- | :--: | :--: | :-: |
| `AdminLogin`  | Exchange the admin secret for a session.     | ✓ | ✓ | ✓ |
| `AdminLogout` | End the admin session.                       | ✓ | ✓ | ✓ |
| `AdminSession`| Get the current admin session.               | ✓ | ✓ | ✓ |
| `AdminMeta`   | Server metadata / feature flags.             | ✓ | ✓ | ✓ |

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
| `FgaGetModel`     | Get the current FGA model.               | ✓ | ✓ | ✓ |
| `FgaWriteModel`   | **Write/overwrite the FGA model.**       | ✓ | ✓ | ✓ |
| `FgaWriteTuples`  | Write relationship tuples.               | ✓ | ✓ | ✓ |
| `FgaDeleteTuples` | **Delete relationship tuples.**          | ✓ | ✓ | ✓ |
| `FgaReadTuples`   | Read relationship tuples.                | ✓ | ✓ | ✓ |
| `FgaListUsers`    | List users with a relation to an object. | ✓ | ✓ | ✓ |
| `FgaExpand`       | Expand a relation into its userset.      | ✓ | ✓ | ✓ |
| `FgaReset`        | **Reset all FGA data.**                  | ✓ | ✓ | ✓ |

#### OAuth clients (machine-to-machine / workload identity)

| Method               | Description                                                                            | grpc | rest | gql |
| -------------------- | --------------------------------------------------------------------------------------- | :--: | :--: | :-: |
| `CreateClient`       | Provision a new machine/workload identity (service account). `client_secret` is returned **once**. | ✓ | ✓ | ✓ |
| `UpdateClient`       | Update a client's metadata, scopes or active flag.                                      | ✓ | ✓ | ✓ |
| `DeleteClient`       | **Delete a client.** Tokens already issued to it stop being honoured.                   | ✓ | ✓ | ✓ |
| `RotateClientSecret` | Issue a new secret for a client. Returned once; the old secret keeps validating during the grace window. | ✓ | ✓ | ✓ |
| `GetClient`          | Get a single client by id (`client_secret` never returned).                             | ✓ | ✓ | ✓ |
| `Clients`            | List clients (paginated).                                                               | ✓ | ✓ | ✓ |

#### Trusted issuers

| Method                 | Description                                                                                          | grpc | rest | gql |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | :--: | :--: | :-: |
| `AddTrustedIssuer`     | Register an external token issuer (K8s service account, [SPIFFE](https://spiffe.io), OIDC) allowed to authenticate as a service account via JWT-bearer assertions. | ✓ | ✓ | ✓ |
| `UpdateTrustedIssuer`  | Update a trusted issuer.                                                                                | ✓ | ✓ | ✓ |
| `DeleteTrustedIssuer`  | **Delete a trusted issuer.** Assertions from it stop authenticating immediately.                       | ✓ | ✓ | ✓ |
| `GetTrustedIssuer`     | Get a single trusted issuer by id.                                                                     | ✓ | ✓ | ✓ |
| `TrustedIssuers`       | List trusted issuers (paginated), optionally filtered by `service_account_id`.                         | ✓ | ✓ | ✓ |

#### SAML (service providers & IdP keys)

| Method                      | Description                                                                                     | grpc | rest | gql |
| ---------------------------- | -------------------------------------------------------------------------------------------------| :--: | :--: | :-: |
| `CreateSamlServiceProvider` | Register a downstream [SAML 2.0](https://www.oasis-open.org/standard/saml/) SP that Authorizer (acting as IdP) issues signed assertions to.  | ✓ | ✓ | ✓ |
| `UpdateSamlServiceProvider` | Update a downstream SP's name, endpoints, certificate, attribute mapping, or active state.       | ✓ | ✓ | ✓ |
| `DeleteSamlServiceProvider` | **Delete a downstream SP.** SSO assertions to it stop being issued immediately.                  | ✓ | ✓ | ✓ |
| `GetSamlServiceProvider`    | Get a single downstream SP by id.                                                                | ✓ | ✓ | ✓ |
| `ListSamlServiceProviders`  | List downstream SPs for an org (paginated).                                                      | ✓ | ✓ | ✓ |
| `RotateSamlIdpCert`         | Generate a new current signing keypair for an org's SAML IdP, demoting the previous current key. | ✓ | ✓ | ✓ |
| `RetireSamlIdpKey`          | **Retire a published-but-not-signing SAML IdP key.** It stops being published in IdP metadata.   | ✓ | ✓ | ✓ |
| `ListSamlIdpKeys`           | List all SAML IdP signing keys for an org.                                                       | ✓ | ✓ | ✓ |
| `ImportSamlSpMetadata`      | Parse pasted SP metadata XML into fields to prefill a create call. Does not create a record or fetch remotely. | ✓ | ✓ | ✓ |

#### Organizations & members

Organizations, members, SSO connections, SCIM endpoints and verified domains work over
every protocol as of server 2.4.0. Their types are declared directly in the Go SDK rather
than proto-generated — `Organization`, `OrgMember`, `CreateOrganizationRequest`,
`ListOrganizationsRequest`, etc. — because these operations predate the proto; the
signatures were kept when the REST/gRPC transports were added.

| Method               | Description                                          | grpc | rest | gql |
| --------------------- | ----------------------------------------------------| :--: | :--: | :-: |
| `CreateOrganization`  | Create an organization. `Name` must be a unique, URL-safe slug. | ✓ | ✓ | ✓ |
| `UpdateOrganization`  | Update an organization.                              | ✓ | ✓ | ✓ |
| `DeleteOrganization`  | **Delete an organization** and its memberships/connections. | ✓ | ✓ | ✓ |
| `GetOrganization`     | Get a single organization by id.                     | ✓ | ✓ | ✓ |
| `Organizations`       | List organizations (paginated).                      | ✓ | ✓ | ✓ |
| `AddOrgMember`        | Add a user to an organization.                       | ✓ | ✓ | ✓ |
| `RemoveOrgMember`     | Remove a user from an organization.                  | ✓ | ✓ | ✓ |
| `OrgMembers`          | List an organization's members (paginated).          | ✓ | ✓ | ✓ |
| `UserOrganizations`   | List a user's organizations, with per-org roles (paginated). | ✓ | ✓ | ✓ |

`Organizations`, `OrgMembers` and `OrgDomains` (below) take pagination via this SDK's own
`*PaginationRequest` type directly on the request — a single level, matching the proto
shape everywhere else in the SDK:

```go
res, err := admin.Organizations(&authorizer.ListOrganizationsRequest{
    Pagination: &authorizer.PaginationRequest{Limit: 20, Page: 1},
})

members, err := admin.OrgMembers(&authorizer.ListOrgMembersRequest{
    OrgID:      "org_123",
    Pagination: &authorizer.PaginationRequest{Limit: 20, Page: 1},
})
```

#### Org SSO connections (OIDC & SAML)

Upstream SSO an organization's members sign in through.

| Method                       | Description                                                              | grpc | rest | gql |
| ------------------------------ | ------------------------------------------------------------------------| :--: | :--: | :-: |
| `CreateOrgOIDCConnection`    | Create an org's upstream OIDC SSO connection.                            | ✓ | ✓ | ✓ |
| `UpdateOrgOIDCConnection`    | Update it. Supplying `ClientSecret` rotates it; omitting leaves it intact. | ✓ | ✓ | ✓ |
| `DeleteOrgOIDCConnection`    | **Delete it.** SSO logins through it stop working immediately.           | ✓ | ✓ | ✓ |
| `GetOrgOIDCConnection`       | Get it by id or by org id (supply exactly one).                          | ✓ | ✓ | ✓ |
| `CreateOrgSAMLConnection`    | Create an org's upstream SAML SSO connection.                            | ✓ | ✓ | ✓ |
| `UpdateOrgSAMLConnection`    | Update it. Supplying `IdpCertificate` replaces it; omitting leaves it intact. | ✓ | ✓ | ✓ |
| `DeleteOrgSAMLConnection`    | **Delete it.** SSO logins through it stop working immediately.           | ✓ | ✓ | ✓ |
| `GetOrgSAMLConnection`       | Get it by id or by org id (supply exactly one).                          | ✓ | ✓ | ✓ |

#### SCIM provisioning


| Method              | Description                                                                    | grpc | rest | gql |
| -------------------- | --------------------------------------------------------------------------------| :--: | :--: | :-: |
| `CreateScimEndpoint` | Provision a SCIM endpoint for an organization. The bearer token is returned **once**. | ✓ | ✓ | ✓ |
| `RotateScimToken`    | Rotate the SCIM endpoint's bearer token. New token returned once; old one stops validating. | ✓ | ✓ | ✓ |
| `DeleteScimEndpoint` | **Delete an organization's SCIM endpoint.** The IdP's provisioning token stops working immediately. | ✓ | ✓ | ✓ |
| `GetScimEndpoint`    | Get an organization's SCIM endpoint (the bearer token is never returned).      | ✓ | ✓ | ✓ |

#### Org domains (home realm discovery)

Verified DNS-domain-to-organization mappings used for home realm discovery.

| Method                 | Description                                                                                     | grpc | rest | gql |
| ------------------------ | --------------------------------------------------------------------------------------------------| :--: | :--: | :-: |
| `RequestOrgDomain`     | Start domain verification, returning the DNS TXT record the tenant must publish to prove control. | ✓ | ✓ | ✓ |
| `VerifyOrgDomain`      | Check the DNS TXT challenge and, if satisfied, verify the domain.                                  | ✓ | ✓ | ✓ |
| `AddVerifiedOrgDomain` | Directly register a verified domain, bypassing the DNS TXT challenge. Super-admin only.            | ✓ | ✓ | ✓ |
| `DeleteOrgDomain`      | **Remove a verified domain.** Logins relying on it for home realm discovery stop resolving to the org. | ✓ | ✓ | ✓ |
| `OrgDomains`           | List an organization's verified domains (paginated).                                               | ✓ | ✓ | ✓ |

```go
domains, err := admin.OrgDomains(&authorizer.ListOrgDomainsRequest{
    OrgID:      "org_123",
    Pagination: &authorizer.PaginationRequest{Limit: 20, Page: 1},
})
```

#### OAuth clients (machine-to-machine / workload identity)

| Method               | Description                                                                            | grpc | rest | gql |
| -------------------- | --------------------------------------------------------------------------------------- | :--: | :--: | :-: |
| `CreateClient`       | Provision a new machine/workload identity (service account). `client_secret` is returned **once**. | ✓ | ✓ | ✓ |
| `UpdateClient`       | Update a client's metadata, scopes or active flag.                                      | ✓ | ✓ | ✓ |
| `DeleteClient`       | **Delete a client.** Tokens already issued to it stop being honoured.                   | ✓ | ✓ | ✓ |
| `RotateClientSecret` | Issue a new secret for a client. Returned once; the old secret keeps validating during the grace window. | ✓ | ✓ | ✓ |
| `GetClient`          | Get a single client by id (`client_secret` never returned).                             | ✓ | ✓ | ✓ |
| `Clients`            | List clients (paginated).                                                               | ✓ | ✓ | ✓ |

#### Trusted issuers

| Method                 | Description                                                                                          | grpc | rest | gql |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | :--: | :--: | :-: |
| `AddTrustedIssuer`     | Register an external token issuer (K8s service account, SPIFFE, OIDC) allowed to authenticate as a service account via JWT-bearer assertions. | ✓ | ✓ | ✓ |
| `UpdateTrustedIssuer`  | Update a trusted issuer.                                                                                | ✓ | ✓ | ✓ |
| `DeleteTrustedIssuer`  | **Delete a trusted issuer.** Assertions from it stop authenticating immediately.                       | ✓ | ✓ | ✓ |
| `GetTrustedIssuer`     | Get a single trusted issuer by id.                                                                     | ✓ | ✓ | ✓ |
| `TrustedIssuers`       | List trusted issuers (paginated), optionally filtered by `service_account_id`.                         | ✓ | ✓ | ✓ |

#### SAML (service providers & IdP keys)

| Method                      | Description                                                                                     | grpc | rest | gql |
| ---------------------------- | -------------------------------------------------------------------------------------------------| :--: | :--: | :-: |
| `CreateSamlServiceProvider` | Register a downstream SAML 2.0 SP that Authorizer (acting as IdP) issues signed assertions to.  | ✓ | ✓ | ✓ |
| `UpdateSamlServiceProvider` | Update a downstream SP's name, endpoints, certificate, attribute mapping, or active state.       | ✓ | ✓ | ✓ |
| `DeleteSamlServiceProvider` | **Delete a downstream SP.** SSO assertions to it stop being issued immediately.                  | ✓ | ✓ | ✓ |
| `GetSamlServiceProvider`    | Get a single downstream SP by id.                                                                | ✓ | ✓ | ✓ |
| `ListSamlServiceProviders`  | List downstream SPs for an org (paginated).                                                      | ✓ | ✓ | ✓ |
| `RotateSamlIdpCert`         | Generate a new current signing keypair for an org's SAML IdP, demoting the previous current key. | ✓ | ✓ | ✓ |
| `RetireSamlIdpKey`          | **Retire a published-but-not-signing SAML IdP key.** It stops being published in IdP metadata.   | ✓ | ✓ | ✓ |
| `ListSamlIdpKeys`           | List all SAML IdP signing keys for an org.                                                       | ✓ | ✓ | ✓ |
| `ImportSamlSpMetadata`      | Parse pasted SP metadata XML into fields to prefill a create call. Does not create a record or fetch remotely. | ✓ | ✓ | ✓ |

#### Organizations & members

Organizations, members, SSO connections, SCIM endpoints and verified domains have no
proto/gRPC or REST RPCs — they are **GraphQL only**. Types are declared directly in the
Go SDK (not proto-generated): `Organization`, `OrgMember`, `CreateOrganizationRequest`,
`ListOrganizationsRequest`, etc.

| Method               | Description                                          | grpc | rest | gql |
| --------------------- | ----------------------------------------------------| :--: | :--: | :-: |
| `CreateOrganization`  | Create an organization. `Name` must be a unique, URL-safe slug. | | | ✓ |
| `UpdateOrganization`  | Update an organization.                              |  |  | ✓ |
| `DeleteOrganization`  | **Delete an organization** and its memberships/connections. |  |  | ✓ |
| `GetOrganization`     | Get a single organization by id.                     |  |  | ✓ |
| `Organizations`       | List organizations (paginated).                      |  |  | ✓ |
| `AddOrgMember`        | Add a user to an organization.                       |  |  | ✓ |
| `RemoveOrgMember`     | Remove a user from an organization.                  |  |  | ✓ |
| `OrgMembers`          | List an organization's members (paginated).          |  |  | ✓ |
| `UserOrganizations`   | List a user's organizations, with per-org roles (paginated). |  |  | ✓ |

`Organizations`, `OrgMembers` and `OrgDomains` (below) take pagination via this SDK's own
`*PaginationRequest` type directly on the request — a single level, matching the proto
shape everywhere else in the SDK:

```go
res, err := admin.Organizations(&authorizer.ListOrganizationsRequest{
    Pagination: &authorizer.PaginationRequest{Limit: 20, Page: 1},
})

members, err := admin.OrgMembers(&authorizer.ListOrgMembersRequest{
    OrgID:      "org_123",
    Pagination: &authorizer.PaginationRequest{Limit: 20, Page: 1},
})
```

#### Org SSO connections (OIDC & SAML)

Upstream SSO an organization's members sign in through. **GraphQL only.**

| Method                       | Description                                                              | grpc | rest | gql |
| ------------------------------ | ------------------------------------------------------------------------| :--: | :--: | :-: |
| `CreateOrgOIDCConnection`    | Create an org's upstream OIDC SSO connection.                            |  |  | ✓ |
| `UpdateOrgOIDCConnection`    | Update it. Supplying `ClientSecret` rotates it; omitting leaves it intact. |  |  | ✓ |
| `DeleteOrgOIDCConnection`    | **Delete it.** SSO logins through it stop working immediately.           |  |  | ✓ |
| `GetOrgOIDCConnection`       | Get it by id or by org id (supply exactly one).                          |  |  | ✓ |
| `CreateOrgSAMLConnection`    | Create an org's upstream SAML SSO connection.                            |  |  | ✓ |
| `UpdateOrgSAMLConnection`    | Update it. Supplying `IdpCertificate` replaces it; omitting leaves it intact. |  |  | ✓ |
| `DeleteOrgSAMLConnection`    | **Delete it.** SSO logins through it stop working immediately.           |  |  | ✓ |
| `GetOrgSAMLConnection`       | Get it by id or by org id (supply exactly one).                          |  |  | ✓ |

#### SCIM provisioning

**GraphQL only.**

| Method              | Description                                                                    | grpc | rest | gql |
| -------------------- | --------------------------------------------------------------------------------| :--: | :--: | :-: |
| `CreateScimEndpoint` | Provision a SCIM endpoint for an organization. The bearer token is returned **once**. |  |  | ✓ |
| `RotateScimToken`    | Rotate the SCIM endpoint's bearer token. New token returned once; old one stops validating. |  |  | ✓ |
| `DeleteScimEndpoint` | **Delete an organization's SCIM endpoint.** The IdP's provisioning token stops working immediately. |  |  | ✓ |
| `GetScimEndpoint`    | Get an organization's SCIM endpoint (the bearer token is never returned).      |  |  | ✓ |

#### Org domains (home realm discovery)

Verified DNS-domain-to-organization mappings used for home realm discovery. **GraphQL only.**

| Method                 | Description                                                                                     | grpc | rest | gql |
| ------------------------ | --------------------------------------------------------------------------------------------------| :--: | :--: | :-: |
| `RequestOrgDomain`     | Start domain verification, returning the DNS TXT record the tenant must publish to prove control. |  |  | ✓ |
| `VerifyOrgDomain`      | Check the DNS TXT challenge and, if satisfied, verify the domain.                                  |  |  | ✓ |
| `AddVerifiedOrgDomain` | Directly register a verified domain, bypassing the DNS TXT challenge. Super-admin only.            |  |  | ✓ |
| `DeleteOrgDomain`      | **Remove a verified domain.** Logins relying on it for home realm discovery stop resolving to the org. |  |  | ✓ |
| `OrgDomains`           | List an organization's verified domains (paginated).                                               |  |  | ✓ |

```go
domains, err := admin.OrgDomains(&authorizer.ListOrgDomainsRequest{
    OrgID:      "org_123",
    Pagination: &authorizer.PaginationRequest{Limit: 20, Page: 1},
})
```

#### GraphQL-only extras

These are the only admin operations with no proto RPC, so they work **over GraphQL only**:

| Method            | Description                          |
| ----------------- | ------------------------------------ |
| `AdminSignup`     | Bootstrap the first admin.           |
| `UpdateEnv`       | **Deprecated server-side** — v2 configures everything via CLI flags; the resolver always errors. |
| `GenerateJWTKeys` | Generate a new JWT signing key pair. |
