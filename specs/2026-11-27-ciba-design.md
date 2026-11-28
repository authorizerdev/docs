# CIBA: human approval for agent actions

**Status**: design, revision 4 (after principal-engineer, security and CTO
reviews, a reuse pass, and a line-by-line check of every code claim; see §15). Phase 4 of the agent-readiness plan. Ships as **beta**.
Builds on RFC 8693 delegation (`AGENTIC_DELEGATION_DESIGN.md`), the consent
screen (`2026-08-11-cimd-and-consent.md`) and FGA conditions (authorizer#945,
released in 2.4.10).

**Spec**: OpenID Connect Client-Initiated Backchannel Authentication Flow —
Core 1.0 (Final, 2021-09-01). `CIBA §N` refers to a section of that spec; a
plain `§N` refers to a section of this document.

---

## 1. The problem

An agent holding a delegated token can act within what it was granted. Some
actions should not be decided by a grant made in advance: send this payment,
delete this repository, email this customer. The user should approve **that**
action, **now**, on a device they control, and the agent should get authority
for that action only after they say yes.

Today the only interactive path is `/authorize`, which needs a browser on the
same device as the client. A headless agent has none. `consent.go` refuses
delegated callers with the note *"Human-in-the-loop approval for a headless
agent is CIBA's job"*.

CIBA is the standard shape for this when the user is **not at the agent's
screen** (background jobs, chat and email bots, scheduled agents): the agent
calls a backchannel endpoint naming the user, the server reaches the user out
of band, the user approves or denies, and the agent collects the result at the
token endpoint. When the user *is* at the agent's screen, the same approval
page is reachable through MCP URL-mode elicitation (§11).

### 1.1 Who needs this, and what already exists

Step-up for a human is already supported **when the agent can open the user's
browser**, which is the case for desktop agents such as Claude Code, Cursor or
a local CLI (they already open a browser for MCP OAuth with a loopback
redirect):

- `/authorize` with `prompt=login`, or `max_age` (including `max_age=0`),
  forces a real re-authentication, with MFA when enrolled: it revokes the
  current session so the login UI asks again (`authorize.go`, `forceReauth`).
- The ID token carries `auth_time` (and so does the refresh token, unchanged
  across refresh), so the agent, as the OIDC client, checks that the sign-in
  is recent (OIDC Core §3.1.2.1).
- The agent then uses the fresh user token for RFC 8693 token exchange, as
  today.

That path needs no new server code; 4a only documents it (§11). Its limits:

- the user sees a sign-in, not the action;
- access tokens and delegated tokens do not carry `auth_time`, so the evidence
  reaches the agent but not the resource server, which has to trust the agent;
- `acr` is fixed to `"0"` (no `acr_values`), so "with MFA" cannot be required
  or checked.

CIBA is for agents that **cannot reach the user's browser**: server-side and
background agents (scheduled jobs, queue workers, chat and email bots, cloud
agents running without the user present). Nothing in Authorizer covers that
case today.

## 2. Scope

**In (phase 4a, beta)**

- Backchannel authentication endpoint, **poll** mode.
- Hints: `login_hint` (an Authorizer user id) and `id_token_hint`.
- Action binding: required `binding_message`, optional minimal
  `authorization_details` (RFC 9396), both shown to the user and carried into
  the token (§5).
- Exactly one `resource` (RFC 8707); CIBA tokens are for external resource
  servers only (§5).
- Approval only on Authorizer's own server-rendered page, with a cookie
  session, step-up and CSRF protection (§4.3).
- Channels: email and the `user.approval_requested` webhook; both deliver a
  link to the approval page.
- CIBA grant at `/oauth/token` issuing a delegated, action-bound token.
- Discovery, audit, metrics, and per-client and per-user limits on the
  existing `IncrementCache` counter (§8).
- Adoption kit: JS and Python helpers, an MCP reference example (an MCP tool
  gated by approval, with URL elicitation), dashboard visibility, docs.

**Later (4b)**

- In-app approval API for first-party apps (needs an approver-client
  allow-list and a memory-store list primitive; §15).
- Ping mode (CIBA §10.2) — on demand; needs client metadata (a schema change)
  and an SSRF-hardened notification client.
- Optional: approval grants a short, capped time window as a time-limited FGA
  tuple (≤ 1 hour, duration shown on the page).
- Per-client allow-lists of `authorization_details` types.

**Out**

- **Push** mode: tokens are delivered without the client authenticating at the
  token endpoint (CIBA §14).
- Signed requests (CIBA §7.1.1), `user_code` (CIBA §7.1.2), `login_hint_token`.
- Email or phone as `login_hint` (§13, decision 1).
- CIBA tokens for Authorizer's own API (§5).

## 3. Configuration

| Flag | Default | Meaning |
| --- | --- | --- |
| `--enable-ciba` | `false` | Serves the endpoint and the approval page, advertises CIBA. Off: no routes, no metadata, the grant is `unsupported_grant_type`. |
| `--ciba-request-ttl` | `300` (s) | Request lifetime (`expires_in`). `requested_expiry` may shorten it, never lengthen it. Max 600. |
| `--ciba-poll-interval` | `5` (s) | `interval` returned to clients. |
| `--ciba-max-requests-per-user` | `3` | Requests one client may make for one user per request-TTL window. |
| `--ciba-max-requests-per-user-total` | `10` | Requests all clients together may make for one user per request-TTL window. |
| `--ciba-step-up-max-age` | `300` (s) | The approving session must have authenticated within this many seconds, or re-authenticate (§4.3). |

Startup checks with `--enable-ciba`:

- `--url` must be set; warn unless it is `https` or `localhost` (CIBA §7
  requires TLS; links and the issuer are built from `--url`).
- At least one channel must be able to reach users: SMTP configured, or a
  webhook registered for `user.approval_requested`. Otherwise refuse to start,
  since 4a has no in-app channel and requests could never be approved. (A
  webhook registered later is detected at request time; until one exists the
  server logs a warning on each request.)
- Warn when `--allowed-origins` is an explicit list without the server's own
  origin: the sign-in detour back to the approval page would be refused
  (§4.3).
- Warn when magic link is the only enabled sign-in method: under decision 5
  no session could satisfy step-up, so no request could be approved.
- Warn when the active FGA model has no `type agent`: delegated checks made
  through Authorizer then authorize as the user alone (`fga_agent.go`).
- Multiple replicas need a shared memory store (Redis or the database store);
  with the in-memory store a request made on one replica is invisible to the
  others.

**Per-client opt-in.** A client may use CIBA only if it is a `service_account`
and its `grant_types` includes `urn:openid:params:grant-type:ciba`. The
`grant_types` column exists on every backend (no schema change) but is written
only by dynamic registration and enforced nowhere, and the admin client APIs do
not expose it; 4a adds an additive `grant_types` field to `_create_client` /
`_update_client` (and gRPC/REST) and enforces it for CIBA only. Dynamic and
CIMD clients can never obtain CIBA. CIBA §7.2 recommends against shared
secrets, so workload identity (RFC 7523 assertions from a registered trusted
issuer) is preferred; a client-signed `private_key_jwt` against the client's
own JWKS is not supported by Authorizer and is not added here.

## 4. The flow

```
Agent (service account)          Authorizer                         User
       │  POST /oauth/bc-authorize  │                                  │
       │  client auth, scope=openid │                                  │
       │  login_hint=<user id>      │                                  │
       │  binding_message, resource │                                  │
       │  [authorization_details]   │                                  │
       │ ─────────────────────────► │  record (pending, TTL)           │
       │ ◄───────────────────────── │  email / webhook (link) ───────► │
       │  {auth_req_id, expires_in, │                                  │
       │   interval}                │   /oauth/bc-approve: sign in,    │
       │                            │   step-up, review, approve/deny  │
       │                            │ ◄──────────────────────────────  │
       │  POST /oauth/token         │                                  │
       │  grant_type=…:ciba         │                                  │
       │  auth_req_id (every 5 s)   │                                  │
       │ ─────────────────────────► │                                  │
       │ ◄───────────────────────── │  authorization_pending … then    │
       │                            │  tokens / access_denied /        │
       │                            │  expired_token                   │
```

### 4.1 Backchannel request — `POST /oauth/bc-authorize`

Form-encoded, client-authenticated with `clientauth.ResolveClient` and
`RequireServiceAccountKind` (an interactive client is refused before its secret
is checked).

Validation, in order:

1. Client may use CIBA (§3), else `unauthorized_client`.
2. `scope` contains `openid` (CIBA §7.1), else `invalid_scope`. Requested
   scopes are intersected with the client's `allowed_scopes`; an empty result
   is `invalid_scope`. Scopes in the `authorizer:` namespace are refused
   (`invalid_scope`): CIBA tokens never reach Authorizer's own API (§5).
3. Exactly one hint (CIBA §7.1): `login_hint` or `id_token_hint`;
   `login_hint_token` or two hints is `invalid_request`. `acr_values` is
   ignored in 4a; other unrecognized parameters are ignored (CIBA §7.2).
4. `login_hint` must be a canonical lowercase UUID (an Authorizer user id),
   else `invalid_request`.
5. `id_token_hint` must be an unexpired ID token this server signed
   (`TokenProvider.ParseJWTToken`, which verifies the signature against the
   primary and secondary keys and rejects an expired `exp`), with
   `token_type` `id_token` (the check `parseIDTokenHintSubject` already makes)
   and an `aud` that contains the requesting client (CIBA §14); else
   `invalid_request`. Accepting expired hints would need a second parser that
   skips `exp` (§13, decision 7).
6. `binding_message` is required (CIBA makes it optional): missing is
   `invalid_request`; more than 64 characters, or any control (`Cc`) or format
   (`Cf`: bidi overrides, zero-width) character, is `invalid_binding_message`.
7. `authorization_details` (optional, RFC 9396): a JSON array of at most 5
   objects, at most 4 KB in total, each with a string `type`; other values are
   strings, numbers or booleans, one level deep, with the same character rules
   as the binding message. Anything else is `invalid_authorization_details`.
   4a treats them as display-and-echo only; it does not interpret types.
8. `resource`: **exactly one** absolute URI that is not this server's own URL
   or a URL under it; else `invalid_target`. It becomes the token's `aud`.
9. Caps and blocks (§8), else the fake-success path below.

Response (CIBA §7.3):

```json
{ "auth_req_id": "<43-char base64url, 256 bits>", "expires_in": 300, "interval": 5 }
```

**User resolution never leaks.**

- `login_hint` is looked up with `GetUserByID`; `id_token_hint` yields `sub`.
- **Tenant boundary**: if the client has an `OrgID`, the user must hold an
  active membership in that organization (`GetOrgMembership`).
- If the user does not exist, is revoked, fails the tenant check, or the
  request is over a cap or blocked (§8), the endpoint still answers 200 with an
  `auth_req_id` that never becomes approvable and ends in `expired_token`.
  `unknown_user_id` (CIBA §13) is never returned, and caps never produce a
  distinct error: on an endpoint any allowed agent can call, either would be an
  oracle. The per-client request rate (§8) is the one limit that answers
  `access_denied` (403), because it is independent of the user.
- Caps for an unresolvable user are counted exactly like a real user's (§8).
- Notifications are sent in the background (`asyncutil.Go`) after the response
  is written, so timing does not reveal whether the user exists or has email.
- A storage *failure* (not `storage.IsNotFound`) is a 500, never a fake
  success.

### 4.2 Reaching the user

Each request gets an **approval id** (128 bits, independent of `auth_req_id`).
It is a *lookup handle* for the approval page, not a credential: knowing it
never lets anyone approve (§4.3). The agent never sees it; the user never sees
`auth_req_id`.

- **Email** — new template `ciba_approval`: agent name, the binding message
  labelled as the agent's own words, the action details, scopes, resource,
  expiry, and a link to `<url>/oauth/bc-approve?id=<approval id>`.
- **Webhook** — new event `user.approval_requested`: agent, user id, the same
  display fields and the approval link, so an app can push to its own mobile
  app. Webhook payloads are user-centric today (`RegisterEvent(…, user)`); this
  adds a payload variant as `RegisterScimGroupEvent` does for SCIM. Webhook
  logs store payloads, so the payload carries no secret beyond the lookup link.

A failed channel is logged and counted, never reported to the agent.

### 4.3 The approval page — `GET`/`POST /oauth/bc-approve`

Server-rendered, reusing the consent screen's building blocks rather than new
ones:

- a new `ciba_approve.tmpl` built from the shared `au_shell.tmpl` partials
  (`au_styles`, `au_brand`) that `consent.tmpl` uses, and `consentError` /
  `consent_error.tmpl` for failures;
- the same `Cache-Control: no-store` headers and a CSP with
  `frame-ancestors 'none'` and `form-action 'self'` (the POST renders a result
  page; it never redirects off-site, so the consent page's widened
  `form-action` is not needed).

**Authentication**

- Only the **session cookie** is read: `cookie.GetSession`, then
  `TokenProvider.ValidateBrowserSession`, as `/authorize` does. That call checks
  the session is still live in the memory store, its nonce and its expiry, and
  returns `token.SessionData` (`Subject`, `AuthTime`, `LoginMethod`).
  Decrypting the cookie alone is not enough: a cookie from a session that was
  logged out or revoked still decrypts.
- The page never calls `GetUserIDFromSessionOrAccessToken` (which the consent
  POST uses, and which accepts bearer tokens), so no OAuth client — first-party,
  dynamic, or the agent's own web UI holding the user's token — can approve on
  the user's behalf.
- The session must belong to the request's user; a mismatch shows the generic
  "request not found" page.
- **Step-up** reuses `/authorize`'s `max_age` logic: the session's
  `SessionData.EffectiveAuthTime()` must be within `--ciba-step-up-max-age`,
  and its `LoginMethod` must not be `magic_link_login` (the approval link
  itself arrived by email, so a mailbox-only sign-in proves nothing new; §13,
  decision 5). `SessionData` does not record whether an MFA challenge ran, so
  the rule is on the login method alone. Otherwise the page revokes the
  session exactly as `forceReauth` does (memory-store entry and cookie;
  extracted into a shared helper, not copied) and sends the user to sign in.
- **The sign-in detour** copies the SAML IdP continuation, which solves the
  same problem today. The server redirects to
  `/app?redirect_uri=<url>/oauth/bc-approve?id=<approval id>`, as
  `bounceSAMLIDPToLogin` does. After sign-in the login UI navigates only to
  `/authorize` or to URLs of one exact shape (`isSamlIdpContinueURL` in
  `web/app/src/Root.tsx`), never to an arbitrary `redirect_uri`. So 4a adds an
  `isCibaApproveURL` check beside it: same origin, path exactly
  `/oauth/bc-approve`, an `id` parameter.
- `app.go` validates that `redirect_uri` against `--allowed-origins` (no
  `client_id`). The default `*` admits the server's own origin. An explicit
  list must include it, the same requirement the SAML IdP continuation has;
  startup warns when it does not (§3).
- The approval id appears in that URL, as it does in the emailed link. It is a
  lookup handle, not a credential (§4.2).

**What the user sees, in this order**

1. The agent's registered name (and organization, if any).
2. The action: `authorization_details` as a key/value list, the resource, and
   the scopes.
3. "Message from <agent> (not verified by Authorizer)": the binding message,
   HTML-escaped.
4. Remaining time, and **Approve**, **Deny**, and **Deny and block this
   agent**.

**CSRF** reuses the consent screen's pattern: each render stores a pending
record under a fresh random id with `SetState` and puts that id in the form;
the `POST` consumes it with `GetAndRemoveState` (single-use, as
`ConsentHandler` does). The path is exempted from the generic CSRF middleware
on the same reasoning as `/authorize/consent` (`csrf.go`): the id exists only
inside a page this server rendered. `SetState` entries expire after 10 minutes
on all three memory stores.

Two checks are new, because the consent POST does not make them (it binds the
pending record to a user id, resolved by a call that also accepts bearer
tokens, and checks no `Origin`):

- the pending record holds the session nonce and approval id it was rendered
  for, and the `POST` must present the same session;
- the `POST`'s `Origin` must equal the server's own origin.

The form token is the per-render id, never the approval id, which travels in
emails and webhooks.

### 4.4 Collecting the result — CIBA grant at `/oauth/token`

`grant_type=urn:openid:params:grant-type:ciba&auth_req_id=…`, client-authenticated.

| Situation | Response |
| --- | --- |
| Unknown id, or issued to another client | `invalid_grant` |
| Pending | `authorization_pending` |
| Polled faster than `interval` | `slow_down`; interval grows by 5 s for this request (CIBA §11) |
| Expired (within the grace period, §6) | `expired_token` |
| Denied | `access_denied` |
| Approved, first redemption | tokens (§5); the id is then spent |
| Approved, already redeemed | `invalid_grant` |

## 5. What an approval issues

**A delegated access token bound to the approved action**, minted with the
existing `CreateDelegatedAccessToken`:

- `sub` = the user; `act.sub` = the agent's `client_id`.
- `aud` = the requested `resource` (never Authorizer itself).
- `scope` = the approved scopes (already ∩ the agent's ceiling, §4.1).
- `authorization_details` = exactly what the user saw and approved (RFC 9396
  §7), when present.
- `ciba` claim: `{"req": <SHA-256 of auth_req_id>, "msg": <SHA-256 of the
  binding message>, "approved_at": <time>}`, so a resource server can tie the
  token to one approved request and check the action it is about to perform.
- 5-minute lifetime, no refresh token.
- No `sid`. `DelegationTokenConfig.SessionID` may be empty, and such a token
  "can never authenticate HERE" (`delegation_token.go`): this is the existing
  rule that keeps CIBA tokens off Authorizer's own API, alongside the
  `resource` and `authorizer:` refusals in §4.1.

`DelegationTokenConfig` has no field for extra claims today; 4a adds two
optional fields (`AuthorizationDetails`, and the `ciba` claim) that are empty
for every existing caller.

**An ID token** from the existing `CreateIDToken`, with `aud` = the agent and
`auth_time` = the approving sign-in time. `CreateIDToken` copies every field of
the user it is given into claims, regardless of scope, so the CIBA path passes
it a copy of the user with only the fields the approved scopes allow (`email` →
email and `email_verified`; `profile` → name fields). No new builder. It still
emits the role claims, as every ID token does. `LoginMethod` is the approving
session's, so `amr` (`loginMethodToAMR`) says how the user signed in to
approve. `acr` is what the existing issuer sets (`"0"` today).

**Why delegated and action-bound**: the agent asked to do one thing as the
user. A plain user token would hand it the user's full authority; a scope-only
token would let "approve a $20 payment" authorize any payment in scope.
Resource servers must check `act`, `authorization_details` and `ciba.msg`
against the operation; the docs and SDK helpers do this by default.

**Why never Authorizer's own API**: Authorizer's mutating operations rely on a
two-key rule — the scope must be in both the agent's ceiling and the user's own
token (`delegatedscope.go`). CIBA has no user token, so one approval could
unlock, say, `authorizer:account:delete`. Refusing `authorizer:` scopes and an
Authorizer `resource` removes that. Because CIBA tokens have no `sid`, the
existing liveness check (`delegationSessionIsLive`) already rejects them at
Authorizer's API and needs no change.

**Revocation**: the token is stateless, bound by its 5-minute lifetime; a denied
or expired request can never be redeemed; "deny and block" stops new requests
from that agent (§8). Per-token revocation at resource servers is out of scope,
as for token exchange today.

**FGA**: the "agent ∩ user" rule applies to delegated tokens presented to
Authorizer's permission APIs. CIBA tokens are not presented there (their
audience is the external resource), so the resource server enforces the action
itself, using the claims above.

## 6. State and atomicity

Records live in the memory store (Redis, database or in-memory), so no storage
schema changes across the 13+ backends. Keys use SHA-256 of identifiers, never
raw hints or handles.

| Key | Value | TTL |
| --- | --- | --- |
| `ciba:req:<h(auth_req_id)>` | JSON: client, user (or none), scopes, resource, binding message, authorization details, approval id, `expires_at` | request TTL + 10 min grace |
| `ciba:approval:<h(approval id)>` | `h(auth_req_id)` | request TTL |
| `ciba:decision:<h(auth_req_id)>` | `approved` / `denied` + approving sign-in time | request TTL + grace |
| `ciba:redeemed:<h(auth_req_id)>` | `1` | request TTL + grace |
| `ciba:poll:<h(auth_req_id)>` | `1` | current interval − 1 s |
| `ciba:slowdowns:<h(auth_req_id)>` | counter | request TTL + grace |
| `ciba:block:<client>:<h(user)>` | `1` | 1 h after a deny, 24 h after deny-and-block |

- **Expired vs unknown**: records outlive `expires_at` by a grace period, so a
  late poll gets `expired_token`; status always comes from `expires_at`, never
  from key presence alone.
- **Approve vs deny**: `SetCacheNX` on the decision key; the first decision
  wins; a decision after `expires_at` is refused.
- **Single redemption**: `SetCacheNX` on the redeemed key before minting.
- **Polling**: `SetCacheNX` on the poll key with a TTL one second under the
  interval (the in-memory store treats an entry as live through its expiry
  second); a hit means too fast → `slow_down`, and `IncrementCache` on the
  slowdowns key adds 5 s.
- **Approval form token**: the consent screen's pattern, `SetState` on render
  and `GetAndRemoveState` on submit (§4.3), so it lives outside the table above.

These use `SetCacheNX`, `IncrementCache` and `SetCache`/`GetCache`, which exist
in the Redis, database and in-memory backends; no new memory-store primitive is
needed in 4a.

## 7. Security

1. **Who can start a request**: only an opted-in `service_account`; never a
   dynamic or CIMD client.
2. **Who can approve**: only the user, in an Authorizer cookie session, after
   recent authentication (step-up), on Authorizer's own page. No bearer token
   and no other client can approve.
3. **Tenant boundary**: an org-scoped agent can only target members of its
   organization.
4. **No enumeration**: unknown, revoked, out-of-org, capped and blocked users
   all get a normal `auth_req_id` ending in `expired_token`; identical caps and
   timing; no `unknown_user_id`.
5. **Action binding**: the token carries what was approved; the binding message
   is labelled unverified and filtered for spoofing characters.
6. **Least authority**: delegated, single external resource, 5 minutes, no
   `authorizer:` scopes, minimal ID token.
7. **Fatigue and spam**: per-(client, user) and per-user caps, a block after a
   deny, one-click "deny and block", alerts on high deny rates (§10).
8. **CSRF and clickjacking**: the consent screen's single-use per-render form
   token plus an `Origin` check;
   `frame-ancestors 'none'`; the approval id is not a credential.
9. **Handles**: `auth_req_id` (256 bits) and approval id (128 bits) are
   independent, single-use, expiring, and stored hashed.
10. **No sensitive logging**: hints, `auth_req_id`, approval ids and binding
    messages are never logged or audited in clear (hash or length only).
11. **Fail closed**: any storage or notification error at approval or
    redemption denies.

## 8. Rate limits

- Per-IP limits apply as for every endpoint.
- Per client: N requests per minute, counted with `IncrementCache` the way the
  login lockout already counts attempts (`service/login.go`). Keys include the
  window start (`ciba:rate:<client>:<minute>`), so the counter's TTL — which
  `IncrementCache` resets on each call — cannot slide the window. Over the
  limit is `access_denied` (403). A general per-client limiter remains phase 6
  (§13, decision 6).
- Per (client, user): `--ciba-max-requests-per-user` per request-TTL window.
- Per user across all clients: `--ciba-max-requests-per-user-total`.
- After a deny, the (client, user) pair is blocked for 1 hour; "deny and block"
  blocks it for 24 hours.
- Over a per-user cap or blocked: the fake-success path (§4.1), so neither is
  an oracle.
- Counters key on the hashed, verified user id (the `sub` of an
  `id_token_hint`, the canonical `login_hint`), so encoding variants cannot
  multiply a cap and keys stay bounded in size.
- Polling: `slow_down` (CIBA §11).

## 9. Discovery and client metadata

With `--enable-ciba`, `/.well-known/openid-configuration` adds
`backchannel_authentication_endpoint`,
`backchannel_token_delivery_modes_supported: ["poll"]`,
`backchannel_user_code_parameter_supported: false`, and the CIBA grant in
`grant_types_supported`. `authorization_details_types_supported` is omitted
(types are free-form in 4a). No delivery mode or notification endpoint is
stored per client in 4a (that would be a schema change); ping in 4b adds both.

## 10. Audit, metrics, dashboard

- Audit: `ciba.requested`, `ciba.approved`, `ciba.denied`, `ciba.blocked`,
  `ciba.expired`, `ciba.token_issued` — agent as actor, user as resource,
  hashes or lengths only for user-visible text.
- Metrics: request / decision / redemption counters, time-to-decision
  histogram, deny rate per client (alertable), channel failures.
- Dashboard: per-client CIBA toggle; recent requests per client and user
  (status, timestamps, decision — from audit data); the new events in audit
  filters.

## 11. API surfaces and adoption kit

| Surface | Change |
| --- | --- |
| HTTP | `POST /oauth/bc-authorize`; CIBA grant on `/oauth/token`; `GET`/`POST /oauth/bc-approve` |
| GraphQL / gRPC / REST | `grant_types` on admin client create/update/read (`make generate-graphql`, `make proto-gen`, `make proto-gen-clients`) |
| Dashboard | §10 |
| SDKs | JS and Python: a `requireApproval(...)` helper that starts a request and polls with backoff, and a resource-server helper that verifies `act`, `authorization_details` and `ciba.msg`. Go on demand |
| MCP | Reference example (`authorizerdev/examples/with-ciba`): an MCP tool gated by approval; when the MCP host supports URL-mode elicitation, the tool surfaces the approval link to the user directly |
| Docs | A CIBA guide (setup, Redis and SMTP requirements, resource-server verification), and a step-up guide for agents that can open the user's browser (§1.1: `prompt=login` / `max_age`, `auth_time`, then token exchange) |

## 12. Tests

- **Unit**: every §4.1 rule; binding-message and authorization-details
  character filtering; the state machine; interval growth; key hashing.
- **Integration (SQLite)**: full poll flow; deny; deny-and-block; expiry
  (`expired_token` in grace, `invalid_grant` after); double redemption; wrong
  client; unknown, revoked, out-of-org, capped and blocked users
  indistinguishable from real ones (status, body); `id_token_hint` with a
  foreign `aud`; `resource` equal to Authorizer refused; `authorizer:` scopes
  refused; bearer token on the approval page refused; a logged-out (revoked) session
  cookie refused; another user's session refused; stale session and
  magic-link session require step-up; the login UI returns to the approval page
  after sign-in and to no other `/oauth/*` URL; expired `id_token_hint`
  refused; missing, forged or reused form token and
  cross-origin POST refused; delegated token cannot approve; approve/deny race;
  approve after expiry; dynamic and CIMD clients refused; existing clients
  unaffected.
- **Memory store**: the flow against Redis and the database store
  (`TEST_ENABLE_REDIS=1`).
- **Release smoke**: end-to-end approval against the real binary, including the
  token's `authorization_details` and `ciba` claims.
- **Probe tests** (merge blockers): responses for known and unknown users are
  indistinguishable in status, body and timing distribution.

## 13. Decisions

Recommended by the reviews; confirm before implementation.

1. **Email / phone `login_hint`: no.** Agents already hold the user's `sub`
   through delegation or an ID token; address hints would make any allowed
   agent an address-book spammer. Revisit only as a per-client, org-scoped,
   verified-address-only option behind the §8 caps.
2. **Approval lifetime: one approval, one action-bound 5-minute token.** A
   standing window turns a per-action approval into a grant; if added in 4b, it
   is capped (≤ 1 hour) and the duration is shown on the page.
3. **Ping mode: 4b, on demand.** It needs a schema change and SSRF hardening;
   requests expire within 10 minutes anyway.
4. **Channels**: email whenever SMTP is configured; the webhook whenever an
   endpoint is registered for `user.approval_requested` (registering it is the
   opt-in). In-app approval arrives in 4b.
5. **Step-up strength**: a session whose login method is `magic_link_login`
   does not satisfy step-up, because the approval link also arrived by email.
   Password, mobile OTP (SMS), passkey, social and SSO sessions do. The rule
   cannot see MFA (it is not recorded in the session), so a magic-link login
   that also passed MFA is still refused; recording MFA in `SessionData` would
   be an additive field, left out of 4a. (Alternative: accept any recent
   sign-in, and rely on the user's own email security.)
6. **Rate limiting**: CIBA's limits use the existing `IncrementCache` counter
   (reuse) rather than building the general per-client limiter in 4a, which the
   CTO review suggested; the general limiter stays in phase 6.
7. **`id_token_hint` must be unexpired.** `ParseJWTToken` rejects an expired
   `exp`, and reusing it keeps one verification path. CIBA §14 allows a grace
   period, which needs a second parser that verifies the signature but skips
   `exp`. Background agents should send `login_hint` (the user id), which
   never expires.

## 14. Rollout

- Beta in the next minor release, off by default, documented as beta.
- A `security-engineer` review of the implementation before merge; the probe
  tests in §12 are merge blockers.
- The pending-request and polling core is written so the device authorization
  grant (RFC 8628) can reuse it.

### 14.1 What is reused, extended, and new

| Need | Reused as-is | Extended | New |
| --- | --- | --- | --- |
| Client authentication | `clientauth.ResolveClient` + `RequireServiceAccountKind` | — | per-client `grant_types` check |
| User lookup, tenant check | `GetUserByID`, `GetOrgMembership`, `storage.IsNotFound` | — | — |
| Pending state, single use, polling | `SetCache`/`GetCache`, `SetCacheNX`, `IncrementCache` | — | — |
| Hints | `ParseJWTToken`, the `token_type` check of `parseIDTokenHintSubject` | — | `aud` check |
| Approval page | `au_shell.tmpl` partials, `consentError`, no-store headers, `ValidateBrowserSession`, `SessionData.EffectiveAuthTime()`, `SetState`/`GetAndRemoveState` form token, the `csrf.go` exemption pattern, the SAML IdP `/app?redirect_uri=` bounce and `app.go`'s `redirect_uri` check | `forceReauth` session revocation moved into a shared helper; `isCibaApproveURL` beside `isSamlIdpContinueURL` in the login UI | `ciba_approve.tmpl`, `/oauth/bc-approve` handler, session binding and `Origin` check on the POST |
| Token | `CreateDelegatedAccessToken` (no `sid`), `CreateIDToken` (scope-redacted user; `amr` from the approving session) | two optional `DelegationTokenConfig` fields | — |
| Notifications | `email.Provider.SendEmail`, `asyncutil.Go`, webhook delivery | webhook payload variant (as SCIM) | `ciba_approval` template, `user.approval_requested` event |
| Limits | `IncrementCache` (login-lockout pattern) | — | — |
| Discovery, audit, metrics | `openid_config.go` conditional fields, `audit.Event`, `metrics.RecordSecurityEvent` | — | event constants |
| Admin API | client registry `grant_types` column | `grant_types` on admin client APIs | — |
| Endpoints | — | CIBA branch in `/oauth/token` | `/oauth/bc-authorize` |

No storage schema changes; no new memory-store primitive. One login-UI change
(`web/app`), with its own test.

## 15. Review log

Revision 4 (every code claim checked line by line; seven were wrong):

- **Session check**: decrypting the cookie (as the `max_age` branch does) would
  accept a logged-out session. The page uses `ValidateBrowserSession`, which
  checks the memory store.
- **Sign-in detour**: the login UI does not return to an arbitrary
  `redirect_uri`; it resumes only `/authorize` or the exact SAML IdP shape. The
  design copies the SAML continuation and adds `isCibaApproveURL` (a
  `web/app` change). The own origin is not "already required" in
  `--allowed-origins`; a startup warning covers it.
- **CSRF**: the consent POST resolves the user with a call that accepts bearer
  tokens and has no `Origin` check, so session binding and the `Origin` check
  are new, not reused. All three memory stores expire `SetState` after 10
  minutes (rev 3 said the in-memory store did not).
- **`auth_time`** is on ID and refresh tokens, not access or delegated tokens;
  §1.1 now says the agent checks it and the resource server cannot.
- **`id_token_hint`**: `ParseJWTToken` rejects expired tokens, so the 30-day
  grace would need a new parser; 4a takes unexpired hints only (decision 7).
- **Step-up**: there is no email-OTP login method, and `SessionData` does not
  record MFA; decision 5 is restated on `magic_link_login` alone, with a
  startup warning for magic-link-only deployments.
- Verified and unchanged: `RequireServiceAccountKind` rejects before the
  secret and excludes dynamic (`ClientKindDynamic`) and metadata-document
  clients; `grant_types` is written only by `register_client.go` and absent
  from admin APIs; delegated tokens without `sid` fail
  `delegationSessionIsLive`; `CreateIDToken` copies every user field and takes
  `aud` from `cfg.ClientID`; `SetCacheNX`/`IncrementCache` exist in all three
  stores; the in-memory store treats an entry as live through its expiry
  second; the login lockout uses `IncrementCache`; `GetOrgMembership`,
  `Client.OrgID`, `RegisterScimGroupEvent`, webhook logs storing the request
  body, `authorizer:account:delete`.

Revision 3 (reuse pass against the current code, nothing assumed):

- Added §1.1: desktop agents that can open the user's browser are already
  covered by `prompt=login` / `max_age` + `auth_time` + token exchange; CIBA is
  only for agents that cannot reach the user's browser.
- Approval page rebuilt from existing pieces: session-cookie-only
  authentication, `max_age`-style step-up via `EffectiveAuthTime()`, the
  existing `forceReauth` revocation (shared helper), the `/app` login detour
  with its existing `redirect_uri` check, and the consent screen's
  `SetState`/`GetAndRemoveState` form token in place of a new nonce store. The
  approval id is no longer claimed to be hidden across login (it is in the
  emailed link anyway, and is not a credential).
- Tokens from existing minters: `CreateDelegatedAccessToken` with no `sid`
  (existing rule: cannot authenticate at Authorizer), two optional config
  fields; `CreateIDToken` given a scope-redacted user instead of a new builder.
- Rate limits on `IncrementCache` (login-lockout pattern) instead of a new
  general limiter in 4a.
- New decision 5: a magic-link or email-OTP-only session does not satisfy
  step-up for an emailed approval link.
- Reuse table (§14.1).

Revision 2 incorporates:

- **Principal-engineer review**: the `id_token_hint` audience rule (CIBA §14);
  `grant_types` not exposed by admin APIs; expired vs unknown needs a grace
  period; no client metadata in 4a; a server-rendered approval route; async
  notifications; TLS and replica requirements; section-reference clarity.
- **Security review** (1 critical, 4 high, 3 medium, 3 low):
  - *C1* any client holding a user access token could approve → approval only
    in an Authorizer cookie session; in-app API moved to 4b behind an
    allow-list.
  - *H1* CSRF relied on the approval id, which travels in emails and webhooks →
    per-render session-bound nonce plus `Origin` check; the approval id is a
    lookup handle only.
  - *H2* no tenant boundary → org membership required for org-scoped agents.
  - *H3* token not bound to the action → `authorization_details` and `ciba`
    claims; binding message labelled unverified; `Cf` characters refused.
  - *H4* two-key protection for `authorizer:` scopes lost → exactly one
    external `resource`; `authorizer:` scopes refused; no Authorizer-audience
    tokens (which also removes the liveness-check change).
  - *M1* approval fatigue → per-user caps, block after a deny, deny-and-block,
    fixed-window counters. *M2* "agent ∩ user" wrongly claimed for CIBA tokens
    → corrected; startup warning without `type agent`. *M3* the ID token
    over-shared the profile → minimal CIBA ID token.
  - *Low*: no list primitive (in-app list moved to 4b); hint keys hashed and
    canonicalized; poll TTL boundary; approval id kept out of the login UI's
    URL; no sensitive logging.
- **CTO review**: go on a changed scope — action binding in 4a; adoption kit
  (JS/Python helpers, MCP example with URL elicitation, dashboard, docs) in the
  same release; a general per-client limiter; a reusable pending-request core
  for RFC 8628; startup guards; beta label.
