---
sidebar_position: 4
title: SCIM 2.0 Provisioning
---

# SCIM 2.0 Provisioning

Authorizer exposes a per-[organization](./organizations) inbound **SCIM 2.0** (RFC 7644) endpoint so enterprise directories (Okta, Microsoft Entra ID, OneLogin, …) can provision and deprovision that org's users automatically.

- Base URL: `https://your-authorizer.example/scim/v2`
- Authentication: `Authorization: Bearer <endpoint token>` — one token per org
- Media type: `application/scim+json`; errors use the SCIM error schema

The organization is resolved **solely from the bearer token** — never from the URL or request body — so one org's token can never touch another org's users. A missing, malformed, or wrong token is a constant-time `401`.

## Create the endpoint (admin API)

One SCIM endpoint per org, keyed by `org_id`:

```graphql
mutation {
  _create_scim_endpoint(params: { org_id: "ORG_ID" }) {
    scim_endpoint {
      id
      org_id
      enabled
    }
    token # the bearer credential — shown ONCE, store it now
  }
}
```

The token is high-entropy and stored only as a hash; like client secrets, it is returned **once** at creation and once at rotation, never again.

| Operation | Type | Purpose |
|-----------|------|---------|
| `_create_scim_endpoint` | mutation | Create the org's endpoint; returns the token once |
| `_rotate_scim_token` | mutation | Invalidate the old token, return a new one once |
| `_delete_scim_endpoint` | mutation | Remove the endpoint |
| `_scim_endpoint` | query | Fetch the endpoint record (never the token) |

All keyed by `org_id`.

## Supported SCIM surface

| Route | Method | Behavior |
|-------|--------|----------|
| `/scim/v2/Users` | POST | Create (JIT-provision) a user in the org |
| `/scim/v2/Users` | GET | Only the `userName eq "..."` filter (the IdP dedup probe). An unfiltered list returns an empty set — full org enumeration is out of scope |
| `/scim/v2/Users/{id}` | GET | Fetch one user |
| `/scim/v2/Users/{id}` | PUT | Replace mutable profile fields + `active` flag |
| `/scim/v2/Users/{id}` | PATCH | Partial update, including `active` transitions |
| `/scim/v2/Users/{id}` | DELETE | Treated as deactivation (`active: false`) |
| `/scim/v2/ServiceProviderConfig`, `/ResourceTypes`, `/Schemas` | GET | SCIM discovery documents |

Groups are not yet implemented.

Notes:

- `userName` is required on create; if the IdP omits it, the primary email is used as `userName`.
- `externalId` is stored and round-tripped, so the IdP can correlate its own IDs.

## Deprovisioning semantics

Deactivation is the enterprise-offboarding path and is **synchronous**:

- `PATCH {"active": false}` (or `DELETE`) marks the user revoked and **immediately revokes their sessions and refresh tokens** — a still-held access token fails introspection and cannot be refreshed.
- A user provisioned with `active: false` is deprovisioned from birth (no token can ever be issued).
- `active: true` reactivates the account.

## Example: provision a user

```bash
curl -s -X POST https://your-authorizer.example/scim/v2/Users \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
    "userName": "jane@acme.com",
    "externalId": "00u1abcd",
    "name": { "givenName": "Jane", "familyName": "Doe" },
    "emails": [{ "value": "jane@acme.com", "primary": true }],
    "active": true
  }'
```

Dedup probe (what Okta/Entra send before creating):

```bash
curl -s -G https://your-authorizer.example/scim/v2/Users \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  --data-urlencode 'filter=userName eq "jane@acme.com"'
```

## IdP configuration pointers

- **Okta** — add a SCIM 2.0 provisioning integration; set the SCIM connector base URL to `https://your-authorizer.example/scim/v2`, authentication mode *HTTP Header* with the bearer token, and enable Create/Update/Deactivate users.
- **Microsoft Entra ID (Azure AD)** — in an enterprise application's *Provisioning* settings, set the Tenant URL to `https://your-authorizer.example/scim/v2` and the Secret Token to the endpoint token, then test the connection. Entra's deprovision flow (`PATCH active:false`) is fully supported and revokes sessions immediately.

Rotate the token with `_rotate_scim_token` and update the IdP's secret whenever it may have been exposed.
