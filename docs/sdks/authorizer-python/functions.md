---
sidebar_position: 2
title: Functions
---

# Functions

Every method below exists on **both** `AuthorizerClient` (sync) and
`AsyncAuthorizerClient` (async). On the async client the calls are coroutines — `await`
them. Request objects are dataclasses imported from `authorizer`; responses are dataclasses
too.

```python
from authorizer import (
    AuthorizerClient, AsyncAuthorizerClient,
    LoginRequest, SignUpRequest, MagicLinkLoginRequest,
    VerifyOTPRequest, VerifyEmailRequest, ResendOTPRequest,
    ResendVerifyEmailRequest, ForgotPasswordRequest, ResetPasswordRequest,
    ValidateJWTTokenRequest, ValidateSessionRequest, SessionQueryRequest,
    UpdateProfileRequest, GetTokenRequest, RevokeTokenRequest,
    CheckPermissionsRequest, ListPermissionsRequest, PermissionCheckInput, FgaTupleInput,
    TokenType,
)
```

## Authentication & user management

| Method                | Signature                                                       | Returns                     |
| --------------------- | --------------------------------------------------------------- | --------------------------- |
| `login`               | `login(req: LoginRequest)`                                      | `AuthToken`                 |
| `signup`              | `signup(req: SignUpRequest)`                                    | `AuthToken`                 |
| `magic_link_login`    | `magic_link_login(req: MagicLinkLoginRequest)`                  | `GenericResponse`           |
| `verify_otp`          | `verify_otp(req: VerifyOTPRequest)`                             | `AuthToken`                 |
| `verify_email`        | `verify_email(req: VerifyEmailRequest)`                         | `AuthToken`                 |
| `resend_otp`          | `resend_otp(req: ResendOTPRequest)`                             | `GenericResponse`           |
| `resend_verify_email` | `resend_verify_email(req: ResendVerifyEmailRequest)`            | `GenericResponse`           |
| `forgot_password`     | `forgot_password(req: ForgotPasswordRequest)`                  | `ForgotPasswordResponse`    |
| `reset_password`      | `reset_password(req: ResetPasswordRequest)`                    | `GenericResponse`           |
| `validate_jwt_token`  | `validate_jwt_token(req: ValidateJWTTokenRequest)`             | `ValidateJWTTokenResponse`  |
| `validate_session`    | `validate_session(req: ValidateSessionRequest)`               | `ValidateSessionResponse`   |
| `get_meta_data`       | `get_meta_data()`                                               | `MetaData`                  |

### Authenticated (pass a bearer token via `headers`)

| Method                | Signature                                                                       | Returns           |
| --------------------- | ------------------------------------------------------------------------------- | ----------------- |
| `get_session`         | `get_session(req=None, headers=None)`                                           | `AuthToken`       |
| `get_profile`         | `get_profile(headers=None)`                                                     | `User`            |
| `update_profile`      | `update_profile(req: UpdateProfileRequest, headers=None)`                       | `GenericResponse` |
| `logout`              | `logout(headers=None)`                                                          | `GenericResponse` |
| `deactivate_account`  | `deactivate_account(headers=None)`                                              | `GenericResponse` |

### Fine-grained authorization

| Method               | Signature                                                                   | Returns                     |
| -------------------- | --------------------------------------------------------------------------- | --------------------------- |
| `check_permissions`  | `check_permissions(req: CheckPermissionsRequest, headers=None)`             | `CheckPermissionsResponse`  |
| `list_permissions`   | `list_permissions(req: ListPermissionsRequest, headers=None)`               | `ListPermissionsResponse`   |

See the dedicated [Fine-Grained Authorization](./fga) page for usage.

### OAuth (REST)

| Method         | Signature                                  | Returns            |
| -------------- | ------------------------------------------ | ------------------ |
| `get_token`    | `get_token(req: GetTokenRequest)`          | `GetTokenResponse` |
| `revoke_token` | `revoke_token(req: RevokeTokenRequest)`    | `GenericResponse`  |

### Escape hatch — raw GraphQL

For any operation not covered by a typed helper:

```python
data = client.graphql_query(
    query="query { meta { version } }",
    variables=None,
    headers=None,
)
```

`graphql_query(query: str, variables=None, headers=None) -> dict` returns the parsed
`data` object.

## Examples

### Sign up

```python
from authorizer import AuthorizerClient, SignUpRequest

client = AuthorizerClient("YOUR_CLIENT_ID", "https://your-instance.authorizer.dev")

token = client.signup(SignUpRequest(
    email="user@example.com",
    password="Abc@123",
    confirm_password="Abc@123",
    given_name="Ada",
    family_name="Lovelace",
))
print(token.message, token.access_token)
```

### Log in and read the profile

```python
from authorizer import AuthorizerClient, LoginRequest

client = AuthorizerClient("YOUR_CLIENT_ID", "https://your-instance.authorizer.dev")

token = client.login(LoginRequest(email="user@example.com", password="Abc@123"))
auth = {"Authorization": f"Bearer {token.access_token}"}

user = client.get_profile(headers=auth)
print(user.id, user.email, user.roles)
```

### Validate a JWT

```python
from authorizer import AuthorizerClient, ValidateJWTTokenRequest, TokenType

client = AuthorizerClient("YOUR_CLIENT_ID", "https://your-instance.authorizer.dev")

res = client.validate_jwt_token(ValidateJWTTokenRequest(
    token=access_token,
    token_type=TokenType.ACCESS_TOKEN,
))
print(res.is_valid, res.claims)
```

### Magic-link login

```python
from authorizer import AuthorizerClient, MagicLinkLoginRequest

client = AuthorizerClient("YOUR_CLIENT_ID", "https://your-instance.authorizer.dev")
res = client.magic_link_login(MagicLinkLoginRequest(email="user@example.com"))
print(res.message)  # "Please check your inbox!..."
```

## Request types

All request dataclasses serialize via `to_dict()`. Fields shown `| None` are optional.

| Type                       | Key fields                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `LoginRequest`             | `password*`, `email`, `phone_number`, `roles`, `scope`, `state`                                                           |
| `SignUpRequest`            | `password*`, `confirm_password*`, `email`, `given_name`, `family_name`, `phone_number`, `roles`, `scope`, `redirect_uri`, `is_multi_factor_auth_enabled`, `app_data`, … |
| `MagicLinkLoginRequest`    | `email*`, `roles`, `scope`, `state`, `redirect_uri`                                                                       |
| `VerifyOTPRequest`         | `otp*`, `email`, `phone_number`, `is_totp`, `state`                                                                       |
| `VerifyEmailRequest`       | `token*`, `state`                                                                                                         |
| `ResendOTPRequest`         | `email`, `phone_number`, `state`                                                                                          |
| `ResendVerifyEmailRequest` | `email*`, `identifier`                                                                                                    |
| `ForgotPasswordRequest`    | `email`, `phone_number`, `state`, `redirect_uri`                                                                          |
| `ResetPasswordRequest`     | `password*`, `confirm_password*`, `token`, `otp`, `phone_number`                                                          |
| `ValidateJWTTokenRequest`  | `token*`, `token_type*` (`TokenType`), `roles`                                                                            |
| `ValidateSessionRequest`   | `cookie`, `roles`                                                                                                         |
| `SessionQueryRequest`      | `roles`, `scope`                                                                                                          |
| `UpdateProfileRequest`     | `email`, `old_password`, `new_password`, `confirm_new_password`, `given_name`, `family_name`, `roles`, `app_data`, …      |
| `GetTokenRequest`          | `code`, `grant_type`, `refresh_token`, `code_verifier`                                                                    |
| `RevokeTokenRequest`       | `refresh_token*`                                                                                                          |
| `CheckPermissionsRequest`  | `checks*` (`list[PermissionCheckInput]`), `user`                                                                          |
| `ListPermissionsRequest`   | `relation`, `object_type`, `user`                                                                                         |
| `PermissionCheckInput`     | `relation*`, `object*`, `contextual_tuples` (`list[FgaTupleInput]`)                                                       |
| `FgaTupleInput`            | `user*`, `relation*`, `object*`                                                                                           |

`* = required`

## Response types

All response dataclasses are built via `from_dict()`.

| Type                       | Key fields                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `AuthToken`                | `message`, `access_token`, `expires_in`, `id_token`, `refresh_token`, `should_show_*_screen`, `authenticator_*`, `user` |
| `User`                     | `id`, `email`, `email_verified`, `given_name`, `family_name`, `phone_number`, `roles`, `created_at`, `app_data`, …      |
| `GenericResponse`          | `message`                                                                                                               |
| `ForgotPasswordResponse`   | `message`, `should_show_mobile_otp_screen`                                                                              |
| `ValidateJWTTokenResponse` | `is_valid`, `claims`                                                                                                    |
| `ValidateSessionResponse`  | `is_valid`, `user`                                                                                                      |
| `MetaData`                 | `version`, `client_id`, and `is_*_enabled` feature flags (login providers, MFA, sign-up, etc.)                          |
| `GetTokenResponse`         | `access_token`, `expires_in`, `id_token`, `refresh_token`                                                               |
| `CheckPermissionsResponse` | `results` (`list[PermissionCheckResult]`)                                                                               |
| `PermissionCheckResult`    | `relation`, `object`, `allowed`                                                                                         |
| `ListPermissionsResponse`  | `objects`, `permissions` (`list[Permission]`), `truncated`                                                              |
| `Permission`               | `object`, `relation`                                                                                                    |

## Enums

| Enum             | Values                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `TokenType`      | `ACCESS_TOKEN`, `ID_TOKEN`, `REFRESH_TOKEN`                                                            |
| `ResponseTypes`  | `CODE`, `TOKEN`                                                                                        |
| `OAuthProviders` | `APPLE`, `GITHUB`, `GOOGLE`, `FACEBOOK`, `LINKEDIN`, `TWITTER`, `MICROSOFT`, `TWITCH`, `ROBLOX`, `DISCORD` |

## Error handling

The SDK raises two exception types:

| Exception                    | When                                                              |
| ---------------------------- | ---------------------------------------------------------------- |
| `AuthorizerError`            | The API returned an error. Has `message`, `errors`, `status`.    |
| `AuthorizerConnectionError`  | A network/transport failure (subclass of `AuthorizerError`).     |

```python
from authorizer import AuthorizerClient, LoginRequest, AuthorizerError

client = AuthorizerClient("YOUR_CLIENT_ID", "https://your-instance.authorizer.dev")
try:
    client.login(LoginRequest(email="user@example.com", password="wrong"))
except AuthorizerError as err:
    print(err.status, err.message)
```
