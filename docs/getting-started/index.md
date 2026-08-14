---
sidebar_position: 1
title: Getting Started
---

# Getting Started

This guide helps you start **Authorizer v2** using the **CLI-based configuration model**.
If you are upgrading from v1, read the [Migration v1 to v2](../migration/v1-to-v2) guide alongside this page.

---

## Required Variables

All examples below use these required variables. Replace with your own values for production:

:::info `--encryption-key` (2.4.0+)

Encrypts [TOTP](https://datatracker.ietf.org/doc/html/rfc6238) shared secrets and OTP digests at rest. **Required when `--jwt-type`
is `RS*`/`ES*`** — with no `--jwt-secret` to fall back to, the server refuses to
start without it. With HMAC types (`HS*`) it falls back to `--jwt-secret`, but a
distinct value is recommended: rotating the JWT secret otherwise re-keys at-rest
data and locks out every enrolled TOTP user.

Generate it **once** (`openssl rand -hex 32`), store it as a secret, and keep it
stable across restarts — a key that changes on every boot leaves existing TOTP
enrolments and pending OTPs undecryptable. Omit the flag on releases before
2.4.0, which do not have it. See [Server Configuration](/core/server-config).

:::

| Flag | Description | Sample Value |
| ---- | ----------- | ------------ |
| `--database-type` | Database type | `sqlite` |
| `--database-url` | Database connection string | `test.db` |
| `--jwt-type` | JWT signing algorithm | `HS256` |
| `--jwt-secret` | JWT signing secret | `test` |
| `--encryption-key` | At-rest key for TOTP secrets and OTP digests (2.4.0+). Required with `RS*`/`ES*` | *(generate once with `openssl rand -hex 32`)* |
| `--admin-secret` | Admin secret for admin operations | `admin` |
| `--client-id` | Client identifier **(required)** | `123456` |
| `--client-secret` | Client secret **(required)** | `secret` |

> **Important:** `--client-id` and `--client-secret` are **required** in v2. The server does **not** read `.env` files or dashboard-managed env anymore.

---

## Option A: Run from Source

### Prerequisites

- Go **>= 1.24**
- Node.js **>= 18** (only if building web UIs)
- A database (SQLite, Postgres, MySQL, etc.)

### Build and run

```bash
git clone https://github.com/authorizerdev/authorizer.git
cd authorizer

go build -o build/authorizer .

./authorizer \
  --database-type=sqlite \
  --database-url=test.db \
  --url=http://localhost:8080 \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --encryption-key=test-encryption-key \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

For local development:

```bash
make dev
# or
go run main.go \
  --database-type=sqlite \
  --database-url=test.db \
  --url=http://localhost:8080 \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --encryption-key=test-encryption-key \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

---

## Option B: Docker

```bash
docker run -p 8080:8080 quay.io/authorizer/authorizer:latest \
  --database-type=sqlite \
  --database-url=test.db \
  --url=http://localhost:8080 \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --encryption-key=test-encryption-key \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

With PostgreSQL:

```bash
docker run -p 8080:8080 quay.io/authorizer/authorizer:latest \
  --database-type=postgres \
  --database-url="postgres://user:pass@host:5432/authorizer" \
  --url=http://localhost:8080 \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --encryption-key=test-encryption-key \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

See [Docker deployment](../deployment/docker) for Docker Compose examples.

---

## Option C: Download Binary

Download from the [release page](https://github.com/authorizerdev/authorizer/releases):

```bash
# Download and extract
tar -zxf AUTHORIZER_VERSION -c authorizer
cd authorizer

# Run with required flags
./authorizer \
  --database-type=sqlite \
  --database-url=test.db \
  --url=http://localhost:8080 \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --encryption-key=test-encryption-key \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

> For Mac users, grant permission: `xattr -d com.apple.quarantine build/authorizer`

See [Binary deployment](../deployment/binary) for systemd service setup.

---

## Option D: Kubernetes

```bash
kubectl apply -f authorizer-v2.yaml
```

See [Kubernetes deployment](../deployment/kubernetes) for full manifests and [Helm Chart](../deployment/helm-chart) for Helm-based installation.

---

## Option E: One-click Deployments

| Platform | Deploy Link |
| -------- | ----------- |
| Railway | [Deploy on Railway](https://railway.com/deploy/authorizer-1?referralCode=FEF4uT&utm_medium=integration&utm_source=template&utm_campaign=generic) |
| Heroku | [Deploy to Heroku](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku) |
| Render | [Deploy to Render](https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render) |
| Koyeb | [Deploy to Koyeb](https://app.koyeb.com/deploy?name=authorizer&type=docker&image=quay.io/authorizer/authorizer&env[PORT]=8000&env[DATABASE_TYPE]=postgres&env[DATABASE_URL]=CHANGE_ME&ports=8000;http;/) |

See the [Deployment](../deployment/) section for detailed guides for each platform.

---

## Verify it works

After starting the server, open:

- `http://localhost:8080/app` -- built-in login UI
- `http://localhost:8080/graphql` -- GraphQL endpoint (playground if enabled)

---

## Minimal configuration for local development

For a quick local dev setup:

```bash
./authorizer \
  --env=development \
  --http-port=8080 \
  --database-type=sqlite \
  --database-url=test.db \
  --url=http://localhost:8080 \
  --client-id=123456 \
  --client-secret=secret \
  --admin-secret=admin \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --encryption-key=test-encryption-key \
  --allowed-origins=http://localhost:3000
```

See [Server Configuration](../core/server-config) for all flags and hardening options.

---

## Frontend SDK versions for v2

When talking to a v2 server, use:

- **`@authorizerdev/authorizer-js` v3** (`^3.3.0` or compatible v3)
- **`@authorizerdev/authorizer-react` v2** (`^2.0.0` or compatible v2)

```bash
npm install @authorizerdev/authorizer-js@^3.3.0 \
            @authorizerdev/authorizer-react@^2.0.0
```

If you used types directly from `authorizer-js`, rename them for v2:

```ts
// Old (v1)
import { SignupInput, LoginInput } from '@authorizerdev/authorizer-js'

// New (v2 server + v3 SDK)
import { SignUpRequest, LoginRequest } from '@authorizerdev/authorizer-js'
```

For more details and a full checklist, see [Migration v1 to v2](../migration/v1-to-v2#6-sdk-and-client-libraries).
