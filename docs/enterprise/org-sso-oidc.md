---
sidebar_position: 2
title: Per-Org OIDC SSO
---

# Per-Organization OIDC SSO (Broker)

Each [organization](./organizations) can bring its own upstream OIDC identity provider (Okta, Microsoft Entra ID, Google Workspace, …). Authorizer acts as the **Relying Party (broker)**: the org's users authenticate at their corporate IdP, and Authorizer JIT-provisions them and issues a normal Authorizer session — your apps keep integrating with Authorizer only.

```
User ──► /oauth/sso/{org_slug}/login ──► upstream IdP /authorize (PKCE + state + nonce)
     ◄── /oauth/sso/{org_slug}/callback ◄── code
Authorizer verifies ID token (JWKS, iss, aud, nonce) ──► JIT provision ──► session cookie
     ──► redirect back to your app (redirect_uri + state)
```

## Setup

### 1. Register Authorizer at the upstream IdP

Create an OIDC app (authorization code flow) at the org's IdP with the redirect URI:

```
https://your-authorizer.example/oauth/sso/{org_slug}/callback
```

Note the issuer URL, client ID, and client secret the IdP gives you.

### 2. Create the connection (admin API)

```graphql
mutation {
  _create_org_oidc_connection(
    params: {
      org_id: "ORG_ID"
      name: "Acme Okta"
      issuer_url: "https://acme.okta.com" # upstream OIDC discovery base
      client_id: "UPSTREAM_CLIENT_ID"     # issued BY the IdP TO Authorizer
      client_secret: "UPSTREAM_SECRET"    # stored encrypted, never returned
      # scopes: defaults to "openid profile email" when omitted
      # redirect_uri: derived from the request host when omitted
    }
  ) {
    id
    org_id
    issuer_url
    sso_client_id
    is_active
  }
}
```

One OIDC connection per org. Related operations:

| Operation | Purpose |
|-----------|---------|
| `_update_org_oidc_connection` | Update fields; supplying `client_secret` rotates it, omitting leaves it intact |
| `_delete_org_oidc_connection` | Remove the connection |
| `_org_oidc_connection` | Fetch by connection `id` **or** by `org_id` (supply exactly one) |

The upstream `client_secret` is never projected back in any response.

### 3. Start a login from your app

Send the org's users to:

```
GET https://your-authorizer.example/oauth/sso/{org_slug}/login
      ?redirect_uri=https://app.example.com/dashboard
      &state=RANDOM_STATE
```

- `redirect_uri` is **required** and must pass the instance's `--allowed-origins` validation.
- `state` is optional and echoed back to your app.

On success, Authorizer sets its session cookie and redirects the browser to your `redirect_uri` with `state` appended. From there, your app uses the normal Authorizer session (GraphQL `session` query, or silent OIDC via `/authorize`). The resulting tokens carry `login_method: "sso"`.

## JIT provisioning

First-time users are created automatically:

- Federated identity is keyed by **`(org_id, issuer, sub)`** — never by email. An upstream assertion whose email merely collides with an existing account is **rejected fail-closed**, not linked (account-takeover defense).
- The user is added as a member of the organization.
- Subsequent logins match the same federated identity and reuse the account.

## Security model

Verified in the broker implementation:

- **PKCE (S256)**, unguessable single-use `state`, and `nonce` on every upstream round trip.
- **Mix-up defense** (RFC 9207): the returned ID token's `iss` must equal the issuer the dispatching connection discovered; an `iss` query parameter, when present, must match too.
- ID token verified against the upstream **JWKS**; `aud` must equal the connection's upstream client ID; asymmetric algorithms only (`RS*/PS*/ES*` — `alg:none` and `HS*` are rejected).
- All upstream fetches (discovery, JWKS, token exchange) use an SSRF-hardened HTTP client — host-pinned, redirects refused, response size capped.
- SSO callbacks are audited (success and failure).

## SAML instead?

If the org's IdP only speaks SAML 2.0, use the [per-org SAML SP](./org-saml) — same org model, same JIT provisioning.
