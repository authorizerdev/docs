---
sidebar_position: 2
title: Server Configuration
---

# Server Configuration (v2)

Authorizer v2 uses **CLI flags only** for configuration.
Nothing is loaded from `.env` files or dashboard-managed env, and config is not persisted in the database or cache.

If you are migrating from v1, first skim the high-level [Migration v1 to v2](../migration/v1-to-v2) guide and then use this page as a reference.

---

## 1. Core flags

```bash
./authorizer \
  --env=production \
  --http-port=8080 \
  --host=0.0.0.0 \
  --metrics-port=8081 \
  --metrics-host=127.0.0.1 \
  --log-level=info
```

- **`--env`**: environment name (for example `production`, `development`).
- **`--http-port`**: HTTP listen port (default `8080`).
- **`--host`**: bind address for the **main** HTTP server (default `0.0.0.0`).
- **`--metrics-port`**: port for the dedicated **`/metrics`** listener (default `8081`; **must differ** from `--http-port`). Health probes stay on the HTTP port.
- **`--metrics-host`**: bind address for that **dedicated** metrics listener only (default `127.0.0.1`). The main app can listen on all interfaces while metrics stay on loopback. For Docker/Kubernetes scraping from another container/pod, set **`--metrics-host=0.0.0.0`** and keep the metrics port on an internal network only (never on a public load balancer).
- **`--log-level`**: one of `debug`, `info`, `warn`, `error`, `fatal`, `panic`.

---

## 2. Database and session store

### Database

```bash
./authorizer \
  --database-type=postgres \
  --database-url="postgres://user:pass@host/db" \
  --database-name=authorizer \
  --database-host=db-host \
  --database-port=5432
```

Key flags:

- **`--database-type`**: `postgres`, `mysql`, `planetscale`, `sqlite`, `sqlserver`, `mongodb`, `arangodb`, `yugabyte`, `mariadb`, `cassandradb`, `scylladb`, `couchbase`, `dynamodb`, etc.
- **`--database-url`**: connection string.
- Optional per-driver flags (name, host, port, TLS certs, etc.) -- see the mapping table in [Migration v1 to v2](../migration/v1-to-v2#database).

### Session / cache

```bash
./authorizer \
  --redis-url=redis://user:pass@redis-host:6379/0
```

- **`--redis-url`**: Redis connection string used for session storage.
  If omitted, sessions are stored in memory (suitable only for dev / single-node setups).

---

## 3. OAuth / app behavior

These flags replace v1 env such as `CLIENT_ID`, `CLIENT_SECRET`, and app behavior toggles.

```bash
./authorizer \
  --client-id=YOUR_CLIENT_ID \
  --client-secret=YOUR_CLIENT_SECRET \
  --admin-secret=your-admin-secret \
  --allowed-origins=https://your-app.com,http://localhost:3000 \
  --default-authorize-response-type=code \
  --default-authorize-response-mode=query
```

- **`--client-id`** (required): instance/client identifier.
- **`--client-secret`** (required): secret used for token-related operations.
- **`--admin-secret`** (**required, non-empty**): super-admin secret for admin
  operations. **Breaking change as of April 2026**: there is no default any
  more — empty causes the server to exit at startup. Pick any non-empty value;
  the strength of the secret is your responsibility. See [Security Hardening](./security#admin-authentication).
- **`--allowed-origins`**: comma-separated list of allowed origins (default
  `*`). A startup warning is logged when the value contains `*` — set an
  explicit allowlist for production. See [CORS, CSRF and origin enforcement](./security#cors-csrf-and-origin-enforcement).
- **`--trusted-proxies`** (default empty): comma-separated CIDRs of reverse
  proxies whose `X-Forwarded-For` should be honoured. **Breaking change as of
  April 2026**: defaults to none — operators behind a proxy must set this
  explicitly or rate limiting and audit logs will key on the proxy IP. See
  [Trusted proxies](./security#trusted-proxies).
- **`--url`** (default empty): canonical/trusted base URL of this instance
  (e.g. `https://auth.example.com`). When set, it is the **only** source used
  to build verification/reset/magic-link email URLs, the JWT `iss` claim, and
  OIDC discovery URLs — the `X-Authorizer-URL`, `X-Forwarded-Host`, and `Host`
  request headers are ignored for that purpose. Leaving it empty keeps legacy
  header-based derivation. **Recommended for production**, especially behind
  a reverse proxy. See [Trusted base URL](./security#trusted-base-url).

Organization / UI:

```bash
./authorizer \
  --organization-name="Your Company" \
  --organization-logo="https://your-cdn/logo.png" \
  --enable-login-page=true \
  --enable-playground=false \
  --enable-graphql-introspection=false
```

- **`--enable-login-page`**: set to `false` to disable the built-in login UI.
- **`--enable-playground`**: set to `false` to disable the GraphQL playground.
- **`--enable-graphql-introspection`**: set to `false` in hardened environments.

---

## 4. Auth behavior and cookies

### Roles and auth flows

```bash
./authorizer \
  --roles=user,admin \
  --default-roles=user \
  --protected-roles=admin \
  --enable-strong-password=true \
  --enable-basic-authentication=true \
  --enable-email-verification=true \
  --enable-magic-link-login=true \
  --enable-signup=true
```

These replace v1 flags such as `DISABLE_BASIC_AUTHENTICATION`, `DISABLE_EMAIL_VERIFICATION`, etc.
See the [Auth behavior mapping](../migration/v1-to-v2#auth-behavior) for exact correspondences.

:::danger Breaking in 2.4.0 — `--enable-email-verification` requires SMTP

Starting the server with `--enable-email-verification=true` and no working mail
path is now a **fatal boot error**. It used to start and fail silently per user.

Every route back into an unverified account terminates at the same mailbox, so
without SMTP a user is created unverified and can never recover — and an
unverified account also blocks a federated login for the same address. That is
unrecoverable state, so it fails where an operator can see it rather than one
user at a time.

A "working mail path" means all three of `--smtp-host`, `--smtp-port` (greater
than zero) and `--smtp-sender-email`. Setting only the host still fails.

Either configure SMTP or set `--enable-email-verification=false`.
:::

### Multi-factor authentication (MFA) & WebAuthn/passkeys

**Breaking change**: `--enable-mfa`, `--enable-totp-login`, `--enable-email-otp`,
and `--enable-sms-otp` are **removed**. [TOTP](https://datatracker.ietf.org/doc/html/rfc6238), email OTP, SMS OTP, and
[WebAuthn](https://www.w3.org/TR/webauthn-2/)/passkey-as-MFA are now all **on by default**; opt out per method with
the `--disable-*` flags below. `--enforce-mfa` also flipped its default from
`true` to `false` — MFA is now optional and skippable unless you explicitly
enforce it.

```bash
./authorizer \
  --enforce-mfa=false \
  --disable-mfa=false \
  --disable-totp-login=false \
  --disable-webauthn-mfa=false \
  --disable-email-otp=false \
  --disable-sms-otp=false
```

- **`--enforce-mfa`** (default `false`): require every user to complete MFA
  enrollment before a token is issued (`mfaGateBlockEnroll`, never skippable).
  When `false`, users are offered MFA setup once and may skip it
  (`skip_mfa_setup` mutation); a user's own already-enrolled factor is always
  required to verify regardless of this flag.
- **`--disable-mfa`** (default `false`): one-way global kill switch — forces
  MFA off entirely (TOTP/email-OTP/SMS-OTP unavailable, `--enforce-mfa`
  neutralized) regardless of the per-method flags below. Does **not** affect
  WebAuthn/passkey as a **primary login method** (only as an MFA factor).
- **`--disable-totp-login`** (default `false`): disable TOTP authenticator-app
  MFA.
- **`--disable-webauthn-mfa`** (default `false`): disable WebAuthn/passkey as
  an **MFA factor**. Does not affect WebAuthn/passkey as a primary,
  passwordless login method — that is always available and has no flag.
- **`--disable-email-otp`** (default `false`): disable email-OTP MFA. Only
  takes effect when SMTP is configured (`--smtp-*`); otherwise email OTP is
  unavailable regardless of this flag.
- **`--disable-sms-otp`** (default `false`): disable SMS-OTP MFA. Only takes
  effect when [Twilio](https://www.twilio.com) is configured (`--twilio-*`); otherwise SMS OTP is
  unavailable regardless of this flag.

Effective availability of each method is exposed on the public `meta`
GraphQL query (`is_totp_mfa_enabled`, `is_email_otp_mfa_enabled`,
`is_sms_otp_mfa_enabled`, `is_webauthn_enabled`, `is_mfa_enforced`) so
frontends never have to reverse-engineer flag combinations. See
[MFA & Passkeys](./security#multi-factor-authentication-mfa--passkeys) for
the full behavior — withheld-token first-time setup, lockout, admin recovery,
and the WebAuthn/passkey GraphQL operations.

### Cookies

```bash
./authorizer \
  --app-cookie-secure=true \
  --admin-cookie-secure=true \
  --app-cookie-same-site=none
```

- **`--app-cookie-secure`** / **`--admin-cookie-secure`** (both default `true`):
  use `true` for HTTPS-only cookies in production.
- **`--app-cookie-same-site`** (default `none`): `SameSite` attribute for the
  session cookies — one of `lax`, `strict`, or `none`.

The default of `none` is what allows an app on a **different site** to complete
a credentialed `/session` call at all. Set `lax` only when every app that reads
the session shares this host; it is the tighter setting, but it stops
cross-site session reads working.

:::caution The value is validated at boot (2.4.0)

An unrecognised value now **exits at startup** instead of silently falling back
to `lax`. That fallback was the dangerous part: an operator who asked for
`strict` and mistyped it got `lax` — a real downgrade from what they requested,
with nothing anywhere saying so. A mistyped `none` went the other way and
withheld the session cookie from cross-site apps, which presents as "login
randomly doesn't stick" with the cause three layers away.
:::

`strict` is accepted, but note that one cookie deliberately ignores this
setting: the short-lived OAuth `state` cookie used during social login is
always `Lax`, or `None` when secure. A provider's callback arrives as a
cross-site redirect — a cross-site `form_post` for Apple — and `Strict`
withholds cookies on exactly those, so honouring `strict` there would break
every social login on the deployment.

---

## 5. JWT configuration

```bash
./authorizer \
  --jwt-type=HS256 \
  --jwt-secret=your-jwt-secret \
  --jwt-role-claim=role
```

Or for asymmetric keys:

```bash
./authorizer \
  --jwt-type=RS256 \
  --jwt-private-key="$(cat /path/to/private.key)" \
  --jwt-public-key="$(cat /path/to/public.key)" \
  --encryption-key=your-encryption-key
```

Additional flags:

- **`--custom-access-token-script`**: path/string for custom token augmentation logic (advanced use only).
- **`--refresh-token-expires-in`** (default `2592000`, 30 days): refresh-token
  lifetime in seconds. Previously hardcoded — now operator-configurable.

- **`--encryption-key`** (no default): the key used to encrypt secrets **at
  rest** — TOTP shared secrets and OTP digests. Separate from the JWT signing
  material.

In v2, the `_generate_jwt_keys` mutation is deprecated and returns an error; configure keys **only via flags**.

:::warning Breaking change in 2.4.0 — `--encryption-key`

At-rest encryption no longer derives from `--jwt-secret`. **A deployment using
an asymmetric JWT algorithm (`RS*`/`ES*`) with no `--jwt-secret` will refuse to
start until `--encryption-key` is set.**

HMAC deployments (`HS256`/`HS384`/`HS512`) are unaffected: the key still falls
back to `--jwt-secret`, so no change is required.

This closes a vulnerability in **2.2.1 through 2.4.0-rc.13** where that
fallback produced a publicly known constant for asymmetric deployments — read
the [security advisory](./security#otp-and-totp-at-rest) before upgrading, as
remediation includes forcing TOTP re-enrolment.
:::

> **Note on key rotation:** `--encryption-key` protects TOTP shared secrets at
> rest and HMACs OTPs. Rotating it will lock out every user with an enrolled
> TOTP authenticator until they re-enrol. When it is unset it falls back to
> `--jwt-secret`, so on those deployments rotating the JWT secret rotates the
> at-rest key too. See
> [OTP and TOTP at rest](./security#otp-and-totp-at-rest).

---

## 6. SMTP and SMS

### SMTP

```bash
./authorizer \
  --smtp-host=smtp.mailprovider.com \
  --smtp-port=587 \
  --smtp-username=user@example.com \
  --smtp-password=strong-password \
  --smtp-sender-email=auth@example.com \
  --smtp-sender-name="Auth Team" \
  --smtp-local-name=authorizer \
  --smtp-skip-tls-verification=false
```

### Twilio (SMS OTP)

```bash
./authorizer \
  --twilio-account-sid=AC... \
  --twilio-api-key=... \
  --twilio-api-secret=... \
  --twilio-sender=+123456789
```

---

## 7. Social / OAuth providers

Each provider uses its own set of flags:

```bash
./authorizer \
  --google-client-id=... \
  --google-client-secret=... \
  --google-scopes="openid,email,profile" \
  --github-client-id=... \
  --github-client-secret=... \
  --github-scopes="read:user,user:email"
```

Other supported providers follow the same pattern:

- `--facebook-client-id`, `--facebook-client-secret`, `--facebook-scopes`
- `--microsoft-client-id`, `--microsoft-client-secret`, `--microsoft-tenant-id`, `--microsoft-allowed-tenants`, `--microsoft-scopes`
- `--apple-client-id`, `--apple-client-secret`, `--apple-scopes`
- `--linkedin-client-id`, `--linkedin-client-secret`, `--linkedin-scopes`
- `--discord-client-id`, `--discord-client-secret`, `--discord-scopes`
- `--twitter-client-id`, `--twitter-client-secret`, `--twitter-scopes`
- `--twitch-client-id`, `--twitch-client-secret`, `--twitch-scopes`
- `--roblox-client-id`, `--roblox-client-secret`, `--roblox-scopes`

### Provider email attestation (2.4.0)

:::warning Breaking in 2.4.0

A social login whose provider does **not** attest the email address no longer
signs the user into an existing account with that address.

OAuth proves the user holds an account at the provider. It proves nothing about
the email address that provider hands back — which is why OIDC has a separate
`email_verified` claim. Microsoft Entra is the practical case: on a multi-tenant
alias the `email` claim is **mutable and unattested**, so anyone able to set a
directory attribute in *their own* tenant could assert your address and be
logged into your account. This is the [nOAuth](https://www.descope.com/blog/post/noauth)
class of account takeover.

Signup with an unattested address still works — it just creates its own account
instead of reaching an existing one.
:::

Attestation comes from the provider's `email_verified` claim, or Entra's
`xms_edov` optional claim. To make Entra attest:

- pin `--microsoft-tenant-id` to a single tenant, **or**
- enable the `xms_edov` optional claim on the app registration, **or**
- list the tenants you trust in `--microsoft-allowed-tenants` when
  `--microsoft-tenant-id` is a multi-tenant alias (`common`, `organizations`,
  `consumers`). Empty means no restriction — and in that mode the tenant is
  untrusted, so the email it asserts will not link to an existing account.

`--oauth-allow-unverified-provider-email=true` is a temporary compatibility
escape hatch. It does **not** disable the check: an unattested address still
cannot cross into an account owned by another credential. It only re-permits
same-provider linking, which leaves two Entra tenants able to collide on one
address. The server logs a warning on every boot while it is set.

See [Email verification contract](./email-verification-contract) for the
per-provider signal table and the upgrade path.

---

## 8. Rate limiting

```bash
./authorizer \
  --rate-limit-rps=30 \
  --rate-limit-burst=20 \
  --rate-limit-fail-closed=false
```

- **`--rate-limit-rps`**: maximum sustained requests per second per IP (default `30`). Set to `0` to disable.
- **`--rate-limit-burst`**: maximum burst size per IP (default `20`).
- **`--rate-limit-fail-closed`**: when `true`, a failing rate-limit backend returns `503` instead of allowing the request (default `false`, fail-open).

Rate limiting is always enabled by default. When `--redis-url` is set, limits are shared across replicas via Redis. See [Rate Limiting](./rate-limiting) for full details.

---

## 9. Admin and GraphQL security flags

New in v2:

```bash
./authorizer \
  --disable-admin-header-auth=true \
  --enable-graphql-introspection=false \
  --graphql-max-complexity=300 \
  --graphql-max-depth=15 \
  --graphql-max-aliases=30 \
  --graphql-max-body-bytes=1048576
```

- **`--disable-admin-header-auth`**: when `true`, the server ignores `X-Authorizer-Admin-Secret` and only honors the secure admin cookie.
  **Recommended for production.**
- **`--enable-graphql-introspection`**: disable in locked-down environments.
- **`--graphql-max-complexity`** (default `300`): max total complexity score per operation.
- **`--graphql-max-depth`** (default `15`): max selection-set nesting depth.
- **`--graphql-max-aliases`** (default `30`): max aliased fields per operation (defends against alias amplification).
- **`--graphql-max-body-bytes`** (default `1048576`, 1 MiB): max GraphQL request body size.

`GET /graphql` is no longer accepted — clients must POST. Rejections are
counted in the `authorizer_graphql_limit_rejections_total` [Prometheus](https://prometheus.io)
metric, labelled by limit kind. See
[GraphQL hardening](./security#graphql-hardening) for details.

### Authorization (FGA)

```bash
./authorizer \
  --fga-store=postgres \
  --fga-store-url="postgres://user:pass@host/db"
```

- **`--fga-store`**: backing store for the embedded [OpenFGA](https://openfga.dev) engine — one of `sqlite`, `postgres`, `mysql`, or `memory`. Only needed when the main database is NoSQL (see paragraph below); for SQL main databases the engine reuses that database automatically.
- **`--fga-store-url`**: connection string for the FGA store when `--fga-store` is set to a database driver.
- **`--fga-allow-unconstrained-agents`** (default `false`): see below.

#### `--fga-allow-unconstrained-agents`

:::warning Escape hatch — changes an authorization outcome

A delegated (agent-acting-for-user) permission check evaluates
`perms(agent) ∩ perms(user)`. If the authorization model declares no
`type agent`, the agent half **cannot be evaluated at all**.

As of 2.4.0 that check is **denied**. Previously it authorized as the delegating
user alone, which silently handed the agent the user's full authority — the
Confused Deputy the intersection exists to prevent. A security check that cannot
be evaluated is not a check that passes.

Setting this flag to `true` restores the pre-2.4.0 behaviour while you migrate a
model. It does not make anything more permissive than 2.3.x was, but it does
mean **agents carry their delegating user's full authority**.

Every such request is logged at warn level and recorded as `not_enforced` on the
delegated-check metric, so the exposure shows up in dashboards rather than being
discovered during an incident.

The fix is to add `type agent` to your model — see
[Agent identity](../enterprise/agent-identity). Grant your agents *before*
deploying the model, or their calls start being denied.
:::

Authorizer ships an embedded **OpenFGA** (ReBAC) engine. It is enabled by default when the main database is SQL-compatible (SQLite/Postgres/MySQL) and reuses that database. For NoSQL main databases (MongoDB, DynamoDB, …) it is off unless you set `--fga-store` (one of `sqlite`/`postgres`/`mysql`/`memory`) and `--fga-store-url`. Checks fail closed. See [Authorization (FGA)](./authorization).

---

## 9. Security headers

```bash
./authorizer \
  --enable-hsts=true \
  --disable-csp=false
```

- **`--enable-hsts`** (default `false`): emit `Strict-Transport-Security`. Only enable behind TLS — turning HSTS on without TLS will lock browsers out for a year.
- **`--disable-csp`** (default `false`): disable the default `Content-Security-Policy` header. CSP is on by default.

The defaults are conservative and documented at
[Security response headers](./security#security-response-headers).

---

## 10. Full security reference

See the dedicated [Security Hardening](./security) page for:

- The complete list of security CLI flags introduced in April 2026
- Trusted-proxy configuration for various deployment topologies
- CSRF, CORS, OAuth flow, and webhook SSRF protections (all automatic)
- OTP and TOTP at-rest hardening, including the rolling-deploy note
  for multi-replica clusters
- Login error normalization and user-enumeration defences
- Multi-factor authentication (MFA) behavior, lockout, admin recovery, and
  WebAuthn/passkey ceremonies

---

## 11. Discovering all flags

To list all available flags and their defaults, run:

```bash
./authorizer --help
```

For a v1 to v2 mapping table, see [Configuration Mapping](../migration/v1-to-v2#3-configuration-mapping-v1-env--v1-behavior-to-v2-cli-flags).
