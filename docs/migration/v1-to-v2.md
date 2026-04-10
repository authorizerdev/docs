---
sidebar_position: 1
title: Migration v1 to v2
---

# Migration Guide: Authorizer v1 to v2

This page helps you migrate from **Authorizer v1** to **Authorizer v2**. The v2 server focuses on **CLI-based configuration**, **better secret handling**, and **deployment hardening**.

---

## 1. Major Security and Configuration Change

### What changed

In **v1**, environment and configuration could be:

- Loaded from `.env` or OS environment variables.
- Stored and updated in **cache (e.g. Redis)** or **database** via the dashboard or `_update_env` mutation.

In **v2**:

- **All configuration is passed at server start via CLI root arguments.**
- Nothing is read from a persisted "env store" in cache or DB.
- Secrets and config are not stored in your database or cache. They are supplied explicitly at startup (for example via your orchestrator, platform env to CLI args, or a wrapper script).

### What you need to do

1. **Copy all your existing v1 credentials and environment configuration BEFORE migrating.**

   :::danger Critical — do not skip this step
   You must capture all your v1 env variables before migrating. Missing values will cause the v2 server to fail or behave incorrectly, and **you will not be able to recover them after shutting down v1**.
   :::

   **How to get your current env variables:**

   - **Option 1: Using the `_env` query (recommended)**

     Query the `_env` GraphQL field with your admin secret to export all current configuration:

     ```bash
     curl --location 'YOUR_AUTHORIZER_URL/graphql' \
     --header 'x-authorizer-admin-secret: YOUR_ADMIN_SECRET' \
     --header 'Content-Type: application/json' \
     --data '{
         "query": "{\n  _env {\n    CLIENT_ID\n    CLIENT_SECRET\n    GOOGLE_CLIENT_ID\n    GOOGLE_CLIENT_SECRET\n    GITHUB_CLIENT_ID\n    GITHUB_CLIENT_SECRET\n    FACEBOOK_CLIENT_ID\n    FACEBOOK_CLIENT_SECRET\n    LINKEDIN_CLIENT_ID\n    LINKEDIN_CLIENT_SECRET\n    APPLE_CLIENT_ID\n    APPLE_CLIENT_SECRET\n    DISCORD_CLIENT_ID\n    DISCORD_CLIENT_SECRET\n    TWITTER_CLIENT_ID\n    TWITTER_CLIENT_SECRET\n    MICROSOFT_CLIENT_ID\n    MICROSOFT_CLIENT_SECRET\n    MICROSOFT_ACTIVE_DIRECTORY_TENANT_ID\n    TWITCH_CLIENT_ID\n    TWITCH_CLIENT_SECRET\n    ROBLOX_CLIENT_ID\n    ROBLOX_CLIENT_SECRET\n    DEFAULT_ROLES\n    PROTECTED_ROLES\n    ROLES\n    JWT_TYPE\n    JWT_SECRET\n    JWT_ROLE_CLAIM\n    JWT_PRIVATE_KEY\n    JWT_PUBLIC_KEY\n    REDIS_URL\n    SMTP_HOST\n    SMTP_PORT\n    SMTP_USERNAME\n    SMTP_PASSWORD\n    SMTP_LOCAL_NAME\n    SENDER_EMAIL\n    SENDER_NAME\n    ALLOWED_ORIGINS\n    ORGANIZATION_NAME\n    ORGANIZATION_LOGO\n    ADMIN_SECRET\n    APP_COOKIE_SECURE\n    ADMIN_COOKIE_SECURE\n    DISABLE_LOGIN_PAGE\n    DISABLE_MAGIC_LINK_LOGIN\n    DISABLE_EMAIL_VERIFICATION\n    DISABLE_BASIC_AUTHENTICATION\n    DISABLE_MOBILE_BASIC_AUTHENTICATION\n    DISABLE_SIGN_UP\n    DISABLE_STRONG_PASSWORD\n    DISABLE_REDIS_FOR_ENV\n    CUSTOM_ACCESS_TOKEN_SCRIPT\n    DATABASE_NAME\n    DATABASE_TYPE\n    DATABASE_URL\n    ACCESS_TOKEN_EXPIRY_TIME\n    DISABLE_MULTI_FACTOR_AUTHENTICATION\n    ENFORCE_MULTI_FACTOR_AUTHENTICATION\n    DEFAULT_AUTHORIZE_RESPONSE_TYPE\n    DEFAULT_AUTHORIZE_RESPONSE_MODE\n    DISABLE_PLAYGROUND\n    DISABLE_TOTP_LOGIN\n    DISABLE_MAIL_OTP_LOGIN\n    __typename\n  }\n}",
         "variables": {}
     }'
     ```

   - **Option 2: Copy from the v1 dashboard**

     Go through your v1 dashboard settings and copy every value you configured. This includes:
     - **OAuth / app:** `client_id`, `client_secret`, `admin_secret`
     - **Social / OAuth providers:** Google, GitHub, Facebook, Microsoft, Apple, LinkedIn, Discord, Twitter, Twitch, Roblox client IDs and secrets
     - **Roles:** `roles`, `default_roles`, `protected_roles`
     - **JWT:** `jwt_type`, `jwt_secret` (or `jwt_private_key` / `jwt_public_key`)
     - **Session / memory store:** `redis_url` (if using Redis)
     - **Email / SMTP:** `smtp_host`, `smtp_port`, `smtp_username`, `smtp_password`, `smtp_sender_email`, `smtp_sender_name`
     - **Domain / origins:** `allowed_origins`
     - **Access token custom scripts:** `custom_access_token_script`

   You will need to pass each of these as a CLI flag in v2 for a smooth transition.

2. **Stop relying on dashboard or `_update_env` for server configuration.**
   In v2, the server does not load or save config from/to DB or cache. Configure everything when starting the server.

3. **Map your current v1 env vars to v2 CLI flags.**
   Use the configuration mapping below and pass options when starting the binary (see [Running the server](#2-running-the-server)).

4. **Ensure required flags are set at startup.**
   The v2 server will fail to start if critical flags are missing. At minimum you must provide:
   - `--database-type` and `--database-url` (or individual `--database-host`, `--database-port`, `--database-name`, `--database-username`, `--database-password`) — the server cannot start without a database connection.
   - `--client-id` and `--client-secret` — **required**; the server will exit if they are missing.
   - `--admin-secret` — needed for admin dashboard access and admin API operations.
   - `--jwt-type` and `--jwt-secret` (for HMAC algorithms like HS256) or `--jwt-private-key` / `--jwt-public-key` (for RSA/ECDSA algorithms) — needed for token signing and verification.

---

## 2. Running the Server

### v1 (typical)

```bash
# .env or OS env
export DATABASE_TYPE=sqlite
export DATABASE_URL=data.db
export CLIENT_ID=...
export CLIENT_SECRET=...
./build/server
```

Or configure via dashboard after first run.

### v2 (recommended)

Pass all config as **CLI arguments** when starting the server:

```bash
./build/server \
  --database-type=sqlite \
  --database-url=data.db \
  --client-id=YOUR_CLIENT_ID \
  --client-secret=YOUR_CLIENT_SECRET \
  --admin-secret=your-admin-secret \
  --jwt-type=HS256 \
  --jwt-secret=your-jwt-secret
```

For local development (from repo root):

```bash
make dev
# or
go run main.go --database-type=sqlite --database-url=test.db \
  --jwt-type=HS256 --jwt-secret=test --admin-secret=admin \
  --client-id=123456 --client-secret=secret
```

### Using environment variables with v2

The v2 server does **not** read from `.env` or from a fixed set of OS env vars.
To keep using env vars in your deployment:

- **Option A:** Set env vars in your platform (Docker, K8s, Railway, etc.) and pass them into the process as arguments via a wrapper script or `envsubst`:

  ```bash
  ./build/server \
    --database-type="$DATABASE_TYPE" \
    --database-url="$DATABASE_URL" \
    --client-id="$CLIENT_ID" \
    --client-secret="$CLIENT_SECRET" \
    ...
  ```

- **Option B:** Use your platform's way of injecting env into the command line (for example Docker `CMD` or Kubernetes command/args that reference env).

Example Docker run:

```bash
docker run -p 8080:8080 \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL="postgres://..." \
  -e CLIENT_ID=... \
  -e CLIENT_SECRET=... \
  your-authorizer-image \
  ./build/server \
    --database-type="$DATABASE_TYPE" \
    --database-url="$DATABASE_URL" \
    --client-id="$CLIENT_ID" \
    --client-secret="$CLIENT_SECRET" \
    --admin-secret="$ADMIN_SECRET"
```

### Build from source (v2)

#### Prerequisites

- Go >= 1.24 (see `go.mod` in the main repo).
- Node.js >= 18 and npm / pnpm / yarn (only required if you want to build the web UIs).

#### Steps

1. **Clone the repo**

   ```bash
   git clone https://github.com/authorizerdev/authorizer.git
   cd authorizer
   ```

2. **Build the server binary**

   ```bash
   go build -o build/authorizer .
   ```

3. **(Optional) Build the web app and dashboard**

   ```bash
   cd web/app && npm ci && npm run build
   cd ../dashboard && npm ci && npm run build
   cd ../..  # back to repo root
   ```

4. **Run the server with CLI args**

   ```bash
   ./build/authorizer \
     --database-type=sqlite \
     --database-url=data.db \
     --client-id=YOUR_CLIENT_ID \
     --client-secret=YOUR_CLIENT_SECRET \
     --admin-secret=your-admin-secret \
     --jwt-type=HS256 \
     --jwt-secret=your-jwt-secret
   ```

---

## 3. Configuration Mapping (v1 env / v1 behavior to v2 CLI flags)

Use these v2 **CLI flags** instead of v1 env or dashboard config. Flag names use **kebab-case** (for example `--database-url`).

### Deprecated v1-style flag names (do not use)

- `database_url` -- use `--database-url`
- `database_type` -- use `--database-type`
- `env_file` -- **no longer supported**
- `log_level` -- use `--log-level`
- `redis_url` -- use `--redis-url`

### Core / server

| v1 (env or behavior) | v2 CLI flag |
| -------------------- | ----------- |
| `ENV`                | `--env` |
| `PORT`               | `--http-port` (default: 8080) |
| Host                 | `--host` (default: 0.0.0.0) |
| Metrics port         | `--metrics-port` (default: 8081) |
| `LOG_LEVEL`          | `--log-level` |

### Database

| v1                | v2 CLI flag |
| ----------------- | ----------- |
| `DATABASE_TYPE`   | `--database-type` |
| `DATABASE_URL`    | `--database-url` |
| `DATABASE_NAME`   | `--database-name` |
| `DATABASE_USERNAME` | `--database-username` |
| `DATABASE_PASSWORD` | `--database-password` |
| `DATABASE_HOST`   | `--database-host` |
| `DATABASE_PORT`   | `--database-port` |
| `DATABASE_CERT`, `DATABASE_CA_CERT`, `DATABASE_CERT_KEY` | `--database-cert`, `--database-ca-cert`, `--database-cert-key` |
| Couchbase         | `--couchbase-bucket`, `--couchbase-scope`, `--couchbase-ram-quota` |
| AWS/DynamoDB      | `--aws-region`, `--aws-access-key-id`, `--aws-secret-access-key` |

### Memory store (sessions)

| v1          | v2 CLI flag |
| ----------- | ----------- |
| `REDIS_URL` | `--redis-url` |

### OAuth / app

| v1                 | v2 CLI flag |
| ------------------ | ----------- |
| `CLIENT_ID`        | `--client-id` **(required)** |
| `CLIENT_SECRET`    | `--client-secret` **(required)** |
| `ADMIN_SECRET`     | `--admin-secret` |
| `ALLOWED_ORIGINS`  | `--allowed-origins` (slice; default `*`) |
| `DEFAULT_AUTHORIZE_RESPONSE_TYPE` / `MODE` | `--default-authorize-response-type`, `--default-authorize-response-mode` |

### Organization / UI

| v1                   | v2 CLI flag |
| -------------------- | ----------- |
| `ORGANIZATION_NAME`  | `--organization-name` |
| `ORGANIZATION_LOGO`  | `--organization-logo` |
| `DISABLE_LOGIN_PAGE` | `--enable-login-page` (inverted: use `false` to disable) |
| `DISABLE_PLAYGROUND` | `--enable-playground` (inverted: use `false` to disable) |
| N/A (GraphQL introspection always on) | `--enable-graphql-introspection` (default `true`; set `false` to disable schema introspection in hardened environments) |

### Auth behavior

| v1                              | v2 CLI flag |
| --------------------------------| ----------- |
| Roles                           | `--roles`, `--default-roles`, `--protected-roles` |
| `DISABLE_STRONG_PASSWORD`       | `--enable-strong-password` (inverted) |
| `DISABLE_BASIC_AUTHENTICATION`  | `--enable-basic-authentication` (inverted) |
| `DISABLE_EMAIL_VERIFICATION`    | `--enable-email-verification` (inverted) |
| `DISABLE_MAGIC_LINK_LOGIN`      | `--enable-magic-link-login` (inverted) |
| `ENFORCE_MULTI_FACTOR_AUTHENTICATION` | `--enforce-mfa`, `--enable-mfa` |
| `DISABLE_SIGN_UP`               | `--enable-signup` (inverted) |
| TOTP / OTP                      | `--enable-totp-login`, `--enable-email-otp`, `--enable-sms-otp` |
| Mobile basic auth               | `--enable-mobile-basic-authentication` |
| Phone verification              | `--enable-phone-verification` |

### Cookies

| v1                                        | v2 CLI flag |
| ----------------------------------------- | ----------- |
| `APP_COOKIE_SECURE`, `ADMIN_COOKIE_SECURE` | `--app-cookie-secure`, `--admin-cookie-secure` |

### JWT

| v1                         | v2 CLI flag |
| -------------------------- | ----------- |
| `JWT_TYPE`                 | `--jwt-type` |
| `JWT_SECRET`               | `--jwt-secret` |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` | `--jwt-private-key`, `--jwt-public-key` |
| `JWT_ROLE_CLAIM`           | `--jwt-role-claim` |
| `CUSTOM_ACCESS_TOKEN_SCRIPT` | `--custom-access-token-script` |

### SMTP

| v1                        | v2 CLI flag |
| ------------------------- | ----------- |
| `SMTP_HOST`, `SMTP_PORT`  | `--smtp-host`, `--smtp-port` |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | `--smtp-username`, `--smtp-password` |
| `SENDER_EMAIL`, `SENDER_NAME` | `--smtp-sender-email`, `--smtp-sender-name` |
| `SMTP_LOCAL_NAME`         | `--smtp-local-name` |
| Skip TLS verify           | `--skip-tls-verification` |

### Twilio (SMS)

| v1                                                     | v2 CLI flag |
| ------------------------------------------------------ | ----------- |
| `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_SENDER` | `--twilio-account-sid`, `--twilio-api-key`, `--twilio-api-secret`, `--twilio-sender` |

### Social / OAuth providers

Each provider is configured with `--<provider>-client-id`, `--<provider>-client-secret`, and optionally `--<provider>-scopes`, for example:

- `--google-client-id`, `--google-client-secret`, `--google-scopes`
- `--github-client-id`, `--github-client-secret`, `--github-scopes`
- `--facebook-client-id`, `--facebook-client-secret`, `--facebook-scopes`
- `--microsoft-client-id`, `--microsoft-client-secret`, `--microsoft-tenant-id`, `--microsoft-scopes`
- `--apple-client-id`, `--apple-client-secret`, `--apple-scopes`
- `--linkedin-client-id`, `--linkedin-client-secret`, `--linkedin-scopes`
- `--discord-client-id`, `--discord-client-secret`, `--discord-scopes`
- `--twitter-client-id`, `--twitter-client-secret`, `--twitter-scopes`
- `--twitch-client-id`, `--twitch-client-secret`, `--twitch-scopes`
- `--roblox-client-id`, `--roblox-client-secret`, `--roblox-scopes`

### Other

| v1                  | v2 CLI flag |
| ------------------- | ----------- |
| `RESET_PASSWORD_URL` | `--reset-password-url` |

### Admin / GraphQL security flags (v2-only)

The following flags are **new in v2** and help harden your deployment:

- **`--disable-admin-header-auth`**: when set to `true`, the server **does not** accept `X-Authorizer-Admin-Secret` as admin authentication; only the secure admin cookie is honored.
  - **Recommended for production**: `--disable-admin-header-auth=true`.
- **`--enable-graphql-introspection`**: controls whether GraphQL introspection is enabled on `/graphql`.
  - Default is `true` (for development and tooling).
  - For locked-down production, you can set `--enable-graphql-introspection=false` to prevent unauthenticated schema discovery.

To see all flags and defaults:

```bash
./build/server --help
```

### Breaking changes — April 2026 security batch

If you are upgrading **across** the April 2026 security release (any
release on or after that date), two existing flags now have stricter
behaviour. Both will cause silent regressions if you don't address them
during the upgrade:

#### `--admin-secret` is now required

In earlier v2 releases, `--admin-secret` defaulted to the literal string
`password` if you forgot to set it. That default is gone. The server
now exits at startup with a fatal error when the flag is empty or
missing:

```
FATAL: --admin-secret is required and must not be empty.
```

**Action required:** set `--admin-secret` to any non-empty value before
restarting. The strength of the secret is your responsibility — the
server only enforces non-emptiness.

```bash
./build/server --admin-secret="$(openssl rand -hex 32)" ...
```

#### `--trusted-proxies` defaults to none

Per-IP rate limiting, audit logs, Prometheus metrics, and CSRF
same-origin checks now read the client IP from `RemoteAddr` by default
and **ignore** `X-Forwarded-For`. This closes a spoofing hole where any
client could pretend to be a different IP by sending a forged
`X-Forwarded-For` header.

If your Authorizer instance is **directly exposed to the internet** (no
proxy in front), you don't need to do anything — the new default is
correct.

If your Authorizer instance is **behind a reverse proxy** (nginx, AWS
ALB, Cloudflare, an ingress controller, etc.), you must opt in by
listing the proxy network in CIDR form. Otherwise, every request will
appear to come from the proxy IP and per-IP rate limiting will trip on
its first burst:

```bash
# Behind nginx on the same host
./build/server --trusted-proxies=127.0.0.1/32,::1/128 ...

# Inside a Kubernetes cluster
./build/server --trusted-proxies=10.0.0.0/8 ...

# Behind Cloudflare
./build/server --trusted-proxies=$(cat cloudflare-ips.txt | paste -sd, -) ...
```

See the new [Security Hardening](../core/security#trusted-proxies) page
for the full topology table and flag reference.

---

## 4. Deprecated GraphQL API Behavior

These mutations exist for compatibility but **return an error** in v2; configure via CLI instead.

| Mutation          | v2 behavior |
| ----------------- | ----------- |
| `_update_env`     | Returns error: `"deprecated. please configure env via cli args"` |
| `_admin_signup`   | Returns error: `"deprecated. please configure admin secret via cli args"` |
| `_generate_jwt_keys` | Returns error: `"deprecated. please configure jwt keys via cli args"` |

- **Admin secret:** set with `--admin-secret` at startup.
- **JWT keys/type:** set with `--jwt-type`, `--jwt-secret`, or `--jwt-private-key` / `--jwt-public-key` at startup.
- **All other env:** use the corresponding CLI flags when starting the server.

If your app or dashboard calls `_update_env`, `_admin_signup`, or `_generate_jwt_keys`, remove or replace those calls and move configuration to startup arguments.

---

## 5. Docker changes in v2

- The v2 image uses **ENTRYPOINT** so the server receives CLI arguments at runtime.
- Do **not** rely on env vars being read directly by the server; pass config as **arguments** to the container.

Example:

```dockerfile
ENTRYPOINT [ "./build/server" ]
CMD []
```

Run with args:

```bash
docker run -p 8080:8080 your-image \
  --database-type=postgres \
  --database-url="postgres://user:pass@host/db" \
  --client-id=... \
  --client-secret=... \
  --admin-secret=...
```

Or use a script inside the image that maps env to flags and then runs `./build/server ...`.

---

## 6. SDK and Client Libraries

### `@authorizerdev/authorizer-js` (v3)

- **Version:** v2 uses **authorizer-js** `3.0.0-rc.1` (or compatible v3).
- **Type renames (breaking):**
  - `SignupInput` to `SignUpRequest`
  - `LoginInput` to `LoginRequest`
  - `VerifyOtpInput` to `VerifyOTPRequest`
  - `MagicLinkLoginInput` to `MagicLinkLoginRequest`
- **Build/output:** CJS/ESM paths may differ; check the package `exports` and your bundler.

Upgrade:

```bash
npm install @authorizerdev/authorizer-js@^3.0.0-rc.1
# or
pnpm add @authorizerdev/authorizer-js@^3.0.0-rc.1
```

### `@authorizerdev/authorizer-react` (v2)

- **Version:** use **authorizer-react** `2.0.0-rc.1` (or compatible v2) with **authorizer-js** v3.
- **Breaking:** build system (tsdx to tsup), output paths (for example `dist/index.cjs`, `dist/index.mjs`), and **Node.js >= 18**.
- **Types:** same renames as authorizer-js (for example `SignUpRequest`, `LoginRequest`).

Example migration for type imports:

```ts
// Old
import { SignupInput, LoginInput } from '@authorizerdev/authorizer-js'
// New
import { SignUpRequest, LoginRequest } from '@authorizerdev/authorizer-js'
```

### Other libraries

- **authorizer-vue**, **authorizer-svelte**, **authorizer-go**, **authorizer-flutter-sdk**, and other repos under the Authorizer org will be updated for v2 compatibility; use versions that explicitly support Authorizer server v2 when available.

---

## 7. Migration Checklist

- [ ] **Copy all existing v1 credentials** either from the dashboard or using the `_env` GraphQL query with your admin secret (see Step 1 above). Do this **before** shutting down v1.
- [ ] Replace all v1 env / dashboard config with **CLI arguments** at server start.
- [ ] Set **`--client-id`** and **`--client-secret`** (required).
- [ ] Set **`--admin-secret`** and JWT options (`--jwt-type` and `--jwt-secret` or key pair) at startup.
- [ ] Stop calling **`_update_env`**, **`_admin_signup`**, and **`_generate_jwt_keys`**; remove or replace with startup config.
- [ ] Update Docker/K8s/deployment to pass config as **CLI args** (or via a wrapper that maps env to args).
- [ ] Upgrade **@authorizerdev/authorizer-js** to v3 and **@authorizerdev/authorizer-react** to v2; update type names and Node version as needed.
- [ ] Use **kebab-case** flags (for example `--database-url`) and avoid deprecated names (`database_url`, `env_file`, etc.).
- [ ] Re-test admin login, JWT issuance, and any flows that previously depended on dashboard-updated env.
