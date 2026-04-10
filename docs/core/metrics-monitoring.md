---
sidebar_position: 7
title: Metrics & Monitoring
---

# Metrics & Monitoring

Authorizer exposes Prometheus-compatible metrics for monitoring authentication activity, API performance, security events, and infrastructure health.

## Endpoints

### `/healthz` - Liveness Probe

Returns storage health status. Use with Kubernetes liveness probes.

```bash
curl http://localhost:8080/healthz
# {"status":"ok"}
```

Returns `503` with `{"status":"unhealthy","error":"storage unavailable"}` when the database is unreachable (details are logged server-side only).

### `/readyz` - Readiness Probe

Checks storage and memory store health. Use with Kubernetes readiness probes.

```bash
curl http://localhost:8080/readyz
# {"status":"ready"}
```

Returns `503` with `{"status":"not ready","error":"storage unavailable"}` when the system is not ready to serve traffic (details are logged server-side only).

### `/metrics` - Prometheus Metrics

Serves all metrics in Prometheus exposition format.

**`/metrics` is never on the main HTTP server.** It is always served by a **separate minimal HTTP server** that runs in parallel with the main Gin app (same pattern as running distinct app and metrics listeners). By default `--http-port` is `8080` and `--metrics-port` is `8081`; **`--http-port` and `--metrics-port` must differ** or the process exits at startup.

The metrics listener is **not** reachable from other machines by default: **`--metrics-host` defaults to `127.0.0.1`**, so only loopback can scrape unless you change it (see below).

```bash
curl http://127.0.0.1:8081/metrics
```

#### Bind address and security

- **Single host / node-exporter style:** Keep defaults (`127.0.0.1` + `--metrics-port`). Run Prometheus (or an agent) **on the same host** and scrape `127.0.0.1:8081`, or use a reverse proxy that forwards from an internal network to that socket.
- **Docker / Kubernetes / another machine scrapes the pod:** Set **`--metrics-host=0.0.0.0`** (or the pod IP interface you use) so the metrics port accepts connections on the container network. **Do not** put the metrics port on a public ingress or internet-facing load balancer; use a **ClusterIP** Service (or internal Docker network) and scrape from inside the cluster only.

For **Docker `EXPOSE` vs `-p` / Compose `ports:`** and Kubernetes **pod vs Service** exposure, see [Docker deployment](../deployment/docker#docker-ports-exposure) and [Kubernetes deployment](../deployment/kubernetes#k8s-ports-services).

## Available Metrics

### HTTP Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `authorizer_http_requests_total` | Counter | `method`, `path`, `status` | Total HTTP requests received |
| `authorizer_http_request_duration_seconds` | Histogram | `method`, `path` | HTTP request latency in seconds |

For routes that do not match a registered Gin pattern, `path` is recorded as `unmatched` (not the raw URL), to keep Prometheus cardinality bounded.

### Authentication Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `authorizer_auth_events_total` | Counter | `event`, `status` | Authentication event count |
| `authorizer_active_sessions` | Gauge | — | Approximate active session count |

**Auth event values:**

| Event | Description |
|-------|-------------|
| `login` | User email/password login |
| `signup` | New user registration |
| `logout` | User session termination |
| `forgot_password` | Password reset request |
| `reset_password` | Password reset completion |
| `verify_email` | Email verification |
| `verify_otp` | OTP verification |
| `magic_link_login` | Magic link authentication |
| `admin_login` | Admin dashboard login |
| `admin_logout` | Admin dashboard logout |
| `oauth_login` | OAuth provider redirect |
| `oauth_callback` | OAuth provider callback |
| `token_refresh` | Token refresh |
| `token_revoke` | Token revocation |

**Status values:** `success`, `failure`

### Security Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `authorizer_security_events_total` | Counter | `event`, `reason` | Security-sensitive events for alerting |
| `authorizer_client_id_header_missing_total` | Counter | — | Requests with no `X-Authorizer-Client-ID` header (allowed for some routes) |

**Security event examples:**

| Event | Reason | Trigger |
|-------|--------|---------|
| `invalid_credentials` | `bad_password` | Failed password comparison |
| `invalid_credentials` | `user_not_found` | Login with non-existent email |
| `account_revoked` | `login_attempt` | Login to a revoked account |
| `invalid_admin_secret` | `admin_login` | Failed admin authentication |

### GraphQL Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `authorizer_graphql_errors_total` | Counter | `operation` | GraphQL responses containing errors (HTTP 200 with errors) |
| `authorizer_graphql_request_duration_seconds` | Histogram | `operation` | GraphQL operation latency |
| `authorizer_graphql_limit_rejections_total` | Counter | `limit` | Operations rejected for exceeding a configured query limit |

The `operation` label is **`anonymous`** for unnamed operations, or **`op_` + a short SHA-256 prefix** of the operation name so client-controlled names cannot create unbounded time series.

GraphQL APIs return HTTP 200 even when the response contains errors. These metrics capture those application-level errors that would otherwise be invisible to HTTP-level monitoring.

The `limit` label on `authorizer_graphql_limit_rejections_total` is one of:

| Value | What was exceeded | Tunable via |
|---|---|---|
| `depth` | Selection-set nesting depth | `--graphql-max-depth` |
| `complexity` | Total complexity score | `--graphql-max-complexity` |
| `alias` | Total aliased fields per operation | `--graphql-max-aliases` |
| `body_size` | HTTP request body size | `--graphql-max-body-bytes` |

A sustained non-zero rate on any label usually means either an
exploration attempt or a legitimate operation that needs the limit
raised. Alert at the rate that distinguishes the two for your traffic
profile. See [GraphQL hardening](./security#graphql-hardening) for the
limits themselves.

### Infrastructure Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `authorizer_db_health_check_total` | Counter | `status` | Database health check outcomes (`healthy`/`unhealthy`) |

## Prometheus Configuration

Add Authorizer as a scrape target in your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'authorizer'
    scrape_interval: 15s
    static_configs:
      # In Docker/K8s, use --metrics-host=0.0.0.0 so the scraper can reach the pod/container; scrape via internal DNS/service.
      - targets: ['authorizer:8081']  # default --metrics-port; same host only: use 127.0.0.1:8081
```

For Kubernetes with service discovery:

```yaml
scrape_configs:
  - job_name: 'authorizer'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: authorizer
        action: keep
      - source_labels: [__meta_kubernetes_pod_ip]
        target_label: __address__
        replacement: '$1:8081'  # metrics port; ensure deployment sets --metrics-host=0.0.0.0 for in-cluster scrape
```

## Grafana Dashboard

### Suggested Panels

**Authentication Overview:**
```promql
# Login success rate (last 5 minutes)
rate(authorizer_auth_events_total{event="login",status="success"}[5m])
/ rate(authorizer_auth_events_total{event="login"}[5m])

# Signup rate
rate(authorizer_auth_events_total{event="signup",status="success"}[5m])

# Active sessions
authorizer_active_sessions
```

**Security Alerts:**
```promql
# Failed login rate (alert if > 10/min)
rate(authorizer_security_events_total{event="invalid_credentials"}[1m]) > 10

# Failed admin login attempts
increase(authorizer_security_events_total{event="invalid_admin_secret"}[5m])

# Revoked account login attempts
increase(authorizer_security_events_total{event="account_revoked"}[5m])
```

**API Performance:**
```promql
# GraphQL p99 latency
histogram_quantile(0.99, rate(authorizer_graphql_request_duration_seconds_bucket[5m]))

# HTTP p95 latency by path
histogram_quantile(0.95, sum(rate(authorizer_http_request_duration_seconds_bucket[5m])) by (le, path))

# GraphQL error rate
rate(authorizer_graphql_errors_total[5m])
```

**Infrastructure:**
```promql
# Database health check failure rate
rate(authorizer_db_health_check_total{status="unhealthy"}[5m])

# Request rate by endpoint
sum(rate(authorizer_http_requests_total[5m])) by (path)
```

## Alerting Rules

Example Prometheus alerting rules:

```yaml
groups:
  - name: authorizer
    rules:
      - alert: HighLoginFailureRate
        expr: rate(authorizer_security_events_total{event="invalid_credentials"}[5m]) > 0.5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High login failure rate detected"
          description: "More than 0.5 failed logins/sec for 2 minutes — possible brute force."

      - alert: DatabaseUnhealthy
        expr: authorizer_db_health_check_total{status="unhealthy"} > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Authorizer database health check failing"

      - alert: HighGraphQLErrorRate
        expr: rate(authorizer_graphql_errors_total[5m]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Elevated GraphQL error rate"
```

## Manual Testing

Start Authorizer and verify metrics are working:

```bash
# 1. Start Authorizer (dev mode with SQLite)
make dev

# 2. Check health endpoints
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz

# 3. View raw metrics (default: loopback + metrics port)
curl http://127.0.0.1:8081/metrics

# 4. Generate some auth events via GraphQL
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(params: {email: \"test@example.com\", password: \"wrong\"}) { message } }"}'

# 5. Check metrics again — look for auth and security counters
curl -s http://127.0.0.1:8081/metrics | grep authorizer_auth
curl -s http://127.0.0.1:8081/metrics | grep authorizer_security
curl -s http://127.0.0.1:8081/metrics | grep authorizer_graphql

# 6. Run integration tests
TEST_DBS="sqlite" go test -p 1 -v -run "TestMetrics|TestHealth|TestReady|TestAuthEvent|TestAdminLoginMetrics|TestGraphQLError" ./internal/integration_tests/
```

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--metrics-port` | `8081` | Port for the dedicated Prometheus `/metrics` listener (**must differ** from `--http-port`) |
| `--metrics-host` | `127.0.0.1` | Bind address for that dedicated listener only (use `0.0.0.0` for in-cluster or cross-container scrape; never expose on the public internet without a proxy and auth) |

`/healthz`, `/readyz`, and `/health` stay on the **main HTTP** port (`--host`:`--http-port`). `/metrics` is **only** on the dedicated listener (`--metrics-host`:`--metrics-port`).
