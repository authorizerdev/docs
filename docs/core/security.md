---
sidebar_position: 9
title: Security Hardening
---

# Security Hardening

This page documents the security-relevant CLI flags introduced in the
April 2026 hardening pass, along with the operational guidance you need
to deploy them safely. Most of the hardening is on by default and
requires no action; the few breaking changes are flagged at the top.

---

## TL;DR — Breaking changes

If you are upgrading from a release **before** the April 2026 security
batch, you must address these two items before restarting:

1. **`--admin-secret` is now required.** The previous `"password"` default
   is gone. Empty (or absent) `--admin-secret` causes the server to exit
   immediately with a fatal error. Pick any non-empty value; the strength
   of the secret is your responsibility.

   ```bash
   ./authorizer --admin-secret="$(openssl rand -hex 32)" ...
   ```

2. **`--trusted-proxies` defaults to none.** Rate limiting, audit logs,
   and CSRF same-origin checks now key on `RemoteAddr` by default — they
   ignore `X-Forwarded-For` unless you opt in. If you run Authorizer
   behind a reverse proxy (nginx, ALB, Cloudflare, an ingress
   controller), you must list the proxy's network in CIDR form or your
   metrics and rate limits will be keyed on the proxy IP instead of the
   real client IP.

   ```bash
   ./authorizer \
     --trusted-proxies=10.0.0.0/8,127.0.0.1/32 \
     ...
   ```

   See [Trusted proxies](#trusted-proxies) below for details.

Everything else in this document is opt-in or already on by default.

---

## Admin authentication

```bash
./authorizer \
  --admin-secret="$(openssl rand -hex 32)" \
  --disable-admin-header-auth=true
```

- **`--admin-secret`** (required, non-empty): the super-admin secret used
  to authenticate admin operations. The previous insecure `"password"`
  default is gone — startup fails fast if you forget to set it. Pick any
  value you trust; the server only enforces non-emptiness.
- **`--disable-admin-header-auth`** (default `false`): when `true`, the
  `X-Authorizer-Admin-Secret` header is no longer accepted as admin
  authentication; only the secure admin cookie is honoured. **Recommended
  for production.**

---

## Refresh tokens

```bash
./authorizer --refresh-token-expires-in=2592000
```

- **`--refresh-token-expires-in`** (default `2592000`, 30 days): refresh
  token lifetime in seconds. Previously hardcoded to 30 days. Shorten
  for higher-security deployments where re-authentication is acceptable;
  lengthen for long-lived sessions where a 30-day window is too short.

**Revocation on password reset**: a successful [`reset_password`](./graphql-api#reset_password)
synchronously deletes all of the user's existing sessions and refresh
tokens from the session store before the mutation returns — any
pre-existing session or refresh token is rejected immediately after. This
closes the gap where an attacker holding a live session before the reset
kept access after it.

---

## Trusted proxies

```bash
./authorizer --trusted-proxies=10.0.0.0/8,127.0.0.1/32
```

- **`--trusted-proxies`** (default empty, comma-separated CIDRs): list of
  reverse-proxy networks whose `X-Forwarded-For` and similar forwarded
  headers Gin will honour when computing the client IP.

When the list is **empty** (the default), Gin falls back to `RemoteAddr`
and the application is immune to spoofed `X-Forwarded-For` headers.

When the list contains CIDRs, Gin trusts forwarded headers from connections
originating in those networks. If you run Authorizer behind a reverse
proxy you **must** set this flag, otherwise:

| Subsystem | Behaviour without `--trusted-proxies` |
|---|---|
| Per-IP rate limiting | All requests appear to come from the proxy → one rate-limit bucket for the entire fleet → trivial to exhaust. |
| Audit logs | Every event is recorded with the proxy IP, not the user's. |
| CSRF same-origin enforcement | Uses the request `Host` header (unaffected); but combined with the wrong client IP makes investigations harder. |
| [Prometheus](https://prometheus.io) metrics | `authorizer_http_requests_total` labelled by proxy IP only. |

### Common deployments

| Topology | `--trusted-proxies` value |
|---|---|
| Single host, no proxy | leave empty |
| Behind nginx on the same host | `127.0.0.1/32,::1/128` |
| Behind Cloudflare | the [Cloudflare IP ranges](https://www.cloudflare.com/ips/) |
| Behind an AWS ALB | the VPC CIDR (e.g. `10.0.0.0/16`) |
| Inside a Kubernetes cluster | the pod and service CIDRs (e.g. `10.0.0.0/8`) |

---

## Trusted base URL

```bash
./authorizer --url=https://auth.example.com
```

:::warning Required as of 2.4.0
The server **refuses to start** without `--url`. Deployments upgrading from
2.3.x that never set it will fail to boot until they do — see
[Upgrading to 2.4.0](../migration/v1-to-v2#upgrading-from-23x-to-240).
:::

- **`--url`** (**required**): the operator-configured canonical base URL of
  this Authorizer instance. It is the **only** source used to
  derive the server's own host — verification/reset/magic-link email links,
  the JWT `iss` claim, and the OIDC discovery/JWKS document URLs — and every
  request header that could otherwise influence it (`X-Authorizer-URL`,
  `X-Forwarded-Host`, `Host`) is ignored. The value is normalized to
  scheme+host (path, query, fragment, userinfo, and trailing slash stripped)
  and pinned once at startup, before any listener accepts a connection. A
  value that cannot be normalized — `auth.example.com` with no scheme, or a
  URL carrying user info — is **rejected at startup** rather than silently
  ignored, since either would otherwise start in the vulnerable configuration
  while looking configured.

Before 2.4.0 the flag was optional, and leaving it empty fell back to
header-based derivation (`X-Authorizer-URL`, then `X-Forwarded-Host`/`Host`).
That fallback is a host-header-injection account-takeover surface (CWE-640):
a request with a forged host header causes a password-reset or verification
email to carry a **genuine** single-use link pointing at an attacker-controlled
domain — no prior access and no mailbox compromise required. Making the flag
mandatory is the only fix that closes the class; validating the derived host
against `--allowed-origins` would help only deployments that configured an
explicit list, and would do nothing on the default `*` — which is the
configuration the attack targets.

This costs no supported capability. Setting `--url` already collapsed an
instance to a single canonical host, so serving several hostnames from one
instance only ever worked on the vulnerable path. Verified organization
domains are email-domain-to-organization routing for home realm discovery,
not HTTP virtual hosting, and are unaffected.

### `--url` vs `--allowed-origins` vs the SDKs' `authorizerURL`

Three similarly-named settings that mean different things. Confusing `--url`
with `--allowed-origins` is the most common misconfiguration:

| Setting | Lives in | Names | Example |
|---|---|---|---|
| `--url` | server flag | **This server's own address** — the single host Authorizer believes it is reachable at. | `https://auth.example.com` |
| `--allowed-origins` | server flag | **The other apps** permitted to call this server cross-origin and be redirected to. | `https://app.example.com,https://admin.example.com` |
| `authorizerURL` | SDK / client option | **The client's pointer back at the server** — what a browser or backend SDK dials. Normally the same value as `--url`. | `https://auth.example.com` |

You need both flags and they are not interchangeable: `--url` is *where
Authorizer is*, `--allowed-origins` is *who may talk to it*. There is no
`--authorizer-url` server flag; `authorizerURL` is client-side only, and
`X-Authorizer-URL` is the legacy request header `--url` replaces — ignored
outright as of 2.4.0.

---

## CORS, CSRF, and origin enforcement

### CORS

```bash
./authorizer --allowed-origins=https://app.example.com,https://admin.example.com
```

- **`--allowed-origins`** (default `*`): comma-separated list of origins
  permitted to send credentialed cross-origin requests.

A startup warning is logged when `--allowed-origins` contains `*` —
this default is for development convenience and is never recommended
for production. Set an explicit allowlist before deploying.

### CSRF

CSRF protection is automatic and applies to every state-changing request
(POST, PUT, PATCH, DELETE) other than the OAuth callback and token
endpoints. Requirements:

1. **`Origin` or `Referer` header must be present.** Requests with
   neither are rejected with `403`. Browsers always send `Origin` on
   cross-origin POSTs, so this only affects scripted/curl traffic; add
   `-H "Origin: https://your-host"` if you hit it.
2. **The Origin must be in the allowlist.** When `--allowed-origins`
   contains `*`, the CSRF middleware falls back to **same-origin
   enforcement** — the Origin host must match the request `Host`. Wildcard
   CORS does not mean wildcard CSRF.
3. **One of `Content-Type: application/json` or `X-Requested-With` must
   be present.** Browsers cannot set these cross-origin without a
   successful preflight, providing a second defence layer.

There is no flag to disable CSRF — if you need to bypass it for a
specific automated client, use the bearer-token flow on `/oauth/token`
instead of cookie-based auth.

---

## HTTP server timeouts and graceful shutdown

The main HTTP server is now built with explicit timeouts to defend
against slowloris and other slow-client DoS, and shuts down gracefully
on SIGTERM/SIGINT (the metrics server already did this). No flags — the
defaults are conservative:

| Setting | Value |
|---|---|
| `ReadHeaderTimeout` | 10 s |
| `ReadTimeout` | 30 s |
| `WriteTimeout` | 60 s |
| `IdleTimeout` | 120 s |
| `MaxHeaderBytes` | 1 MiB |
| Graceful shutdown drain | 30 s |

If your deployment includes long-running uploads or streaming responses
that exceed `WriteTimeout`, file an issue — we may need to make these
configurable.

---

## Security response headers

```bash
./authorizer \
  --enable-hsts=true \
  --disable-csp=false
```

The following headers are always set:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-XSS-Protection` | `0` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=(), payment=(), usb=()` |

Token endpoint responses (`/oauth/token`) additionally set
`Cache-Control: no-store, no-cache, must-revalidate, private` and
`Pragma: no-cache` per [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) §5.1.

Two opt-in flags:

- **`--enable-hsts`** (default `false`): emit
  `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Only
  enable when you serve over TLS — turning HSTS on without TLS will lock
  browsers out for a year.
- **`--disable-csp`** (default `false`): disable the default
  `Content-Security-Policy` header. CSP is **on by default**:

  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
  ```

  The `unsafe-inline` allowances are temporary — they will be tightened
  as the dashboard migrates away from inline styles. Use `--disable-csp=true`
  only as an escape hatch if the default policy breaks a customised
  dashboard in the wild.

---

## OAuth flow hardening

Two fixes apply automatically; no flags.

1. **`response_mode=query` is rejected for token-bearing flows.** The
   `/authorize` endpoint now refuses `response_mode=query` when the
   `response_type` includes `token` or `id_token` (implicit and hybrid
   flows). Tokens in the URL query string get logged in proxy access
   logs and browser history — a real credential leak path. Allowed
   combinations:

   | `response_type` | `response_mode` |
   |---|---|
   | `code` | `query`, `fragment`, `form_post` |
   | `token`, `id_token`, hybrids | `fragment`, `form_post` |

2. **`GET /logout` is hardened against CSRF.** The endpoint still
   exists (OIDC RP-initiated logout requires it) but only terminates
   the session under one of two conditions:

   - The request includes a valid `id_token_hint` query parameter (an
     `<img>` tag CSRF cannot synthesise a valid signed ID token), OR
   - The user clicks through an HTML confirmation page that issues a
     POST to `/logout`.

   Plain `GET /logout` without `id_token_hint` now serves the
   confirmation page instead of silently signing the user out. POST
   `/logout` is unchanged — first-party SDKs (`authorizer-js`,
   `authorizer-go`, web/app, web/dashboard) all use the GraphQL
   `logout` mutation and are unaffected.

---

## Webhook SSRF protection

Outbound webhook calls now resolve the destination host **once** and pin
the dialer to the validated IP, defeating DNS rebinding TOCTOU attacks
where an attacker's DNS server returns a public IP for validation and a
private IP (e.g. AWS metadata `169.254.169.254`) for the actual dial.

Private, loopback, link-local, and reserved IP ranges are rejected
before the dial. TLS verification still uses the original hostname via
SNI, so HTTPS webhooks work normally.

No flags. The protection applies to:

- Admin "Test endpoint" GraphQL mutation
- The webhook event dispatcher (every triggered webhook)

---

## OTP and TOTP at rest

OTP and [TOTP](https://datatracker.ietf.org/doc/html/rfc6238) secrets are now protected at rest:

- **OTPs (email/SMS one-time codes):** stored as HMAC-SHA256 digests
  keyed by `--encryption-key`. The verifier hashes the candidate and
  compares constant-time against the stored digest. The plaintext is
  only ever held in memory long enough to send the email/SMS body.
- **TOTP shared secrets (authenticator app):** encrypted at rest with
  AES-256-GCM (using HKDF-derived keys from `--encryption-key`) and stored
  with an `enc:v1:` prefix.

:::danger Security advisory — affected versions 2.2.1 through 2.4.0-rc.13

In those releases the at-rest key was **not** a separate input. It derived from
`--jwt-secret`, and when a deployment used an asymmetric JWT algorithm
(`RS*`/`ES*` with `--jwt-private-key`/`--jwt-public-key`) and set **no**
`--jwt-secret`, the derivation ran over empty keying material and produced a
**constant compiled into the open-source binary**. Anyone who can read the
repository can compute it.

**If you ran an affected version with `RS*`/`ES*` and no `--jwt-secret`,** a
copy of your database yields recoverable TOTP seeds and every outstanding OTP
digest — including password-reset codes, whose 10⁶ search space is trivial once
the key is known.

Remediation, in order:

1. Set `--encryption-key` to a fresh random value (`openssl rand -hex 32`).
2. Force TOTP re-enrolment for all users — existing ciphertext was written
   under the old key and **cannot** be decrypted with the new one. There is no
   re-encryption path.
3. Invalidate outstanding password-reset and verification OTPs.

From 2.4.0 the key is its own input and an `RS*`/`ES*` deployment without one
**refuses to start** rather than falling back silently.
:::

### Migration

There is **no flag** for OTP/TOTP migration. The handlers transparently
handle both forms:

- **OTPs:** in-flight legacy plaintext rows expire within minutes
  naturally. New writes are always hashed.
- **TOTP:** the read path tries decryption first, falls back to treating
  the stored value as a legacy base32 secret if it doesn't have the
  `enc:v1:` prefix. On a successful legacy validation, the row is
  re-encrypted in place (best-effort — a write failure does not fail
  the login).

### Rolling-deploy note for multi-replica clusters

If you run **multiple Authorizer replicas** behind a load balancer and
roll out this release across them one at a time, there is a window
during which a TOTP user's row may be migrated to `enc:v1:` by a new
replica and then read by an old replica that doesn't understand the
prefix. The user-visible impact is bounded — TOTP codes regenerate every
30 s — but it's real.

Mitigations, in order of preference:

1. **Atomic deploy.** Replace all replicas at once (drain → replace).
   This is the typical Authorizer deployment model and avoids the issue
   entirely.
2. **Brief maintenance window.** Disable TOTP login at the load balancer
   for the duration of the rollout.
3. **Accept the window.** TOTP users may need to retry their code once
   during the rollout.

For **single-binary deployments** (one Authorizer process on one host)
this is a non-issue — there are no other replicas to disagree with.

### Key rotation

Both OTP and TOTP at-rest protection are keyed by `--encryption-key`.
Rotating it will lock out every user with an enrolled TOTP authenticator
until they re-enrol, because the existing ciphertext can no longer be
decrypted. If you must rotate, plan a TOTP re-enrolment campaign (or a
temporary fallback path) before doing so.

`--encryption-key` falls back to `--jwt-secret` when it is not set, which keeps
HMAC (`HS*`) deployments working unchanged — but it means rotating
`--jwt-secret` on such a deployment silently rotates the at-rest key too. Set
`--encryption-key` explicitly to decouple the two; the server warns at startup
when both are set to the same value.

The server logs an explicit error on every TOTP validation that fails
to decrypt:

```
failed to decrypt stored TOTP secret; check that --encryption-key (or --jwt-secret, if no encryption key is set) has not changed since enrollment
```

---

## Multi-factor authentication (MFA) & Passkeys

MFA methods — TOTP, email OTP, SMS OTP, and [WebAuthn](https://www.w3.org/TR/webauthn-2/)/passkey as a second
factor — are **enabled by default**. `--enforce-mfa` defaults to `false`:
MFA is optional and skippable unless you turn enforcement on. See
[Server Configuration](./server-config#multi-factor-authentication-mfa--webauthnpasskeys)
for the full flag reference (`--enforce-mfa`, `--disable-mfa`,
`--disable-totp-login`, `--disable-webauthn-mfa`, `--disable-email-otp`,
`--disable-sms-otp`).

### Per-method availability

The public `meta` GraphQL query exposes whether each method is actually
usable right now (config flag **and**, for email/SMS OTP, provider
configured):

| Field | True when |
|---|---|
| `is_totp_mfa_enabled` | MFA enabled and `--disable-totp-login` is not set |
| `is_email_otp_mfa_enabled` | MFA enabled, `--disable-email-otp` is not set, and SMTP is configured |
| `is_sms_otp_mfa_enabled` | MFA enabled, `--disable-sms-otp` is not set, and [Twilio](https://www.twilio.com) is configured |
| `is_webauthn_enabled` | MFA enabled and `--disable-webauthn-mfa` is not set — this reflects WebAuthn's availability **as an MFA factor only**; primary passkey login/registration has no flag and is always available regardless of this field |
| `is_mfa_enforced` | mirrors `--enforce-mfa` |

`_admin_meta.is_multi_factor_auth_service_enabled` reports whether MFA can be
used at all on this instance (at least one usable method) — the dashboard
uses it to gate the per-user "require MFA" toggle.

### Withheld-token first-time setup

Login/signup/OAuth-callback resolve a per-user MFA "gate" before issuing a
token:

| Gate | Trigger | Token behavior |
|---|---|---|
| none | MFA doesn't apply to this user and isn't enforced | issued normally |
| block-verify | user already has a verified factor (TOTP, passkey, email-OTP, or SMS-OTP) | **withheld** until they verify it — never skippable |
| block-enroll | `--enforce-mfa` is set and the user hasn't enrolled anything yet | **withheld** until enrollment completes — never skippable |
| offer-all | MFA is available but not enforced, user hasn't enrolled, and has never skipped before | **withheld** until the user completes a method or calls `skip_mfa_setup` |
| skipped | same as offer-all, but the user already chose Skip once | issued normally, no nag |

In every withheld case the response carries no `access_token` — only a
message and a set of `should_show_*` / `should_offer_*` flags on
`AuthResponse` (`should_show_totp_screen`, `should_offer_webauthn_mfa_setup`,
`should_offer_email_otp_mfa_setup`, `should_offer_sms_otp_mfa_setup`,
`should_offer_webauthn_mfa_verify`). The follow-up call (`verify_otp`,
`totp_mfa_setup`, `webauthn_registration_verify`, `webauthn_login_verify`, or
`skip_mfa_setup`) is authenticated by a short-lived **MFA session** set alongside
that response, not by a bearer token — none has been issued yet.
`should_offer_mfa_setup` is deprecated and never set; ignore it.

#### Completing the flow from a non-browser client

The MFA session travels as a cookie, but it is **not browser-only**. It is an
ordinary `Set-Cookie` response header carrying an opaque handle, and the server
accepts it back in an ordinary `Cookie` request header — so any HTTP client can
complete the flow. A browser does it automatically; everything else reads one
value and sends it back.

```bash
# 1. Sign up. The token is withheld; the handle arrives in Set-Cookie.
curl -i -X POST "$AUTHORIZER_URL/graphql" \
  -H 'Content-Type: application/json' -H "Origin: $AUTHORIZER_URL" \
  -d '{"query":"mutation { signup(params: {email: \"a@b.com\", password: \"Password@123\", confirm_password: \"Password@123\"}) { access_token message } }"}'

# HTTP/1.1 200 OK
# Set-Cookie: mfa_session=e415fa93-f51e-4ee1-8568-bd7cf2e0fa67; ...
# {"data":{"signup":{"access_token":null,"message":"Proceed to mfa setup"}}}

# 2. Echo it back. No cookie jar involved.
curl -X POST "$AUTHORIZER_URL/graphql" \
  -H 'Content-Type: application/json' -H "Origin: $AUTHORIZER_URL" \
  -H 'Cookie: mfa_session=e415fa93-f51e-4ee1-8568-bd7cf2e0fa67' \
  -d '{"query":"mutation { skip_mfa_setup(params: {email: \"a@b.com\"}) { access_token } }"}'
# -> access_token issued
```

Over **gRPC** the same handle is carried as metadata: read it from the
`set-cookie` response metadata, send it back as a `cookie` entry.

:::caution Send it only to your own Authorizer
A browser's cookie jar scopes cookies to the origin that set them. If you carry
the handle by hand you take on that job: **attach it only to requests to your
configured Authorizer base URL, and never follow a redirect while it is
attached.** The handle authenticates a half-completed login — `skip_mfa_setup`
exchanges it for a full access token — so treat it exactly like a credential:
hold it in memory for the duration of the flow, never log it, never persist it.
:::

You do not need a general-purpose cookie jar for this, and reaching for one has
been a reliable source of bugs: `Secure` cookies are dropped over
`http://localhost` by some HTTP stacks, and domain-matching rules vary between
languages. Reading `mfa_session` by name and echoing it back to one known origin
has none of those failure modes. The official
[Go](https://github.com/authorizerdev/authorizer-go) and
[Python](https://github.com/authorizerdev/authorizer-py) SDKs do this for you.

A registered passkey satisfies MFA on its own — no OTP/TOTP re-challenge —
because every WebAuthn assertion already requires user verification
(biometric/PIN) at the authenticator.

### Lockout & admin recovery

Two independent lockout mechanisms exist:

1. **Transient per-user rate limit.** `verify_otp` (TOTP, TOTP recovery code,
   email OTP, and SMS OTP all share this) allows **5 failed attempts per user
   in a 15-minute sliding window**; the 6th failing attempt returns
   `429 Too Many Requests` for the rest of that window. This is on top of the
   global per-IP rate limiter and closes the gap where one account is
   brute-forced from many IPs. A storage-layer fault to the counter fails
   open (never locks a legitimate user out because of an infra blip).
2. **Permanent, self-declared lockout.** The `lock_mfa` mutation lets a user
   who has lost access to their only MFA factor (with no working OTP
   fallback) mark their own account locked (`mfa_locked_at`). It's refused
   if the user has a verified email/SMS OTP fallback available — use that
   instead. Once locked, **all** login attempts for that user (password,
   passkey, everything) are rejected until an admin clears it.

Admin recovery is the `_update_user` mutation with `reset_mfa: true`. It
clears `mfa_locked_at`, the user's `is_multi_factor_auth_enabled` override,
and `has_skipped_mfa_setup_at`, and **deletes every enrolled
authenticator (TOTP/email-OTP/SMS-OTP) and every registered WebAuthn
credential** for that user — their next login lands back on the same
first-time MFA setup screen a brand-new account sees.

```graphql
mutation {
  _update_user(params: { id: "user-id", reset_mfa: true }) {
    id
    mfa_locked_at
    enrolled_mfa_methods
  }
}
```

`User.mfa_locked_at` and `User.enrolled_mfa_methods` (any of `"totp"`,
`"webauthn"`, `"email_otp"`, `"sms_otp"`) let an admin dashboard show which
users are locked and what they have enrolled without guessing from
`is_multi_factor_auth_enabled` alone.

### Recovery codes

TOTP enrollment (`totp_mfa_setup`, or the enrollment payload returned inline
by a `block-enroll`/`offer-all` login response) issues **10 single-use
recovery codes**, shown to the user exactly once. At rest they are stored as
**SHA-256 hashes** (not the plaintext codes) and each is marked consumed the
first time it validates successfully — a stolen database dump never yields
usable codes, and a code can't be replayed.

### WebAuthn / passkey ceremonies

WebAuthn/passkey support is `web/app` (end-user login) only —
**`web/dashboard` admin login is untouched** (`_admin_login` has no passkey
path). The self-service GraphQL operations (no `_` admin prefix):

| Operation | Purpose |
|---|---|
| `webauthn_registration_options(email, phone_number)` | begin registering a new passkey; returns JSON `PublicKeyCredentialCreationOptions` for `navigator.credentials.create()` |
| `webauthn_registration_verify(params: { name, credential, email, phone_number, state })` | verify the attestation and persist the credential |
| `webauthn_login_options(email: String)` | begin a login ceremony — omit `email` for **usernameless/discoverable** login (any resident passkey for the origin); pass it for the **MFA-alternative** flow, scoped to that user's own credentials |
| `webauthn_login_verify(params: { credential, state })` | verify the assertion and issue tokens through the same path as `login`/`verify_otp` |
| `webauthn_credentials` (query) | list the caller's own registered passkeys |
| `webauthn_delete_credential(id)` | delete one of the caller's own passkeys |

`options`/`credential` are opaque JSON strings carrying the WebAuthn
`PublicKeyCredential*` structures; the SDK handles the base64url ⟷
`ArrayBuffer` conversion between these and the browser's
`navigator.credentials` API.

```graphql
mutation BeginPasskeyLogin {
  webauthn_login_options {
    options
  }
}

mutation FinishPasskeyLogin($credential: String!) {
  webauthn_login_verify(params: { credential: $credential }) {
    access_token
    id_token
    refresh_token
    message
  }
}
```

Both registration operations also accept an MFA-session-cookie caller (no
bearer token yet) during a token-withheld `offer-all`/`block-enroll` login —
completing registration there resolves the gate and issues the previously
withheld token, the same way `totp_mfa_setup` + `verify_otp(is_totp: true)`
does for TOTP.

**Email-verification gate:** `webauthn_login_verify` is stricter than
password login — it refuses to issue tokens until the account's email is
verified, returning a distinct, actionable error
(`email is not verified. please verify your email before signing in with a
passkey`) rather than a generic invalid-credential error. This matters most
for passkey-only signup (no password at all): the first login attempt with
that passkey is refused until the user verifies their email through the
normal verification-email flow.

A locked-out account (`mfa_locked_at` set) is refused at
`webauthn_login_verify` too, with the same message as password/OTP login.

---

## GraphQL hardening

```bash
./authorizer \
  --graphql-max-complexity=300 \
  --graphql-max-depth=15 \
  --graphql-max-aliases=30 \
  --graphql-max-body-bytes=1048576
```

The GraphQL endpoint now enforces four limits, all configurable:

- **`--graphql-max-complexity`** (default `300`): caps the total
  complexity score of a single operation. Defends against expensive
  resolver chains.
- **`--graphql-max-depth`** (default `15`): caps the nesting depth of a
  selection set. Defends against deeply nested DoS queries.
- **`--graphql-max-aliases`** (default `30`): caps the total number of
  aliased fields per operation. Defends against alias-amplification
  attacks where a client fans out the same expensive field many times
  under different aliases without changing the complexity score.
- **`--graphql-max-body-bytes`** (default `1048576`, 1 MiB): caps the
  request body size. Defends against oversized-payload DoS.

Two side effects:

- **GET on `/graphql` is no longer accepted.** Queries (and especially
  mutations) over GET leak into proxy logs, server access logs, and
  browser history. Clients must POST. All first-party SDKs already POST.
- **A new Prometheus counter** records rejections by limit kind:

  ```
  authorizer_graphql_limit_rejections_total{limit="depth"|"complexity"|"alias"|"body_size"}
  ```

  See [Metrics & Monitoring](./metrics-monitoring) for details. Alert
  on a sustained non-zero rate to spot abuse, or to detect that a limit
  is too tight for your legitimate operation surface.

---

## Rate limiter behaviour changes

Two correctness fixes that may change observed behaviour:

1. **Redis backend errors now propagate.** Previously, a Redis error in
   the rate-limit check was silently swallowed and the request was
   allowed through, regardless of `--rate-limit-fail-closed`. The flag
   now actually takes effect: when `--rate-limit-fail-closed=true`, a
   failing Redis returns `503` to the caller; otherwise the request is
   allowed and the error is logged.
2. **The Redis sliding window length is now `ceil(burst / rps)` seconds**
   instead of integer-division-truncated. With `burst < rps` the previous
   math produced a 0-second window and effectively disabled the limit.
   The in-memory backend was already correct; this aligns Redis with it.

---

## Login error normalization

All login failures now return the same generic `invalid credentials`
error message regardless of the underlying reason (user not found, wrong
password, email not verified, wrong auth method, account revoked). The
specific reason is recorded in the debug log for ops visibility but
never returned to the client.

A precomputed dummy bcrypt comparison runs on the user-not-found and
other early-exit paths so request latency matches the real password
verification path. Without this, an attacker can distinguish "no such
user" from "wrong password" by measuring response time.

`forgot_password`, `resend_verify_email`, and `magic_link_login` follow
the same pattern: they return the **same** generic success message
whether or not the email matches an existing account, with a hint to
double-check for typos:

> *If an account exists for this email, a [reset link / verification
> link / magic link] has been sent. Please check your inbox. If you
> don't receive it within a few minutes, double-check the email address
> for typos.*

This kills the user-enumeration attack surface entirely.

---

## Fine-grained authorization

Authorizer ships an embedded **[OpenFGA](https://openfga.dev)** (ReBAC) engine, and access checks **fail closed** — a `check_permissions` for a relation that the relationship tuples don't grant is denied, and any engine or store error denies rather than allows. There is no permissive "log but allow" mode. See [Authorization (FGA)](./authorization) for the authorization model, admin mutations, and per-endpoint usage.

---

## See also

- [Server Configuration](./server-config) — full CLI flag reference
- [Authorization (FGA)](./authorization) — OpenFGA authorization model, tuples, and access checks
- [Rate Limiting](./rate-limiting) — rate limiter configuration
- [Metrics & Monitoring](./metrics-monitoring) — Prometheus metrics including the new GraphQL limit counter
- [v1 to v2 Migration](../migration/v1-to-v2) — for users upgrading from v1
