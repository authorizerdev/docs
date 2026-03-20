---
sidebar_position: 10
title: EasyPanel
---

# Deploy on EasyPanel

## Introduction

[EasyPanel](https://easypanel.io) is a modern server control panel that helps you deploy applications on your own server.

## Deploy an Authorizer Instance

EasyPanel provides a template for deploying Authorizer. Deploy using the template:

1. Login to your EasyPanel dashboard
2. Search for the **Authorizer** template
3. Click **Deploy**

## Configure for v2

After deployment, update the start command to include the required v2 CLI flags:

```bash
./build/server \
  --database-type=sqlite \
  --database-url=test.db \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

| Variable | Example Value |
| -------- | ------------- |
| `--database-type` | `sqlite` |
| `--database-url` | `test.db` |
| `--jwt-type` | `HS256` |
| `--jwt-secret` | `test` |
| `--admin-secret` | `admin` |
| `--client-id` | `123456` |
| `--client-secret` | `secret` |

## Update Instance

Update the Docker image version in your EasyPanel configuration to the desired version from [GitHub Releases](https://github.com/authorizerdev/authorizer/releases) or [Docker Hub](https://hub.docker.com/r/lakhansamani/authorizer).
