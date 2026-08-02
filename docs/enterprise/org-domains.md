---
sidebar_position: 2
title: Verified Domains & Home Realm Discovery
---

# Verified Domains & Home Realm Discovery

A **verified domain** proves that an [organization](./organizations) controls an email domain (`acme.com`), so a login for `jane@acme.com` can be automatically routed to Acme's SSO connection instead of showing the generic login form. This routing lookup is called **Home Realm Discovery (HRD)**, sometimes called "organization discovery."

## The one rule that matters: domain ≠ membership

A verified domain answers exactly one question — **"which org's SSO should a login for this email route to"** — and nothing else. It never determines:

- **Who is a member.** Membership comes only from an explicit `OrgMember` row (via [`_add_org_member`](./organizations#manage-members), SSO JIT-provisioning, or SCIM). An external consultant `jane@consulting-firm.com` can be a full member of Acme even though `consulting-firm.com` is not a verified Acme domain.
- **Whether login is allowed.** A user whose email domain matches no verified domain is not blocked — they just don't get an SSO redirect, and fall back to whatever their membership already permits (password, social, magic link, or an SSO connection they access some other way).
- **What happens if a member's email domain changes.** Membership and roles are untouched — they were never keyed on the domain string.

Deleting a verified domain only removes the routing hint. It never removes members, and it never revokes access.

## How a domain gets verified

Two methods ship today:

| Method | Who can use it | Proof required | Operation |
|--------|-----------------|-----------------|-----------|
| **DNS TXT challenge** | Org admin (or super-admin) | Publish a TXT record at a specific name | `_request_org_domain` then `_verify_org_domain` |
| **Trusted assert** | Super-admin only | None — the platform operator is already trusted | `_add_verified_org_domain` |

There is no auto-verify-by-owned-mailbox shortcut and no email-OTP-to-domain method in the current release — both were considered during design but did not ship. DNS TXT is the only self-serve proof path; trusted-assert is the operator escape hatch (used by the dashboard's "Add without DNS verification" quick-add for super-admins).

A verified domain is a row **only once proven** — a pending DNS challenge is not a database row, it's a short-lived token in the memory store (~24h TTL) and is never used for routing until it's matched.

## Admin GraphQL operations

All are org-scoped-admin gated (super-admin, or that org's `authorizer:org_admin` member) except `_add_verified_org_domain`, which is super-admin only:

| Operation | Type | Purpose |
|-----------|------|---------|
| `_request_org_domain` | mutation | Mint a DNS TXT challenge for `org_id` + `domain` |
| `_verify_org_domain` | mutation | Check the TXT record and, on match, insert the verified row |
| `_add_verified_org_domain` | mutation | **Super-admin only.** Insert a verified row with no proof (trusted-assert) |
| `_org_domains` | query | Paginated list of an org's verified domains (never another org's) |
| `_delete_org_domain` | mutation | Remove a verified mapping, freeing the domain for re-verification |

### DNS TXT walkthrough

**1. Request a challenge:**

```graphql
mutation {
  _request_org_domain(params: { org_id: "ORG_ID", domain: "acme.com" }) {
    domain
    record_type
    record_name
    record_value
  }
}
```

Response:

```json
{
  "data": {
    "_request_org_domain": {
      "domain": "acme.com",
      "record_type": "TXT",
      "record_name": "_authorizer-challenge.acme.com",
      "record_value": "authorizer-domain-verification=<32-byte base32 token>"
    }
  }
}
```

**2. Publish the record**, then confirm it resolves:

```bash
dig +short TXT _authorizer-challenge.acme.com
# "authorizer-domain-verification=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**3. Verify:**

```graphql
mutation {
  _verify_org_domain(params: { org_id: "ORG_ID", domain: "acme.com" }) {
    domain
    org_id
    verified_at
  }
}
```

The match is an **exact string comparison** against `authorizer-domain-verification=<token>` — a substring/prefix match is deliberately not accepted. If the record isn't visible yet, `_verify_org_domain` returns a "dns verification failed" error and **leaves the challenge in place** so you can retry once DNS propagates; it does not require re-requesting a new token. The DNS lookup is TXT-only with a bounded ~5s timeout — no HTTP fetch is ever made against the domain.

### Trusted-assert (super-admin)

```graphql
mutation {
  _add_verified_org_domain(params: { org_id: "ORG_ID", domain: "acme.com" }) {
    domain
    org_id
    verified_at
  }
}
```

Skips the DNS challenge entirely. Only a super-admin can call this — an org admin attempting it is rejected. Still subject to the same uniqueness and public-suffix guards as DNS verification (see below).

### List and delete

```graphql
query {
  _org_domains(params: { org_id: "ORG_ID", pagination: { limit: 100 } }) {
    pagination { total }
    org_domains { domain verified_at }
  }
}
```

```graphql
mutation {
  _delete_org_domain(params: { domain: "acme.com" }) {
    message
  }
}
```

`_delete_org_domain` takes only the domain — the owning org is loaded from the row first, and the org-admin check is authorized against *that* org, not a caller-supplied `org_id`.

## Home Realm Discovery endpoint

```
GET /api/v1/org-discovery?email=<email>
```

Public, unauthenticated, and gated behind the `--enable-org-discovery` flag (**default `false`** — off until an operator opts in; a single-tenant deployment with no per-org SSO never needs it). When disabled, the endpoint returns `404`.

The response is deliberately minimal to avoid letting a caller enumerate your tenant list by probing domains:

```json
// match with SSO connection
{ "connection": { "type": "saml", "login_url": "/oauth/saml/acme/login" } }
```

```json
// verified domain but no SSO connection, OR no match at all — indistinguishable
{ "connection": null }
```

Nothing beyond `login_url` (which necessarily embeds the org's slug) is ever returned — no `organization_id`, `organization_name`, or `org_id`, and there's no operator "verbose" opt-in to add them. If the org has both an active SAML and an active OIDC connection, SAML takes precedence.

A pending (unverified) domain is never resolved — `GetOrgDomainByDomain` is a lookup against verified rows only, so it's structurally impossible for an in-flight challenge to affect routing.

The endpoint has its own per-IP rate limit bucket, independent of the global request limiter, to blunt domain-enumeration attempts; a malformed `email` returns a uniform `400` with no parsing detail.

## `/app` login page integration

The hosted login page (`/app`, gated by `--enable-login-page`) shows an email-first step when discovery is enabled:

1. The user types their email and submits.
2. The SPA calls `GET /api/v1/org-discovery?email=…`.
3. **SSO match** — the browser is redirected to `connection.login_url`, with the original `redirect_uri` and `state` appended so the post-login flow returns to your app, not to `/app`.
4. **No match (or discovery disabled/erroring)** — the standard password/social/magic-link login renders inline, exactly as it does today. Discovery is a routing hint only; it never blocks or fails a login.

This flag is opt-in per deployment (`--enable-org-discovery`, mirrored to the SPA as `Meta.is_org_discovery_enabled`); leaving it off keeps `/app` byte-for-byte the same as before this feature existed.

### App-supplied escape hatch

If your app already knows which org a user belongs to (a subdomain, an org picker, your own domain-to-tenant map), skip discovery entirely and send the user straight to that org's login:

```
GET /oauth/saml/{org_slug}/login?redirect_uri=...&state=...
```

or the [OIDC broker](./org-sso-oidc) equivalent. This is the recommended path whenever your app already owns the org mapping — HRD exists for the case where it doesn't.

## Dashboard UX

The org detail page's **Verified Domains** panel: a table of the org's verified domains with their verification date, an **Add Domain** dialog that walks through request → show the DNS record with copy-to-clipboard → verify (with a retryable "not propagated yet" hint on failure), and a super-admin-only "Add without DNS verification" quick path. Each row has a **Delete** action.

## Security & behavior reference

| Behavior | Detail |
|----------|--------|
| **Public-suffix / consumer guard** | Bare TLDs and multi-label public suffixes (`com`, `co.uk`) are rejected, plus a blocklist of major consumer providers (`gmail.com`, `outlook.com`, `icloud.com`, …) even where the public-suffix list would technically allow them. |
| **Uniqueness** | The normalized domain is the row's primary key — one verified domain routes to exactly one org, enforced atomically at the storage layer (not a check-then-insert race). A second org verifying an already-claimed domain gets a `domain_already_verified_by_another_org` error; re-verifying your own already-verified domain is a no-op success. |
| **Subdomains are exact-match** | Verifying `acme.com` does **not** cover `eng.acme.com` — each (sub)domain is its own row, matching the DNS challenge's exact-name granularity. |
| **Normalization** | One shared normalizer (IDNA/UTS-46, lowercased, punycode, no scheme/path/port/wildcard) is used for both writes and HRD lookups, so a login email resolves to the exact stored value. |
| **Org-delete cascade** | Deleting an organization cascades to delete its verified domains, freeing them for re-claim by anyone. Without this a deleted org's domain would be permanently unclaimable, since the domain is the primary key. |
| **Rate limiting** | `_request_org_domain` and `_verify_org_domain` are rate-limited per org; the public `/api/v1/org-discovery` endpoint is rate-limited per IP, separately from the global request limiter. |
| **Token secrecy** | The DNS challenge token is never logged; only the verification *method* (`dns_txt` / `trusted_assert`) is recorded in the audit event, never the token value. |
| **Multi-instance deployments** | The pending DNS challenge lives in the memory store, which is per-node unless Redis is configured — the same requirement as magic links and OTP. Configure Redis if `_request_org_domain` and `_verify_org_domain` can land on different nodes. |
