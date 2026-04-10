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
   ./build/server --admin-secret="$(openssl rand -hex 32)" ...
   ```

2. **`--trusted-proxies` defaults to none.** Rate limiting, audit logs,
   and CSRF same-origin checks now key on `RemoteAddr` by default — they
   ignore `X-Forwarded-For` unless you opt in. If you run Authorizer
   behind a reverse proxy (nginx, ALB, Cloudflare, an ingress
   controller), you must list the proxy's network in CIDR form or your
   metrics and rate limits will be keyed on the proxy IP instead of the
   real client IP.

   ```bash
   ./build/server \
     --trusted-proxies=10.0.0.0/8,127.0.0.1/32 \
     ...
   ```

   See [Trusted proxies](#trusted-proxies) below for details.

Everything else in this document is opt-in or already on by default.

---

## Admin authentication

```bash
./build/server \
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
./build/server --refresh-token-expires-in=2592000
```

- **`--refresh-token-expires-in`** (default `2592000`, 30 days): refresh
  token lifetime in seconds. Previously hardcoded to 30 days. Shorten
  for higher-security deployments where re-authentication is acceptable;
  lengthen for long-lived sessions where a 30-day window is too short.

---

## Trusted proxies

```bash
./build/server --trusted-proxies=10.0.0.0/8,127.0.0.1/32
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
| Prometheus metrics | `authorizer_http_requests_total` labelled by proxy IP only. |

### Common deployments

| Topology | `--trusted-proxies` value |
|---|---|
| Single host, no proxy | leave empty |
| Behind nginx on the same host | `127.0.0.1/32,::1/128` |
| Behind Cloudflare | the [Cloudflare IP ranges](https://www.cloudflare.com/ips/) |
| Behind an AWS ALB | the VPC CIDR (e.g. `10.0.0.0/16`) |
| Inside a Kubernetes cluster | the pod and service CIDRs (e.g. `10.0.0.0/8`) |

---

## CORS, CSRF, and origin enforcement

### CORS

```bash
./build/server --allowed-origins=https://app.example.com,https://admin.example.com
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
./build/server \
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
`Pragma: no-cache` per RFC 6749 §5.1.

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

OTP and TOTP secrets are now protected at rest:

- **OTPs (email/SMS one-time codes):** stored as HMAC-SHA256 digests
  keyed by `--jwt-secret`. The verifier hashes the candidate and
  compares constant-time against the stored digest. The plaintext is
  only ever held in memory long enough to send the email/SMS body.
- **TOTP shared secrets (authenticator app):** encrypted at rest with
  AES-256-GCM (using HKDF-derived keys from `--jwt-secret`) and stored
  with an `enc:v1:` prefix.

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

Both OTP and TOTP at-rest protection are keyed by `--jwt-secret`.
Rotating `--jwt-secret` will lock out every user with an enrolled TOTP
authenticator until they re-enrol, because the existing ciphertext can
no longer be decrypted. If you must rotate the JWT secret, plan a
TOTP re-enrolment campaign (or a temporary fallback path) before doing so.
The server logs an explicit error on every TOTP validation that fails
to decrypt:

```
failed to decrypt stored TOTP secret; check that --jwt-secret has not changed since enrollment
```

---

## GraphQL hardening

```bash
./build/server \
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

## See also

- [Server Configuration](./server-config) — full CLI flag reference
- [Rate Limiting](./rate-limiting) — rate limiter configuration
- [Metrics & Monitoring](./metrics-monitoring) — Prometheus metrics including the new GraphQL limit counter
- [v1 to v2 Migration](../migration/v1-to-v2) — for users upgrading from v1
