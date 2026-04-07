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
./build/server \
  --env=production \
  --http-port=8080 \
  --host=0.0.0.0 \
  --metrics-port=8081 \
  --log-level=info
```

- **`--env`**: environment name (for example `production`, `development`).
- **`--http-port`**: HTTP listen port (default `8080`).
- **`--host`**: bind address (default `0.0.0.0`).
- **`--metrics-port`**: metrics/health port (default `8081`).
- **`--log-level`**: one of `debug`, `info`, `warn`, `error`, `fatal`, `panic`.

---

## 2. Database and session store

### Database

```bash
./build/server \
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
./build/server \
  --redis-url=redis://user:pass@redis-host:6379/0
```

- **`--redis-url`**: Redis connection string used for session storage.
  If omitted, sessions are stored in memory (suitable only for dev / single-node setups).

---

## 3. OAuth / app behavior

These flags replace v1 env such as `CLIENT_ID`, `CLIENT_SECRET`, and app behavior toggles.

```bash
./build/server \
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

Organization / UI:

```bash
./build/server \
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
./build/server \
  --roles=user,admin \
  --default-roles=user \
  --protected-roles=admin \
  --enable-strong-password=true \
  --enable-basic-authentication=true \
  --enable-email-verification=true \
  --enable-magic-link-login=true \
  --enable-signup=true \
  --enable-totp-login=true \
  --enable-email-otp=true \
  --enable-sms-otp=false
```

These replace v1 flags such as `DISABLE_BASIC_AUTHENTICATION`, `DISABLE_EMAIL_VERIFICATION`, etc.
See the [Auth behavior mapping](../migration/v1-to-v2#auth-behavior) for exact correspondences.

### Cookies

```bash
./build/server \
  --app-cookie-secure=true \
  --admin-cookie-secure=true
```

Use `true` for HTTPS-only cookies in production.

---

## 5. JWT configuration

```bash
./build/server \
  --jwt-type=HS256 \
  --jwt-secret=your-jwt-secret \
  --jwt-role-claim=role
```

Or for asymmetric keys:

```bash
./build/server \
  --jwt-type=RS256 \
  --jwt-private-key="$(cat /path/to/private.key)" \
  --jwt-public-key="$(cat /path/to/public.key)"
```

Additional flags:

- **`--custom-access-token-script`**: path/string for custom token augmentation logic (advanced use only).
- **`--refresh-token-expires-in`** (default `2592000`, 30 days): refresh-token
  lifetime in seconds. Previously hardcoded — now operator-configurable.

In v2, the `_generate_jwt_keys` mutation is deprecated and returns an error; configure keys **only via flags**.

> **Note on key rotation:** `--jwt-secret` is also used to encrypt TOTP shared
> secrets at rest and to HMAC OTPs. Rotating it will lock out every user with
> an enrolled TOTP authenticator until they re-enrol. See
> [OTP and TOTP at rest](./security#otp-and-totp-at-rest).

---

## 6. SMTP and SMS

### SMTP

```bash
./build/server \
  --smtp-host=smtp.mailprovider.com \
  --smtp-port=587 \
  --smtp-username=user@example.com \
  --smtp-password=strong-password \
  --smtp-sender-email=auth@example.com \
  --smtp-sender-name="Auth Team" \
  --smtp-local-name=authorizer \
  --skip-tls-verification=false
```

### Twilio (SMS OTP)

```bash
./build/server \
  --twilio-account-sid=AC... \
  --twilio-api-key=... \
  --twilio-api-secret=... \
  --twilio-sender=+123456789
```

---

## 7. Social / OAuth providers

Each provider uses its own set of flags:

```bash
./build/server \
  --google-client-id=... \
  --google-client-secret=... \
  --google-scopes="openid,email,profile" \
  --github-client-id=... \
  --github-client-secret=... \
  --github-scopes="read:user,user:email"
```

Other supported providers follow the same pattern:

- `--facebook-client-id`, `--facebook-client-secret`, `--facebook-scopes`
- `--microsoft-client-id`, `--microsoft-client-secret`, `--microsoft-tenant-id`, `--microsoft-scopes`
- `--apple-client-id`, `--apple-client-secret`, `--apple-scopes`
- `--linkedin-client-id`, `--linkedin-client-secret`, `--linkedin-scopes`
- `--discord-client-id`, `--discord-client-secret`, `--discord-scopes`
- `--twitter-client-id`, `--twitter-client-secret`, `--twitter-scopes`
- `--twitch-client-id`, `--twitch-client-secret`, `--twitch-scopes`
- `--roblox-client-id`, `--roblox-client-secret`, `--roblox-scopes`

---

## 8. Admin and GraphQL security flags

```bash
./build/server \
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
counted in the `authorizer_graphql_limit_rejections_total` Prometheus
metric, labelled by limit kind. See
[GraphQL hardening](./security#graphql-hardening) for details.

---

## 9. Security headers

```bash
./build/server \
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

---

## 11. Discovering all flags

To list all available flags and their defaults, run:

```bash
./build/server --help
```

For a v1 to v2 mapping table, see [Configuration Mapping](../migration/v1-to-v2#3-configuration-mapping-v1-env--v1-behavior-to-v2-cli-flags).
