---
sidebar_position: 1
title: Getting Started
description: "Status of the Authorizer Flutter SDK. It is not released yet; until it ships, call Authorizer's REST and GraphQL APIs directly from Dart."
---

# Getting Started

The Authorizer Flutter SDK has not been released yet. The
[repository](https://github.com/authorizerdev/authorizer-flutter-sdk) is a placeholder — it
contains no source code, and there is no package on pub.dev.

Until it ships, call the server directly from Dart: every SDK operation is available over
the [REST endpoints](/core/endpoints) and the [GraphQL API](/core/graphql-api), which work
with any HTTP client (`package:http`, Dio, and so on). For browser-based OAuth flows, see
[OAuth 2.0 / OIDC](/core/oauth2-oidc).
