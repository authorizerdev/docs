---
sidebar_position: 4
title: Endpoints
---

# Endpoints

Endpoints supported by Authorizer.

> Looking for the typed API surface? Every operation is also available as a
> [GraphQL API](./graphql-api), a JSON [REST API](./rest-api) under `/v1`, and a native
> [gRPC API](./grpc), and a read-only subset is exposed to AI agents via the
> [MCP Server](./mcp).

## `/`

`GET /` - Root endpoint opens authorize dashboard

## `/.well-known/openid-configuration`

`GET /.well-known/openid-configuration` - Returns OPEN ID configuration for instance

## `/.well-known/jwks.json`

`GET /.well-known/jwks.json` - To get public key config of JWT token. Used to decode and verify JWT. Recommended to use RS256 JWT type

## `/app`

`GET /app` - Application with builtin UI that you can easily integrate in your application.

## `/graphql`

`POST /graphql` - GraphQl endpoint for all the [GraphQL queries and mutations](../core/graphql-api)

## `/healthz`

`GET /healthz` - Liveness probe. Returns `{"status":"ok"}` with HTTP 200 if the database is reachable, or HTTP 503 with `{"status":"unhealthy"}` otherwise.

## `/readyz`

`GET /readyz` - Readiness probe. Returns `{"status":"ready"}` with HTTP 200 if the system is ready, or HTTP 503 with `{"status":"not ready"}` otherwise.

## `/metrics`

`GET /metrics` — Prometheus-compatible metrics. **Always** served on a **separate listener** at **`--metrics-host`:`--metrics-port`** (defaults **`127.0.0.1:8081`**); never on the main HTTP port (`--http-port` must differ). See [Metrics & Monitoring](../core/metrics-monitoring) for details.

## `/verify_email`

`GET /verify_email?token=TOKEN&redirect_uri=URL` - Endpoint to verify email address

This is the endpoint the signup-verification and magic-link emails link to.
It works as follows:

- Checks `token` and `redirect_uri`. `redirect_uri` must pass
  `--allowed-origins`, or match exactly when `--redirect-uris` is set.
- Marks the email as verified.
- Sets the session cookie.
- Responds with `307` to `redirect_uri`, adding `state`, `nonce` and, for
  `/authorize`-started flows opened in the same browser, `code` (redeemable at
  `/oauth/token` with the PKCE verifier since v2.4.9).

Tokens are never put in the redirect URL. Your app reads them with
[`session`](./graphql-api#session) using the cookie. If MFA applies to the
user, the redirect carries `mfa_required=1&mfa_methods=…&mfa_gate=…` instead
and no session cookie is set. See
[How the magic link flow works](./graphql-api#magic-link-flow) for the full
flow.

## `/userinfo`

`GET /userinfo` - Endpoint to get user information. Requires Authorization header with bearer access token

## `/authorize`

`GET /authorize` - Endpoint to perform authentication and authorization.
It allows perform authentication via builtin login page.

- It supports [PKCE flow](https://datatracker.ietf.org/doc/html/rfc7636). This will help user to perform authentication and authorization in safe memory and prevent from CSRF attack. It also enables perform authorization with safety on mobile applications (Tried and tested with [Expo AuthSession](https://github.com/authorizerdev/examples/tree/main/with-react-native-expo))

- It supports [Implicit Flow](https://datatracker.ietf.org/doc/html/rfc6749#section-1.3.2)

This end point has following query parameters

**Query String Params**
| Key              | Description                                                                                                                                                                                                      | Required |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `client_id`      | Your client_id                                                                                                                                                                                                   | true     |
| `redirect_uri`   | URL where user should be redirected after login                                                                                                                                                                  | true     |
| `response_type`  | What type of response you want. It supports `code` & `token` as response types. Default value is `token`                                                                                                         | false    |
| `code_challenge` | SHA-256 challenge used to verify the code that will be sent. Required when `code` flow is used                                                                                                                   | false    |
| `state`          | Unique state identifier that is used to make sure request is not interrupted                                                                                                                                     | true     |
| `scope`          | Space separated list of openID scopes. If not present default scopes `openid email profile` is used                                                                                                              | false    |
| `response_mode`  | Response is required in which format. Supports 2 forms `query` (returns redirect url with response in query string) and `web_message` (returns html page with data embedded in JS). Default its value is `query` | false    |
| `screen_hint`  | Specifies a hint to the authorization server about the desired user interaction screen. When set to `signup` the authorization server will redirect the user to the signup page of the authentication provider | false    |

Response is typically a web page with code / token details or redirection to expected url with token as query params

## `/oauth/token`

`POST /oauth/token` - Endpoint used to get the token information when oauth & openid flow is performed.

> Note: Valid browser session is required to get token information in case `grant_type` authorization_code is used

**Request Body Params**

| Key             | Description                                                                                                  | Required |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| `grant_type`    | Supports `authorization_code` & `refresh_token` grant types. Default is `authorization_code`                                 | false    |
| `code_verifier` | Code verifier to verify against the code_challenge sent in authorize request. Required if `authorization_code` flow is used. | false    |
| `code`          | Code returned form authorize request is sent to make sure it is follow up of same request                                    | false    |
| `refresh_token` | Refresh token used to get the new access token. Required in case of `refresh_token` grant type                               | false    |

**Response**

| Key             | Description                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `access_token`  | accessToken that frontend application can use for further authorized requests                                                                     |
| `expires_in`    | timestamp when the current token is going to expire, so that frontend can request for new access token                                            |
| `id_token`      | JWT token holding the user information                                                                                                            |
| `refresh_token` | When scope includes `offline_access`, Long living token is returned which can be used to get new access tokens. This is rotated with each request |
| `scope`         | List of openID scopes                                                                                                                             |

## `oauth/revoke`

**Request Body Params**

| Key             | Description                 | Required |
| --------------- | --------------------------- | -------- |
| `refresh_token` | Refresh token to be revoked | true     |

**Response**

| Key       | Description     |
| --------- | --------------- |
| `message` | Success message |

## `/oauth_login/:oauth_provider`

`GET /oauth_login/:oauth_provider` - Endpoint to perform oauth login for various providers like google, github, facebook
This endpoint supports following query parameters

**Query String Params**

| Key            | Description                                                                                         | Required |
| -------------- | --------------------------------------------------------------------------------------------------- | -------- |
| `redirect_uri` | URL where user should be redirected after login. See accepted values below                          | true     |
| `redirectURL`  | Deprecated alias of `redirect_uri`, still accepted                                                  | false    |
| `state`        | Unique state identifier that is used to make sure request is not interrupted                        | true     |
| `roles`        | Comma separated list of roles to login with. If not present default role(`user`) is used            | false    |
| `scope`        | Space separated list of openID scopes. If not present default scopes `openid email profile` is used | false    |

Sample URLs:

```
# Outside /authorize: return to your app (its origin is in --allowed-origins)
/oauth_login/google?redirect_uri=https://myapp.com/dashboard&state=abc123&roles=admin

# From the login page during an /authorize request: return to /app, which resumes /authorize
/oauth_login/google?state=st-123&redirect_uri=https%3A%2F%2Fauth.example.com%2Fapp%2F%3Fclient_id%3Dc1%26response_type%3Dcode%26state%3Dst-123%26...
```

More cases, with the result for each, are in [What `/oauth_login` accepts](./oauth2-oidc#social-login-inside-an-authorization-request).

**Accepted `redirect_uri` values:**

- Any URI allowed by `--allowed-origins`.
- This server's own `/app`, `/app/` or `/app/signup` (same scheme and host:port as `--url`, exact path, no fragment), whatever `--allowed-origins` says. _Authorizer 2.4.6 and later._ The login page uses this to resume an `/authorize` request through `/authorize`, which then checks the client's registered redirect URIs. See [Social login inside an authorization request](./oauth2-oidc#social-login-inside-an-authorization-request).

A client's registered redirect URI is **not** accepted here unless its origin is in `--allowed-origins`. To get a code to a registered client, go through `/authorize`.

## `/oauth_callback/:oauth_provider`

`GET /oauth_callback/:oauth_provider` - Endpoint that is used by oauth providers as callback after success / unsuccessful login. Register `<your-authorizer-url>/oauth_callback/<provider>` as the callback URL on the provider's console.

On success it sets the session cookie and redirects to the `redirect_uri` given to `/oauth_login`:

- For this server's own `/app` URL, it redirects to that URL unchanged and issues no authorization code. `/app` resumes the original `/authorize` request.
- For any other URI, it appends `state` and `nonce`, plus `code` when the login belongs to an `/authorize` request. That last case is deprecated: it skips the consent screen and logs a warning.

## `logout`

`GET logout` - Endpoint to logout user
This endpoint supports following query parameters

**Query String Params**

| Key            | Description                                      | Required |
| -------------- | ------------------------------------------------ | -------- |
| `redirect_uri` | URL where user should be redirected after logout | false    |
