---
sidebar_position: 4
title: Helm Chart
---

# Helm Chart

Install Authorizer on a Kubernetes cluster using the official Helm chart.

---

## Prerequisites

- A running Kubernetes cluster
- [Helm](https://helm.sh/docs/intro/install/) installed

---

## Getting Started

### Step 1: Add repository

```bash
helm repo add authorizer https://helm-charts.authorizer.dev
```

### Step 2: Update helm repos

```bash
helm repo update
```

### Step 3: Install helm chart

For a minimal setup with SQLite and the required v2 variables:

```bash
helm install \
    --namespace authorizer \
    --create-namespace \
    --set authorizer.database_type=sqlite \
    --set authorizer.database_url="/tmp/test.db" \
    --set authorizer.authorizer_url=https://auth.example.com \
    --set authorizer.jwt_type=HS256 \
    --set authorizer.jwt_secret=test \
    --set authorizer.encryption_key=test-encryption-key \
    --set authorizer.admin_secret=admin \
    --set authorizer.client_id=123456 \
    --set authorizer.client_secret=secret \
    --set securityContext.readOnlyRootFilesystem=false \
    authorizer authorizer/authorizer
```

For PostgreSQL:

```bash
helm install \
    --namespace authorizer \
    --create-namespace \
    --set authorizer.database_type=postgres \
    --set authorizer.database_url="postgres://user:pass@host:5432/authorizer" \
    --set authorizer.authorizer_url=https://auth.example.com \
    --set authorizer.jwt_type=HS256 \
    --set authorizer.jwt_secret=your-jwt-secret \
    --set authorizer.encryption_key=your-encryption-key \
    --set authorizer.admin_secret=your-admin-secret \
    --set authorizer.client_id=123456 \
    --set authorizer.client_secret=secret \
    authorizer authorizer/authorizer
```

---

## Helm Chart Variables

### Required Variables

| Name | Description | Default |
| ---- | ----------- | ------- |
| `authorizer.database_type` | Database type: `postgres`, `mysql`, `sqlite`, `sqlserver`, `mongodb`, `arangodb`, `yugabyte`, `mariadb`, `cassandradb`, `scylladb`, `couchbase`, `dynamodb`, `planetscale` | - |
| `authorizer.database_url` | Database connection string. See [Databases](../core/databases) | - |
| `authorizer.authorizer_url` | This deployment's own public base URL, with the scheme (`--url`). **Required as of 2.4.0** — the chart refuses to render without it, because the server exits at boot. This is *not* `allowed_origins`: `authorizer_url` is where Authorizer itself is reachable, `allowed_origins` lists the apps it may redirect to | - |
| `authorizer.client_id` | Client identifier **(required in v2)** | - |
| `authorizer.client_secret` | Client secret **(required in v2)** | - |
| `authorizer.admin_secret` | Admin secret for admin operations | - |
| `authorizer.jwt_type` | JWT signing algorithm (`HS256`, `RS256`) | - |
| `authorizer.jwt_secret` | JWT signing secret (for HS256) | - |

### Database Variables

| Name | Description | Default |
| ---- | ----------- | ------- |
| `authorizer.database_host` | Host name for cassandradb and scylladb | - |
| `authorizer.database_username` | Username for cassandradb and scylladb | - |
| `authorizer.database_password` | Password for cassandradb and scylladb | - |
| `authorizer.database_cert` | SSL Certificate (base64 encoded) for cassandradb and scylladb | - |
| `authorizer.database_cert_key` | SSL Certificate Key (base64 encoded) for cassandradb and scylladb | - |
| `authorizer.database_ca_cert` | CA Signed Certificate (base64 encoded) for cassandradb and scylladb | - |
| `authorizer.aws_region` | AWS Region for DynamoDB | - |
| `authorizer.aws_access_key_id` | AWS access key identifier for DynamoDB | - |
| `authorizer.aws_secret_access_key` | AWS secret access key for DynamoDB | - |

### Redis / Session Store

| Name | Description | Default |
| ---- | ----------- | ------- |
| `authorizer.redis_url` | Redis connection string for session storage | - |
| `redis.install` | Install Redis (`true`/`false`) | - |
| `redis.storageClassName` | Storage class name for Redis PVC | - |
| `redis.storage` | Size of Redis PVC | `5Gi` |

### HTTP, metrics, and rate limiting

| Name | Description | Default |
| ---- | ----------- | ------- |
| `authorizer.http_port` | Main HTTP listen port (`--http-port`); must differ from `metrics_port` | `8080` |
| `authorizer.metrics_port` | Dedicated `/metrics` listener port (`--metrics-port`) | `8081` |
| `authorizer.metrics_host` | Bind address for `/metrics` (`--metrics-host`); `0.0.0.0` for in-cluster [Prometheus](https://prometheus.io) | `0.0.0.0` |
| `authorizer.rate_limit_rps` | Per-IP sustained RPS (`--rate-limit-rps`); `0` disables | `30` |
| `authorizer.rate_limit_burst` | Per-IP burst size (`--rate-limit-burst`) | `20` |
| `authorizer.rate_limit_fail_closed` | On Redis/rate-limit errors, return 503 (`--rate-limit-fail-closed`) | `false` |

### Redirect URIs and origins

| Name | Description | Default |
| ---- | ----------- | ------- |
| `authorizer.allowed_origins` | Comma-separated origins allowed to call this server (`--allowed-origins`) | `*` |
| `authorizer.redirect_uris` | Comma-separated list of **exact** redirect URIs for this deployment's own client (`--redirect-uris`, new in 2.4.0). When unset, `redirect_uri` falls back to matching `allowed_origins`, which compares *origins* — any path under an allowed host is accepted. See [server config](../core/server-config) | - |

:::warning `redirect_uris` applies to every flow carrying this `client_id`
It is not a per-app setting. List every callback your apps use, including
local development ones, or those logins are refused with
`invalid redirect_uri`.
:::

### Couchbase

| Name | Description | Default |
| ---- | ----------- | ------- |
| `authorizer.couchbase_bucket` | Couchbase bucket for authorizer collections | `authorizer` |
| `authorizer.couchbase_bucket_ram_quota` | Couchbase bucket RAM quota in MB | `1000` |
| `authorizer.couchbase_scope` | Couchbase scope for authorizer collections | `_default` |

---

## Upgrading

To upgrade to a newer version of the Helm chart:

```bash
helm repo update
helm upgrade authorizer authorizer/authorizer --namespace authorizer
```

---

## How the chart configures the container

Chart `2.x` passes every `authorizer.*` value to the container as a
`--kebab-case` CLI flag, matching the v2 CLI-only configuration model. There
is no `.env` file to mount and no `_update_env` dashboard call.

- Secrets (`client_secret`, `jwt_secret`, `admin_secret`, database credentials,
  every social-provider secret) are written to Kubernetes `Secret` resources
  and injected as environment variables, which the container's entrypoint
  expands into the flags. They never appear in the pod spec's `args`.
- Non-secret values are rendered into the args directly.
- A value left `null` is omitted, so the server's own default applies.

Run `helm show values authorizer/authorizer` for the full list — each key is
documented in place, and maps to the flag of the same name in
[Server configuration](../core/server-config).
