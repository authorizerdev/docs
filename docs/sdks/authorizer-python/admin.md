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
> `fga_write_model` (overwrites the model), `fga_delete_tuples`, `fga_reset` (wipes all
> FGA data), `delete_client`, `rotate_client_secret`/`rotate_scim_token` (invalidate the
> old secret/token), `delete_trusted_issuer`, `delete_organization`,
> `delete_org_oidc_connection`/`delete_org_saml_connection`, `delete_saml_service_provider`,
> `retire_saml_idp_key`, `delete_org_domain`, and `delete_scim_endpoint` permanently change
> or remove data — see each method's note below.

#### Auth, session & meta

| Method          | Description                              | grpc | rest | gql |
| --------------- | ---------------------------------------- | :--: | :--: | :-: |
| `admin_login`   | Exchange the admin secret for a session. | ✓ | ✓ | ✓ |
| `admin_logout`  | End the admin session.                   | ✓ | ✓ | ✓ |
| `admin_session` | Get the current admin session.           | ✓ | ✓ | ✓ |
| `admin_meta`    | Server metadata / feature flags.         | ✓ | ✓ | ✓ |

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
| `fga_get_model`     | Get the current FGA model.               | ✓ | ✓ | ✓ |
| `fga_write_model`   | **Write/overwrite the FGA model.**       | ✓ | ✓ | ✓ |
| `fga_write_tuples`  | Write relationship tuples.               | ✓ | ✓ | ✓ |
| `fga_delete_tuples` | **Delete relationship tuples.**          | ✓ | ✓ | ✓ |
| `fga_read_tuples`   | Read relationship tuples.                | ✓ | ✓ | ✓ |
| `fga_list_users`    | List users with a relation to an object. | ✓ | ✓ | ✓ |
| `fga_expand`        | Expand a relation into its userset.      | ✓ | ✓ | ✓ |
| `fga_reset`         | **Reset all FGA data.**                  | ✓ | ✓ | ✓ |

#### Clients (service accounts / machine identities)

Clients created here authenticate over `/oauth/token` with the `client_credentials` and
token-exchange grants — see [Machine-to-machine & agent delegation](./functions#oauth-rest).

| Method                 | Description                                     | grpc | rest | gql |
| ---------------------- | ------------------------------------------------ | :--: | :--: | :-: |
| `create_client`        | Create a client. `client_secret` is shown **once**. | ✓ | ✓ | ✓ |
| `update_client`        | Update a client.                                | ✓ | ✓ | ✓ |
| `delete_client`        | **Delete a client** — its tokens stop resolving. | ✓ | ✓ | ✓ |
| `rotate_client_secret` | **Rotate a client's secret** (old one invalidated, new one shown once). | ✓ | ✓ | ✓ |
| `get_client`           | Get a single client.                            | ✓ | ✓ | ✓ |
| `clients`              | List clients (paginated).                       | ✓ | ✓ | ✓ |

#### Trusted issuers

External OIDC/JWT issuers Authorizer accepts tokens from (e.g. for federated
machine/agent identities).

| Method                   | Description                              | grpc | rest | gql |
| ------------------------ | ----------------------------------------- | :--: | :--: | :-: |
| `add_trusted_issuer`     | Add a trusted issuer.                    | ✓ | ✓ | ✓ |
| `update_trusted_issuer`  | Update a trusted issuer.                 | ✓ | ✓ | ✓ |
| `delete_trusted_issuer`  | **Delete a trusted issuer** — its tokens stop authenticating. | ✓ | ✓ | ✓ |
| `get_trusted_issuer`     | Get a single trusted issuer.             | ✓ | ✓ | ✓ |
| `trusted_issuers`        | List trusted issuers (paginated).        | ✓ | ✓ | ✓ |

#### SAML Identity Provider

Authorizer acting as a SAML IdP for downstream service providers.

| Method                          | Description                                                        | grpc | rest | gql |
| -------------------------------- | -------------------------------------------------------------------- | :--: | :--: | :-: |
| `create_saml_service_provider`   | Register a downstream SP.                                          | ✓ | ✓ | ✓ |
| `update_saml_service_provider`   | Update a registered SP.                                             | ✓ | ✓ | ✓ |
| `delete_saml_service_provider`   | **Delete a registered SP** — it can no longer be issued assertions. | ✓ | ✓ | ✓ |
| `get_saml_service_provider`      | Get a single registered SP.                                         | ✓ | ✓ | ✓ |
| `list_saml_service_providers`    | List registered SPs (paginated).                                    | ✓ | ✓ | ✓ |
| `rotate_saml_idp_cert`           | Generate a new signing keypair; the previous key stays active.      | ✓ | ✓ | ✓ |
| `retire_saml_idp_key`            | **Retire a signing key** — drops out of IdP metadata; cannot retire the current key. | ✓ | ✓ | ✓ |
| `list_saml_idp_keys`             | List signing keys (`-> list[SAMLIDPKey]`).                          | ✓ | ✓ | ✓ |
| `import_saml_sp_metadata`        | Parse pasted SP metadata XML (no record is created, no URL fetched). | ✓ | ✓ | ✓ |

#### Organizations, org SSO, SCIM and org domains

Multi-tenant organizations, their membership, upstream SSO connections, inbound SCIM
provisioning, and the verified domains that drive home-realm discovery. These were
GraphQL-only until server 2.4.0, which added the proto RPCs and REST bindings — against an
older server they still work over `graphql` only.

Most are authorized for a super-admin **or** that organization's own org-admin (the
reserved `authorizer:org_admin` role); the platform-wide operations (`organizations`,
`create_organization`, `delete_organization`, `add_verified_org_domain`) stay super-admin
only.

| Method | Description | gql | rest | grpc |
| ------ | ----------- | :-: | :--: | :--: |
| `create_organization` | Create an organization. | ✓ | ✓ | ✓ |
| `update_organization` | Update an organization. | ✓ | ✓ | ✓ |
| `delete_organization` | **Delete an organization.** | ✓ | ✓ | ✓ |
| `get_organization` | Get a single organization. | ✓ | ✓ | ✓ |
| `organizations` | List organizations (paginated). | ✓ | ✓ | ✓ |
| `add_org_member` | Add a member to an organization. | ✓ | ✓ | ✓ |
| `remove_org_member` | Remove a member from an organization. | ✓ | ✓ | ✓ |
| `org_members` | List an organization's members. | ✓ | ✓ | ✓ |
| `user_organizations` | List the organizations a user belongs to. | ✓ | ✓ | ✓ |
| `request_org_domain` | Start home-realm-discovery domain verification (DNS challenge). | ✓ | ✓ | ✓ |
| `verify_org_domain` | Verify a requested domain's DNS challenge. | ✓ | ✓ | ✓ |
| `add_verified_org_domain` | Super-admin only: trust-assert a domain as verified, skipping the DNS challenge. | ✓ | ✓ | ✓ |
| `delete_org_domain` | **Delete a verified org domain** — it stops routing logins to the org. | ✓ | ✓ | ✓ |
| `org_domains` | List an organization's verified domains. | ✓ | ✓ | ✓ |
| `create_org_oidc_connection` | Create an org-scoped OIDC SSO connection. | ✓ | ✓ | ✓ |
| `update_org_oidc_connection` | Update an org-scoped OIDC SSO connection. | ✓ | ✓ | ✓ |
| `delete_org_oidc_connection` | **Delete an org-scoped OIDC SSO connection** — members lose this SSO path. | ✓ | ✓ | ✓ |
| `get_org_oidc_connection` | Get an org-scoped OIDC SSO connection. | ✓ | ✓ | ✓ |
| `create_org_saml_connection` | Create an org-scoped SAML SSO connection. | ✓ | ✓ | ✓ |
| `update_org_saml_connection` | Update an org-scoped SAML SSO connection. | ✓ | ✓ | ✓ |
| `delete_org_saml_connection` | **Delete an org-scoped SAML SSO connection** — members lose this SSO path. | ✓ | ✓ | ✓ |
| `get_org_saml_connection` | Get an org-scoped SAML SSO connection. | ✓ | ✓ | ✓ |
| `create_scim_endpoint` | Create a SCIM provisioning endpoint. Bearer token shown **once**. | ✓ | ✓ | ✓ |
| `rotate_scim_token` | **Rotate a SCIM endpoint's bearer token** (old one invalidated, new one shown once). | ✓ | ✓ | ✓ |
| `delete_scim_endpoint` | **Delete a SCIM endpoint** — provisioning stops working. | ✓ | ✓ | ✓ |
| `get_scim_endpoint` | Get a single SCIM endpoint. | ✓ | ✓ | ✓ |

#### Clients (service accounts / machine identities)

Clients created here authenticate over `/oauth/token` with the `client_credentials` and
token-exchange grants — see [Machine-to-machine & agent delegation](./functions#oauth-rest).

| Method                 | Description                                     | grpc | rest | gql |
| ---------------------- | ------------------------------------------------ | :--: | :--: | :-: |
| `create_client`        | Create a client. `client_secret` is shown **once**. | ✓ | ✓ | ✓ |
| `update_client`        | Update a client.                                | ✓ | ✓ | ✓ |
| `delete_client`        | **Delete a client** — its tokens stop resolving. | ✓ | ✓ | ✓ |
| `rotate_client_secret` | **Rotate a client's secret** (old one invalidated, new one shown once). | ✓ | ✓ | ✓ |
| `get_client`           | Get a single client.                            | ✓ | ✓ | ✓ |
| `clients`              | List clients (paginated).                       | ✓ | ✓ | ✓ |

#### Trusted issuers

External OIDC/JWT issuers Authorizer accepts tokens from (e.g. for federated
machine/agent identities).

| Method                   | Description                              | grpc | rest | gql |
| ------------------------ | ----------------------------------------- | :--: | :--: | :-: |
| `add_trusted_issuer`     | Add a trusted issuer.                    | ✓ | ✓ | ✓ |
| `update_trusted_issuer`  | Update a trusted issuer.                 | ✓ | ✓ | ✓ |
| `delete_trusted_issuer`  | **Delete a trusted issuer** — its tokens stop authenticating. | ✓ | ✓ | ✓ |
| `get_trusted_issuer`     | Get a single trusted issuer.             | ✓ | ✓ | ✓ |
| `trusted_issuers`        | List trusted issuers (paginated).        | ✓ | ✓ | ✓ |

#### SAML Identity Provider

Authorizer acting as a SAML IdP for downstream service providers.

| Method                          | Description                                                        | grpc | rest | gql |
| -------------------------------- | -------------------------------------------------------------------- | :--: | :--: | :-: |
| `create_saml_service_provider`   | Register a downstream SP.                                          | ✓ | ✓ | ✓ |
| `update_saml_service_provider`   | Update a registered SP.                                             | ✓ | ✓ | ✓ |
| `delete_saml_service_provider`   | **Delete a registered SP** — it can no longer be issued assertions. | ✓ | ✓ | ✓ |
| `get_saml_service_provider`      | Get a single registered SP.                                         | ✓ | ✓ | ✓ |
| `list_saml_service_providers`    | List registered SPs (paginated).                                    | ✓ | ✓ | ✓ |
| `rotate_saml_idp_cert`           | Generate a new signing keypair; the previous key stays active.      | ✓ | ✓ | ✓ |
| `retire_saml_idp_key`            | **Retire a signing key** — drops out of IdP metadata; cannot retire the current key. | ✓ | ✓ | ✓ |
| `list_saml_idp_keys`             | List signing keys (`-> list[SAMLIDPKey]`).                          | ✓ | ✓ | ✓ |
| `import_saml_sp_metadata`        | Parse pasted SP metadata XML (no record is created, no URL fetched). | ✓ | ✓ | ✓ |

#### GraphQL-only extras

These are the only admin operations with no proto RPC, so they work **over GraphQL only**:

| Method                          | Description                                          |
| --------------------------------- | ------------------------------------------------------- |
| `admin_signup`                    | Bootstrap the first admin.                             |
| `update_env`                      | **Deprecated server-side** — v2 configures everything via CLI flags; the resolver always errors. |
| `generate_jwt_keys`               | Generate a new JWT signing key pair.                   |
