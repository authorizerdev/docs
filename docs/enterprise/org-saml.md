---
sidebar_position: 4
title: Per-Org SAML 2.0 SSO
---

# Per-Organization SAML 2.0 SSO (Service Provider)

For [organizations](./organizations) whose IdP speaks [SAML 2.0](https://www.oasis-open.org/standard/saml/) (Okta, Microsoft Entra ID, ADFS, …), Authorizer acts as a **SAML Service Provider (SP)** per org. Users authenticate at the corporate IdP; Authorizer validates the signed assertion, JIT-provisions the user, and issues a normal Authorizer session.

## Endpoints (per org)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/oauth/saml/{org_slug}/metadata` | GET | SP metadata XML — import this at the IdP |
| `/oauth/saml/{org_slug}/login` | GET | Start an SP-initiated login (sends the AuthnRequest via HTTP-Redirect) |
| `/oauth/saml/{org_slug}/acs` | POST | Assertion Consumer Service — the IdP posts the SAML response here |

## Setup

All the admin ops below accept a super-admin, or that org's `authorizer:org_admin` member — see [Org-scoped admin](./organizations#org-scoped-admin).

### 1. Collect the IdP's details

From the org's IdP you need: the **entity ID** (the assertion `Issuer`), the **SSO URL** (HTTP-Redirect binding), and the **X.509 signing certificate** (PEM).

### 2. Create the connection (admin API)

```graphql
mutation {
  _create_org_saml_connection(
    params: {
      org_id: "ORG_ID"
      name: "Acme ADFS"
      idp_entity_id: "http://adfs.acme.com/adfs/services/trust"
      idp_sso_url: "https://adfs.acme.com/adfs/ls/"
      idp_certificate: "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
      # sp_entity_id / acs_url: optional overrides; derived from the request
      # host when omitted:
      #   sp_entity_id → https://{host}/oauth/saml/{org_slug}/metadata
      #   acs_url      → https://{host}/oauth/saml/{org_slug}/acs
      # attribute_mapping: optional JSON, e.g.
      #   "{\"email\":\"email\",\"given_name\":\"firstName\"}"
      # allow_idp_initiated: defaults to false (SP-initiated only)
    }
  ) {
    id
    org_id
    idp_entity_id
    sp_entity_id
    acs_url
    is_active
  }
}
```

Related operations: `_update_org_saml_connection` (supplying `idp_certificate` replaces it; omitting leaves it intact), `_delete_org_saml_connection`, `_org_saml_connection` (fetch by `id` **or** `org_id`). The IdP certificate is accepted on write but never projected back.

The `idp_entity_id` is globally unique across all trusted issuers — a SAML IdP cannot shadow an OIDC or client-assertion issuer registered at the same value.

### 3. Register the SP at the IdP

Import the SP metadata from `/oauth/saml/{org_slug}/metadata`, or configure manually with the `sp_entity_id` (Audience) and `acs_url` (Recipient/Destination) shown in the connection.

### 4. Start a login from your app

```
GET https://your-authorizer.example/oauth/saml/{org_slug}/login
      ?redirect_uri=https://app.example.com/dashboard
      &state=RANDOM_STATE
```

`redirect_uri` is required and validated against `--allowed-origins`. On success Authorizer sets its session cookie and redirects back to `redirect_uri` with `state` — identical app-side behavior to the [OIDC broker](./org-sso-oidc).

## Attribute mapping & JIT provisioning

The **NameID is always the federated subject**; federated identity is keyed by `(org_id, IdP entity ID, NameID)` — never by email, so an email collision with an existing account is rejected fail-closed rather than linked. First-time users are created and added as org members automatically.

Profile attributes are extracted using the connection's `attribute_mapping` (Authorizer field → SAML attribute name). Defaults:

| Authorizer field | Default SAML attribute |
|------------------|------------------------|
| `email` | `email` |
| `given_name` | `firstName` |
| `family_name` | `lastName` |
| `nickname` | `displayName` |
| `picture` | `picture` |

## Security model

Enforced at the ACS (via the vetted `crewjam/saml` library plus explicit checks):

- **Signature over the consumed assertion** — the XML-DSIG is validated on the same `<Assertion>` element that is consumed (or a Response signature covering it), defeating XML Signature Wrapping (XSW). Signatures validate **only** against the org's pinned IdP certificate.
- **Unsigned assertions are rejected.**
- **Audience / Recipient / Destination** must match this org's SP entity ID and ACS URL — an assertion minted for Org B cannot be consumed at Org A.
- **`NotBefore` / `NotOnOrAfter`** validated with bounded clock skew.
- **Single-use AssertionID** — consumed assertion IDs are cached until expiry; replays are rejected.
- **InResponseTo** — SP-initiated responses must match a pending AuthnRequest; `RelayState` is an opaque single-use handle, never trusted as a redirect URL. The final app redirect is validated against `--allowed-origins`.
- ACS successes and failures are audited; internal errors are never echoed to the caller.

### IdP-initiated SSO

Disabled by default. Set `allow_idp_initiated: true` only if the org's IdP cannot do SP-initiated flows: enabling it disables InResponseTo validation for **all** responses on that connection (a library limitation), leaving replay defense solely to the single-use AssertionID cache.

### AuthnRequest signing

AuthnRequests are currently emitted unsigned (HTTP-Redirect binding). All SP-side assertion security is enforced at the ACS; request signing protects the IdP against forged requests and is a future upgrade.

## Acting as an IdP instead?

This page covers Authorizer as the **SP** (consuming assertions from an org's upstream corporate IdP). Authorizer can also act as a **SAML IdP** — issuing signed assertions to downstream Service Providers like Zendesk or Salesforce, per org. See [SAML 2.0 Identity Provider](./saml-idp).
