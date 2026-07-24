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
> `fgaWriteModel` (overwrites the model), `fgaDeleteTuples`, `fgaReset` (wipes all FGA
> data), `deleteClient`, `rotateClientSecret` (invalidates the old secret immediately),
> `deleteTrustedIssuer`, `deleteOrganization`, `removeOrgMember`, `deleteOrgOIDCConnection`,
> `deleteOrgSAMLConnection`, `deleteSAMLServiceProvider`, `retireSAMLIDPKey`,
> `deleteScimEndpoint`, `rotateScimToken` (invalidates the old token immediately), and
> `deleteOrgDomain` permanently change, remove, or invalidate data.

> **Pagination shape:** the paginated list methods (`users`, `verificationRequests`,
> `webhooks`, `webhookLogs`, `emailTemplates`, `auditLogs`, `clients`, `trustedIssuers`,
> `organizations`, `orgMembers`, `userOrganizations`, `listSAMLServiceProviders`,
> `orgDomains`, …) take pagination fields (`limit`, `page`) directly on the params object —
> e.g. `admin.webhooks({ limit: 10 })`. There is no `pagination` wrapper. If you have older
> code written as `admin.webhooks({ pagination: { limit: 10 } })`, drop the wrapper.

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

#### OAuth clients (service accounts / M2M)

Registered OAuth clients used by the `client_credentials` and RFC 8693 token-exchange grants
(see [`getToken`](/sdks/authorizer-js/functions#--gettoken)). `client_secret` is returned
exactly once, at creation and at rotation, and is never projected back afterwards.

| Method                | Description                                             | rest | gql |
| ----------------------- | ---------------------------------------------------------- | :--: | :-: |
| `createClient`         | Register a new OAuth client / service account.            | ✓ | ✓ |
| `updateClient`         | Update a client's name, description, scopes, or active state. | ✓ | ✓ |
| `deleteClient`         | **Delete a client.**                                       | ✓ | ✓ |
| `rotateClientSecret`   | **Mint a fresh secret; the old one stops working immediately.** | ✓ | ✓ |
| `client`               | Get a single client by id (never includes the secret).     | ✓ | ✓ |
| `clients`              | List clients (paginated).                                  | ✓ | ✓ |

#### Trusted issuers (secretless client authentication)

External token issuers trusted to authenticate a service account via RFC 7523
`client_assertion` (Kubernetes SA tokens, SPIFFE JWT-SVIDs, cloud OIDC tokens) instead of a
shared secret.

| Method                  | Description                                              | rest | gql |
| ------------------------- | ------------------------------------------------------------ | :--: | :-: |
| `addTrustedIssuer`      | Register a trusted issuer for a service account.            | ✓ | ✓ |
| `updateTrustedIssuer`   | Update an existing trusted issuer.                           | ✓ | ✓ |
| `deleteTrustedIssuer`   | **Delete a trusted issuer; its tokens stop authenticating immediately.** | ✓ | ✓ |
| `trustedIssuer`         | Get a single trusted issuer by id.                           | ✓ | ✓ |
| `trustedIssuers`        | List trusted issuers, optionally filtered by service account (paginated). | ✓ | ✓ |

#### Organizations

Tenant grouping of users. Organizations, their SSO connections, SCIM endpoints, and verified
domains have **no REST/proto routes yet** — GraphQL only.

| Method              | Description                                             | rest | gql |
| --------------------- | ------------------------------------------------------------ | :--: | :-: |
| `createOrganization` | Create a new organization.                                   |   | ✓ |
| `updateOrganization` | Update an existing organization.                              |   | ✓ |
| `deleteOrganization` | **Delete an organization.**                                   |   | ✓ |
| `organization`       | Get a single organization by id.                              |   | ✓ |
| `organizations`      | List organizations (paginated).                               |   | ✓ |
| `addOrgMember`       | Add a user to an organization with optional per-org roles.    |   | ✓ |
| `removeOrgMember`    | **Remove a user from an organization.**                       |   | ✓ |
| `orgMembers`         | List an organization's members (paginated).                   |   | ✓ |
| `userOrganizations`  | List the organizations a user belongs to, with roles per org (paginated). |   | ✓ |

#### Org SSO connections

Per-organization upstream identity providers. `createOrgOIDCConnection` brokers Authorizer as
an OIDC Relying Party; `createOrgSAMLConnection` brokers Authorizer as a SAML 2.0 Service
Provider. Upstream secrets/certificates are accepted on write but never projected back.
GraphQL only.

| Method                       | Description                                                       | rest | gql |
| ------------------------------ | ----------------------------------------------------------------------- | :--: | :-: |
| `createOrgOIDCConnection`    | Create a per-org upstream OIDC connection.                              |   | ✓ |
| `updateOrgOIDCConnection`    | Update a per-org upstream OIDC connection.                              |   | ✓ |
| `deleteOrgOIDCConnection`    | **Delete a per-org upstream OIDC connection; SSO stops immediately.**    |   | ✓ |
| `orgOIDCConnection`          | Get a connection by id OR by org_id (supply exactly one).               |   | ✓ |
| `createOrgSAMLConnection`    | Create a per-org upstream SAML connection.                              |   | ✓ |
| `updateOrgSAMLConnection`    | Update a per-org upstream SAML connection.                              |   | ✓ |
| `deleteOrgSAMLConnection`    | **Delete a per-org upstream SAML connection; SSO stops immediately.**    |   | ✓ |
| `orgSAMLConnection`          | Get a connection by id OR by org_id (supply exactly one).               |   | ✓ |

#### SAML IdP (Authorizer as Identity Provider)

The inverse of the org SAML connection above: downstream Service Providers that Authorizer
issues signed SAML assertions to, plus the per-org IdP signing keypairs used to sign them.

| Method                          | Description                                                          | rest | gql |
| ---------------------------------- | -------------------------------------------------------------------------- | :--: | :-: |
| `createSAMLServiceProvider`      | Register a downstream SP.                                                  | ✓ | ✓ |
| `updateSAMLServiceProvider`      | Update a downstream SP's name, endpoints, certificate, mapping, or state.  | ✓ | ✓ |
| `deleteSAMLServiceProvider`      | **Delete a downstream SP; SSO for that SP stops immediately.**             | ✓ | ✓ |
| `samlServiceProvider`            | Get a single downstream SP by id.                                          | ✓ | ✓ |
| `listSAMLServiceProviders`       | List downstream SPs for an org (paginated).                                | ✓ | ✓ |
| `rotateSAMLIDPCert`              | Generate a new current signing keypair for an org's SAML IdP.              | ✓ | ✓ |
| `retireSAMLIDPKey`               | **Retire a published-but-superseded key (cannot retire the current key).** | ✓ | ✓ |
| `listSAMLIDPKeys`                | List all SAML IdP signing keys for an org (unpaginated).                   | ✓ | ✓ |
| `importSAMLSPMetadata`           | Parse pasted SP metadata XML into entity_id/acs_url/certificate (does not create a record). | ✓ | ✓ |

#### SCIM endpoints

Per-org inbound SCIM 2.0 provisioning credential. The bearer token is returned exactly once,
at creation and at rotation, and is never projected back afterwards. GraphQL only.

| Method                | Description                                                     | rest | gql |
| ------------------------ | ---------------------------------------------------------------------- | :--: | :-: |
| `createScimEndpoint`   | Provision the org's inbound SCIM endpoint.                            |   | ✓ |
| `rotateScimToken`      | **Mint a fresh bearer token; the old one stops working immediately.**  |   | ✓ |
| `deleteScimEndpoint`   | **Remove the org's SCIM endpoint; inbound provisioning stops immediately.** |   | ✓ |
| `scimEndpoint`         | Get the org's SCIM endpoint (never includes the token).                |   | ✓ |

#### Org verified domains

Verified DNS-domain-to-organization mappings used for home-realm discovery. GraphQL only.

| Method                  | Description                                                          | rest | gql |
| --------------------------| --------------------------------------------------------------------------| :--: | :-: |
| `requestOrgDomain`      | Start domain verification, returning the DNS TXT challenge to publish.  |   | ✓ |
| `verifyOrgDomain`       | Check the published DNS challenge and record the verified domain.       |   | ✓ |
| `addVerifiedOrgDomain`  | Record a verified domain without a DNS challenge (super-admin only).    |   | ✓ |
| `deleteOrgDomain`       | **Remove a verified domain; home-realm discovery for it stops immediately.** |   | ✓ |
| `orgDomains`            | List an organization's verified domains (paginated).                    |   | ✓ |

#### GraphQL-only extras

These have no REST equivalent and work **over GraphQL only**:

| Method            | Description                          |
| ----------------- | ------------------------------------ |
| `adminSignup`     | Bootstrap the first admin.           |
| `updateEnv`       | Update server environment/config.    |
| `generateJWTKeys` | Generate a new JWT signing key pair. |
