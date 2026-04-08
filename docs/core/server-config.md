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
- **`--admin-secret`**: super admin secret for admin operations.
- **`--allowed-origins`**: comma-separated list of allowed origins (default `*`).

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

Additional flag:

- **`--custom-access-token-script`**: path/string for custom token augmentation logic (advanced use only).

In v2, the `_generate_jwt_keys` mutation is deprecated and returns an error; configure keys **only via flags**.

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
  --smtp-skip-tls-verification=false
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

## 8. Rate limiting

```bash
./build/server \
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
./build/server \
  --disable-admin-header-auth=true \
  --enable-graphql-introspection=false
```

- **`--disable-admin-header-auth`**: when `true`, the server ignores `X-Authorizer-Admin-Secret` and only honors the secure admin cookie.
  **Recommended for production.**
- **`--enable-graphql-introspection`**: disable in locked-down environments.

---

## 10. Discovering all flags

To list all available flags and their defaults, run:

```bash
./build/server --help
```

For a v1 to v2 mapping table, see [Configuration Mapping](../migration/v1-to-v2#3-configuration-mapping-v1-env--v1-behavior-to-v2-cli-flags).
