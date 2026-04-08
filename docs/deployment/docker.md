---
sidebar_position: 2
title: Docker
---

# Docker

Run Authorizer using Docker with the v2 **CLI-only configuration model**.

---

## Quick Start

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

Then open `http://localhost:8080/app` for the built-in login UI.

---

## Ports: `EXPOSE`, publishing, and metrics {#docker-ports-exposure}

The image **`EXPOSE`s `8080` and `8081`**. That only **documents** which ports the application may listen on; it does **not** open them on the Docker host. You choose what to publish with `-p` or Compose `ports:`.

| Port | Role | Typical use |
|------|------|-------------|
| **8080** | Main HTTP (API, UI, `/healthz`, `/readyz`) | **Yes** — map to the host or front with a reverse proxy / load balancer. |
| **8081** | Prometheus **`/metrics`** (separate listener) | **Depends** — see below. |

**Recommended defaults**

- **`docker run` (single container, no in-Docker Prometheus):** publish **only `8080`** (e.g. `-p 8080:8080`). Metrics stay on **`127.0.0.1:8081`** inside the container; that is enough if you scrape from an agent on the **same host** using the container’s network namespace, or you do not need metrics yet.
- **Docker Compose / Swarm with Prometheus as another service:** add **`--metrics-host=0.0.0.0`** so `8081` accepts connections on the **internal** compose network. Prefer **not** adding `"8081:8081"` under `ports:` (avoids exposing metrics on the host). Prometheus should use a service DNS name like `http://authorizer:8081/metrics` on the internal network only.
- **Public internet:** never publish **8081** to a public address. Keep metrics on loopback or an internal network; use auth/network policy at the edge if you must expose a scrape path.

**Health checks:** the image `HEALTHCHECK` calls **`http://127.0.0.1:8080/healthz`** on the main server only, so liveness works even when metrics are loopback-only.

---

## Using with PostgreSQL

```bash
docker run -p 8080:8080 lakhansamani/authorizer:latest \
  --database-type=postgres \
  --database-url="postgres://user:pass@host:5432/authorizer" \
  --jwt-type=HS256 \
  --jwt-secret=your-jwt-secret \
  --admin-secret=your-admin-secret \
  --client-id=123456 \
  --client-secret=secret
```

---

## Docker Compose

Create a `docker-compose.yml`:

```yaml
version: "3.8"
services:
  authorizer:
    image: lakhansamani/authorizer:latest
    ports:
      - "8080:8080"
    command:
      - "--database-type=sqlite"
      - "--database-url=/data/test.db"
      - "--jwt-type=HS256"
      - "--jwt-secret=test"
      - "--admin-secret=admin"
      - "--client-id=123456"
      - "--client-secret=secret"
    volumes:
      - authorizer_data:/data

volumes:
  authorizer_data:
```

Start with:

```bash
docker compose up -d
```

---

## Docker Compose with PostgreSQL and Redis

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: authorizer
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: authorizer
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  authorizer:
    image: lakhansamani/authorizer:latest
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
    command:
      - "--database-type=postgres"
      - "--database-url=postgres://authorizer:secret@postgres:5432/authorizer"
      - "--redis-url=redis://redis:6379"
      - "--jwt-type=HS256"
      - "--jwt-secret=test"
      - "--admin-secret=admin"
      - "--client-id=123456"
      - "--client-secret=secret"
      - "--env=production"

volumes:
  pg_data:
```

---

## Using Environment Variables with v2

The v2 server does **not** read from `.env` files or OS env vars directly. To use env vars in your deployment, map them into CLI flags:

```bash
docker run -p 8080:8080 \
  -e DATABASE_TYPE=sqlite \
  -e DATABASE_URL=test.db \
  -e JWT_SECRET=test \
  -e ADMIN_SECRET=admin \
  -e CLIENT_ID=123456 \
  -e CLIENT_SECRET=secret \
  lakhansamani/authorizer:latest \
    --database-type="$DATABASE_TYPE" \
    --database-url="$DATABASE_URL" \
    --jwt-type=HS256 \
    --jwt-secret="$JWT_SECRET" \
    --admin-secret="$ADMIN_SECRET" \
    --client-id="$CLIENT_ID" \
    --client-secret="$CLIENT_SECRET"
```

---

## Required Variables

| Flag | Description | Example |
| ---- | ----------- | ------- |
| `--database-type` | Database type | `sqlite`, `postgres`, `mysql` |
| `--database-url` | Database connection string | `test.db` |
| `--jwt-type` | JWT signing algorithm | `HS256`, `RS256` |
| `--jwt-secret` | JWT signing secret (for HS256) | `test` |
| `--admin-secret` | Admin secret for admin operations | `admin` |
| `--client-id` | Client identifier **(required)** | `123456` |
| `--client-secret` | Client secret **(required)** | `secret` |

For all available flags, see [Server Configuration](../core/server-config).
