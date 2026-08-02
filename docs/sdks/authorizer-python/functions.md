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
    SkipMfaSetupRequest, LockMfaRequest, OtpMfaSetupRequest,
    WebauthnRegistrationOptionsRequest, WebauthnRegistrationVerifyRequest,
    WebauthnLoginOptionsRequest, WebauthnLoginVerifyRequest, WebauthnDeleteCredentialRequest,
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

### MFA setup & recovery

All take a bearer token via `headers` (or, if the caller doesn't have one yet, an
`email`/`phone_number` pair that resolves the in-progress MFA session cookie instead).

| Method                 | Signature                                                              | Returns            |
| ----------------------- | ------------------------------------------------------------------------ | ------------------- |
| `skip_mfa_setup`        | `skip_mfa_setup(req: SkipMfaSetupRequest, headers=None)`                | `AuthToken`         |
| `lock_mfa`               | `lock_mfa(req: LockMfaRequest, headers=None)`                            | `GenericResponse`   |
| `email_otp_mfa_setup`    | `email_otp_mfa_setup(req: OtpMfaSetupRequest=None, headers=None)`       | `GenericResponse`   |
| `sms_otp_mfa_setup`      | `sms_otp_mfa_setup(req: OtpMfaSetupRequest=None, headers=None)`         | `GenericResponse`   |
| `totp_mfa_setup`         | `totp_mfa_setup(req: OtpMfaSetupRequest=None, headers=None)`            | `AuthToken`         |

> `lock_mfa` has no OTP fallback — it locks the account and requires admin recovery
> (see [admin `update_user`](./admin)) afterward.

### WebAuthn / passkeys

| Method                          | Signature                                                                        | Returns                               |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------- |
| `webauthn_registration_options`    | `webauthn_registration_options(req: WebauthnRegistrationOptionsRequest=None, headers=None)` | `WebauthnRegistrationOptionsResponse`    |
| `webauthn_registration_verify`     | `webauthn_registration_verify(req: WebauthnRegistrationVerifyRequest, headers=None)`        | `AuthToken`                              |
| `webauthn_login_options`           | `webauthn_login_options(req: WebauthnLoginOptionsRequest=None, headers=None)`               | `WebauthnLoginOptionsResponse`           |
| `webauthn_login_verify`            | `webauthn_login_verify(req: WebauthnLoginVerifyRequest, headers=None)`                      | `AuthToken`                              |
| `webauthn_delete_credential`       | `webauthn_delete_credential(req: WebauthnDeleteCredentialRequest, headers=None)`            | `GenericResponse`                        |
| `webauthn_credentials`             | `webauthn_credentials(headers=None)`                                                        | `list[WebauthnCredentialInfo]`           |

`webauthn_registration_options`/`webauthn_login_options` return a JSON-encoded
`options` string to feed straight to the browser's `navigator.credentials.create()` /
`.get()`; `webauthn_registration_verify`/`webauthn_login_verify` take the JSON-encoded
credential response back. `webauthn_delete_credential` permanently deletes the
registered passkey. `webauthn_credentials` lists the authenticated caller's own
registered passkeys.

### OAuth (REST)

| Method         | Signature                                  | Returns            |
| -------------- | ------------------------------------------ | ------------------ |
| `get_token`    | `get_token(req: GetTokenRequest)`          | `GetTokenResponse` |
| `revoke_token` | `revoke_token(req: RevokeTokenRequest)`    | `GenericResponse`  |

`get_token` posts a form-encoded (`application/x-www-form-urlencoded`) request to
`/oauth/token` and supports four grants: `authorization_code` (default, needs `code` +
`code_verifier`), `refresh_token`, `client_credentials` (RFC 6749 §4.4), and RFC 8693
token exchange. The `client_credentials` and token-exchange grants are **machine /
agent-to-agent flows — server-side only**: never send `client_secret`,
`client_assertion`, or a `subject_token`/`actor_token` to untrusted or browser code.

#### Machine-to-machine (client_credentials)

Get a token for a service account / machine identity created via the [admin
`create_client`](./admin) method:

```python
from authorizer import (
    AuthorizerClient, GetTokenRequest, GRANT_TYPE_CLIENT_CREDENTIALS,
)

machine = AuthorizerClient(client_id="SERVICE_CLIENT_ID", authorizer_url="https://your-instance.authorizer.dev")
token = machine.get_token(
    GetTokenRequest(grant_type=GRANT_TYPE_CLIENT_CREDENTIALS, client_secret="SERVICE_CLIENT_SECRET")
)
print(token.access_token, token.scope)
```

#### Agent delegation (RFC 8693 token exchange)

An agent acting on behalf of a signed-in user exchanges the user's token plus its own
machine token for a delegated token. The original user stays the JWT `sub`; each hop
narrows `scope` and appends to the nested `act` claim (re-widening scope is rejected):

```python
from authorizer import (
    AuthorizerClient, GetTokenRequest,
    GRANT_TYPE_CLIENT_CREDENTIALS, GRANT_TYPE_TOKEN_EXCHANGE, TOKEN_TYPE_ACCESS_TOKEN,
)

agent = AuthorizerClient(client_id="AGENT_CLIENT_ID", authorizer_url="https://your-instance.authorizer.dev")

# 1. the agent authenticates as itself
machine_token = agent.get_token(
    GetTokenRequest(grant_type=GRANT_TYPE_CLIENT_CREDENTIALS, client_secret="AGENT_CLIENT_SECRET")
)

# 2. exchange the user's token for one delegated to this agent, scoped down
delegated = agent.get_token(
    GetTokenRequest(
        grant_type=GRANT_TYPE_TOKEN_EXCHANGE,
        client_secret="AGENT_CLIENT_SECRET",
        subject_token=user_access_token,
        subject_token_type=TOKEN_TYPE_ACCESS_TOKEN,
        actor_token=machine_token.access_token,
        actor_token_type=TOKEN_TYPE_ACCESS_TOKEN,
        scope="crm:read",
        resource="https://crm.internal.example",
    )
)
print(delegated.access_token)  # sub is still the user; act.sub is the agent
```

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
| `SignUpRequest`            | `password*`, `confirm_password*`, `email`, `given_name`, `family_name`, `phone_number`, `roles`, `scope`, `redirect_uri`, `app_data`, …                          |
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
| `GetTokenRequest`          | `code`, `grant_type`, `refresh_token`, `code_verifier`, `client_secret`, `scope`, `client_assertion`, `client_assertion_type`, `subject_token`, `subject_token_type`, `actor_token`, `actor_token_type`, `resource` |
| `RevokeTokenRequest`       | `refresh_token*`                                                                                                          |
| `CheckPermissionsRequest`  | `checks*` (`list[PermissionCheckInput]`), `user`                                                                          |
| `ListPermissionsRequest`   | `relation`, `object_type`, `user`                                                                                         |
| `PermissionCheckInput`     | `relation*`, `object*`, `contextual_tuples` (`list[FgaTupleInput]`)                                                       |
| `FgaTupleInput`            | `user*`, `relation*`, `object*`                                                                                           |
| `SkipMfaSetupRequest`      | `email`, `phone_number`, `state`                                                                                          |
| `LockMfaRequest`           | `email`, `phone_number`                                                                                                   |
| `OtpMfaSetupRequest`       | `email`, `phone_number` (shared by `email_otp_mfa_setup` / `sms_otp_mfa_setup` / `totp_mfa_setup`)                        |
| `WebauthnRegistrationOptionsRequest` | `email`, `phone_number`                                                                                         |
| `WebauthnRegistrationVerifyRequest`  | `credential*`, `name`, `email`, `phone_number`, `state`                                                         |
| `WebauthnLoginOptionsRequest`        | `email`                                                                                                          |
| `WebauthnLoginVerifyRequest`         | `credential*`, `state`                                                                                          |
| `WebauthnDeleteCredentialRequest`    | `id*`                                                                                                            |

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
| `GetTokenResponse`         | `access_token`, `expires_in`, `id_token`, `refresh_token`, `token_type`, `scope`, `issued_token_type`                   |
| `CheckPermissionsResponse` | `results` (`list[PermissionCheckResult]`)                                                                               |
| `PermissionCheckResult`    | `relation`, `object`, `allowed`                                                                                         |
| `ListPermissionsResponse`  | `objects`, `permissions` (`list[Permission]`), `truncated`                                                              |
| `Permission`               | `object`, `relation`                                                                                                    |
| `WebauthnRegistrationOptionsResponse` | `options` (JSON-encoded `PublicKeyCredentialCreationOptions`)                                                |
| `WebauthnLoginOptionsResponse`        | `options` (JSON-encoded `PublicKeyCredentialRequestOptions`)                                                 |
| `WebauthnCredentialInfo`              | `id`, `name`, `transports`, `created_at`, `updated_at`, `last_used_at`                                       |

## Enums

| Enum             | Values                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `TokenType`      | `ACCESS_TOKEN`, `ID_TOKEN`, `REFRESH_TOKEN`                                                            |
| `ResponseTypes`  | `CODE`, `TOKEN`                                                                                        |
| `OAuthProviders` | `APPLE`, `GITHUB`, `GOOGLE`, `FACEBOOK`, `LINKEDIN`, `TWITTER`, `MICROSOFT`, `TWITCH`, `ROBLOX`, `DISCORD` |

## OAuth grant / token-type constants

Plain string constants (not enums) for building `GetTokenRequest` — pass their values, or
the constants themselves, to `grant_type`, `*_token_type`, and `client_assertion_type`:

| Constant                          | Value                                                          |
| ---------------------------------- | --------------------------------------------------------------- |
| `GRANT_TYPE_AUTHORIZATION_CODE`    | `"authorization_code"`                                          |
| `GRANT_TYPE_REFRESH_TOKEN`         | `"refresh_token"`                                                |
| `GRANT_TYPE_CLIENT_CREDENTIALS`    | `"client_credentials"`                                           |
| `GRANT_TYPE_TOKEN_EXCHANGE`        | `"urn:ietf:params:oauth:grant-type:token-exchange"` (RFC 8693)  |
| `TOKEN_TYPE_ACCESS_TOKEN`          | `"urn:ietf:params:oauth:token-type:access_token"`               |
| `TOKEN_TYPE_JWT`                   | `"urn:ietf:params:oauth:token-type:jwt"`                        |
| `CLIENT_ASSERTION_TYPE_JWT_BEARER` | `"urn:ietf:params:oauth:client-assertion-type:jwt-bearer"` (RFC 7523) |

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
