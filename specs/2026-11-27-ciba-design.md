# CIBA: human approval for agent actions

**Status**: design, for review. Phase 4 of the agent-readiness plan.
Builds on RFC 8693 delegation (`AGENTIC_DELEGATION_DESIGN.md`), the consent
screen (`2026-08-11-cimd-and-consent.md`) and FGA conditions (authorizer#945,
released in 2.4.10).

**Spec**: OpenID Connect Client-Initiated Backchannel Authentication Flow —
Core 1.0 (Final, 2021-09-01). Section numbers below refer to it.

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
- Approval page in `/app`, reusing the consent screen's template and rules.
- The CIBA grant at `/oauth/token`, issuing a **delegated token** (§5).
- Discovery metadata, audit events, metrics, rate limits.

**Later (phase 4b)**

- **Ping** mode (§10.2).
- Rich Authorization Requests (RFC 9396 `authorization_details`) on the request,
  shown on the approval page and echoed in the token response.
- Optional: an approval writes a time-limited FGA grant (a `non_expired_grant`
  tuple) instead of, or as well as, issuing a token.

**Out**

- **Push** mode. It delivers tokens to the client without the client
  authenticating at the token endpoint (§14), and needs sender-constrained
  tokens to be safe. Poll and ping cover the agent use case.
- Signed authentication requests (§7.1.1), `user_code` (§7.1.2),
  `login_hint_token`, and email or phone as `login_hint` (see §7.1).

## 3. Configuration

| Flag | Default | Meaning |
| --- | --- | --- |
| `--enable-ciba` | `false` | Serves the backchannel endpoint and advertises it. Off: no route, no metadata, the grant type is `unsupported_grant_type`. |
| `--ciba-request-ttl` | `300` (s) | Lifetime of a request (`expires_in`). `requested_expiry` may shorten it, never lengthen it. Max 600. |
| `--ciba-poll-interval` | `5` (s) | `interval` returned to clients. |
| `--ciba-max-pending-per-user` | `3` | Pending requests one client may hold for one user. |

Per client, CIBA is **opt-in**: a client may use it only when its registry row's
`grant_types` includes `urn:openid:params:grant-type:ciba`, and only if it is a
`service_account` (confidential; §7.2 recommends against shared secrets, so
`private_key_jwt` / workload identity is preferred). `GrantTypes` is written
today but enforced nowhere; CIBA is the first grant to enforce it, so no
existing client's behaviour changes.

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
       │   interval}                │       approval page in /app      │
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
2. `scope` contains `openid` (§7.1), else `invalid_scope`. Requested scopes are
   intersected with the client's `allowed_scopes`; an empty result is
   `invalid_scope`.
3. Exactly one hint (§7.1): `login_hint` or `id_token_hint`; `login_hint_token`
   or two hints is `invalid_request`.
4. `binding_message`: required by Authorizer (the spec makes it optional) — it
   is the only thing that tells the user *which* action they are approving.
   Plain text, at most 64 characters, no control characters, else
   `invalid_binding_message`.
5. `resource`: at most one absolute URI, as on the token-exchange grant. It
   becomes the token's `aud`; omitted means Authorizer's own URL.
6. Per-client and per-user caps (§8), else `access_denied` (403) with a
   generic description. CIBA defines no rate-limit error for this endpoint, and
   the description must not reveal whether the user exists.

Response (§7.3):

```json
{ "auth_req_id": "<43-char base64url, 256 bits>", "expires_in": 300, "interval": 5 }
```

**User resolution never leaks.** `login_hint` is looked up with `GetUserByID`;
`id_token_hint` must carry this server's signature and issuer (an expired token
is accepted, §7.1), and its `sub` is used. If the user does not exist, is
revoked, or has no verified contact channel, the endpoint still answers 200 with
an `auth_req_id` that silently expires (`expired_token`). `unknown_user_id`
(§13) is deliberately never returned: on an endpoint any agent can call, it
would be an account-existence oracle. A storage *failure* (not `IsNotFound`) is
a 500.

### 4.2 Reaching the user

The request record gets a separate **approval id** (128-bit, unrelated to
`auth_req_id`) — the user-side handle. The agent never sees it; the user never
sees `auth_req_id`.

- **Email** — new template `ciba_approval`: agent name, binding message,
  scopes, resource, expiry, and a link to `/app/approve?id=<approval id>`.
- **Webhook** — new event `user.approval_requested` with the same fields (no
  link secrets beyond the approval id), so an app can push a notification to
  its own mobile app.
- **In-app** — GraphQL/REST/gRPC for the signed-in user:
  `backchannel_requests` (list my pending requests) and
  `respond_backchannel_request(approval_id, decision)`. First-party apps can
  show approvals without email.

### 4.3 The approval page

`/app/approve?id=…` renders the consent template with: the agent's registered
name and organization, the binding message (escaped, prominent), scopes,
resource and remaining time, and **Approve** / **Deny**.

- The approver must be signed in, and must be the request's user (same rule as
  `ConsentHandler`). A mismatch shows the generic "request not found" page.
- A delegated token cannot approve (an agent must not approve its own request).
- The approval id is the synchronizer token (the consent-screen CSRF reasoning
  applies), single-use, and expires with the request.

### 4.4 Collecting the result — CIBA grant at `/oauth/token`

`grant_type=urn:openid:params:grant-type:ciba&auth_req_id=…`, client-authenticated.

| Situation | Response |
| --- | --- |
| Unknown id, or issued to another client | `invalid_grant` |
| Pending | `authorization_pending` |
| Polled faster than `interval` | `slow_down`; interval grows by 5 s for this request (§11) |
| Expired | `expired_token` |
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

**Revocation**: approval creates a session entry for the issued token, and its
`sid` points at it (the existing `DelegationSessionID` shape), so the user
signing out or an admin wiping sessions kills the token at Authorizer's own API,
as for token exchange. Downstream resource servers are bound by the 5-minute
lifetime, as today.

## 6. State and atomicity

Records live in the memory store (Redis, database or in-memory, whichever the
deployment uses), so no storage schema changes across the 13+ backends.

| Key | Value | TTL |
| --- | --- | --- |
| `ciba:req:<auth_req_id>` | JSON: client id, user id, scopes, resource, binding message, approval id, created/expires | request TTL |
| `ciba:approval:<approval id>` | `auth_req_id` | request TTL |
| `ciba:decision:<auth_req_id>` | `approved` / `denied` | request TTL |
| `ciba:redeemed:<auth_req_id>` | `1` | request TTL |
| `ciba:poll:<auth_req_id>` | poll counter / last poll | request TTL |
| `ciba:pending:<client>:<user>` | counter | request TTL |

Races are settled with **`SetCacheNX`** (first writer wins, already in every
backend): the decision key makes approve-vs-deny atomic and final, and the
redeemed key makes redemption single-use. `IncrementCache` drives `slow_down`
and the pending caps. No new memory-store primitive is needed.

## 7. Security

1. **Who can start a request**: only a `service_account` client explicitly
   allowed the CIBA grant. Delegated tokens cannot start one either (the
   request is authenticated as the client itself).
2. **Hints**: user ids are opaque UUIDs and ID tokens are signed, so an agent
   can only target users it already knows through a prior interaction. Email or
   phone hints are out of v1: they would let any allowed agent spam approval
   requests at an address book. *(Open question 1.)*
3. **No enumeration**: unknown, revoked and unreachable users all get a normal
   `auth_req_id` that expires; no `unknown_user_id`.
4. **Phishing and fatigue**: the binding message is required and short; the
   page names the registered agent and its organization; at most
   `--ciba-max-pending-per-user` pending requests per agent per user; denials
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
- Per (client, user): `--ciba-max-pending-per-user` pending requests.
- Per client: N requests per minute (fixed default, e.g. 60), counted with
  `IncrementCache`. This is the first per-client limit; the general per-client
  limiter in phase 6 can replace it.
- Polling: `slow_down` per §11.

## 9. Discovery and client metadata

When `--enable-ciba` is on, `/.well-known/openid-configuration` adds:
`backchannel_authentication_endpoint`,
`backchannel_token_delivery_modes_supported: ["poll"]`,
`backchannel_user_code_parameter_supported: false`, and the CIBA grant in
`grant_types_supported`. `_create_client` / `_update_client` accept
`backchannel_token_delivery_mode` (`poll` only in 4a) and the grant type.

## 10. Audit and metrics

Audit: `ciba.requested`, `ciba.approved`, `ciba.denied`, `ciba.expired`,
`ciba.token_issued`, with the agent as actor and the user as resource (no
binding message in audit metadata beyond its length, to keep user text out of
logs). Metrics: request / decision / redemption counters and a
time-to-decision histogram.

## 11. API surfaces

| Surface | Change |
| --- | --- |
| HTTP | `POST /oauth/bc-authorize`; CIBA grant on `/oauth/token`; `/app/approve` page |
| GraphQL | `backchannel_requests`, `respond_backchannel_request` (user); admin client fields |
| gRPC/REST | same as GraphQL via proto (`make proto-gen`, `make proto-gen-clients`) |
| Dashboard | client edit: allow CIBA; audit filters for the new events |
| SDKs | helper to start a request and poll (Go, JS, Python); user-side list/respond |
| MCP | none in 4a |

## 12. Tests

- Unit: request validation table (each §4.1 rule), state transitions, interval
  growth.
- Integration (SQLite): full poll flow; deny; expiry; double redemption; wrong
  client; unknown user indistinguishable from known; approver mismatch;
  delegated approver refused; caps; revocation through sign-out; the issued
  token's agent ∩ user FGA behaviour.
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
