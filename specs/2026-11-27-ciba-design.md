# CIBA: human approval for agent actions

**Status**: design, for review. Phase 4 of the agent-readiness plan.
Builds on RFC 8693 delegation (`AGENTIC_DELEGATION_DESIGN.md`), the consent
screen (`2026-08-11-cimd-and-consent.md`) and FGA conditions (authorizer#945,
released in 2.4.10).

**Spec**: OpenID Connect Client-Initiated Backchannel Authentication Flow —
Core 1.0 (Final, 2021-09-01). `CIBA §N` refers to a section of that spec;
a plain `§N` refers to a section of this document.

---

## 1. The problem

An agent holding a delegated token can act within what it was granted. Some
actions should not be decided by a grant made in advance at all: send this
payment, delete this repository, email this customer. The user should approve
**that** action, **now**, on a device they control, and the agent should get
authority for that action only after they say yes.

Today the only interactive path is `/authorize`, which needs a browser on the
same device as the client. A headless agent has none. `consent.go` already
refuses delegated callers with the note *"Human-in-the-loop approval for a
headless agent is CIBA's job"*.

CIBA is the standard shape for this: the client (the agent) calls a backchannel
endpoint naming the user, the server reaches the user out of band, the user
approves or denies, and the client collects the result at the token endpoint.

## 2. Scope

**In (phase 4a)**

- Backchannel authentication endpoint, **poll** mode only.
- Hints: `login_hint` (an Authorizer user id) and `id_token_hint` (an ID token
  this server issued). `login_hint_token` is rejected.
- `binding_message` shown to the user; `resource` (RFC 8707) to bind the
  resulting token's audience.
- Out-of-band channels: email (new template), webhook event (so an app can push
  to its own mobile app), and an in-app API for first-party apps.
- A server-rendered approval page, reusing the consent screen's template and
  rules (§4.3).
- The CIBA grant at `/oauth/token`, issuing a **delegated token** (§5).
- Discovery metadata, audit events, metrics, rate limits.

**Later (phase 4b)**

- **Ping** mode (CIBA §10.2).
- Rich Authorization Requests (RFC 9396 `authorization_details`) on the request,
  shown on the approval page and echoed in the token response.
- Optional: an approval writes a time-limited FGA grant (a `non_expired_grant`
  tuple) instead of, or as well as, issuing a token.

**Out**

- **Push** mode. It delivers tokens to the client without the client
  authenticating at the token endpoint (CIBA §14), and needs sender-constrained
  tokens to be safe. Poll and ping cover the agent use case.
- Signed authentication requests (CIBA §7.1.1), `user_code` (CIBA §7.1.2),
  `login_hint_token`, and email or phone as `login_hint` (open question 1).

## 3. Configuration

| Flag | Default | Meaning |
| --- | --- | --- |
| `--enable-ciba` | `false` | Serves the backchannel endpoint and advertises it. Off: no route, no metadata, the grant type is `unsupported_grant_type`. |
| `--ciba-request-ttl` | `300` (s) | Lifetime of a request (`expires_in`). `requested_expiry` may shorten it, never lengthen it. Max 600. |
| `--ciba-poll-interval` | `5` (s) | `interval` returned to clients. |
| `--ciba-max-pending-per-user` | `3` | Requests one client may make for one user per request-TTL window. |

Per client, CIBA is **opt-in**: a client may use it only when its registry row's
`grant_types` includes `urn:openid:params:grant-type:ciba`, and only if it is a
`service_account`. CIBA §7.2 recommends against shared secrets, so workload identity
(RFC 7523 client assertions from a registered trusted issuer) is preferred over
a client secret; a client-signed `private_key_jwt` against the client's own JWKS
is not supported by Authorizer today and is not added here.

The `grant_types` column already exists on every storage backend (no schema
change), but it is written only by dynamic registration and is enforced
nowhere, and the admin client APIs (`_create_client` / `_update_client`, gRPC,
REST) do not expose it. 4a adds an additive `grant_types` field to those APIs
and makes CIBA the first grant that is enforced against it; no existing
client's behaviour changes.

`--enable-ciba` refuses to start unless `--url` is set, and warns unless it is
`https` (or `localhost` for development): CIBA §7 requires TLS on the backchannel
endpoint, and the approval link and token audience are built from `--url`.

Multiple replicas need a shared memory store (Redis or the database store), as
for sessions today: with the in-memory store a request made on one replica is
invisible to the others.

## 4. The flow

```
Agent (service account)          Authorizer                         User
       │  POST /oauth/bc-authorize  │                                  │
       │  client auth, scope=openid │                                  │
       │  login_hint=<user id>      │                                  │
       │  binding_message, resource │                                  │
       │ ─────────────────────────► │  record (pending, TTL)           │
       │ ◄───────────────────────── │  email / webhook / in-app ─────► │
       │  {auth_req_id, expires_in, │                                  │
       │   interval}                │       /oauth/bc-approve page     │
       │                            │ ◄──────────── approve / deny ─── │
       │  POST /oauth/token         │                                  │
       │  grant_type=…:ciba         │                                  │
       │  auth_req_id (every 5 s)   │                                  │
       │ ─────────────────────────► │                                  │
       │ ◄───────────────────────── │  authorization_pending … then    │
       │                            │  tokens (or access_denied /      │
       │                            │  expired_token)                  │
```

### 4.1 Backchannel request — `POST /oauth/bc-authorize`

Form-encoded, client-authenticated with the same `clientauth.ResolveClient` the
token endpoint uses, with `RequireServiceAccountKind` (so an interactive client
is refused before its secret is checked).

Validation, in order:

1. Client may use CIBA (§3), else `unauthorized_client`.
2. `scope` contains `openid` (CIBA §7.1), else `invalid_scope`. Requested scopes are
   intersected with the client's `allowed_scopes`; an empty result is
   `invalid_scope`.
3. Exactly one hint (CIBA §7.1): `login_hint` or `id_token_hint`; `login_hint_token`
   or two hints is `invalid_request`. `acr_values` is accepted and ignored in 4a
   (no `acr` claim is issued); other unrecognized parameters are ignored (CIBA §7.2).
4. `binding_message`: required by Authorizer (the spec makes it optional) — it
   is the only thing that tells the user *which* action they are approving.
   Missing is `invalid_request`; longer than 64 characters or containing
   control characters is `invalid_binding_message`.
5. `resource`: at most one absolute URI, as on the token-exchange grant. It
   becomes the token's `aud`; omitted means Authorizer's own URL.
6. Per-client and per-user caps (§8), else `access_denied` (403) with a
   generic description. CIBA defines no rate-limit error for this endpoint. The
   per-user counter is keyed on the hint value whether or not that user exists,
   so the cap behaves identically for real and unknown users.

Response (CIBA §7.3):

```json
{ "auth_req_id": "<43-char base64url, 256 bits>", "expires_in": 300, "interval": 5 }
```

**User resolution never leaks.**

- `login_hint` is an Authorizer user id, looked up with `GetUserByID`. (CIBA §7.1
  allows email, phone or username too; see open question 1.)
- `id_token_hint` must be an ID token this server signed, whose `aud` contains
  the requesting client (CIBA §14: "the Client presenting the id_token_hint is
  listed in the audience claim"), else `invalid_request`. This reveals nothing
  about the user: it is a check on the token the agent presented. In practice that is the ID token the agent
  received from an earlier CIBA approval. Expired tokens are accepted for up to
  30 days after `exp` (CIBA §14 permits "some reasonable period"); its `sub` is used.
- If the user does not exist or is revoked, the endpoint still answers 200 with
  an `auth_req_id` that never becomes approvable and ends in `expired_token`.
  `unknown_user_id` (CIBA §13) is deliberately never returned: on an endpoint any
  allowed agent can call, it would be an account-existence oracle.
- Notifications are sent in the background (`asyncutil.Go`), after the response
  is written, so response time does not reveal whether a user exists or has an
  email address.
- A storage *failure* (not `storage.IsNotFound`) is a 500, never a fake
  success.

### 4.2 Reaching the user

The request record gets a separate **approval id** (128-bit, unrelated to
`auth_req_id`) — the user-side handle. The agent never sees it; the user never
sees `auth_req_id`.

- **Email** — new template `ciba_approval`: agent name, binding message,
  scopes, resource, expiry, and a link to `<url>/oauth/bc-approve?id=<approval id>`.
- **Webhook** — new event `user.approval_requested` with the same fields and the
  approval id, so an app can push a notification to its own mobile app. Webhook
  payloads are user-centric today (`RegisterEvent(…, user)`); this needs a
  payload variant, as `RegisterScimGroupEvent` already does for SCIM.
- **In-app** — GraphQL/REST/gRPC for the signed-in user:
  `backchannel_requests` (list my pending requests) and
  `respond_backchannel_request(approval_id, decision)`. First-party apps can
  show approvals without email.

A failed or unavailable channel (no SMTP, no verified email, webhook down) does
not cancel the request: it stays pending and approvable in-app until it
expires. Channel failures are logged and counted, never returned to the agent.

### 4.3 The approval page

`GET /oauth/bc-approve?id=<approval id>` is server-rendered from the consent
template (like the consent screen, not a page of the `/app` SPA) with: the
agent's registered name (and organization, if it has one), the binding message (HTML-escaped,
prominent), scopes, resource and remaining time, and **Approve** / **Deny**,
which `POST` back to the same path.

- No session: the page sends the user through the login UI and back to the
  approval page, using the same login-then-resume pattern `/authorize` uses.
  The return target is this fixed server path, never a client-supplied URL.

- The approver must be signed in, and must be the request's user (same rule as
  `ConsentHandler`). A mismatch shows the generic "request not found" page.
- A delegated token cannot approve (an agent must not approve its own request).
- The `POST` is exempted from the generic CSRF middleware for the same reason
  as `/authorize/consent`: the approval id is a synchronizer token only the
  signed-in user's page holds. It is single-use (the decision key, §6) and
  expires with the request.

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

A **delegated access token**, not a user token: `sub` = the user, `act.sub` =
the agent's `client_id`, scope = the approved scopes ∩ the agent's ceiling,
`aud` = `resource`, and the existing 5-minute lifetime with no refresh token.
Every FGA check made with it still requires both the agent and the user to hold
the permission. Plus an **ID token** (CIBA is an OpenID flow) with `aud` = the
agent's `client_id` and `auth_time` = the approval time.

Why delegated: the agent asked to do one thing as the user. A plain user token
would hand it the user's full authority for the token's lifetime, which is
exactly what this phase exists to prevent.

**Revocation**: the token's `sid` names the **session that approved it** (login
method, user id and nonce, in the existing `DelegationSessionID` shape), so
signing out of that session, a password reset or an admin session wipe kills
the token at Authorizer's own API. A sid pointing at a fresh, separate session
would not work: logout deletes only the current session, so that token would
survive the user signing out.

This needs one change to the existing liveness check. `delegationSessionIsLive`
(`internal/token/delegated_access_token.go`) looks up `access_token_<nonce>`,
and that entry expires with the session's access token (default 30 minutes),
while the browser session's `session_token_<nonce>` entry lives as long as the
session. For a token-exchange subject that is fine, since the subject is a live
access token. A CIBA approval made from the browser therefore binds to the
`session_token_<nonce>` entry, and the check accepts that entry for CIBA-issued
tokens, marked as such in the sid. An in-app approval made with an access token
binds to that token's `access_token_<nonce>` entry, as token exchange does. If
the session is rotated or ends within the token's 5 minutes, the token stops
working at Authorizer's own API (fail closed). Downstream resource servers are
bound by the 5-minute lifetime, as today.

## 6. State and atomicity

Records live in the memory store (Redis, database or in-memory, whichever the
deployment uses), so no storage schema changes across the 13+ backends.

| Key | Value | TTL |
| --- | --- | --- |
| `ciba:req:<auth_req_id>` | JSON: client id, user id (or none, for an unresolvable hint), scopes, resource, binding message, approval id, `expires_at` | request TTL + 10 min grace |
| `ciba:approval:<approval id>` | `auth_req_id` | request TTL |
| `ciba:decision:<auth_req_id>` | `approved` / `denied`, plus the approving session's `sid` | request TTL + grace |
| `ciba:redeemed:<auth_req_id>` | `1` | request TTL + grace |
| `ciba:poll:<auth_req_id>` | `1` | current poll interval |
| `ciba:slowdowns:<auth_req_id>` | counter | request TTL + grace |
| `ciba:rate:<client>:<user>` | counter | request TTL |
| `ciba:rate:<client>` | counter | 60 s |

- **Expired vs unknown**: the request record outlives `expires_at` by a grace
  period, so a poll after expiry gets `expired_token` (CIBA §11), not
  `invalid_grant`. After the grace period the id is unknown (`invalid_grant`).
  Status is always computed from `expires_at`, never from key presence alone.
- **Approve vs deny**: `SetCacheNX` on the decision key; the first decision
  wins and is final. A decision after `expires_at` is refused.
- **Single redemption**: `SetCacheNX` on the redeemed key before minting.
- **Polling rate**: `SetCacheNX` on the poll key with TTL = the current
  interval; if it already exists the client polled too fast → `slow_down`, and
  `IncrementCache` on the slowdowns key raises the interval by 5 s (CIBA §11).
- **Caps**: `IncrementCache` counters per window. They count requests in the
  window, not requests still pending, because the store has no atomic
  decrement.

All of these exist in the Redis, database and in-memory backends today
(`SetCacheNX`, `IncrementCache`, `SetCache`/`GetCache`); no new memory-store
primitive is needed.

## 7. Security

1. **Who can start a request**: only a `service_account` client explicitly
   allowed the CIBA grant. Delegated tokens cannot start one either (the
   request is authenticated as the client itself).
2. **Hints**: user ids are opaque UUIDs and ID tokens are signed, so an agent
   can only target users it already knows through a prior interaction. Email or
   phone hints are out of v1: they would let any allowed agent spam approval
   requests at an address book. *(Open question 1.)*
3. **No enumeration**: unknown and revoked users get a normal `auth_req_id`
   that ends in `expired_token`; no `unknown_user_id`; notifications are sent
   after the response so timing is the same.
4. **Phishing and fatigue**: the binding message is required and short; the
   page names the registered agent and its organization; at most
   `--ciba-max-pending-per-user` requests per agent per user per window; denials
   and expiries are audited; per-client request rate is capped.
5. **Unguessable, separated handles**: `auth_req_id` (256 bits) and approval id
   (128 bits) are independent; neither appears in the other side's channel.
   Both are single-use and expire.
6. **Approver binding**: signed-in session, same user, never a delegated token.
7. **Least authority on success**: delegated token, agent ∩ user checks,
   audience-bound, 5-minute lifetime, revocable through its session.
8. **Fail closed**: any storage or notification error at approval or
   redemption denies; nothing defaults to approved.

## 8. Rate limits

- Per-IP limits apply as for every endpoint.
- Per (client, user): at most `--ciba-max-pending-per-user` requests per
  request-TTL window.
- Per client: N requests per minute (fixed default, e.g. 60), counted with
  `IncrementCache`. This is the first per-client limit; the general per-client
  limiter in phase 6 can replace it.
- Polling: `slow_down` per CIBA §11.

## 9. Discovery and client metadata

When `--enable-ciba` is on, `/.well-known/openid-configuration` adds:
`backchannel_authentication_endpoint`,
`backchannel_token_delivery_modes_supported: ["poll"]`,
`backchannel_user_code_parameter_supported: false`, and the CIBA grant in
`grant_types_supported`. Clients are poll-only in 4a, so no
`backchannel_token_delivery_mode` or notification endpoint is stored (that
would be a schema change on every backend); ping in 4b adds both, with the
schema and migration work that implies. Per-client opt-in is the `grant_types`
field (§3).

## 10. Audit and metrics

Audit: `ciba.requested`, `ciba.approved`, `ciba.denied`, `ciba.expired`,
`ciba.token_issued`, with the agent as actor and the user as resource (no
binding message in audit metadata beyond its length, to keep user text out of
logs). Metrics: request / decision / redemption counters and a
time-to-decision histogram.

## 11. API surfaces

| Surface | Change |
| --- | --- |
| HTTP | `POST /oauth/bc-authorize`; CIBA grant on `/oauth/token`; `GET`/`POST /oauth/bc-approve` (CSRF-exempt like consent) |
| GraphQL | `backchannel_requests`, `respond_backchannel_request` (user); `grant_types` on admin client create/update/read |
| gRPC/REST | same as GraphQL via proto (`make proto-gen`, `make proto-gen-clients`) |
| Dashboard | client edit: allow CIBA; audit filters for the new events |
| SDKs | helper to start a request and poll (Go, JS, Python); user-side list/respond |
| MCP | none in 4a |

## 12. Tests

- Unit: request validation table (each §4.1 rule), state transitions, interval
  growth.
- Integration (SQLite): full poll flow; deny; expiry (`expired_token` within
  the grace period, `invalid_grant` after); double redemption; wrong client;
  unknown user indistinguishable from known (same status, body shape and
  error); `id_token_hint` with a foreign `aud` refused; approver mismatch;
  delegated approver refused; approve-after-expiry refused; approve/deny race
  (first decision wins); caps; revocation by signing out of the approving
  session; the issued token's agent ∩ user FGA behaviour; client without the
  grant refused; existing clients unaffected.
- Memory store: the flow against Redis and the database store, not only
  in-memory (`TEST_ENABLE_REDIS=1`).
- Release smoke: an end-to-end CIBA approval against the real binary.

## 13. Open questions

1. **Email / phone `login_hint`**: allow it behind a flag for apps whose agents
   only know an address, or keep user id / ID token only?
2. **Approval lifetime**: one approval = one 5-minute token (proposed), or allow
   the approval to grant a short window (e.g. a time-limited FGA tuple) for a
   multi-step task?
3. **Ping mode in 4a or 4b?** Poll is enough for agents; ping saves polling for
   long-running approvals.
4. **Which channel is on by default** when `--enable-ciba` is set: email only,
   or email + webhook?
