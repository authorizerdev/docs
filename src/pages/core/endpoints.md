---
title: Endpoints
layout: ../../layouts/Main.astro
---

Endpoints supported by Authorizer

## `/`

`GET /` - Root endpoint opens GraphQL Playground

## `/app`

`GET /app` - Application with builtin UI that you can easily integrate in your application.

## `/graphql`

`POST /graphql` - GraphQl endpoint for all the [GraphQL queries and mutations](/core/graphql-api)

## `/verify_email`

`GET /verify_email?token=TOKEN` - Endpoint to verify email address

## `/oauth_login/:oauth_provider`

`GET /oauth_login/:oauth_provider` - Endpoint to perform oauth login for various providers like google, github, facebook

This endpoint supports following query parameters

- `redirectURL`: URL where user should be redirected after login
- `role`: Role with which user should login. This is optional and by default it will use the `DEFAULT_ROLE` specified in `env`

Sample URL: `/oauth_login/google?redirectURL=https://myapp.com&role=admin`

## `/oauth_callback/:oauth_provider`

`GET /oauth_callback/:oauth_provider` - Endpoint that is used by oauth providers as callback after success / unsuccessful login
