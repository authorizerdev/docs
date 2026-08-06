---
sidebar_position: 1
title: Deployment Overview
---

# Deployments

These deployment guides show how to run **Authorizer v2** using the **CLI-only configuration model**.

Key differences from v1:

- No `.env` file loading by the server
- No dashboard-based `_update_env` configuration
- All config is supplied as **CLI flags** when starting the binary or container

## Required Variables

:::info `--encryption-key` (2.4.0+)

Encrypts TOTP shared secrets and OTP digests at rest. **Required when `--jwt-type`
is `RS*`/`ES*`** — with no `--jwt-secret` to fall back to, the server refuses to
start without it. With HMAC types (`HS*`) it falls back to `--jwt-secret`, but a
distinct value is recommended: rotating the JWT secret otherwise re-keys at-rest
data and locks out every enrolled TOTP user.

Generate it **once** (`openssl rand -hex 32`), store it as a secret, and keep it
stable across restarts — a key that changes on every boot leaves existing TOTP
enrolments and pending OTPs undecryptable. Omit the flag on releases before
2.4.0, which do not have it. See [Server Configuration](/core/server-config).

:::

All deployments require these flags with sample values:

```bash
--database-type=sqlite \
--database-url=test.db \
--jwt-type=HS256 \
--jwt-secret=test \
--encryption-key=test-encryption-key \
--admin-secret=admin \
--client-id=123456 \
--client-secret=secret
```

## Deployment Options

| Method | Guide |
| ------ | ----- |
| Docker | [Docker](./docker) |
| Binary / Source | [Binary](./binary) |
| Kubernetes | [Kubernetes](./kubernetes) |
| Helm Chart | [Helm Chart](./helm-chart) |
| Heroku | [Heroku](./heroku) |
| Railway | [Railway](./railway) |
| Render | [Render](./render) |
| Fly.io | [Fly.io](./fly-io) |
| Koyeb | [Koyeb](./koyeb) |
| EasyPanel | [EasyPanel](./easypanel) |
| Alibaba Cloud | [Alibaba Cloud](./alibaba-cloud) |

## Reference

- [Getting Started](../getting-started) -- quick start guide
- [Server Configuration](../core/server-config) -- all CLI flags
- [Migration v1 to v2](../migration/v1-to-v2) -- upgrade guide
