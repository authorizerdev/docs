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
    --set authorizer.jwt_type=HS256 \
    --set authorizer.jwt_secret=test \
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
    --set authorizer.jwt_type=HS256 \
    --set authorizer.jwt_secret=your-jwt-secret \
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

## Next Version (v2 Helm Chart)

The next version of the Helm chart will pass all configuration as **CLI flags** to the Authorizer v2 container using the `args` field, aligning with the v2 CLI-only configuration model. This means:

- All `authorizer.*` values will be mapped to `--kebab-case` CLI flags automatically
- No `.env` file mounting or `_update_env` dashboard calls
- Secrets managed via Kubernetes `Secret` resources referenced through `env` and expanded in `args`

Example of how the next version will configure the deployment:

```yaml
containers:
  - name: authorizer
    image: lakhansamani/authorizer:latest
    args:
      - "--database-type=$(DATABASE_TYPE)"
      - "--database-url=$(DATABASE_URL)"
      - "--jwt-type=HS256"
      - "--jwt-secret=$(JWT_SECRET)"
      - "--admin-secret=$(ADMIN_SECRET)"
      - "--client-id=$(CLIENT_ID)"
      - "--client-secret=$(CLIENT_SECRET)"
    env:
      - name: DATABASE_TYPE
        valueFrom:
          secretKeyRef:
            name: authorizer-secrets
            key: database-type
      - name: DATABASE_URL
        valueFrom:
          secretKeyRef:
            name: authorizer-secrets
            key: database-url
```

Until the next Helm chart version is released, you can use the existing chart with the current values or deploy using raw Kubernetes manifests as shown in the [Kubernetes](./kubernetes) guide.
