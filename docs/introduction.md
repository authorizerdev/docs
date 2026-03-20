---
sidebar_position: 1
slug: /
title: Introduction
description: Authorizer is an open-source authentication and authorization solution for your applications. Self-host with your own database.
---

# Introduction

## What is Authorizer?

**Authorizer** is an open-source authentication and authorization solution for your applications. Bring your database and have complete control over user information. You can self-host Authorizer instances and connect to any supported database.

![Authorizer Architecture](/img/authorizer-arch.png)

### Features

- Sign-in / Sign-up with email ID and password
- Secure session management with HTTP-only cookies
- Email verification
- OAuth2 and OpenID Connect compatible APIs
- APIs to update profile securely
- Forgot password flow using email
- Social logins (Google, GitHub, Facebook, LinkedIn, Apple, Discord, Twitter, Twitch, Roblox, Microsoft)
- Role-based access management
- Password-less login with magic link
- TOTP-based multi-factor authentication
- SMS OTP via Twilio
- GraphQL API

### Introduction Video

Watch the introduction video on YouTube: [Introduction to Authorizer](https://www.youtube.com/watch?v=DFgo0TuA4c8)

---

## Authorizer v2

Authorizer v2 focuses on simpler, more secure configuration and a cleaner operational model:

- **Configuration via CLI flags only** -- no persisted env in the database or cache
- **More secure secret handling** -- secrets are passed at process start, not stored in Authorizer-managed storage
- **Stronger defaults and hardening flags** -- better control over GraphQL introspection, admin access, and cookies
- **Updated SDKs** -- `@authorizerdev/authorizer-js` v3 and `@authorizerdev/authorizer-react` v2

### Quick Start

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

Or with Docker:

```bash
docker run -p 8080:8080 lakhansamani/authorizer:latest \
  --database-type=sqlite \
  --database-url=test.db \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

### Where to start

- **New projects:** Start with the [Getting Started](./getting-started) guide
- **Migrating from v1:** See [Migration v1 to v2](./migration/v1-to-v2) for a complete guide
- **Deployment:** Choose from [Docker](./deployment/docker), [Kubernetes](./deployment/kubernetes), [Helm Chart](./deployment/helm-chart), or [one-click deploys](./deployment)
- **SDK integration:** See [authorizer-js](./sdks/authorizer-js), [authorizer-react](./sdks/authorizer-react), or [authorizer-go](./sdks/authorizer-go)

---

## Supported Databases

Authorizer supports a wide range of databases:

- PostgreSQL, MySQL, MariaDB, SQLite, SQL Server
- MongoDB, ArangoDB, CouchDB
- CassandraDB, ScyllaDB, DynamoDB, Couchbase
- Yugabyte, PlanetScale, CockroachDB

See [Databases](./core/databases) for connection string formats.

---

## Supported SDKs

### Frontend SDKs

- [JavaScript / TypeScript](https://github.com/authorizerdev/authorizer-js) (v3 for Authorizer v2)
- [React](https://github.com/authorizerdev/authorizer-react) (v2 for Authorizer v2)
- [Vue](https://github.com/authorizerdev/authorizer-vue)
- [Svelte](https://github.com/authorizerdev/authorizer-svelte)
- [Flutter](https://github.com/nickolasgomez/authorizer-flutter-sdk)

### Backend SDKs

- [Golang](https://github.com/authorizerdev/authorizer-go)
- [Node.js](https://github.com/authorizerdev/authorizer-js) (same package, works server-side)

---

## Roadmap

- 2-Factor authentication (TOTP, SMS OTP)
- React Native SDK
- Android Native SDK
- iOS Native SDK
- Python SDK
- PHP SDK
- WordPress plugin
- AMI / Digital Ocean Droplet
- Azure deployment
- Password-less login with mobile number and OTP SMS
