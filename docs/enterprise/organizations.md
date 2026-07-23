---
sidebar_position: 1
title: Organizations
---

# Organizations

Organizations model tenants (customer companies, teams, business units) inside one Authorizer instance. Each organization has:

- A unique, URL-safe **slug** (`name`) — it appears in per-org SSO URLs like `/oauth/sso/{org_slug}/login`.
- An optional `display_name`.
- An `enabled` flag — a disabled org's SSO and provisioning stop working.
- **Members**: users linked to the org, each with a set of per-organization roles (independent of the user's global roles and of their roles in other orgs).

Organizations are the anchor for the other enterprise features:

| Feature | Attached per org |
|---------|------------------|
| [OIDC SSO broker](./org-sso-oidc) | One upstream OIDC IdP connection |
| [SAML 2.0 SP](./org-saml) | One upstream SAML IdP connection |
| [SCIM 2.0 provisioning](./scim) | One inbound SCIM endpoint + bearer token |
| [Verified domains + Home Realm Discovery](./org-domains) | Many verified email domains, used to route logins to this org's SSO |

Users who sign in through an org's SSO connection are JIT-provisioned and automatically added as members of that organization.

## Admin API

All operations are super-admin GraphQL operations (`x-authorizer-admin-secret` header or the `authorizer.admin` cookie).

| Operation | Type | Purpose |
|-----------|------|---------|
| `_create_organization` | mutation | Create an org (`name` slug must be unique and URL-safe) |
| `_update_organization` | mutation | Update `name`, `display_name`, `enabled` |
| `_delete_organization` | mutation | Delete the org |
| `_organization` | query | Fetch one org by `id` |
| `_organizations` | query | Paginated list |
| `_add_org_member` | mutation | Add a user as member with optional per-org roles |
| `_remove_org_member` | mutation | Remove a member |
| `_org_members` | query | Paginated member list for an org |

### Create an organization

```graphql
mutation {
  _create_organization(
    params: { name: "acme", display_name: "Acme Corp" }
  ) {
    id
    name
    display_name
    enabled
  }
}
```

### Manage members

```graphql
mutation {
  _add_org_member(
    params: {
      org_id: "ORG_ID"
      user_id: "USER_ID"
      roles: ["admin"] # per-org roles; defaults to empty when omitted
    }
  ) {
    id
    org_id
    user_id
    roles
  }
}
```

```graphql
query {
  _org_members(params: { org_id: "ORG_ID" }) {
    pagination { total }
    org_members { user_id roles created_at }
  }
}
```

```graphql
mutation {
  _remove_org_member(params: { org_id: "ORG_ID", user_id: "USER_ID" }) {
    message
  }
}
```

Notes:

- Membership is unique per `(org_id, user_id)` — adding the same user twice is rejected.
- Per-org roles are independent across orgs: the same user can be `admin` in one org and `viewer` in another.
- SSO JIT provisioning and SCIM provisioning create memberships automatically; `_add_org_member` is for manual/back-office management.
