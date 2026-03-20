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
go get github.com/authorizerdev/authorizer-go
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
response, err := authorizerClient.Login(&authorizer.LoginInput{
    Email:    "test@yopmail.com",
    Password: "Abc@123",
})
if err != nil {
    panic(err)
}
```

**Example: Validate JWT Token**

```go
res, err := authorizerClient.ValidateJWTToken(&authorizer.ValidateJWTTokenInput{
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

## Available Methods

The SDK provides the following methods:

- `Login` -- Authenticate with email and password
- `Signup` -- Register a new user
- `VerifyEmail` -- Verify user email
- `ForgotPassword` -- Initiate forgot password flow
- `ResetPassword` -- Reset password with token
- `GetProfile` -- Get user profile
- `UpdateProfile` -- Update user profile
- `MagicLinkLogin` -- Login with magic link
- `ValidateJWTToken` -- Validate a JWT token
- `GetSession` -- Get current session
- `RevokeToken` -- Revoke a token
- `Logout` -- Logout user
- `ValidateSession` -- Validate a session
