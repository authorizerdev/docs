# Endpoints

Endpoints supported by Authorizer

## `/`

`GET /` - Root endpoint opens authorize dashboard

## `/.well-known/openid-configuration`

`GET /.well-known/openid-configuration` - Returns OPEN ID configuration for instance

## `/.well-known/jwks.json`

`GET /.well-known/jwks.json` - To get public key config of JWT token. Used to decode and verify JWT. Recommended to use RS256 JWT type

## `/app`

`GET /app` - Application with builtin UI that you can easily integrate in your application.

## `/graphql`

`POST /graphql` - GraphQl endpoint for all the [GraphQL queries and mutations](/core/graphql-api)

## `/verify_email`

`GET /verify_email?token=TOKEN` - Endpoint to verify email address

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

Response is typically a web page with code / token details or redirection to expected url with token as query params

## `/oauth/token`

`POST /oauth/token` - Endpoint used to get the token information when oauth & openid flow is performed.

> Note: Valid browser session is required to get token information in case `grant_type` authorization_code is used

**Request Body Params**

| Key             | Description                                                                                                                  | Required |
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

| Key           | Description                                                                                         | Required |
| ------------- | --------------------------------------------------------------------------------------------------- | -------- |
| `redirectURL` | URL where user should be redirected after login                                                     | true     |
| `state`       | Unique state identifier that is used to make sure request is not interrupted                        | true     |
| `roles`       | Comma separated list of roles to login with. If not present default role(`user`) is used            | false    |
| `scope`       | Space separated list of openID scopes. If not present default scopes `openid email profile` is used | false    |

Sample URL: `/oauth_login/google?redirectURL=https://myapp.com&role=admin`

## `/oauth_callback/:oauth_provider`

`GET /oauth_callback/:oauth_provider` - Endpoint that is used by oauth providers as callback after success / unsuccessful login

## `logout`

`GET logout` - Endpoint to logout user
This endpoint supports following query parameters

**Query String Params**

| Key            | Description                                      | Required |
| -------------- | ------------------------------------------------ | -------- |
| `redirect_uri` | URL where user should be redirected after logout | false    |
