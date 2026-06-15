---
sidebar_position: 5
title: Heroku
---

# Deploy on Heroku

## Create Instance

Deploy Authorizer with PostgreSQL on [Heroku](https://heroku.com):

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku)

After clicking the button:

### Step 1: Enter the App name

The app name becomes your URL. For example, `authorizer-demo` gives you `authorizer-demo.herokuapp.com`.

### Step 2: Choose the Region and deploy

Select your deployment region (United States or Europe).

### Step 3: Configure for v2

For Authorizer v2, configure the following required variables in your Heroku app settings under **Config Vars**:

| Variable | Example Value |
| -------- | ------------- |
| `DATABASE_TYPE` | `postgres` |
| `DATABASE_URL` | *(auto-configured by Heroku add-on)* |
| `JWT_TYPE` | `HS256` |
| `JWT_SECRET` | `test` |
| `ADMIN_SECRET` | `admin` |
| `CLIENT_ID` | `123456` |
| `CLIENT_SECRET` | `secret` |

### Optional: metrics bind address and rate limits

The [authorizer-heroku](https://github.com/authorizerdev/authorizer-heroku) Dockerfile passes these **Config Vars** through to the binary (shell defaults match Authorizer):

| Variable | Maps to | Default | Notes |
| -------- | ------- | ------- | ----- |
| `METRICS_HOST` | `--metrics-host` | `127.0.0.1` | `0.0.0.0` only if an internal scraper must reach `METRICS_PORT`; do not publish metrics publicly. |
| `METRICS_PORT` | `--metrics-port` | `8081` | |
| `RATE_LIMIT_RPS` | `--rate-limit-rps` | `30` | `0` disables per-IP limiting. |
| `RATE_LIMIT_BURST` | `--rate-limit-burst` | `20` | |
| `RATE_LIMIT_FAIL_CLOSED` | `--rate-limit-fail-closed` | `false` | `true` → **503** on rate-limit backend errors. |

Use `REDIS_URL` for shared sessions and rate limits across dynos ([rate limiting](../core/rate-limiting)).

Update the Procfile or startup command to pass CLI flags:

```
web: ./build/server --http-port=$PORT --database-type=$DATABASE_TYPE --database-url=$DATABASE_URL --jwt-type=$JWT_TYPE --jwt-secret=$JWT_SECRET --admin-secret=$ADMIN_SECRET --client-id=$CLIENT_ID --client-secret=$CLIENT_SECRET
```

:::caution Bind the platform's `$PORT`
Heroku assigns a **dynamic** `$PORT` and routes HTTPS only to that port; the server does **not** read `$PORT` on its own, so you **must** pass `--http-port=$PORT`. Without it the dyno binds `8080`, the router can't reach it, and boot fails (`R10`). The published [`authorizer-heroku`](https://github.com/authorizerdev/authorizer-heroku) image already does this.
:::

### Ports on Heroku

A Heroku web dyno exposes **one** HTTP port (`$PORT`). That single port serves the **entire API** — GraphQL (`/graphql`) and the REST `/v1/*` surface (which proxies the gRPC service in-process), plus OAuth and the login UI. **Native gRPC (`9091`) and metrics (`8081`) cannot be published** on a single-port dyno; the listeners still run inside the dyno but Heroku's router won't route to them. Use REST/GraphQL for all clients; if you need native gRPC, deploy on a multi-port platform ([Fly.io](./fly-io), [Koyeb](./koyeb)) or Kubernetes. See [gRPC API](../core/grpc) and [Docker ports](./docker#docker-ports-exposure).

---

## Updating Instance

### Prerequisites

- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
- [Git](https://git-scm.com/downloads)

### Step 1: Clone Authorizer Heroku App

```bash
git clone https://github.com/authorizerdev/authorizer-heroku
cd authorizer-heroku
```

### Step 2: Attach Heroku app

```bash
# Replace authorizer-heroku with your Heroku app's name
heroku git:remote -a authorizer-heroku
heroku stack:set container -a authorizer-heroku
```

### Step 3: Deploy the latest version

```bash
git push heroku main
```
