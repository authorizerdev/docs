---
sidebar_position: 6
title: Railway
---

# Deploy on Railway

## Introduction

[Railway](https://railway.app/) is a deployment platform where you can provision infrastructure, develop locally, and deploy to the cloud.

## Requirements

A [Railway account](https://railway.app/).

## Deploy an Authorizer Instance

Deploy a production-ready Authorizer instance with PostgreSQL and Redis:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/nwXp1C?referralCode=FEF4uT)

Before getting started, make sure you have given permission to Railway for further deployments as it will create a repository in your GitHub account.

![Railway deployment](/img/railway.png)

### Configure for v2

After deployment, configure the following required variables in Railway's environment settings:

| Variable | Example Value |
| -------- | ------------- |
| `DATABASE_TYPE` | `postgres` |
| `DATABASE_URL` | *(auto-configured by Railway)* |
| `JWT_TYPE` | `HS256` |
| `JWT_SECRET` | `test` |
| `ADMIN_SECRET` | `admin` |
| `CLIENT_ID` | `123456` |
| `CLIENT_SECRET` | `secret` |

Update the start command to pass CLI flags:

```bash
./build/server \
  --database-type=$DATABASE_TYPE \
  --database-url=$DATABASE_URL \
  --jwt-type=$JWT_TYPE \
  --jwt-secret=$JWT_SECRET \
  --admin-secret=$ADMIN_SECRET \
  --client-id=$CLIENT_ID \
  --client-secret=$CLIENT_SECRET
```

## Update Instance

Update the [Docker image](https://github.com/authorizerdev/authorizer-railway/blob/main/Dockerfile#L1) to the desired version in the repository created with your deployment.

Find all versions on [GitHub](https://github.com/authorizerdev/authorizer/releases) or [Docker Hub](https://hub.docker.com/r/lakhansamani/authorizer).
