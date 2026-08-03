---
sidebar_position: 1
title: Getting Started
---

# Getting Started

## Official Documentation

For detailed explanation of each function, check the authorizer-go [pkg.go.dev docs](https://pkg.go.dev/github.com/authorizerdev/authorizer-go).

**Prerequisite**: You need an Authorizer instance running. See the [deployment guides](../../deployment/) for setup options.

## Authorizer v2 Compatibility

The authorizer-go SDK works with both Authorizer v1 and v2 servers. When using with v2:

- Obtain the `Client ID` from your v2 server's `--client-id` flag (set at startup)
- The SDK methods remain the same; only the server configuration model has changed

## Installation

### Step 1: Install authorizer-go SDK

```bash
go get github.com/authorizerdev/authorizer-go/v2
```

### Step 2: Initialize authorizer client

**Parameters**

| Key             | Type                | Required | Description                                                                                                     |
| --------------- | ------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `clientID`      | `string`            | `true`   | Your unique client identifier (from `--client-id` flag in v2, or dashboard in v1)                               |
| `authorizerURL` | `string`            | `true`   | Authorizer server URL                                                                                           |
| `redirectURL`   | `string`            | `false`  | Default URL to redirect the user after successful signup / login / forgot password                               |
| `extraHeaders`  | `map[string]string` | `false`  | Set of headers to pass with each request                                                                        |

**Example**

```go
defaultHeaders := map[string]string{}

authorizerClient, err := authorizer.NewAuthorizerClient("YOUR_CLIENT_ID", "YOUR_AUTHORIZER_URL", "OPTIONAL_REDIRECT_URL", defaultHeaders)
if err != nil {
    panic(err)
}
```

### Step 3: Use SDK methods

**Example: Login**

```go
response, err := authorizerClient.Login(&authorizer.LoginRequest{
    Email:    authorizer.NewStringRef("test@yopmail.com"),
    Password: "Abc@123",
})
if err != nil {
    panic(err)
}
```

> `Email` (and `PhoneNumber`) are `*string` fields, so pass a pointer: use the SDK's `authorizer.NewStringRef(v string) *string` helper, or take the address of a local variable.

**Example: Validate JWT Token**

```go
res, err := authorizerClient.ValidateJWTToken(&authorizer.ValidateJWTTokenRequest{
    TokenType: authorizer.TokenTypeIDToken,
    Token:     "your-jwt-token",
})
if err != nil {
    panic(err)
}

if res.IsValid {
    // Token is valid
}
```

### Step 4: Fine-grained authorization (FGA)

Authorizer ships with an embedded [OpenFGA](https://openfga.dev) relationship-based authorization (ReBAC) engine. The SDK exposes two client-facing methods to query it. Each takes a request struct and a `headers map[string]string` (pass `Authorization: Bearer <token>`).

For complete worked scenarios — Go HTTP middleware, list filtering, and tuple lifecycle — see [Authorization recipes](/core/authorization#9-real-world-recipes).

**CheckPermissions** -- evaluate one or more permission checks in a single call. `Results` come back in the same order as `Checks` and echo each pair.

```go
res, err := authorizerClient.CheckPermissions(&authorizer.CheckPermissionsRequest{
    Checks: []*authorizer.PermissionCheckInput{
        {Relation: "can_view", Object: "document:1"},
        {Relation: "can_edit", Object: "document:1"},
    },
}, map[string]string{
    "Authorization": "Bearer " + token,
})
if err != nil {
    panic(err)
}
if res.Results[0].Allowed {
    // caller may view document:1
}
// Each result echoes its pair, so batch responses are self-describing:
for _, r := range res.Results {
    fmt.Printf("%s on %s: %v\n", r.Relation, r.Object, r.Allowed)
}
```

The subject defaults to the caller's token. An optional `User` ("type:id", bare id treated as `user:<id>`) is honored only for super-admins or when it equals the caller's own subject. Each check also accepts optional `ContextualTuples` -- extra relationship tuples evaluated for that call only and never persisted, handy for "what-if" checks or request-time facts:

```go
res, err := authorizerClient.CheckPermissions(&authorizer.CheckPermissionsRequest{
    Checks: []*authorizer.PermissionCheckInput{
        {
            Relation: "can_view",
            Object:   "document:1",
            ContextualTuples: []*authorizer.FgaTupleInput{
                {User: "user:1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", Relation: "viewer", Object: "document:1"},
            },
        },
    },
}, map[string]string{
    "Authorization": "Bearer " + token,
})
```

**ListPermissions** -- list what the subject can access. With both `Relation` and `ObjectType` set it answers "which `ObjectType`s can I `Relation`?"; either or both filters may be omitted, so an empty request returns every permission the subject holds. Returns the distinct `Objects`, the `(Object, Relation)` detail in `Permissions`, and `Truncated` (`true` when the result was capped at 1000 entries).

```go
res, err := authorizerClient.ListPermissions(&authorizer.ListPermissionsRequest{
    Relation:   "can_view",
    ObjectType: "document",
}, map[string]string{
    "Authorization": "Bearer " + token,
})
// res.Objects => ["document:1", "document:7", ...]

// No filters: everything the caller holds, with per-relation detail
all, err := authorizerClient.ListPermissions(&authorizer.ListPermissionsRequest{}, map[string]string{
    "Authorization": "Bearer " + token,
})
// all.Permissions => [{Object: "document:1", Relation: "can_view"}, ...]
// all.Truncated => false
```

## Available Methods

The SDK provides the following methods:

- `Login` -- Authenticate with email and password
- `SignUp` -- Register a new user
- `VerifyEmail` -- Verify user email
- `ForgotPassword` -- Initiate forgot password flow
- `ResetPassword` -- Reset password with token
- `GetProfile` -- Get user profile
- `UpdateProfile` -- Update user profile
- `MagicLinkLogin` -- Login with magic link
- `ValidateJWTToken` -- Validate a JWT token
- `GetSession` -- Get current session
- `RevokeToken` -- Revoke a token (`/oauth/revoke`)
- `Revoke` -- Revoke a token over the client's selected protocol (graphql/rest/grpc)
- `Logout` -- Logout user
- `ValidateSession` -- Validate a session
- `CheckPermissions` -- Evaluate one or more permission checks (FGA)
- `ListPermissions` -- List objects the subject holds a permission on (FGA)
- `GetMetaData` -- Get server metadata / enabled feature flags
- `GetToken` -- Exchange a grant (`authorization_code`, `refresh_token`, `client_credentials`, or RFC 8693 `token-exchange`) for a token at `/oauth/token` -- covers M2M and workload-identity flows
- `ExecuteGraphQL` -- Run a raw GraphQL request against the instance
- `ResendOTP` -- Resend a one-time code
- `ResendVerifyEmail` -- Resend the email verification link
- `VerifyOTP` -- Verify a one-time code and complete login
- `LockMfa` -- Lock the account into required MFA setup when no verified fallback is enrolled
- `SkipMfaSetup` -- Skip optional MFA setup and issue the withheld access token
- `EmailOtpMfaSetup` -- Start email-OTP MFA enrollment
- `SmsOtpMfaSetup` -- Start SMS-OTP MFA enrollment
- `TotpMfaSetup` -- Start TOTP MFA enrollment
- `DeactivateAccount` -- Deactivate the authenticated user's own account
- `WebauthnRegistrationOptions` -- Get a passkey creation challenge
- `WebauthnRegistrationVerify` -- Complete passkey enrollment
- `WebauthnLoginOptions` -- Get a passkey assertion challenge (email optional, for usernameless login)
- `WebauthnLoginVerify` -- Complete passkey login
- `WebauthnCredentials` -- List the caller's own registered passkeys
- `WebauthnDeleteCredential` -- Delete one of the caller's own registered passkeys
