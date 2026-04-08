---
sidebar_position: 5
title: OAuth 2.0, OIDC & SSO
---

# OAuth 2.0, OpenID Connect & SSO

Authorizer is a fully conformant OAuth 2.0 and OpenID Connect (OIDC) provider. You can:

- **Use it standalone** as an SSO identity provider for your own apps — any OIDC-compliant client library "just works" against its Discovery URL.
- **Federate it into an existing SSO** (Auth0, Okta, Keycloak, etc.) as an upstream OIDC identity provider.
- **Use it alongside social providers** (Google, GitHub, Facebook, LinkedIn, Apple, Discord, Twitter, Twitch, Roblox, Microsoft).

This page is the one-stop reference for every endpoint, parameter, and integration pattern Authorizer supports, plus a practical testing guide at the end.

## Standards Implemented

| Standard                              | Status        | Notes                                                              |
| ------------------------------------- | ------------- | ------------------------------------------------------------------ |
| OIDC Core 1.0                         | Implemented   | ID tokens, UserInfo, nonce, `auth_time`, `amr`, `acr`, `at_hash`, `c_hash` |
| OIDC Discovery 1.0                    | Implemented   | All required + recommended fields                                  |
| OIDC Hybrid Flow (§3.3)               | Implemented   | `code id_token`, `code token`, `code id_token token`, `id_token token` |
| OIDC RP-Initiated Logout 1.0          | Implemented   | `post_logout_redirect_uri`, `state` echo, `id_token_hint`          |
| OIDC Back-Channel Logout 1.0          | Implemented   | Opt-in via `--backchannel-logout-uri`                              |
| RFC 6749 (OAuth 2.0)                  | Implemented   | Authorization Code + Refresh Token + Implicit grants               |
| RFC 6750 (Bearer Token)               | Implemented   | `WWW-Authenticate` on 401                                          |
| RFC 7009 (Token Revocation)           | Implemented   | Returns 200 for invalid tokens                                     |
| RFC 7517 (JWK)                        | Implemented   | RSA, ECDSA, HMAC; manual multi-key rotation                        |
| RFC 7636 (PKCE)                       | Implemented   | S256 method; required for authorization code flow                  |
| RFC 7662 (Token Introspection)        | Implemented   | Non-disclosure for inactive tokens                                 |

**Not yet implemented** (tracked for future releases): RFC 7591 dynamic client registration, RFC 9101 JAR / Request Object, OIDC Session Management iframe, front-channel logout, automated time-based key rotation.

---

## Quickstart: Authorizer as an SSO Provider

This is the most common setup — an app delegates authentication to Authorizer via OIDC.

### Step 1 — Configure your Authorizer instance

Before any client can use Authorizer for SSO, you need to tell the server which origins and redirect URIs are allowed.

```bash
./build/server \
  --client-id=my-app \
  --client-secret="$(openssl rand -hex 32)" \
  --allowed-origins=https://app.example.com,http://localhost:3000 \
  --jwt-type=RS256 \
  --jwt-private-key="$(cat /etc/authorizer/jwt-private.pem)" \
  --jwt-public-key="$(cat /etc/authorizer/jwt-public.pem)"
```

For production, use RSA or ECDSA keys (not HMAC) so public clients can verify tokens via the JWKS endpoint without sharing the signing secret. See the [Server Configuration guide](./server-config) for all flags.

### Step 2 — Give your app the Discovery URL

One URL is all a spec-compliant OIDC client library needs:

```
https://your-authorizer.example/.well-known/openid-configuration
```

Every library (Auth0.js, openid-client, go-oidc, python-jose, Spring Security OAuth, etc.) can bootstrap from this single URL. No hand-wiring of endpoint URLs needed.

### Step 3 — Wire your client

The following examples all implement the same Authorization Code + PKCE flow. Pick the one matching your stack.

#### React SPA (using `@authorizerdev/authorizer-react`)

Authorizer ships an official React SDK that wraps OIDC for you:

```bash
npm install @authorizerdev/authorizer-react
```

```jsx
import { AuthorizerProvider, useAuthorizer } from '@authorizerdev/authorizer-react';

function App() {
  return (
    <AuthorizerProvider
      config={{
        authorizerURL: 'https://your-authorizer.example',
        redirectURL: window.location.origin,
        clientID: 'my-app',
      }}
    >
      <MyApp />
    </AuthorizerProvider>
  );
}

function MyApp() {
  const { user, loading, authorizerRef } = useAuthorizer();
  if (loading) return <p>Loading…</p>;
  if (!user) {
    return <button onClick={() => authorizerRef.authorize({ response_type: 'code', use_refresh_token: true })}>Sign in</button>;
  }
  return <p>Hello {user.email}</p>;
}
```

#### Generic SPA (using `oidc-client-ts`)

For a framework-agnostic JavaScript app using a standards-compliant OIDC library:

```bash
npm install oidc-client-ts
```

```javascript
import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

const mgr = new UserManager({
  authority: 'https://your-authorizer.example',
  client_id: 'my-app',
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email offline_access',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
});

// Trigger sign-in
document.querySelector('#login').addEventListener('click', () => mgr.signinRedirect());

// On the /callback page
const user = await mgr.signinRedirectCallback();
console.log('signed in as', user.profile.email);
```

#### Node.js / Express backend (using `openid-client`)

```bash
npm install openid-client express-session
```

```javascript
import express from 'express';
import session from 'express-session';
import { Issuer, generators } from 'openid-client';

const app = express();
app.use(session({ secret: 'change-me', resave: false, saveUninitialized: true }));

// Discover Authorizer and build a Client
const authorizer = await Issuer.discover('https://your-authorizer.example');
const client = new authorizer.Client({
  client_id: 'my-app',
  client_secret: process.env.CLIENT_SECRET,
  redirect_uris: ['http://localhost:3000/callback'],
  response_types: ['code'],
});

app.get('/login', (req, res) => {
  const code_verifier = generators.codeVerifier();
  const code_challenge = generators.codeChallenge(code_verifier);
  req.session.code_verifier = code_verifier;
  res.redirect(client.authorizationUrl({
    scope: 'openid profile email offline_access',
    code_challenge,
    code_challenge_method: 'S256',
  }));
});

app.get('/callback', async (req, res) => {
  const params = client.callbackParams(req);
  const tokenSet = await client.callback(
    'http://localhost:3000/callback',
    params,
    { code_verifier: req.session.code_verifier },
  );
  req.session.tokens = tokenSet;
  const userinfo = await client.userinfo(tokenSet.access_token);
  res.json({ claims: tokenSet.claims(), userinfo });
});

app.listen(3000);
```

#### Go backend (using `coreos/go-oidc`)

```bash
go get github.com/coreos/go-oidc/v3/oidc golang.org/x/oauth2
```

```go
package main

import (
    "context"
    "encoding/json"
    "log"
    "net/http"

    "github.com/coreos/go-oidc/v3/oidc"
    "golang.org/x/oauth2"
)

func main() {
    ctx := context.Background()
    provider, err := oidc.NewProvider(ctx, "https://your-authorizer.example")
    if err != nil {
        log.Fatal(err)
    }
    verifier := provider.Verifier(&oidc.Config{ClientID: "my-app"})

    cfg := oauth2.Config{
        ClientID:     "my-app",
        ClientSecret: "your-client-secret",
        RedirectURL:  "http://localhost:8000/callback",
        Endpoint:     provider.Endpoint(),
        Scopes:       []string{oidc.ScopeOpenID, "profile", "email", "offline_access"},
    }

    http.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
        http.Redirect(w, r, cfg.AuthCodeURL("state-token"), http.StatusFound)
    })

    http.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
        token, err := cfg.Exchange(ctx, r.URL.Query().Get("code"))
        if err != nil {
            http.Error(w, err.Error(), 500)
            return
        }
        rawIDToken := token.Extra("id_token").(string)
        idToken, err := verifier.Verify(ctx, rawIDToken)
        if err != nil {
            http.Error(w, err.Error(), 500)
            return
        }
        var claims struct {
            Email string `json:"email"`
            Sub   string `json:"sub"`
        }
        idToken.Claims(&claims)
        json.NewEncoder(w).Encode(claims)
    })

    log.Fatal(http.ListenAndServe(":8000", nil))
}
```

#### Python / FastAPI backend (using `authlib`)

```bash
pip install authlib fastapi uvicorn itsdangerous
```

```python
from fastapi import FastAPI, Request
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="change-me")

oauth = OAuth()
oauth.register(
    name="authorizer",
    server_metadata_url="https://your-authorizer.example/.well-known/openid-configuration",
    client_id="my-app",
    client_secret="your-client-secret",
    client_kwargs={"scope": "openid profile email offline_access"},
)

@app.get("/login")
async def login(request: Request):
    redirect_uri = request.url_for("callback")
    return await oauth.authorizer.authorize_redirect(request, redirect_uri)

@app.get("/callback", name="callback")
async def callback(request: Request):
    token = await oauth.authorizer.authorize_access_token(request)
    return {"claims": token.get("userinfo")}
```

#### Mobile (Flutter)

Use the official Flutter SDK:

```dart
dependencies:
  authorizer_flutter: ^latest
```

See the [Flutter SDK docs](../sdks/authorizer-flutter) for the full API.

#### Other frameworks

Any framework with an OIDC library will work — ASP.NET Core (`Microsoft.AspNetCore.Authentication.OpenIdConnect`), Spring Boot (`spring-security-oauth2-client`), Rails (`omniauth_openid_connect`), Laravel (`socialite-providers/openid`), and so on. Point them at the Discovery URL and set `client_id` / `client_secret`.

---

## Integrating Authorizer with an Existing SSO

If you already run a commercial or enterprise SSO (Auth0, Okta, Keycloak, Azure AD, Ping) and want to add Authorizer as an **upstream identity source**, every major platform supports this via OIDC federation. Authorizer behaves like any other third-party OIDC provider.

Typical reasons to do this:

- **Bring-your-own-identity for a customer segment** — let customers on a self-hosted plan authenticate via Authorizer while everyone else uses your primary SSO.
- **Cost offload** — route high-volume, low-margin users through Authorizer to avoid per-MAU billing on your main SSO.
- **Private-label multi-tenancy** — each tenant runs their own Authorizer instance, federated into a central Auth0.
- **On-premise / air-gapped** — keep sensitive identities inside a self-hosted Authorizer and federate only short-lived tokens out.

### Auth0: Add Authorizer as an Enterprise OIDC Connection

Auth0 calls third-party OIDC identity providers **Enterprise Connections**.

1. **Register Auth0 as an Authorizer client.** In your Authorizer instance, set the `--client-id` and `--client-secret` that Auth0 will use, and include Auth0's callback URL in `--allowed-origins`:

   ```bash
   ./build/server \
     --client-id=auth0-upstream \
     --client-secret="$(openssl rand -hex 32)" \
     --allowed-origins=https://YOUR_TENANT.auth0.com
   ```

   Auth0's OIDC callback URL will be `https://YOUR_TENANT.auth0.com/login/callback` — add that to `--allowed-origins`.

2. **In Auth0 Dashboard → Authentication → Enterprise → OpenID Connect → Create Connection**, fill in:

   - **Connection Name**: e.g. `authorizer`
   - **Issuer URL**: `https://your-authorizer.example` — Auth0 fetches `/.well-known/openid-configuration` automatically
   - **Client ID**: `auth0-upstream` (the value you configured in step 1)
   - **Client Secret**: the secret from step 1
   - **Type**: Back Channel (authorization code flow with client_secret)
   - **Scopes**: `openid profile email`
   - Enable **Sync user profile attributes at each login**

3. **Enable the connection for your Auth0 applications.** Under the connection → Applications tab, toggle on each Auth0 app that should see the new IdP.

4. **Test.** Open an Auth0 Universal Login page — you should see a new button labeled `authorizer` (or whatever you named the connection). Clicking it redirects through Authorizer and lands back on your Auth0 app as a normal Auth0 user.

**What Auth0 does under the hood:** it calls Authorizer's `/authorize` endpoint with a code-flow request, exchanges the code at `/oauth/token`, verifies the ID token via `/.well-known/jwks.json`, and calls `/userinfo` to populate the Auth0 user profile. All of these endpoints are implemented by Authorizer.

### Okta: Add Authorizer as an Identity Provider

Okta's equivalent feature is called **Identity Providers**.

1. Register Okta's callback URL in Authorizer's `--allowed-origins`: `https://YOUR_OKTA_DOMAIN/oauth2/v1/authorize/callback`
2. In Okta Admin Console → **Security → Identity Providers → Add Identity Provider → OpenID Connect IdP**:
   - **IdP Type**: OIDC
   - **Client ID** / **Client Secret**: the Authorizer client credentials
   - **Scopes**: `openid profile email`
   - **Issuer**: `https://your-authorizer.example`
   - **Authorization endpoint**: copy from Authorizer's discovery document
   - **Token endpoint**, **JWKS endpoint**, **UserInfo endpoint**: copy from discovery
   - **Authentication type**: `Client Secret`
3. Add a **Routing Rule** so the IdP appears on the Okta sign-in page.
4. Test by visiting the Okta sign-in page — the new IdP button appears.

### Keycloak: Add Authorizer as an Identity Provider

Keycloak's equivalent is **Identity Providers** as well.

1. Register Keycloak's callback URL: `https://YOUR_KEYCLOAK/realms/YOUR_REALM/broker/authorizer/endpoint`
2. In Keycloak Admin → **Identity Providers → Add provider → OpenID Connect v1.0**:
   - **Alias**: `authorizer`
   - **Discovery endpoint**: `https://your-authorizer.example/.well-known/openid-configuration` — click **Import** to autofill the rest
   - **Client ID** / **Client Secret**: the Authorizer client credentials
   - **Default Scopes**: `openid profile email`
3. Save. The new IdP will appear on the Keycloak login page.

### Azure AD B2C / Microsoft Entra External ID

Microsoft Entra External ID supports custom OIDC identity providers. In **Identity Providers → New OpenID Connect provider**, supply the Authorizer metadata URL, client ID, and client secret. Map the `sub` claim to `issuerUserId` and `email` to `email`.

### Generic pattern

Any SSO product that supports OIDC federation uses the same inputs:

| Input                    | Value                                                         |
|--------------------------|---------------------------------------------------------------|
| Issuer / Discovery URL   | `https://your-authorizer.example/.well-known/openid-configuration` |
| Client ID                | Set via `--client-id` on Authorizer                           |
| Client Secret            | Set via `--client-secret` on Authorizer                       |
| Scopes                   | `openid profile email` (+ `offline_access` if you need refresh) |
| Redirect / Callback URL  | Provided by the downstream SSO — must be added to Authorizer's `--allowed-origins` |
| Signing algorithm        | Whatever `--jwt-type` is set to (prefer RSA/ECDSA)            |

---

## Endpoint Reference

### OpenID Connect Discovery

**Endpoint:** `GET /.well-known/openid-configuration`
**Spec:** [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)

Returns metadata so clients can auto-configure themselves.

**Selected response fields:**

| Field                                                 | Value / Notes                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `issuer`                                              | Base URL of the Authorizer instance                                                  |
| `authorization_endpoint`                              | URL for `/authorize`                                                                 |
| `token_endpoint`                                      | URL for `/oauth/token`                                                               |
| `userinfo_endpoint`                                   | URL for `/userinfo`                                                                  |
| `jwks_uri`                                            | URL for `/.well-known/jwks.json`                                                     |
| `introspection_endpoint`                              | URL for `/oauth/introspect`                                                          |
| `revocation_endpoint`                                 | URL for `/oauth/revoke`                                                              |
| `end_session_endpoint`                                | URL for `/logout`                                                                    |
| `response_types_supported`                            | `["code", "token", "id_token", "code id_token", "code token", "code id_token token", "id_token token"]` |
| `grant_types_supported`                               | `["authorization_code", "refresh_token", "implicit"]`                                |
| `scopes_supported`                                    | `["openid", "email", "profile", "offline_access"]`                                   |
| `response_modes_supported`                            | `["query", "fragment", "form_post", "web_message"]`                                  |
| `code_challenge_methods_supported`                    | `["S256"]`                                                                           |
| `id_token_signing_alg_values_supported`               | Includes configured `--jwt-type` and always `RS256`                                  |
| `token_endpoint_auth_methods_supported`               | `["client_secret_basic", "client_secret_post"]`                                      |
| `introspection_endpoint_auth_methods_supported`       | `["client_secret_basic", "client_secret_post"]`                                      |
| `revocation_endpoint_auth_methods_supported`          | `["client_secret_basic", "client_secret_post"]`                                      |
| `claims_supported`                                    | Includes `sub`, `iss`, `aud`, `exp`, `iat`, `auth_time`, `amr`, `acr`, `at_hash`, `c_hash`, `nonce`, `email`, `email_verified`, `given_name`, `family_name`, profile claims |
| `backchannel_logout_supported`                        | `true` iff `--backchannel-logout-uri` is configured                                  |
| `backchannel_logout_session_supported`                | Same as above                                                                        |

```bash
curl https://your-authorizer.example/.well-known/openid-configuration
```

### Authorization Endpoint

**Endpoint:** `GET /authorize`
**Specs:** [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749) | [RFC 7636 (PKCE)](https://www.rfc-editor.org/rfc/rfc7636) | [OIDC Core 1.0 §3](https://openid.net/specs/openid-connect-core-1_0.html#Authentication)

Supported flows: Authorization Code (with PKCE), Implicit, Hybrid.

**Request parameters:**

| Parameter                | Required                    | Notes                                                                                 |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------- |
| `client_id`              | Yes                         | Your application's client ID                                                          |
| `response_type`          | Yes                         | Any supported single or hybrid combination (see discovery)                            |
| `state`                  | Yes                         | Anti-CSRF token (opaque string). Mandatory in Authorizer                              |
| `redirect_uri`           | No                          | Must match an allowed origin; defaults to `/app`                                      |
| `scope`                  | No                          | Space-separated. Default: `openid profile email`                                      |
| `response_mode`          | No                          | `query`, `fragment`, `form_post`, `web_message`. Hybrid flows forbid `query`          |
| `code_challenge`         | Yes, when `code` is in type | PKCE challenge: `BASE64URL(SHA256(code_verifier))`                                    |
| `code_challenge_method`  | No                          | Only `S256` is supported; defaults to `S256`                                          |
| `nonce`                  | Recommended                 | Binds ID token to session; required per OIDC when `response_type` includes `id_token` |
| `prompt`                 | No                          | `none`, `login`, `consent`, `select_account` (last two are parsed but no-op)          |
| `max_age`                | No                          | Seconds; `0` forces re-auth; positive values force re-auth if session is older        |
| `login_hint`             | No                          | Pre-fills the email field on the login UI                                             |
| `ui_locales`             | No                          | Forwarded to the login UI as a query parameter                                        |
| `id_token_hint`          | No                          | Advisory ID token; invalid hints are ignored (never cause the request to fail)        |
| `screen_hint`            | No                          | Authorizer extension: `signup` redirects to the signup page                           |

**Example authorization code request:**

```
GET /authorize?
  client_id=YOUR_CLIENT_ID
  &response_type=code
  &state=RANDOM_STATE
  &code_challenge=BASE64URL_SHA256_OF_VERIFIER
  &code_challenge_method=S256
  &redirect_uri=https://yourapp.com/callback
  &scope=openid%20profile%20email%20offline_access
```

**Example hybrid request (OIDC Core §3.3):**

```
GET /authorize?
  client_id=YOUR_CLIENT_ID
  &response_type=code%20id_token
  &state=RANDOM_STATE
  &nonce=RANDOM_NONCE
  &code_challenge=BASE64URL_SHA256_OF_VERIFIER
  &code_challenge_method=S256
  &redirect_uri=https://yourapp.com/callback
  &scope=openid%20profile%20email
  &response_mode=fragment
```

The response fragment contains **both** `code=` and `id_token=` in a single round trip.

### Token Endpoint

**Endpoint:** `POST /oauth/token`
**Specs:** [RFC 6749 §3.2](https://www.rfc-editor.org/rfc/rfc6749#section-3.2) | [RFC 7636 §4.6](https://www.rfc-editor.org/rfc/rfc7636#section-4.6)

Exchanges an authorization code or refresh token for access / ID tokens.

**Content-Type:** `application/x-www-form-urlencoded` or `application/json`
**Response headers:** `Cache-Control: no-store`, `Pragma: no-cache` (RFC 6749 §5.1)

**Authorization Code grant:**

| Parameter       | Required | Notes                                                   |
| --------------- | -------- | ------------------------------------------------------- |
| `grant_type`    | Yes      | `authorization_code`                                    |
| `code`          | Yes      | The authorization code from `/authorize`                |
| `code_verifier` | Yes\*    | PKCE verifier (43–128 chars)                            |
| `client_id`     | Yes      | Your client ID                                          |
| `client_secret` | Yes\*    | Required if `code_verifier` is not provided             |

\*Either `code_verifier` or `client_secret` is required. Client authentication may also be sent via HTTP Basic Auth.

**Refresh Token grant:**

| Parameter       | Required | Notes                                          |
| --------------- | -------- | ---------------------------------------------- |
| `grant_type`    | Yes      | `refresh_token`                                |
| `refresh_token` | Yes      | A valid refresh token                          |
| `client_id`     | Yes      | Your client ID                                 |

Refresh tokens are **rotated** on each use — the old one is invalidated and a new one returned.

**Success response:**

```json
{
  "access_token": "eyJhbG...",
  "token_type": "Bearer",
  "id_token": "eyJhbG...",
  "expires_in": 1800,
  "scope": "openid profile email",
  "refresh_token": "eyJhbG..."
}
```

**Error response:**

```json
{ "error": "invalid_grant", "error_description": "..." }
```

Standard codes: `invalid_request`, `invalid_client`, `invalid_grant`, `unsupported_grant_type`, `invalid_scope`.

### UserInfo Endpoint

**Endpoint:** `GET /userinfo`
**Specs:** [OIDC Core §5.3](https://openid.net/specs/openid-connect-core-1_0.html#UserInfo) | [OIDC Core §5.4 (scope-based claim filtering)](https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims) | [RFC 6750 (Bearer Token)](https://www.rfc-editor.org/rfc/rfc6750)

Returns claims about the authenticated end-user, **filtered by the scopes encoded in the access token**.

```bash
curl -H "Authorization: Bearer ACCESS_TOKEN" https://your-authorizer.example/userinfo
```

**Scope → claim mapping** (OIDC Core §5.4):

| Scope     | Claims returned in addition to `sub`                                                                                          |
|-----------|-------------------------------------------------------------------------------------------------------------------------------|
| `profile` | `name`, `family_name`, `given_name`, `middle_name`, `nickname`, `preferred_username`, `profile`, `picture`, `website`, `gender`, `birthdate`, `zoneinfo`, `locale`, `updated_at` |
| `email`   | `email`, `email_verified`                                                                                                     |
| `phone`   | `phone_number`, `phone_number_verified`                                                                                       |
| `address` | `address`                                                                                                                     |

The `sub` claim is **always** returned per OIDC Core §5.3.2. Keys belonging to a granted scope group are always present in the response; if the user has no value for a specific claim, the key is emitted with JSON `null` (explicitly permitted by §5.3.2) so callers can rely on a stable schema.

**Error response (RFC 6750 §3):**

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="authorizer", error="invalid_token", error_description="The access token is invalid or has expired"
```

### Token Introspection

**Endpoint:** `POST /oauth/introspect`
**Spec:** [RFC 7662 (OAuth 2.0 Token Introspection)](https://www.rfc-editor.org/rfc/rfc7662)

Used by resource servers and API gateways to validate tokens without re-implementing JWT verification.

**Content-Type:** `application/x-www-form-urlencoded`
**Response headers:** `Cache-Control: no-store`, `Pragma: no-cache`

**Client authentication:** `client_secret_basic` (HTTP Basic) or `client_secret_post` (form body).

**Request parameters:**

| Parameter         | Required | Notes                                          |
| ----------------- | -------- | ---------------------------------------------- |
| `token`           | Yes      | The token to introspect                        |
| `token_type_hint` | No       | `access_token`, `refresh_token`, or `id_token` (unknown hints are ignored, not rejected) |
| `client_id`       | Yes      | When not using HTTP Basic                      |
| `client_secret`   | Yes      | When not using HTTP Basic                      |

**Active token response:**

```json
{
  "active": true,
  "scope": "openid profile email",
  "client_id": "my-app",
  "exp": 1712500000,
  "iat": 1712496400,
  "sub": "user-uuid",
  "aud": "my-app",
  "iss": "https://your-authorizer.example",
  "token_type": "access_token"
}
```

**Inactive token response:**

```json
{ "active": false }
```

Per RFC 7662 §2.2, the inactive response **never** contains any other fields — no `error`, no `error_description`, no claim leakage. A missing/expired/revoked/wrong-audience token all look identical to the client.

### Token Revocation

**Endpoint:** `POST /oauth/revoke`
**Spec:** [RFC 7009](https://www.rfc-editor.org/rfc/rfc7009)

Revokes a refresh token. Per RFC 7009 §2.2, returns HTTP 200 even for invalid or already-revoked tokens (prevents token scanning).

| Parameter         | Required | Notes                                   |
| ----------------- | -------- | --------------------------------------- |
| `token`           | Yes      | The refresh token to revoke             |
| `token_type_hint` | No       | `refresh_token` or `access_token`       |
| `client_id`       | Yes      | Your client ID (or via HTTP Basic)      |

### JWKS

**Endpoint:** `GET /.well-known/jwks.json`
**Spec:** [RFC 7517](https://www.rfc-editor.org/rfc/rfc7517)

Public signing keys for JWT verification. Supports RSA (`RS256/384/512`), ECDSA (`ES256/384/512`), and HMAC. **HMAC secrets are never exposed** — the array is empty in HMAC-only configurations.

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "your-client-id",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

#### Manual key rotation

Authorizer supports a zero-downtime manual key-rotation workflow via four optional secondary-key flags:

- `--jwt-secondary-type`
- `--jwt-secondary-secret`
- `--jwt-secondary-private-key`
- `--jwt-secondary-public-key`

When a secondary key is configured, JWKS publishes **both** public keys with distinct `kid`s (the secondary gets a `-secondary` suffix). The signing path always uses the primary key; verification tries the primary first and falls back to the secondary.

**Rotation workflow:**

1. Operator adds a new key as `--jwt-secondary-*` and restarts
2. JWKS now publishes both keys; both can verify existing tokens
3. Operator swaps: new key becomes primary (`--jwt-*`), old key becomes secondary (`--jwt-secondary-*`), restart
4. Outstanding tokens signed by the now-secondary key keep working
5. After all outstanding tokens expire, operator removes the `--jwt-secondary-*` flags and restarts

Automated time-based rotation is a future roadmap item.

### Logout (RP-Initiated)

**Endpoint:** `GET /logout` or `POST /logout`
**Spec:** [OIDC RP-Initiated Logout 1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)

| Parameter                   | Notes                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `post_logout_redirect_uri`  | Preferred (OIDC spec name). Must be in `--allowed-origins`                                  |
| `redirect_uri`              | Legacy alias — accepted as fallback                                                         |
| `state`                     | Echoed on the final redirect per §3                                                         |
| `id_token_hint`             | Proves the request comes from a real authenticated session (CSRF defense for GET)          |

**GET without `id_token_hint`** renders an HTML confirmation page — the actual session deletion only happens via the subsequent POST. This prevents `<img src="/logout">` attacks.

### Back-Channel Logout (opt-in)

**Spec:** [OIDC Back-Channel Logout 1.0](https://openid.net/specs/openid-connect-backchannel-1_0.html)

When the server is started with `--backchannel-logout-uri=https://your-rp.example/bcl`, every successful `/logout` fires a signed `logout_token` JWT via HTTP POST to that URL (fire-and-forget, 5-second timeout).

**`logout_token` claims:**

- `iss`, `aud`, `iat`, `exp` (+5 minutes), `jti` (UUID)
- `sub` (user ID), `sid` (session identifier)
- `events`: `{"http://schemas.openid.net/event/backchannel-logout": {}}`
- **`nonce` is deliberately absent** (explicitly prohibited by §2.4)

The `logout_token` is signed with the same key as ID tokens, so the receiver verifies it via the same JWKS endpoint. Discovery advertises `backchannel_logout_supported: true` when the URI is configured.

---

## PKCE Guide

PKCE ([RFC 7636](https://www.rfc-editor.org/rfc/rfc7636)) is required for the authorization code flow and prevents authorization code interception attacks.

### 1. Generate a code verifier

A random string of 43–128 characters from `[A-Za-z0-9-._~]`:

```javascript
const codeVerifier = generateRandomString(43);
```

```bash
# Bash equivalent
openssl rand -base64 48 | tr -d '=+/' | cut -c1-64
```

### 2. Create a code challenge

```javascript
const hash = await crypto.subtle.digest(
  "SHA-256",
  new TextEncoder().encode(codeVerifier),
);
const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");
```

```bash
# Bash equivalent
printf '%s' "$CODE_VERIFIER" | openssl dgst -binary -sha256 | openssl base64 | tr -d '=' | tr '/+' '_-'
```

### 3. Send it on `/authorize`

```
GET /authorize?response_type=code&code_challenge=CHALLENGE&code_challenge_method=S256&...
```

### 4. Exchange at `/oauth/token`

```
POST /oauth/token
grant_type=authorization_code&code=AUTH_CODE&code_verifier=CODE_VERIFIER&client_id=CLIENT_ID
```

---

## Testing Guide

A practical, copy-paste-able checklist for verifying your Authorizer instance works against every OIDC spec it implements.

### Prerequisites

```bash
export AUTHORIZER_URL="http://localhost:8080"
export CLIENT_ID="your-client-id"
export CLIENT_SECRET="your-client-secret"
```

You will need `curl`, `jq`, `openssl`, and a web browser.

### 1. Discovery

```bash
curl -s $AUTHORIZER_URL/.well-known/openid-configuration | jq
```

**Check:** `issuer` matches `$AUTHORIZER_URL`; `response_types_supported` contains the hybrid combinations; `introspection_endpoint` is present; `registration_endpoint` is absent; `backchannel_logout_supported` is `true` iff the flag is set.

### 2. JWKS

```bash
curl -s $AUTHORIZER_URL/.well-known/jwks.json | jq
```

**Check:** HTTP 200; RSA/ECDSA keys include `kty`, `alg`, `kid`, `use: "sig"`; HMAC-only configs return `keys: []`; multi-key configs return two keys with distinct `kid`s.

### 3. Authorization Code + PKCE (end-to-end)

```bash
# 1. Generate verifier + challenge
CODE_VERIFIER=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-64)
CODE_CHALLENGE=$(printf '%s' "$CODE_VERIFIER" | openssl dgst -binary -sha256 | openssl base64 | tr -d '=' | tr '/+' '_-')
STATE=$(openssl rand -hex 16)

# 2. Print the URL to open in a browser
echo "$AUTHORIZER_URL/authorize?client_id=$CLIENT_ID&response_type=code&redirect_uri=http://localhost:3000/callback&scope=openid%20profile%20email%20offline_access&state=$STATE&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&response_mode=query"
```

After logging in and copying the `code` from the redirect:

```bash
CODE="paste-code-here"

curl -s -X POST $AUTHORIZER_URL/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=$CODE" \
  -d "code_verifier=$CODE_VERIFIER" \
  -d "client_id=$CLIENT_ID" \
  -d "redirect_uri=http://localhost:3000/callback" | jq
```

**Check:**

- HTTP 200 with `Cache-Control: no-store` header
- Response contains `access_token`, `id_token`, `refresh_token`, `token_type: "Bearer"`, `expires_in`, `scope`
- ID token payload (decode via [jwt.io](https://jwt.io)) contains: `iss`, `aud`, `sub`, `exp`, `iat`, `auth_time`, `amr`, `acr="0"`, `at_hash`, and `nonce` if supplied

**Verify `at_hash` manually:**

```bash
ACCESS_TOKEN="paste-access-token-here"
printf '%s' "$ACCESS_TOKEN" | openssl dgst -binary -sha256 | head -c 16 | openssl base64 | tr -d '=' | tr '/+' '_-'
```

Must equal the `at_hash` claim in the ID token.

**Refresh the token:**

```bash
REFRESH_TOKEN="paste-refresh-token-here"

curl -s -X POST $AUTHORIZER_URL/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=$REFRESH_TOKEN" \
  -d "client_id=$CLIENT_ID" | jq
```

**Check:** new tokens returned; the new refresh token differs from the old; the old refresh token no longer works (rotation).

**Revoke the refresh token:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST $AUTHORIZER_URL/oauth/revoke \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "token=$REFRESH_TOKEN" \
  -d "client_id=$CLIENT_ID" \
  -d "token_type_hint=refresh_token"
# Must print 200
```

### 4. UserInfo scope filtering

```bash
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" $AUTHORIZER_URL/userinfo | jq
```

Run the authorization code flow three times with different scope sets and observe:

- `scope=openid` → response is `{"sub": "..."}`
- `scope=openid email` → adds `email`, `email_verified`
- `scope=openid profile email` → adds the full profile claim group

### 5. Token Introspection

```bash
curl -s -u "$CLIENT_ID:$CLIENT_SECRET" -X POST $AUTHORIZER_URL/oauth/introspect \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "token=$ACCESS_TOKEN" | jq
```

**Check:** active token returns `active: true` + full claim set. Invalid token returns **exactly** `{"active": false}` with no leakage. Wrong client secret via HTTP Basic returns 401 with `WWW-Authenticate: Basic`.

### 6. Hybrid flow

```bash
# This MUST be rejected (query mode forbidden for hybrid per OIDC Core §3.3.2.5)
curl -sG $AUTHORIZER_URL/authorize \
  --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode "response_type=code id_token" \
  --data-urlencode "response_mode=query" \
  --data-urlencode "state=$STATE" \
  --data-urlencode "code_challenge=$CODE_CHALLENGE" | jq
# {"error": "invalid_request", ...}
```

Full hybrid flow via browser:

```
$AUTHORIZER_URL/authorize?client_id=$CLIENT_ID&response_type=code%20id_token&redirect_uri=http://localhost:3000/callback&scope=openid%20profile%20email&state=$STATE&nonce=N&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256
```

**Check:** redirect fragment contains **both** `code=` and `id_token=`; the ID token payload includes a `c_hash` claim (OIDC Core §3.3.2.11).

### 7. Authorization request parameters

- **`prompt=none` with no session** must redirect with `error=login_required` (not render the login UI)
- **`prompt=login` with a session** bypasses the session cookie and shows the login UI
- **`max_age=0`** is equivalent to `prompt=login`
- **`login_hint=alice@example.com`** pre-fills the email field

### 8. Back-channel logout

Start a local receiver and set `--backchannel-logout-uri` pointed at it:

```bash
# Terminal 1: receiver
python3 -c "
from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.parse, base64, json

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers['Content-Length'])).decode()
        form = urllib.parse.parse_qs(body)
        payload = form['logout_token'][0].split('.')[1]
        payload += '=' * (-len(payload) % 4)
        print(json.dumps(json.loads(base64.urlsafe_b64decode(payload)), indent=2))
        self.send_response(200); self.end_headers()

HTTPServer(('127.0.0.1', 9999), H).serve_forever()
"

# Terminal 2: start Authorizer with --backchannel-logout-uri=http://127.0.0.1:9999/bcl

# Terminal 3: sign in through the dashboard, then log out
```

**Check in receiver output:** `iss`, `aud`, `sub`, `sid`, `jti`, `iat`, `exp`, `events` containing the BCL event key, and — critically — `nonce` is **absent**.

### 9. Social SSO providers

1. Register the provider on its console (Google, GitHub, etc.), using `$AUTHORIZER_URL/oauth_callback/<provider>` as the callback
2. Configure the provider in Authorizer: `--google-client-id`, `--google-client-secret`, etc.
3. Restart Authorizer — the login page auto-shows the new button
4. Test: visit `$AUTHORIZER_URL/oauth_login/google?redirectURL=http://localhost:3000/callback&state=$STATE`
5. Verify the resulting ID token has `amr: ["fed"]` (federated authentication)

### 10. Automated conformance testing

For pre-production validation, run a full OIDC conformance suite:

- **[OpenID Foundation Conformance Suite](https://openid.net/certification/instructions/)** — gold-standard; run the **Basic OP**, **Hybrid OP**, and **Introspection** test profiles.
- **[oidcdebugger.com](https://oidcdebugger.com/)** — lightweight in-browser authorization endpoint test harness.
- **[jwt.io](https://jwt.io)** — decode and verify ID tokens against your JWKS.

---

## Common Issues

| Symptom                                           | Likely cause                                                                                       |
|---------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `invalid_grant` on `/oauth/token`                 | Code already used, expired, or `code_verifier` doesn't match the original `code_challenge`         |
| `invalid_request` on `/authorize`                 | Missing `state`; or `response_mode=query` with a hybrid `response_type` (forbidden by OIDC Core §3.3.2.5) |
| `/userinfo` returns only `{"sub":"..."}`          | Working as designed — request `scope=openid profile email` to receive profile and email claims     |
| `unsupported_response_type`                       | `response_type` value not in the discovery document's `response_types_supported`                   |
| ID token signature verification fails             | JWKS returns a different key than the one used to sign. Check `--jwt-type` and key configuration   |
| Social login callback shows `state mismatch`      | Cookies blocked, third-party-cookie restrictions, or session cookie expired between redirects      |
| Back-channel logout never fires                   | `--backchannel-logout-uri` not set, or receiver unreachable within 5 seconds                       |
| Auth0 Enterprise OIDC connection can't discover   | Wrong Issuer URL — must be exactly `https://your-authorizer.example` (no trailing slash, no path)  |
| `redirect_uri` rejected                           | Not in `--allowed-origins`. The debug-level log message names the exact URI that was rejected      |

## Debugging Tips

- **Always check the discovery endpoint first.** Almost every OIDC problem is a configuration mismatch and discovery is the cheapest place to spot it.
- **Decode your tokens** at [jwt.io](https://jwt.io) before debugging further — the claims tell you a lot.
- **Enable debug logging** with `--log-level=debug` to see every OIDC decision, including which scope groups were filtered out of `/userinfo` and why a `prompt=none` request returned `login_required`.
- **Verify clock skew.** If `exp` or `iat` validation is failing, ensure your server and client clocks are within 60 seconds.
- **Audit `--allowed-origins`.** `/authorize` rejects unknown `redirect_uri` values with `invalid_request`.
