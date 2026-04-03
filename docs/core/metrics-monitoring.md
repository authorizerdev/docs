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

Returns `503` with `{"status":"unhealthy","error":"..."}` when the database is unreachable.

### `/readyz` - Readiness Probe

Checks storage and memory store health. Use with Kubernetes readiness probes.

```bash
curl http://localhost:8080/readyz
# {"status":"ready"}
```

Returns `503` with `{"status":"not ready","error":"..."}` when the system is not ready to serve traffic.

### `/metrics` - Prometheus Metrics

Serves all metrics in Prometheus exposition format.

```bash
curl http://localhost:8080/metrics
```

## Available Metrics

### HTTP Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `authorizer_http_requests_total` | Counter | `method`, `path`, `status` | Total HTTP requests received |
| `authorizer_http_request_duration_seconds` | Histogram | `method`, `path` | HTTP request latency in seconds |

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

GraphQL APIs return HTTP 200 even when the response contains errors. These metrics capture those application-level errors that would otherwise be invisible to HTTP-level monitoring.

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
      - targets: ['authorizer:8080']
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
        replacement: '$1:8080'
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

# 3. View raw metrics
curl http://localhost:8080/metrics

# 4. Generate some auth events via GraphQL
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(params: {email: \"test@example.com\", password: \"wrong\"}) { message } }"}'

# 5. Check metrics again — look for auth and security counters
curl -s http://localhost:8080/metrics | grep authorizer_auth
curl -s http://localhost:8080/metrics | grep authorizer_security
curl -s http://localhost:8080/metrics | grep authorizer_graphql

# 6. Run integration tests
TEST_DBS="sqlite" go test -p 1 -v -run "TestMetrics|TestHealth|TestReady|TestAuthEvent|TestAdminLoginMetrics|TestGraphQLError" ./internal/integration_tests/
```

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--metrics-port` | `8081` | Port for dedicated metrics server (reserved for future use) |

Currently all endpoints (`/healthz`, `/readyz`, `/metrics`) are served on the main HTTP port alongside the application routes.
