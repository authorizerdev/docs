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

| Flag | Description | Sample Value |
| ---- | ----------- | ------------ |
| `--database-type` | Database type | `sqlite` |
| `--database-url` | Database connection string | `test.db` |
| `--jwt-type` | JWT signing algorithm | `HS256` |
| `--jwt-secret` | JWT signing secret | `test` |
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

go build -o build/server .

./build/server \
  --database-type=sqlite \
  --database-url=test.db \
  --jwt-type=HS256 \
  --jwt-secret=test \
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
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

---

## Option B: Docker

```bash
docker run -p 8080:8080 lakhansamani/authorizer:latest \
  --database-type=sqlite \
  --database-url=test.db \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

With PostgreSQL:

```bash
docker run -p 8080:8080 lakhansamani/authorizer:latest \
  --database-type=postgres \
  --database-url="postgres://user:pass@host:5432/authorizer" \
  --jwt-type=HS256 \
  --jwt-secret=test \
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
./build/server \
  --database-type=sqlite \
  --database-url=test.db \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

> For Mac users, grant permission: `xattr -d com.apple.quarantine build/server`

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
| Railway | [Deploy on Railway](https://railway.app/new/template/nwXp1C?referralCode=FEF4uT) |
| Heroku | [Deploy to Heroku](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku) |
| Render | [Deploy to Render](https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render) |
| Koyeb | [Deploy to Koyeb](https://app.koyeb.com/deploy?name=authorizer&type=docker&image=docker.io/lakhansamani/authorizer&env[PORT]=8000&env[DATABASE_TYPE]=postgres&env[DATABASE_URL]=CHANGE_ME&ports=8000;http;/) |

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
./build/server \
  --env=development \
  --http-port=8080 \
  --database-type=sqlite \
  --database-url=test.db \
  --client-id=123456 \
  --client-secret=secret \
  --admin-secret=admin \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --allowed-origins=http://localhost:3000
```

See [Server Configuration](../core/server-config) for all flags and hardening options.

---

## Frontend SDK versions for v2

When talking to a v2 server, use:

- **`@authorizerdev/authorizer-js` v3** (`^3.0.0-rc.1` or compatible v3)
- **`@authorizerdev/authorizer-react` v2** (`^2.0.0-rc.1` or compatible v2)

```bash
npm install @authorizerdev/authorizer-js@^3.0.0-rc.1 \
            @authorizerdev/authorizer-react@^2.0.0-rc.1
```

If you used types directly from `authorizer-js`, rename them for v2:

```ts
// Old (v1)
import { SignupInput, LoginInput } from '@authorizerdev/authorizer-js'

// New (v2 server + v3 SDK)
import { SignUpRequest, LoginRequest } from '@authorizerdev/authorizer-js'
```

For more details and a full checklist, see [Migration v1 to v2](../migration/v1-to-v2#6-sdk-and-client-libraries).
