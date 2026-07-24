---
sidebar_position: 2
title: Functions
---

# Functions

The `AuthorizerClient` provides methods to interact with the Authorizer API. Every method takes a request struct as a parameter and returns a response struct or an error.

```go
import "github.com/authorizerdev/authorizer-go"

client, err := authorizer.NewAuthorizerClient(
    "YOUR_CLIENT_ID",
    "https://your-instance.authorizer.dev",
    "https://your-app.example.com",
    nil,
)
if err != nil {
    panic(err)
}

// Example: Login
res, err := client.Login(&authorizer.LoginRequest{
    Email:    stringPtr("user@example.com"),
    Password: "Abc@123",
})
if err != nil {
    panic(err)
}
```

## Authentication & user management

### Public methods (no authentication required)

| Method                | Signature                                                       | Returns                     |
| --------------------- | --------------------------------------------------------------- | --------------------------- |
| `Login`               | `Login(req *LoginRequest) (*AuthTokenResponse, error)`          | `*AuthTokenResponse`        |
| `SignUp`              | `SignUp(req *SignUpRequest) (*AuthTokenResponse, error)`        | `*AuthTokenResponse`        |
| `MagicLinkLogin`      | `MagicLinkLogin(req *MagicLinkLoginRequest) (*Response, error)` | `*Response`                 |
| `VerifyOTP`           | `VerifyOTP(req *VerifyOTPRequest) (*AuthTokenResponse, error)`  | `*AuthTokenResponse`        |
| `VerifyEmail`         | `VerifyEmail(req *VerifyEmailRequest) (*AuthTokenResponse, error)` | `*AuthTokenResponse`     |
| `ResendOTP`           | `ResendOTP(req *ResendOTPRequest) (*Response, error)`           | `*Response`                 |
| `ResendVerifyEmail`   | `ResendVerifyEmail(req *ResendVerifyEmailRequest) (*Response, error)` | `*Response`         |
| `ForgotPassword`      | `ForgotPassword(req *ForgotPasswordRequest) (*ForgotPasswordResponse, error)` | `*ForgotPasswordResponse` |
| `ResetPassword`       | `ResetPassword(req *ResetPasswordRequest) (*Response, error)`   | `*Response`                 |
| `ValidateJWTToken`    | `ValidateJWTToken(req *ValidateJWTTokenRequest) (*ValidateJWTTokenResponse, error)` | `*ValidateJWTTokenResponse` |
| `ValidateSession`     | `ValidateSession(req *ValidateSessionRequest) (*ValidateSessionResponse, error)` | `*ValidateSessionResponse` |
| `GetMetaData`         | `GetMetaData() (*MetaData, error)`                              | `*MetaData`                 |

### Authenticated (pass `headers` map with bearer token)

| Method                | Signature                                                                       | Returns           |
| --------------------- | ------------------------------------------------------------------------------- | ----------------- |
| `GetSession`          | `GetSession(headers map[string]string) (*AuthTokenResponse, error)`            | `*AuthTokenResponse` |
| `GetProfile`          | `GetProfile(headers map[string]string) (*User, error)`                         | `*User`            |
| `UpdateProfile`       | `UpdateProfile(req *UpdateProfileRequest, headers map[string]string) (*Response, error)` | `*Response` |
| `Logout`              | `Logout(headers map[string]string) (*Response, error)`                         | `*Response`        |
| `DeactivateAccount`   | `DeactivateAccount(headers map[string]string) (*Response, error)`              | `*Response`        |

### Fine-grained authorization

| Method               | Signature                                                                   | Returns                     |
| -------------------- | --------------------------------------------------------------------------- | --------------------------- |
| `CheckPermissions`   | `CheckPermissions(req *CheckPermissionsRequest, headers map[string]string) (*CheckPermissionsResponse, error)` | `*CheckPermissionsResponse` |
| `ListPermissions`    | `ListPermissions(req *ListPermissionsRequest, headers map[string]string) (*ListPermissionsResponse, error)` | `*ListPermissionsResponse` |

See the dedicated [Fine-Grained Authorization](/sdks/authorizer-go/admin#fga-admin) documentation for details.

### MFA setup & recovery

All take a `headers` map with a bearer token (or, if the caller doesn't have one yet, an `email`/`phone_number` pair that resolves the in-progress MFA session cookie instead).

| Method                 | Signature                                                              | Returns            |
| ----------------------- | ---------------------------------------------------------------------- | ------------------- |
| `SkipMfaSetup`         | `SkipMfaSetup(req *SkipMfaSetupRequest, headers map[string]string) (*AuthTokenResponse, error)` | `*AuthTokenResponse` |
| `LockMfa`              | `LockMfa(req *LockMfaRequest, headers map[string]string) (*Response, error)` | `*Response` |
| `EmailOtpMfaSetup`     | `EmailOtpMfaSetup(req *EmailOtpMfaSetupRequest, headers map[string]string) (*Response, error)` | `*Response` |
| `SmsOtpMfaSetup`       | `SmsOtpMfaSetup(req *SmsOtpMfaSetupRequest, headers map[string]string) (*Response, error)` | `*Response` |
| `TotpMfaSetup`         | `TotpMfaSetup(req *TotpMfaSetupRequest, headers map[string]string) (*AuthTokenResponse, error)` | `*AuthTokenResponse` |

> `LockMfa` has no OTP fallback — it locks the account and requires admin recovery afterward.

### WebAuthn / passkeys

| Method                          | Signature                                                                        | Returns                               |
| ---------------------------------- | ----------- | ---------------------------------------- |
| `WebauthnRegistrationOptions`   | `WebauthnRegistrationOptions(req *WebauthnRegistrationOptionsRequest, headers map[string]string) (*WebauthnRegistrationOptionsResponse, error)` | `*WebauthnRegistrationOptionsResponse` |
| `WebauthnRegistrationVerify`    | `WebauthnRegistrationVerify(req *WebauthnRegistrationVerifyRequest, headers map[string]string) (*AuthTokenResponse, error)` | `*AuthTokenResponse` |
| `WebauthnLoginOptions`          | `WebauthnLoginOptions(email *string) (*WebauthnLoginOptionsResponse, error)` | `*WebauthnLoginOptionsResponse` |
| `WebauthnLoginVerify`           | `WebauthnLoginVerify(req *WebauthnLoginVerifyRequest) (*AuthTokenResponse, error)` | `*AuthTokenResponse` |
| `WebauthnDeleteCredential`      | `WebauthnDeleteCredential(id string, headers map[string]string) (*Response, error)` | `*Response` |
| `WebauthnCredentials`           | `WebauthnCredentials(headers map[string]string) ([]*WebauthnCredentialInfo, error)` | `[]*WebauthnCredentialInfo` |

`WebauthnRegistrationOptions`/`WebauthnLoginOptions` return JSON-encoded `options` strings to feed straight to the browser's `navigator.credentials.create()` / `.get()`; `WebauthnRegistrationVerify`/`WebauthnLoginVerify` take the JSON-encoded credential response back. `WebauthnDeleteCredential` permanently deletes a registered passkey. `WebauthnCredentials` lists the authenticated caller's own registered passkeys.

### OAuth (REST)

| Method         | Signature                                  | Returns            |
| -------------- | ------------------------------------------ | ------------------ |
| `GetToken`     | `GetToken(req *GetTokenRequest) (*TokenResponse, error)` | `*TokenResponse` |
| `RevokeToken`  | `RevokeToken(req *RevokeTokenRequest) (*Response, error)` | `*Response` |
| `Revoke`       | `Revoke(req *RevokeRequest) (*Response, error)` | `*Response` |

`GetToken` posts a form-encoded (`application/x-www-form-urlencoded`) request to `/oauth/token` and supports four grants: `authorization_code` (default, needs `code` + `code_verifier`), `refresh_token`, `client_credentials` (RFC 6749 §4.4), and RFC 8693 token exchange. The `client_credentials` and token-exchange grants are **machine / agent-to-agent flows — server-side only**: never send `client_secret`, `client_assertion`, or a `subject_token`/`actor_token` to untrusted or browser code.

#### Machine-to-machine (client_credentials)

Get a token for a service account / machine identity created via the [admin `CreateClient`](./admin) method:

```go
import "github.com/authorizerdev/authorizer-go"

machine, err := authorizer.NewAuthorizerClient(
    "SERVICE_CLIENT_ID",
    "https://your-instance.authorizer.dev",
    "https://your-app.example.com",
    nil,
)
if err != nil {
    panic(err)
}

token, err := machine.GetToken(&authorizer.GetTokenRequest{
    GrantType:    stringPtr(authorizer.GrantTypeClientCredentials),
    ClientSecret: stringPtr("SERVICE_CLIENT_SECRET"),
})
if err != nil {
    panic(err)
}
fmt.Println(token.AccessToken, token.Scope)
```

#### Agent delegation (RFC 8693 token exchange)

An agent acting on behalf of a signed-in user exchanges the user's token plus its own machine token for a delegated token. The original user stays the JWT `sub`; each hop narrows `scope` and appends to the nested `act` claim (re-widening scope is rejected):

```go
import "github.com/authorizerdev/authorizer-go"

agent, err := authorizer.NewAuthorizerClient(
    "AGENT_CLIENT_ID",
    "https://your-instance.authorizer.dev",
    "https://your-app.example.com",
    nil,
)
if err != nil {
    panic(err)
}

// 1. the agent authenticates as itself
machineToken, err := agent.GetToken(&authorizer.GetTokenRequest{
    GrantType:    stringPtr(authorizer.GrantTypeClientCredentials),
    ClientSecret: stringPtr("AGENT_CLIENT_SECRET"),
})
if err != nil {
    panic(err)
}

// 2. exchange the user's token for one delegated to this agent, scoped down
delegated, err := agent.GetToken(&authorizer.GetTokenRequest{
    GrantType:        stringPtr(authorizer.GrantTypeTokenExchange),
    ClientSecret:     stringPtr("AGENT_CLIENT_SECRET"),
    SubjectToken:     &userAccessToken,
    SubjectTokenType: stringPtr("urn:ietf:params:oauth:token-type:access_token"),
    ActorToken:       machineToken.AccessToken,
    ActorTokenType:   stringPtr("urn:ietf:params:oauth:token-type:access_token"),
    Scope:            stringPtr("crm:read"),
    Resource:         stringPtr("https://crm.internal.example"),
})
if err != nil {
    panic(err)
}
fmt.Println(delegated.AccessToken) // sub is still the user; act.sub is the agent
```

### Escape hatch — raw GraphQL

For any operation not covered by a typed helper:

```go
res, err := client.ExecuteGraphQL(&authorizer.GraphQLRequest{
    Query:     `query { meta { version } }`,
    Variables: nil,
})
if err != nil {
    panic(err)
}
```

`ExecuteGraphQL(req *GraphQLRequest) (map[string]interface{}, error)` returns the parsed response data.

## Examples

### Sign up

```go
import "github.com/authorizerdev/authorizer-go"

client, err := authorizer.NewAuthorizerClient(
    "YOUR_CLIENT_ID",
    "https://your-instance.authorizer.dev",
    "https://your-app.example.com",
    nil,
)
if err != nil {
    panic(err)
}

token, err := client.SignUp(&authorizer.SignUpRequest{
    Email:           stringPtr("user@example.com"),
    Password:        "Abc@123",
    ConfirmPassword: "Abc@123",
    GivenName:       stringPtr("Ada"),
    FamilyName:      stringPtr("Lovelace"),
})
if err != nil {
    panic(err)
}
fmt.Println(token.Message, *token.AccessToken)
```

### Log in and read the profile

```go
import "github.com/authorizerdev/authorizer-go"

client, err := authorizer.NewAuthorizerClient(
    "YOUR_CLIENT_ID",
    "https://your-instance.authorizer.dev",
    "https://your-app.example.com",
    nil,
)
if err != nil {
    panic(err)
}

token, err := client.Login(&authorizer.LoginRequest{
    Email:    stringPtr("user@example.com"),
    Password: "Abc@123",
})
if err != nil {
    panic(err)
}

headers := map[string]string{"Authorization": "Bearer " + *token.AccessToken}

user, err := client.GetProfile(headers)
if err != nil {
    panic(err)
}
fmt.Println(user.ID, user.Email, user.Roles)
```

### Validate a JWT

```go
import "github.com/authorizerdev/authorizer-go"

client, err := authorizer.NewAuthorizerClient(
    "YOUR_CLIENT_ID",
    "https://your-instance.authorizer.dev",
    "https://your-app.example.com",
    nil,
)
if err != nil {
    panic(err)
}

res, err := client.ValidateJWTToken(&authorizer.ValidateJWTTokenRequest{
    Token: accessToken,
})
if err != nil {
    panic(err)
}
fmt.Println(res.IsValid, res.Claims)
```

### Magic-link login

```go
import "github.com/authorizerdev/authorizer-go"

client, err := authorizer.NewAuthorizerClient(
    "YOUR_CLIENT_ID",
    "https://your-instance.authorizer.dev",
    "https://your-app.example.com",
    nil,
)
if err != nil {
    panic(err)
}

res, err := client.MagicLinkLogin(&authorizer.MagicLinkLoginRequest{
    Email: stringPtr("user@example.com"),
})
if err != nil {
    panic(err)
}
fmt.Println(res.Message) // "Please check your inbox!..."
```

## Request types

All request structs are serializable to JSON via `json.Marshal()`. Fields shown as `*Type` are optional (pointers).

| Type                       | Key fields                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `LoginRequest`             | `Password`, `Email`, `PhoneNumber`, `Roles`, `Scope`, `State`                                                           |
| `SignUpRequest`            | `Password`, `ConfirmPassword`, `Email`, `GivenName`, `FamilyName`, `PhoneNumber`, `Roles`, `Scope`, `RedirectURI`, `AppData`, … |
| `MagicLinkLoginRequest`    | `Email`, `Roles`, `Scope`, `State`, `RedirectURI`                                                                       |
| `VerifyOTPRequest`         | `OTP`, `Email`, `PhoneNumber`, `IsTotp`, `State`                                                                       |
| `VerifyEmailRequest`       | `Token`, `State`                                                                                                         |
| `ResendOTPRequest`         | `Email`, `PhoneNumber`, `State`                                                                                          |
| `ResendVerifyEmailRequest` | `Email`                                                                                                                    |
| `ForgotPasswordRequest`    | `Email`, `PhoneNumber`, `State`, `RedirectURI`                                                                          |
| `ResetPasswordRequest`     | `Password`, `ConfirmPassword`, `Token`, `OTP`, `PhoneNumber`                                                          |
| `ValidateJWTTokenRequest`  | `Token`, (no explicit type field; server infers from token structure)                                                    |
| `ValidateSessionRequest`   | `Cookie`, `Roles`                                                                                                         |
| `UpdateProfileRequest`     | `Email`, `OldPassword`, `NewPassword`, `ConfirmNewPassword`, `GivenName`, `FamilyName`, `Roles`, `AppData`, …      |
| `GetTokenRequest`          | `Code`, `GrantType`, `RefreshToken`, `CodeVerifier`, `ClientSecret`, `Scope`, `ClientAssertion`, `ClientAssertionType`, `SubjectToken`, `SubjectTokenType`, `ActorToken`, `ActorTokenType`, `Resource` |
| `RevokeTokenRequest`       | `RefreshToken`                                                                                                          |
| `RevokeRequest`            | `RefreshToken`                                                                                                          |
| `CheckPermissionsRequest`  | `Checks`, `User`                                                                                                          |
| `ListPermissionsRequest`   | `Relation`, `ObjectType`, `User`                                                                                         |
| `PermissionCheckInput`     | `Relation`, `Object`, `ContextualTuples`                                                                                 |
| `FgaTupleInput`            | `User`, `Relation`, `Object`                                                                                             |
| `SkipMfaSetupRequest`      | `Email`, `PhoneNumber`, `State`                                                                                          |
| `LockMfaRequest`           | `Email`, `PhoneNumber`                                                                                                   |
| `EmailOtpMfaSetupRequest`  | `Email`, `PhoneNumber`                                                                                                   |
| `SmsOtpMfaSetupRequest`    | `Email`, `PhoneNumber`                                                                                                   |
| `TotpMfaSetupRequest`      | `Email`, `PhoneNumber`                                                                                                   |
| `WebauthnRegistrationOptionsRequest` | `Email`, `PhoneNumber`                                                                                         |
| `WebauthnRegistrationVerifyRequest`  | `Credential`, `Name`, `Email`, `PhoneNumber`, `State`                                                         |
| `WebauthnLoginVerifyRequest`         | `Credential`, `State`                                                                                           |
| `WebauthnDeleteCredentialRequest`    | `ID`                                                                                                            |

## Response types

All response structs are deserializable from JSON via `json.Unmarshal()`.

| Type                       | Key fields                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `AuthTokenResponse`        | `Message`, `AccessToken`, `ExpiresIn`, `IdToken`, `RefreshToken`, `ShouldShowEmailOtpScreen`, `ShouldShowMobileOtpScreen`, `ShouldShowTotpScreen`, `ShouldOfferWebauthnMfaSetup`, `ShouldOfferWebauthnMfaVerify`, `ShouldOfferEmailOtpMfaSetup`, `ShouldOfferSmsOtpMfaSetup`, `AuthenticatorScannerImage`, `AuthenticatorSecret`, `AuthenticatorRecoveryCodes`, `User` |
| `User`                     | `ID`, `Email`, `EmailVerified`, `GivenName`, `FamilyName`, `PhoneNumber`, `Roles`, `CreatedAt`, `UpdatedAt`, `IsMultiFactorAuthEnabled`, `HasSkippedMfaSetupAt`, `MfaLockedAt`, `EnrolledMfaMethods`, `AppData`, … |
| `Response`                 | `Message`                                                                                                               |
| `ForgotPasswordResponse`   | `Message`, `ShouldShowMobileOtpScreen`                                                                                  |
| `ValidateJWTTokenResponse` | `IsValid`, `Claims`                                                                                                    |
| `ValidateSessionResponse`  | `IsValid`, `User`                                                                                                      |
| `MetaData`                 | `Version`, `ClientID`, and `Is*Enabled` feature flags (login providers, MFA, sign-up, etc.)                             |
| `TokenResponse`            | `AccessToken`, `ExpiresIn`, `IdToken`, `RefreshToken`, `TokenType`, `Scope`, `IssuedTokenType`                         |
| `CheckPermissionsResponse` | `Results`                                                                                                               |
| `PermissionCheckResult`    | `Relation`, `Object`, `Allowed`                                                                                        |
| `ListPermissionsResponse`  | `Objects`, `Permissions`, `Truncated`                                                                                  |
| `Permission`               | `Object`, `Relation`                                                                                                    |
| `WebauthnRegistrationOptionsResponse` | `Options` (JSON-encoded `PublicKeyCredentialCreationOptions`)                                                |
| `WebauthnLoginOptionsResponse`        | `Options` (JSON-encoded `PublicKeyCredentialRequestOptions`)                                                 |
| `WebauthnCredentialInfo`              | `ID`, `Name`, `Transports`, `CreatedAt`, `UpdatedAt`, `LastUsedAt`                                            |

## Constants

| Constant                          | Value                                                          |
| ---------------------------------- | --------------------------------------------------------------- |
| `GrantTypeAuthorizationCode`       | `"authorization_code"`                                          |
| `GrantTypeRefreshToken`            | `"refresh_token"`                                                |
| `GrantTypeClientCredentials`       | `"client_credentials"`                                           |
| `GrantTypeTokenExchange`           | `"urn:ietf:params:oauth:grant-type:token-exchange"` (RFC 8693)  |

## Error handling

The SDK returns standard Go errors. Most API errors come back as error messages:

```go
import "github.com/authorizerdev/authorizer-go"

client, err := authorizer.NewAuthorizerClient(
    "YOUR_CLIENT_ID",
    "https://your-instance.authorizer.dev",
    "https://your-app.example.com",
    nil,
)
if err != nil {
    panic(err)
}

token, err := client.Login(&authorizer.LoginRequest{
    Email:    stringPtr("user@example.com"),
    Password: "wrong",
})
if err != nil {
    // err will be non-nil
    fmt.Println(err)
}
```

## Protocol selection

By default, the client uses GraphQL. You can override this with `WithProtocol`:

```go
import "github.com/authorizerdev/authorizer-go"

// Use REST endpoints
client, err := authorizer.NewAuthorizerClient(
    "YOUR_CLIENT_ID",
    "https://your-instance.authorizer.dev",
    "https://your-app.example.com",
    nil,
    authorizer.WithProtocol(authorizer.ProtocolREST),
)

// Use gRPC (requires a separate gRPC endpoint, default 9091)
client, err = authorizer.NewAuthorizerClient(
    "YOUR_CLIENT_ID",
    "https://your-instance.authorizer.dev",
    "https://your-app.example.com",
    nil,
    authorizer.WithProtocol(authorizer.ProtocolGRPC),
    authorizer.WithGRPCEndpoint("your-instance.authorizer.dev:9091"),
)
```

## Utility helpers

The SDK exports pointer constructor helpers for optional fields:

```go
import "github.com/authorizerdev/authorizer-go"

// stringPtr(s) returns a *string pointing to s
// intPtr(i) returns an *int64 pointing to i
// boolPtr(b) returns a *bool pointing to b

email := authorizer.stringPtr("user@example.com")
```
