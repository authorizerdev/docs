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
- [OAuth2 and OpenID Connect](./core/oauth2-oidc) compatible APIs
- APIs to update profile securely
- Forgot password flow using email
- Social logins (Google, GitHub, Facebook, LinkedIn, Apple, Discord, Twitter, Twitch, Roblox, Microsoft)
- Role-based access management and [fine-grained authorization (FGA)](./core/authorization) via an embedded [OpenFGA](https://openfga.dev) ([Zanzibar](https://research.google/pubs/pub48190/) ReBAC) engine
- Password-less login with magic link
- [WebAuthn](https://www.w3.org/TR/webauthn-2/) / [passkey](https://fidoalliance.org/passkeys/) registration and login
- Multi-factor authentication: [TOTP](https://datatracker.ietf.org/doc/html/rfc6238), email OTP, SMS OTP, and passkey as a second factor
- SMS OTP via [Twilio](https://www.twilio.com)
- Enterprise SSO — [SAML 2.0](https://www.oasis-open.org/standard/saml/) as Service Provider and Identity Provider, OIDC federation, verified email domains, and home realm discovery ([SSO guide](./core/sso-guide))
- [SCIM 2.0](https://datatracker.ietf.org/doc/html/rfc7644) user and group provisioning ([SCIM](./enterprise/scim))
- [Organizations and multi-tenancy](./enterprise/organizations) with org-scoped admin roles
- Machine-to-machine auth (`client_credentials`) and secretless workload identity — [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) client assertions, [SPIFFE](https://spiffe.io) JWT-SVIDs, Kubernetes [TokenReview](https://kubernetes.io/docs/reference/kubernetes-api/authentication-resources/token-review-v1/) ([Workload Identity](./enterprise/workload-identity))
- Agent delegation via [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) token exchange ([Token Exchange](./enterprise/token-exchange))
- Email templating and webhooks
- Rate limiting, security hardening, and [Prometheus](https://prometheus.io) metrics ([Metrics & Monitoring](./core/metrics-monitoring))
- [GraphQL](./core/graphql-api), [REST](./core/rest-api), and [gRPC](./core/grpc) APIs
- [MCP server](./core/mcp) for AI agents

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
./authorizer \
  --database-type=sqlite \
  --database-url=test.db \
  --url=http://localhost:8080 \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --encryption-key=test-encryption-key \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

Or with Docker:

```bash
docker run -p 8080:8080 quay.io/authorizer/authorizer:latest \
  --database-type=sqlite \
  --database-url=test.db \
  --url=http://localhost:8080 \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --encryption-key=test-encryption-key \
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

- PostgreSQL, MySQL, MariaDB, SQLite, libSQL / Turso, SQL Server
- MongoDB, ArangoDB, Couchbase
- CassandraDB, ScyllaDB, DynamoDB
- Yugabyte, PlanetScale, CockroachDB

See [Databases](./core/databases) for connection string formats.

---

## Supported SDKs

### Frontend SDKs

- [JavaScript / TypeScript](https://github.com/authorizerdev/authorizer-js) — v3.3.0; user + admin client; GraphQL + REST protocols
- [React](https://github.com/authorizerdev/authorizer-react) — v2.x; `protocol` prop; pre-built login/signup/MFA components
- [Vue](https://github.com/authorizerdev/authorizer-vue) — beta; no admin client or protocol selection yet
- [Svelte](https://github.com/authorizerdev/authorizer-svelte) — beta; no admin client or protocol selection yet
- [Flutter](https://github.com/authorizerdev/authorizer-flutter-sdk) — not released yet; no package on pub.dev

### Backend SDKs

- [Go](https://github.com/authorizerdev/authorizer-go) — user + admin client; protocol selection (gRPC / REST / GraphQL); FGA helpers
- [Python](https://github.com/authorizerdev/authorizer-py) — v0.3.0 pre-release; sync + async; admin API (`pip install --pre authorizer-py`)
- [Node.js](https://github.com/authorizerdev/authorizer-js) — same package as the frontend SDK, works server-side

See the [SDK reference](./sdks/authorizer-js) for usage docs.

---

## Roadmap

- React Native SDK
- Android Native SDK
- iOS Native SDK
- PHP SDK
- WordPress plugin
- AMI / Digital Ocean Droplet
- Azure deployment
- Vue / Svelte admin client and protocol parity with authorizer-js
