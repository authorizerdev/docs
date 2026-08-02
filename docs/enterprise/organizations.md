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

Organization create/update/delete/list stay super-admin-only (`x-authorizer-admin-secret` header or the `authorizer.admin` cookie) — only the platform operator provisions/deprovisions tenants. Fetching a single org and all member-management ops are **org-scoped-admin gated**: super-admin, or that org's `authorizer:org_admin` member (see [Org-scoped admin](#org-scoped-admin) below).

| Operation | Type | Purpose | Who can call |
|-----------|------|---------|---------------|
| `_create_organization` | mutation | Create an org (`name` slug must be unique and URL-safe) | Super-admin only |
| `_update_organization` | mutation | Update `name`, `display_name`, `enabled` | Super-admin only |
| `_delete_organization` | mutation | Delete the org | Super-admin only |
| `_organization` | query | Fetch one org by `id` | Super-admin or that org's `authorizer:org_admin` |
| `_organizations` | query | Paginated list of all orgs | Super-admin only |
| `_add_org_member` | mutation | Add a user as member with optional per-org roles | Super-admin or that org's `authorizer:org_admin` |
| `_remove_org_member` | mutation | Remove a member | Super-admin or that org's `authorizer:org_admin` |
| `_org_members` | query | Paginated member list for an org | Super-admin or that org's `authorizer:org_admin` |

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
    org_members {
      user_id
      roles
      created_at
      email
      given_name
      family_name
    }
  }
}
```

**Organization member fields**

| Field        | Type     | Description |
| ------------ | -------- | ----------- |
| `user_id`    | `string` | The user's unique identifier |
| `roles`      | `[string]` | Per-organization roles assigned to this member |
| `created_at` | `string` | Timestamp when the membership was created |
| `email`      | `string` | User's email (may be empty if the user no longer exists) |
| `given_name` | `string` | User's first name (may be empty if the user no longer exists) |
| `family_name` | `string` | User's last name (may be empty if the user no longer exists) |

```graphql
mutation {
  _remove_org_member(params: { org_id: "ORG_ID", user_id: "USER_ID" }) {
    message
  }
}
```

Notes:

- Membership is unique per `(org_id, user_id)` — adding the same user twice is rejected.
- Per-org roles are independent across orgs: the same user can be `admin` in one org and `viewer` in another. These are your app's own roles — not to be confused with the reserved `authorizer:org_admin` role below.
- SSO JIT provisioning and SCIM provisioning create memberships automatically; `_add_org_member` is for manual/back-office management.

## Org-scoped admin

A member holding the reserved, namespaced role **`authorizer:org_admin`** can self-manage that one org's SSO/SCIM/domain settings — [SAML](./org-saml), [OIDC](./org-sso-oidc), [SCIM](./scim), and [verified domains](./org-domains) — without the platform super-admin secret. Every gated operation passes when the caller is either a platform super-admin, or an authenticated member whose `OrgMembership` for that org includes this exact role string.

It is intentionally namespaced (not the bare `admin`) so it can never collide with your app's own per-org roles — granting a member `roles: ["admin"]` for your app's own purposes does **not** give them org-scoped admin rights.

Grant it like any other per-org role, via `_add_org_member` (or by adding it to an existing member's `roles`):

```graphql
mutation {
  _add_org_member(
    params: {
      org_id: "ORG_ID"
      user_id: "USER_ID"
      roles: ["authorizer:org_admin"]
    }
  ) {
    id
    org_id
    user_id
    roles
  }
}
```

Scope of what this grants:

- **Org create, update, delete, and the all-orgs list (`_organizations`) remain super-admin-only** — an org-admin can never provision/deprovision tenants or see other orgs.
- An org-admin can manage members of **their own org only** (including granting `authorizer:org_admin` to another member of that org) — never another org's membership.
- A non-super-admin caller cannot remove an org's last `authorizer:org_admin` member, so an org can't accidentally lock itself out of self-service (a super-admin can always recover it).
- Bootstrapping an org's first `authorizer:org_admin` still requires a super-admin, via `_create_organization` followed by `_add_org_member`.
