---
sidebar_position: 9
title: Koyeb
---

# Deploy on Koyeb

## Introduction

[Koyeb](https://www.koyeb.com/) is a developer-friendly serverless platform to deploy apps globally with native autoscaling, a global edge network, and built-in service mesh.

## Requirements

- A [Koyeb account](https://www.koyeb.com/)
- A PostgreSQL database (providers like [Neon](https://neon.tech/) and [Aiven](https://aiven.io/) offer free tiers)

## Deploy an Authorizer Instance

[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?name=authorizer&type=docker&image=quay.io/authorizer/authorizer&env[PORT]=8000&env[DATABASE_TYPE]=postgres&env[DATABASE_URL]=CHANGE_ME&ports=8000;http;/)

### Step 1: Enter application details

Choose the configuration for your deployment:

- **Name**: Service name in Koyeb
- **Region**: Deployment region
- **Instance**: Instance size
- **Scaling**: Number of instances

![Koyeb config](/img/koyeb_app_config.png)

### Step 2: Configure the database URL

In the **Environment variables** section, set the `DATABASE_URL` to your PostgreSQL connection string.

![Koyeb database URL](/img/koyeb_database_url.png)

### Step 3: Configure v2 required variables

Add the following environment variables:

| Variable | Example Value |
| -------- | ------------- |
| `DATABASE_TYPE` | `postgres` |
| `DATABASE_URL` | `postgres://user:pass@host:5432/db` |
| `JWT_TYPE` | `HS256` |
| `JWT_SECRET` | `test` |
| `ADMIN_SECRET` | `admin` |
| `CLIENT_ID` | `123456` |
| `CLIENT_SECRET` | `secret` |

Update the start command to pass CLI flags:

```bash
./build/server \
  --http-port=$PORT \
  --database-type=$DATABASE_TYPE \
  --database-url=$DATABASE_URL \
  --jwt-type=$JWT_TYPE \
  --jwt-secret=$JWT_SECRET \
  --admin-secret=$ADMIN_SECRET \
  --client-id=$CLIENT_ID \
  --client-secret=$CLIENT_SECRET
```

:::caution Bind the port
The deploy button sets `PORT=8000` and exposes `8000;http`. Pass `--http-port=$PORT` so the server binds the port Koyeb routes to — the server does **not** read `$PORT` on its own.
:::

### Ports on Koyeb

The `8000;http` port serves the **whole API** — GraphQL plus the REST `/v1/*` surface (the gRPC service proxied in-process), OAuth, and the login UI. Koyeb supports **multiple ports with per-port protocols**, so to expose **native gRPC** add a second port mapped to `9091` with the **`http2`** protocol (`ports=8000;http;/&ports=9091;http2`, or add it in the service's **Ports** settings). Keep metrics (`8081`) unexposed. Most clients don't need native gRPC — use REST/GraphQL. See [gRPC API](../core/grpc) and [Docker ports](./docker#docker-ports-exposure).

![Koyeb authorizer URL](/img/koyeb_authorizer_url.png)
