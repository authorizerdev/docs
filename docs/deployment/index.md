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

All deployments require these flags with sample values:

```bash
--database-type=sqlite \
--database-url=test.db \
--jwt-type=HS256 \
--jwt-secret=test \
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
