---
sidebar_position: 6
title: SCIM 2.0 Provisioning
---

# SCIM 2.0 Provisioning

Authorizer exposes a per-[organization](./organizations) inbound **SCIM 2.0** (RFC 7644) endpoint so enterprise directories (Okta, Microsoft Entra ID, OneLogin, …) can provision and deprovision that org's users automatically.

- Base URL: `https://your-authorizer.example/scim/v2`
- Authentication: `Authorization: Bearer <endpoint token>` — one token per org
- Media type: `application/scim+json`; errors use the SCIM error schema

The organization is resolved **solely from the bearer token** — never from the URL or request body — so one org's token can never touch another org's users. A missing, malformed, or wrong token is a constant-time `401`.

## Create the endpoint (admin API)

All the ops below accept a super-admin, or that org's `authorizer:org_admin` member — see [Org-scoped admin](./organizations#org-scoped-admin).

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
| `/scim/v2/Users` | GET | Single-term filter over `userName`, `emails.value`, `name.givenName`, `name.familyName`, `active`, `externalId` (see [Filter operators](#filter-operators)), with `startIndex`/`count` pagination. An unfiltered list returns an empty set — full org enumeration is out of scope |
| `/scim/v2/Users/{id}` | GET | Fetch one user |
| `/scim/v2/Users/{id}` | PUT | Replace mutable profile fields + `active` flag |
| `/scim/v2/Users/{id}` | PATCH | Partial update — see [User PATCH](#user-patch) for the supported attributes |
| `/scim/v2/Users/{id}` | DELETE | Treated as deactivation (`active: false`) |
| `/scim/v2/Groups` | POST | Create a group in the org (see [Group provisioning](#group-provisioning)) |
| `/scim/v2/Groups` | GET | Only the `displayName eq "..."` filter (case-insensitive). An unfiltered list, or any other operator, is unsupported |
| `/scim/v2/Groups/{id}` | GET | Fetch one group, with resolved `members` |
| `/scim/v2/Groups/{id}` | PUT | Replace `displayName` and set membership to exactly the posted `members` |
| `/scim/v2/Groups/{id}` | PATCH | Partial update to `displayName`/`externalId` plus member add/remove/replace |
| `/scim/v2/Groups/{id}` | DELETE | Remove the group and its FGA membership tuples |
| `/scim/v2/ServiceProviderConfig`, `/ResourceTypes`, `/Schemas` | GET | SCIM discovery documents |

Notes:

- `userName` is required on create; if the IdP omits it, the primary email is used as `userName`.
- `externalId` is stored and round-tripped, so the IdP can correlate its own IDs.
- Group operations return `501` (`group provisioning is not enabled on this server`) if the org has no [FGA](../core/fga-guide) authorization engine configured — group membership is stored as FGA tuples, not a database column.

## Filter operators

`GET` list filters are single-term only — compound filters (`and`/`or`/`not`), value-path filters (`emails[type eq "work"]`), and ordering operators (`gt`/`lt`/…) are not supported and return `400 invalidFilter`, never a silent empty `200` (a connector reads an empty `200` as "does not exist" and duplicates the create).

| Resource | Attributes | Operators |
|----------|-----------|-----------|
| `/scim/v2/Users` | `userName`, `emails.value`, `name.givenName`, `name.familyName`, `active`, `externalId` | `eq`, `ne`, `co`, `sw`, `pr` (`co`/`sw` rejected on `active` — meaningless on a boolean) |
| `/scim/v2/Groups` | `displayName` | `eq` only |

Notes:

- `eq` on `userName`/`emails.value`/`externalId` (Users) and `displayName` (Groups) is an indexed lookup — the dedup probe an IdP sends before every create. Every other operator/attribute combination falls back to a bounded in-app scan of the org's members (capped at 1,000 scanned memberships, paged 100 at a time) so a very large org can't turn a filter into unbounded work.
- String comparisons are case-insensitive, matching SCIM's default `caseExact:false` for these attributes.
- `startIndex`/`count` (RFC 7644 §3.4.2.4) paginate the Users list response; Groups list only ever returns 0 or 1 resource (the `displayName eq` match), so pagination params are not applicable there.

## User PATCH {#user-patch}

`PATCH /scim/v2/Users/{id}` supports `add`/`replace` operations (treated identically for these single-valued attributes) on:

| Path | Effect |
|------|--------|
| `active` | Deactivate/reactivate — see [Deprovisioning semantics](#deprovisioning-semantics) |
| `name.givenName`, `name.familyName` | Update the profile name |
| `userName`, `emails` / `emails[type eq "..."].value` | Update the user's email (uniqueness-checked — `409` if another user already holds it) |
| `phoneNumber`, `phoneNumbers` / `phoneNumbers[...].value` | Update the phone number (uniqueness-checked) |
| `externalId` | Update the correlation id |

Both the path-qualified shape (`{"op":"replace","path":"active","value":false}`) and the no-path attribute-map shape (`{"op":"replace","value":{"active":false,"name":{"givenName":"Jonathan"}}}`) are accepted, since Okta and Entra don't send the same one. `remove` ops and any path this server doesn't model (e.g. enterprise-extension attributes like `manager`/`department`) are silently skipped rather than rejected, so a connector that also syncs unsupported attributes doesn't fail the whole request. A patch that changes nothing returns the resource unchanged and fires no webhook.

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

## Group provisioning

SCIM Groups (RFC 7643 §4.2) provision org-scoped groups whose membership drives both authorization and SAML assertions. A group carries only identity/metadata (`displayName`, `externalId`, timestamps) — membership is **not** a database column. It's modelled as [FGA](../core/fga-guide) relationship tuples (`group:<org>/<id>#member@user:<uid>`), the same graph that resolves roles and nested groups, so the group→role grant and the SAML group projection are both just reads of that one graph.

- **Cross-org isolation (H6)**: a group is only visible/mutable through the SCIM connection whose org it belongs to; a cross-org group id resolves to `404`, indistinguishable from a nonexistent one.
- **`displayName` uniqueness** is enforced per-org at the service layer (not a DB constraint, for identical behavior across every storage backend) — a create that collides on `displayName` with no matching `externalId` gets `409 uniqueness`.
- **`displayName` matching is case-insensitive** (SCIM `caseExact:false`, RFC 7644 §3.4.2.2): filtering for `displayname eq "engineers"` finds a group stored as `"Engineers"`, and returns it with its stored casing.
- **`externalId` correlation**: a create carrying an `externalId` that already identifies a group in the org is idempotent — it adopts a `displayName` rename and syncs members (`200`) instead of creating a duplicate (`201`).
- **Pagination / safety valve**: the `displayName` lookup scans the org's groups (paged internally, not a single unbounded query) up to a **100,000-group safety valve** per org — a circuit-breaker against pathological orgs, not a realistic ceiling on group count. Reading a group's `members` similarly pages through the underlying FGA tuples 100 at a time.
- **Deleting a group** removes its row and every membership tuple pointing at it; role→group bindings (`role:.../r#assignee@group:.../g#member`) are left for an admin to clean up via `_fga_delete_tuples` if desired — group ids are UUIDs and never reused, so a dangling binding simply resolves to nobody.

### PATCH operations on Groups

`PATCH /scim/v2/Groups/{id}` supports:

| Path | Op | Effect |
|------|----|--------|
| `displayName` | `add`/`replace` | Rename (uniqueness-checked) |
| `externalId` | `add`/`replace` | Update the correlation id |
| `members` (or `members[value eq "..."]`) | `add` | Add the listed users to the group |
| `members` (or `members[value eq "..."]`) | `remove` | Remove the listed users |
| `members` | `remove`, no member list | **Clear every member** (the unfiltered "empty this group" shape IdPs send when deprovisioning a group) |
| `members` | `replace` | Set membership to exactly the posted list (an empty list clears every member) |

Both the RFC/Okta filtered-path shape (`{"op":"remove","path":"members[value eq \"<id>\"]"}`) and Entra's non-RFC shape (`{"op":"remove","path":"members","value":[{"value":"<id>"}]}`) are accepted, along with the no-path attribute-map shape. Every added member must already be an org member — a user id from outside the org is silently skipped, never written as a tuple. A `PATCH` op targeting an unsupported path (e.g. `emails`, `name.givenName`) returns `400 invalidPath`, never a silent no-op `200`.

### Role and SAML projection

Group membership isn't read directly by clients — it's projected into two places at session-issuance time:

- **OpenFGA roles**: a role granted to a group (`role:<org>/<name>#assignee@group:<org>/<gid>#member`) is resolved transitively for every member and unioned onto the roles already minted into that org's session/JWT — see the [FGA guide](../core/fga-guide) for the tuple model (in particular [groups as subjects](../core/fga-guide#groups-as-subjects)). This only ever *adds* roles; a lookup failure derives none rather than blocking login.
- **SAML group assertions**: when Authorizer acts as an [IdP](./saml-idp), a user's groups *in the org the assertion is being issued for* are resolved and emitted as a multi-valued attribute (`groups` by default) — see [Group assertion](./saml-idp#group-assertion-scim-groups--saml-groups).

Both projections are org-namespaced and fail closed: a user who belongs to groups/roles in other orgs never leaks them into a token or assertion issued for this org, and any FGA lookup error yields nothing rather than a partial or wrongly-scoped set.

### Example: create and patch a group

```bash
curl -s -X POST https://your-authorizer.example/scim/v2/Groups \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    "displayName": "Engineers",
    "externalId": "grp-eng",
    "members": [{ "value": "<authorizer-user-id>" }]
  }'
```

```bash
curl -s -X PATCH https://your-authorizer.example/scim/v2/Groups/<group-id> \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
    "Operations": [
      { "op": "add", "path": "members", "value": [{ "value": "<another-user-id>" }] }
    ]
  }'
```

## Provisioning webhooks

Every SCIM lifecycle event fires an [event webhook](../core/graphql-api#webhooks) (configured via `_add_webhook`, keyed to one of the event names below), so a customer's own audit/automation pipeline can react to IdP-driven changes without polling:

| Event | Fires when |
|-------|-----------|
| `user.provisioned` | An IdP creates a user via SCIM |
| `user.deprovisioned` | An IdP deactivates a user (`active:false` PATCH/PUT, or `DELETE`) |
| `user.scim_updated` | An IdP changes a user's attributes via SCIM (name/email/phone/externalId, or reactivation) |
| `group.created` | An IdP creates a group via SCIM |
| `group.updated` | An IdP changes a group's `displayName`/`externalId` or membership |
| `group.deleted` | An IdP deletes a group via SCIM |

Delivery is **asynchronous** — fired off the request path after the SCIM operation commits, so a slow or unreachable webhook endpoint never delays or fails the IdP's HTTP response. Delivery is best-effort per webhook (one bad endpoint doesn't block the others) and logged.

Payload shape:

- User events: `{ "webhook_id", "event_name", "event_description", "user": { ...full user object... } }`
- Group events: `{ "webhook_id", "event_name", "event_description", "group": { "id", "org_id", "display_name", "external_id" } }` — note the key is `group`, not `user`, and it carries only identity fields (no members list); `external_id` is de-namespaced back to the raw IdP value.

Every delivery carries an `X-Authorizer-Signature` header (HMAC-SHA256 over the raw JSON body, keyed on the client secret) so the receiver can verify authenticity.

## IdP configuration pointers

- **Okta** — add a SCIM 2.0 provisioning integration; set the SCIM connector base URL to `https://your-authorizer.example/scim/v2`, authentication mode *HTTP Header* with the bearer token, and enable Create/Update/Deactivate users.
- **Microsoft Entra ID (Azure AD)** — in an enterprise application's *Provisioning* settings, set the Tenant URL to `https://your-authorizer.example/scim/v2` and the Secret Token to the endpoint token, then test the connection. Entra's deprovision flow (`PATCH active:false`) is fully supported and revokes sessions immediately.

Rotate the token with `_rotate_scim_token` and update the IdP's secret whenever it may have been exposed.
