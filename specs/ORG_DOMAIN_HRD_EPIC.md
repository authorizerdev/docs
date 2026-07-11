# Epic: Org-Scoped Admin + Verified Domains + Home Realm Discovery

**Status:** design locked — revised after adversarial architect + auth review
(B1 uniqueness-as-PK, H1 namespaced role, H2 auth-on-loaded-resource, H3
auto-verify opt-in, M1 org-delete cascade, M2 Redis note, M3 shared IDNA
normalize, M4 exact-match subdomains, M5 minimal HRD response). · **Owners:**
principal-engineer + security-engineer
**Goal:** let a SaaS builder's *customers* self-serve enterprise SSO/SAML/SCIM,
and route end users to the correct tenant IdP by verified email domain —
matching the mature B2B-SSO products, without their branding or terminology.

The organization is already the tenant boundary (per-org SAML/OIDC/SCIM ships
today). This epic adds the three pieces that are missing for true multi-tenant
self-service, in strict dependency order.

---

## Foundational invariant: domain ≠ membership

This is the load-bearing rule the whole epic hangs on. It matches every mature
B2B-SSO product surveyed (each supports many domains per org, and none derives
membership from the email-domain string).

1. **Membership is explicit and domain-agnostic.** A user is in an org because
   an `OrgMembership(org, user)` row exists (via invite / add-member), full
   stop. Their access and roles come from that row (+ FGA), never from their
   email domain. An **external consultant** `jane@consulting-firm.com` is a
   full member of Acme by invitation, even though `consulting-firm.com` is not
   an Acme domain. A member's domain changing (rebrand, M&A) does NOT change
   their membership or scope, because scope was never keyed on the domain.

2. **Domains are 1:N per org and drive routing only.** An org has many verified
   domains (acme.com, acme.co.uk, acquired-co.com). A verified domain answers
   exactly one question — "which tenant/IdP should a login for this email be
   routed to" — and never "who is allowed in." (Reference points: WorkOS stores
   a `domains` array; a comparable product caps it at ~10 per org with
   per-domain auth requirements. We do NOT cap in v1; document a sane soft
   limit.)

3. **Auto-join (deferred, out of v1 scope) is connection-gated, not
   domain-string-gated.** If we later auto-add users to an org, the trigger is
   "the user authenticated through THIS org's verified SSO connection" — a real
   cryptographic trust boundary — not "the user's email domain equals a
   verified domain." This is deliberately stronger than a string match and
   keeps external/invited members unaffected. Pre-specced here so Phase 2's
   data model doesn't foreclose it; no code in this epic.

---

## Phase 1 — Org-scoped admin

**Problem:** every org SSO/SCIM/domain mutation is gated `requireSuperAdmin`
(platform operator). A tenant admin cannot manage their own org.

**Design:** introduce `requireOrgAdmin(ctx, meta, orgID)` in
`internal/service/admin_provider.go`, alongside `requireSuperAdmin`. It passes
when **either**:
- the caller is a platform super-admin (unchanged escape hatch), **or**
- the caller is an authenticated user whose `OrgMembership(orgID, userID)`
  exists AND `ParsedRoles()` contains the reserved role
  **`authorizer:org_admin`** (see invariant 3 — NOT the bare string `admin`).

Caller identity comes from the existing `p.callerUserID(ctx, meta)` path
(`caller.go` → principal or `GetUserIDFromSessionOrAccessToken`). No new schema:
org-admin is a reserved, namespaced `OrgMembership.Roles` entry.

**Apply to — and the orgID MUST come from the right source per op kind (fixes a
confused-deputy hole, review H2):**
- **create / list** ops (`_create_org_saml_connection`, `_create_scim_endpoint`,
  `_request_org_domain`, `_org_domains`, `_add_org_member`, …): the orgID comes
  from `params.OrgID`, and that *same* value is authoritative for the write.
  `requireOrgAdmin(ctx, meta, params.OrgID)` binds the privilege to the org
  being written — correct because you must be an admin of exactly that org.
- **update / delete / get** ops: **load the target resource by id FIRST**, then
  `requireOrgAdmin(ctx, meta, resource.OrgID)`, then reject if `params.OrgID`
  is present and `!= resource.OrgID`. NEVER gate on the caller-supplied orgID
  before the load — `resolveOrgSAMLConnection` et al. accept id-OR-org_id, so
  gating on params first lets an org-A admin pass `{id: <org-B row>, org_id:
  <org-A>}` and mutate org-B. The auth check must key on the loaded row's OrgID.
- Files: `admin_org_saml.go`, `admin_org_oidc.go`, `admin_scim.go`, the Phase-2
  domain ops, and the "manage my own org" membership ops (add/remove member,
  list).
- **Org create/delete stays `requireSuperAdmin`** — only the platform operator
  provisions/deprovisions tenants.

### Security invariants (Phase 1)
1. **Auth keys on the resource's real OrgID for mutate/get, on params.OrgID for
   create/list** (see "Apply to"). This is the tenant-isolation boundary; get
   it wrong and it's a confused-deputy IDOR.
2. **Fail closed:** any error resolving membership → deny. A missing/nil
   membership → deny. An inactive/deleted user → deny (membership lookup +
   existing token validation already gate this).
3. **Reserved role is namespaced and collision-proof: `authorizer:org_admin`**
   (`constants.OrgRoleAdmin`), NOT the bare `admin`. App-defined org roles are
   free-form and commonly include `admin`/`owner` for the app's OWN meaning
   (the dashboard RBAC and FGA models already special-case `admin`). Reserving
   the bare string would retroactively hand SSO/SCIM/domain control to every
   member an existing tenant already made an app-level `admin` — a silent
   privilege escalation on upgrade. The `:` namespace cannot collide with a
   normal app role. **Migration:** scan existing `OrgMembership.Roles` for a
   bare `admin`; it is NOT auto-promoted — the namespaced role must be granted
   explicitly.
4. **Super-admin path is unchanged** — platform operators keep full access via
   the admin secret; org-admin is purely additive.
5. **Delegated administration, bounded:** an org admin CAN manage members of
   their own org, including granting `authorizer:org_admin` to another member —
   intended, bounded to their org, and audited. An org admin can NOT grant
   themselves membership/role in another org. Consider (optional) a last-admin
   guard so an org can't lock itself out of self-service (recoverable by
   super-admin regardless).

**Bootstrap:** only a super-admin creates an org and grants the first
`authorizer:org_admin` membership (via `AddOrgMember`); `requireOrgAdmin`
passing for super-admin covers this chicken-and-egg cleanly.

### Tests (Phase 1)
- org admin of org-A creates/updates/deletes org-A's SAML/OIDC/SCIM → allow
- **confused deputy (H2):** org-A admin sends `{id: org-B connection, org_id: org-A}` on update/delete → deny (auth keyed on loaded resource's OrgID)
- member with app-level bare `admin` role (not `authorizer:org_admin`) → deny (H1)
- plain org member (no admin role) → deny
- non-member user → deny
- super-admin → allow (regression)
- org admin creating/deleting the organization itself → deny

---

## Phase 2 — Verified domains

**Depends on:** Phase 1 (domain ops are org-scoped-admin gated).

### Storage: new `org_domains` table across all 6 provider families
The table holds only **verified facts** — the durable "this domain routes to
this org" mapping. Pending verification (the token/challenge) is ephemeral and
lives in the **memory_store** with a TTL, exactly like magic-link tokens, OTP
sessions, OAuth `state`, and the SAML replay cache — NOT in a durable table.
This keeps the table thin and puts short-lived secret challenge state where the
rest of it already lives. (This is a correction to the first draft, which
over-persisted the token.)

`internal/storage/schemas/org_domain.go`:
```
OrgDomain {
  ID         string   // PRIMARY KEY = the normalized domain itself (NOT a uuid).
                       // For Arango/Mongo/Dynamo/Cassandra/Couchbase the doc/partition
                       // key IS the normalized domain (or a deterministic hash of it).
  OrgID      string   // indexed (for ListOrgDomainsByOrg)
  Domain     string   // == ID; the human-readable normalized value
  VerifiedAt int64
  CreatedAt  int64
  UpdatedAt  int64
}
```

**BLOCKER fix (review B1): uniqueness must be enforced by the PRIMARY/partition
key, not a secondary unique index.** The entire ATO model rests on "one verified
domain → one org." DynamoDB, Cassandra, and Couchbase cannot enforce a unique
constraint on a *non-key* attribute — the existing `scim_endpoint`/`OrgMembership`
pattern uses an application-level **check-then-insert** guard, which has a TOCTOU
race: two orgs verifying `acme.com` concurrently can both pass the "not taken"
read and both insert. For SCIM that's harmless; for domain routing it means two
orgs own the same domain — the exact hijack invariant 2 forbids. Therefore the
**normalized domain is the primary/partition key** (or a deterministic id =
hash(normalized domain)), so first-writer-wins is enforced atomically on every
backend via conditional put / `INSERT ... IF NOT EXISTS` / insert-on-unique-PK —
no race, no check-then-insert. Do **not** mirror `scim_endpoint`'s guard here.

A row exists **only once verified** — no `verified` bool; an un-verified domain
is not a row, it's a pending challenge in memory_store.
Register in `schemas/model.go` (`OrgDomain` collection = `Prefix+"org_domains"`).
Provider work across all 6 families (SQL GORM + the 5 NoSQL). Methods:
`AddOrgDomain` (atomic create-if-absent on the domain key; returns a distinct
"already owned by another org" error on conflict), `GetOrgDomainByDomain(domain)`
(the HRD reverse-lookup — a primary-key GET on every backend, the whole reason
this is a table), `ListOrgDomainsByOrg(orgID, pagination)`,
`DeleteOrgDomain(domain)`, and `DeleteOrgDomainsByOrg(orgID)` (for cascade, M1).

Pending-challenge shape in memory_store: key
`org_domain_challenge:<org_id>:<domain>` → `<token>`, TTL ~24h, one per
(org, domain), regenerated on re-request.

### Admin ops (org-scoped-admin gated)
- `_request_org_domain(org_id, domain)` (org-admin) → validates/normalizes;
  if the requesting admin already owns a verified email at the domain → INSERT
  verified row immediately (auto-verify, method 2); else mint a `crypto/rand`
  token into memory_store and return the DNS record to publish
  (`_authorizer-challenge.<domain>  TXT
  "authorizer-domain-verification=<token>"`). Creates a durable row only on
  auto-verify.
- `_verify_org_domain(org_id, domain)` (org-admin) → DNS TXT lookup (method 3);
  on match, INSERT the verified row and delete the challenge. Idempotent.
- `_add_verified_org_domain(org_id, domain)` (**super-admin only**) →
  trusted-assert, method 1: INSERT verified row with no proof.
- `_org_domains(org_id, pagination)` → list verified domains (never leak
  another org's rows).
- `_delete_org_domain(id)` → removes the verified mapping.

### Verification: who is asserting decides whether proof is required

Surveyed products all gate proof on trust, not on the domain: a trusted party
(platform operator; or an admin who already controls a proven email at the
domain) is waived; an untrusted tenant admin self-serving must prove control.
Two proof methods exist in the wild — DNS TXT (WorkOS/Auth0) and email-to-domain
(Clerk, with auto-verify when the adder already owns a verified email there).
We support both, choosing the path by the caller:

1. **Trusted-assert (no proof)** — a **super-admin** may create a verified
   `org_domains` row directly (`_add_verified_org_domain`), because the platform
   operator is already trusted (matches WorkOS API/dashboard "add as verified").
   Never available to an org admin.
2. **Auto-verify (no challenge) — OPT-IN, OFF BY DEFAULT (review H3)** — if the
   **org admin** requesting the domain already has a verified email at that exact
   domain, verify immediately. Caveat that makes this off-by-default: one
   verified mailbox is *inbox-level* control, not *domain-level* control. The
   PSL/consumer guard (invariant 3) catches public suffixes but NOT shared
   non-public domains (universities, agencies, umbrella corps, vanity ESP
   subdomains). At those, a single mailbox holder who is admin of any org could
   bind the whole domain's routing. So: gate behind `--enable-domain-auto-verify`
   (default false); when enabled, still require the mailbox to be a well-known
   admin address (`admin@`/`postmaster@`/`webmaster@`) — not any mailbox. DNS TXT
   (method 3) remains the trust anchor for routing-grade verification.
3. **DNS TXT (primary self-serve proof)** — `net.Resolver` with a context
   deadline (~5s) looks up `TXT _authorizer-challenge.<domain>`; match the exact
   `authorizer-domain-verification=<token>`. Token is `crypto/rand` 32 bytes,
   base32, in memory_store (24h TTL), regenerated per request.
4. **Email-to-domain (optional alt proof)** — send a code to an operator-chosen
   address at the domain and match it; same trust value as DNS (proves control
   of an inbox at the domain). Reuses the email/OTP subsystem. May ship in a
   follow-up if DNS covers the initial need.

The verification *method* is recorded in the audit event, not in the routing
table (the table stays verified-facts-only). Invariant: methods 1–4 all end in
the same place — an INSERT of a verified row — and every path is subject to the
uniqueness and public-suffix guards below.

### Security invariants (Phase 2) — THIS IS THE ATO SURFACE
1. **Only a verified domain (a row) grants trust.** A pending challenge in
   memory_store is inert — never used for routing, auto-join, or any decision.
   It only exists to be matched by `_verify_org_domain`.
2. **A verified domain routes to exactly one org** (unique index on `domain`).
   Multiple orgs may hold pending challenges for `acme.com` concurrently, but
   `_verify_org_domain` is a first-verified-wins INSERT: once one org verifies,
   the unique index makes any other org's verify fail →
   `domain_already_verified_by_another_org`. This keeps HRD unambiguous and
   stops a squatter from hijacking a live tenant's routing. (Future extension,
   modeled on WorkOS: allow multiple orgs to verify the same domain but let only
   one include it in a routing "policy" — deferred; unique-per-domain is the
   correct, simpler v1 and matches the effective behavior of the surveyed
   products.)
3. **Public-suffix guard:** reject verifying a public suffix or bare TLD
   (`gmail.com`, `outlook.com`, `co.uk`, etc.) using an embedded PSL check, so
   no tenant can capture a shared consumer domain. Maintain a small blocklist of
   the top consumer providers even if PSL would technically allow them.
4. **Normalization (single shared function, review M3):** ONE
   `normalizeDomain()` used by BOTH Phase-2 writes and Phase-3 lookups (a
   split implementation silently misses routing and can let a homograph
   collide). Pin the profile: `golang.org/x/net/idna` **Lookup profile, UTS-46
   non-transitional**. lowercase, trim, IDNA→punycode, strip leading `*.`/`@`;
   reject wildcards and anything with a path/port/scheme. The Phase-2 method and
   Phase-3 method are the SAME function name (`GetOrgDomainByDomain`).
   **Subdomain semantics (review M4): exact-match only in v1** — a verified
   `acme.com` does NOT cover `eng.acme.com`; each (sub)domain is verified as its
   own row. This matches the DNS-proof granularity (the TXT challenge lives at
   `_authorizer-challenge.<exact-domain>`) and prevents an apex owner from
   capturing routing for a subdomain delegated to another team.
5. **DNS lookup safety:** TXT-only, bounded timeout, no following of arbitrary
   HTTP — DNS resolution to the claimed domain is inherent and safe; do not add
   an HTTP fetch. Rate-limit `_verify_org_domain` per org to blunt
   enumeration/DoS of the resolver.
6. **Token secrecy:** the verification token is not a bearer secret (publishing
   it in DNS is the proof), but do not reuse it across domains; log domain ops
   to the audit trail (`org.domain.added/verified/deleted`) — never log the
   token value itself alongside PII.
7. **Revocation + cascade (review M1):** deleting/unverifying a domain
   immediately removes its routing effect (HRD re-queries live). **`DeleteOrganization`
   MUST cascade-delete the org's `org_domains` rows** (via `DeleteOrgDomainsByOrg`) —
   today it deletes only the org row and does not cascade. Without this, a
   deleted tenant's verified `acme.com` row survives, and because the domain is
   the unique primary key, `acme.com` becomes **permanently unclaimable by
   anyone** — a self-inflicted routing DoS. Ideally cascade the org's SSO
   connections + SCIM endpoints too; at minimum domains. Test org-delete →
   domain reclaimable.
8. **Deployment note (review M2):** the pending challenge lives in memory_store,
   which is per-node in-memory unless Redis is configured. `_request_org_domain`
   (mint) and `_verify_org_domain` (read) are separate requests that can hit
   different nodes behind a load balancer. **Multi-instance deployments MUST
   configure Redis for domain verification** — same existing requirement as
   magic links / OTP. No code change; a deployment-doc line + a test note.
9. **Re-verification (deferred, review L3):** verification is durable until
   manual delete; a transferred/lapsed domain keeps routing to the old org.
   Acceptable for v1; a periodic re-verify job is a follow-up.

### Tests (Phase 2)
- request → token in memory_store, NO durable row, not usable for routing
- verify with correct TXT (mock resolver) → row inserted; wrong/absent TXT → no row, clear error, challenge survives for retry
- auto-verify (method 2): org admin whose own email is verified at the domain → immediate verified row, no challenge minted
- trusted-assert (method 1): super-admin `_add_verified_org_domain` → verified row, no proof; org admin calling it → deny
- every verification method is still subject to uniqueness (invariant 2) and public-suffix (invariant 3) — e.g. super-admin trusted-assert of an already-verified domain still fails
- second org verifying an already-verified domain → rejected (invariant 2)
- verifying a public-suffix/consumer domain → rejected (invariant 3)
- normalization: `Acme.COM`, ` acme.com `, `*.acme.com`, `acme.com/x` handled/rejected
- org-scoped: org-A cannot list/verify/delete org-B's domain
- **membership independence**: a member whose email domain is NOT any org
  domain (external consultant) is unaffected by domain ops; deleting an org's
  domain does not remove any member
- storage round-trip across all `TEST_DBS`

---

## Phase 3 — Home Realm Discovery (routing) + app escape hatch

**Depends on:** Phase 2 (verified domains only).

### Endpoint: `GET /api/v1/org-discovery?email=<email>` (public, unauthenticated)
Returns which tenant(s) an email belongs to by verified domain, so the login UI
can route to the right IdP — **routing only, it does not authenticate,
determine membership, or restrict signup**. A no-match simply means "no SSO
routing hint" — the user may still be an invited member (external consultant)
and log in through whatever their membership permits.

Logic:
1. Extract the domain from the email (normalize identically to Phase 2).
2. `GetOrgDomainByVerifiedDomain(domain)` → the owning org (unique by invariant 2).
3. Load that org's SAML/OIDC connection (if any).
4. Response — **minimal by default (review M5).** The unauthenticated response
   returns only what the login UI needs to redirect, NOT tenant identifiers:
   - match with a connection → `{ connection: { type: "saml"|"oidc", login_url } }`
     (the SP-initiated URL, e.g. `/oauth/saml/<slug>/login`). The slug is
     unavoidably embedded in `login_url`, but do NOT additionally return
     `organization_id`/`organization_name` — those let someone enumerate your
     customer list by probing domains.
   - match, no enterprise connection → `{ connection: null }` (password/social)
   - no match → `{ connection: null }` (indistinguishable from the above by
     design — don't confirm "this domain is/ isn't a tenant" beyond the routing
     hint)
   An operator opt-in (`--org-discovery-verbose`) may include org id/slug for
   trusted first-party callers.
3b. **Rate-limit + privacy:** rate-limit per IP via `internal/rate_limit`
    (note: itself per-node without Redis — distributed enumeration needs a
    shared limiter, ties to invariant 8). Never reveal member lists, counts, or
    unverified/pending domains. Gate the whole endpoint behind
    `--enable-org-discovery` (default on) for operators who consider even
    routing metadata sensitive.

### Universal login page (`/app`) integration — THE PRIMARY UX

The hosted login SPA at `/app` (`AppHandler`, `internal/http_handlers/app.go`,
gated by `--enable-login-page`) is where most users land, and it already carries
the OAuth request context (`redirect_uri`, `state`, `scope`, `client_id`, org
branding) into the SPA. HRD plugs in here:

1. **Email-first step on `/app`.** The login page shows an email field first.
   As the user submits it, the SPA (`web/app`) calls
   `GET /api/v1/org-discovery?email=…`.
2. **SSO match → redirect to the org's SP-initiated login**, carrying the
   original OAuth context so the post-IdP completion returns to the *caller's*
   `redirect_uri`, not to `/app`. The SPA navigates to the discovered
   `connection.login_url` (`/oauth/saml/<slug>/login` or the OIDC equivalent)
   with `redirect_uri`, `state`, `scope`, `client_id`, `nonce` appended.
3. **No SSO match → render password / social / magic-link inline** on `/app`,
   exactly as today. A no-match never blocks login (invited external members
   still authenticate normally).
4. **Round-trip back.** After the IdP authenticates and posts to the org's ACS
   (SAML) / callback (OIDC), the flow resumes the original authorization request
   and redirects to the caller's `redirect_uri` with the code — the standard
   flow the app already runs.

**Good news — the round-trip is ALREADY solved (verified in source).** Both
SP-initiated login endpoints already accept and preserve the app context
through the IdP round-trip via the shared store: `SAMLLoginHandler`
(`saml_sp.go`) captures `redirect_uri`+`state` into `samlFlowState`
(`AppRedirect`/`AppState`) under an opaque single-use `RelayState`, and the
OIDC broker login (`oauth_sso.go`) does the same via `ssoFlowState` under a
single-use `state`. The ACS/callback resumes the session and redirects to the
caller's `redirect_uri` with its `state`. So HRD needs **no new server-side
threading** — Phase 3 is just the `/app` SPA calling discovery and redirecting
to these existing endpoints with `redirect_uri`+`state` appended. (If a future
need arises to also carry `scope`/`nonce` into the SSO flow, extend those two
flow-state structs — but the core redirect-back works today.)

**Per-org branding (optional, nice-to-have):** once discovery resolves the org,
`/app` may show that org's name/logo instead of the instance defaults
(`AppHandler` currently passes only `Config.OrganizationName/Logo`). Deferred;
note it.

### App-supplied escape hatch (no server change — document it)
Builders who already know the org (subdomain, their own domain map, an org
picker) skip discovery entirely and send the user straight to
`/oauth/saml/<slug>/login` (with the OAuth context) or the org's OIDC
connection. This mirrors the "application already determined the tenant / no
prompt" mode of mature products and stays the recommended path when the app
owns the mapping. It relies on the same OAuth-context threading as above.

### Multi-match note
Invariant 2 (unique PK) makes a *verified* domain belong to exactly one org, so
single-match is guaranteed in v1 — no selector needed. If a future extension
allows multiple orgs to verify one domain (WorkOS's "verify many, one routing
policy"), the endpoint would return a list; shape `connection` as one entry of a
potential list from day one to keep that non-breaking.

### Tests (Phase 3)
- verified SSO domain → returns the org's connection login_url
- verified domain, no connection → connection null
- unverified/pending domain → treated as no match (never routes)
- unknown domain → no match
- rate-limit trips after N/min per IP
- malformed email → 400, uniform error

---

## Cross-cutting

- **GraphQL + proto:** all new admin ops on both surfaces; `make
  generate-graphql`, `make proto-gen`, commit `gen/`. New public discovery
  endpoint is REST (grpc-gateway) + optionally GraphQL query `org_discovery`.
- **Dashboard:** org detail page gains a "Domains" section (add → show DNS
  record → verify → status badge). Org-admin-gated so it also works for tenant
  admins once they have a login. (Separate dashboard PR.)
- **Docs:** a `core/` or `enterprise/` page "Multi-tenant SSO & domain
  verification" once merged.
- **Terminology:** never use another vendor's product names in code, comments,
  schema, or docs. Use: *organization*, *org admin*, *verified domain*, *home
  realm discovery* (generic industry term) / *organization discovery*.

## PR sequence
1. `feat/org-scoped-admin` (Phase 1)
2. `feat/org-verified-domains` (Phase 2, needs #1)
3. `feat/org-home-realm-discovery` (Phase 3, needs #2)
4. `feat/dashboard-org-domains` (UI, needs #2/#3)

Each PR: principal-engineer implements → full test gate (build/vet/lint/
generate parity + integration across TEST_DBS) → security-engineer review →
fix → merge. No phase starts before the prior merges.
