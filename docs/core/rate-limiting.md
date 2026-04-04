---
sidebar_position: 8
title: Rate Limiting
---

# Rate Limiting

Authorizer includes built-in per-IP rate limiting to protect authentication endpoints from brute-force attacks and abuse. Rate limiting is always enabled by default with sensible defaults, and supports multi-replica deployments via Redis.

## How it works

Every incoming request is tracked by client IP address. Each IP is allowed a sustained request rate (`--rate-limit-rps`) with a burst allowance (`--rate-limit-burst`). When an IP exceeds the limit, Authorizer responds with `429 Too Many Requests` and a `Retry-After` header.

**Single instance:** Rate limits are tracked in memory using a token bucket algorithm. No external dependencies required.

**Multi-replica:** When Redis is configured (`--redis-url`), rate limits are shared across all replicas using an atomic Redis sliding-window counter (Lua script). This ensures consistent enforcement regardless of which replica handles the request.

> **Fail-open behavior:** If Redis becomes temporarily unavailable, the rate limiter allows requests through rather than blocking legitimate users. Auth availability takes priority over rate limiting.

---

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--rate-limit-rps` | `10` | Maximum sustained requests per second per IP |
| `--rate-limit-burst` | `20` | Maximum burst size per IP (allows short spikes above the sustained rate) |

```bash
./build/server \
  --rate-limit-rps=10 \
  --rate-limit-burst=20
```

### Customizing limits

For high-traffic deployments, increase the limits:

```bash
./build/server \
  --rate-limit-rps=50 \
  --rate-limit-burst=100
```

For stricter protection (e.g., a small internal deployment):

```bash
./build/server \
  --rate-limit-rps=5 \
  --rate-limit-burst=10
```

### Disabling rate limiting

If your infrastructure already provides rate limiting (e.g., API gateway, CDN, or load balancer), you can disable it:

```bash
./build/server \
  --rate-limit-rps=0
```

---

## Exempt endpoints

The following endpoints are **not** rate limited because they are infrastructure, static assets, or standards-required discovery endpoints:

| Path | Reason |
|------|--------|
| `/` | Root/info endpoint |
| `/health` | Kubernetes liveness probe |
| `/healthz` | Kubernetes liveness probe |
| `/readyz` | Kubernetes readiness probe |
| `/metrics` | Prometheus scrape endpoint |
| `/playground` | GraphQL playground (dev tool) |
| `/.well-known/openid-configuration` | OIDC discovery (cacheable, spec-required) |
| `/.well-known/jwks.json` | JWKS endpoint (cacheable, spec-required) |
| `/app/*` | Static frontend assets (login UI) |
| `/dashboard/*` | Static frontend assets (admin UI) |

All other endpoints are rate limited, including:

- `/graphql` (all auth mutations: signup, login, reset password, etc.)
- `/oauth/token` (token exchange)
- `/oauth/revoke` (token revocation)
- `/oauth_login/:provider` and `/oauth_callback/:provider` (OAuth flows)
- `/authorize` (OAuth2 authorize)
- `/userinfo` (token-based user info)
- `/verify_email` (email verification)
- `/logout` (session termination)

---

## Rate limit response

When a client exceeds the rate limit, Authorizer returns:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 1
Content-Type: application/json

{
  "error": "rate_limit_exceeded",
  "error_description": "Too many requests. Please try again later."
}
```

The `Retry-After: 1` header tells clients to wait at least 1 second before retrying (per [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585#section-4)).

---

## Multi-replica setup with Redis

For deployments with multiple Authorizer replicas, configure Redis to ensure rate limits are shared:

```bash
./build/server \
  --redis-url=redis://user:pass@redis-host:6379/0 \
  --rate-limit-rps=10 \
  --rate-limit-burst=20
```

When `--redis-url` is set, Authorizer automatically uses Redis for both session storage **and** rate limiting. No additional configuration is needed.

### Redis Cluster

Redis Cluster is also supported. Provide multiple URLs:

```bash
./build/server \
  --redis-url="redis://node1:6379,node2:6380,node3:6381"
```

### Docker Compose example

```yaml
services:
  authorizer:
    image: lakhansamani/authorizer:latest
    command:
      - --database-type=postgres
      - --database-url=postgres://user:pass@db:5432/authorizer
      - --redis-url=redis://redis:6379
      - --rate-limit-rps=10
      - --rate-limit-burst=20
      - --client-id=YOUR_CLIENT_ID
      - --client-secret=YOUR_CLIENT_SECRET
    ports:
      - "8080:8080"
    depends_on:
      - db
      - redis
    deploy:
      replicas: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: authorizer
```

---

## Monitoring rate limits

Rate limit rejections appear in Authorizer's HTTP metrics:

```promql
# Rate of 429 responses (rate-limited requests)
rate(authorizer_http_requests_total{status="429"}[5m])

# Rate-limited requests by path
sum(rate(authorizer_http_requests_total{status="429"}[5m])) by (path)
```

### Alerting example

```yaml
groups:
  - name: authorizer-rate-limit
    rules:
      - alert: HighRateLimitRate
        expr: rate(authorizer_http_requests_total{status="429"}[5m]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High rate of rate-limited requests"
          description: "More than 1 req/sec being rate-limited for 5 minutes. Possible attack or misconfigured client."
```

See [Metrics & Monitoring](./metrics-monitoring) for the full metrics reference.
