---
sidebar_position: 4
title: SurrealDB
description: "Use Authorizer as SurrealDB's external identity provider so table permissions use token claims and the client talks to SurrealDB directly."
---

# Using Authorizer with SurrealDB

[SurrealDB](https://surrealdb.com) can verify tokens issued by an external identity provider and use their claims in table permissions. This guide sets up Authorizer as that provider, so a client-side application can use SurrealDB as its only backend: users sign in with Authorizer, and SurrealDB only lets each user read and write their own records.

:::info Requires Authorizer v2.4.8 or later
SurrealDB selects the verification key by the token's `kid` header. Authorizer adds a `kid` to every RS256/ES256 token from v2.4.8. With an earlier version SurrealDB refuses every token with `401`; its debug log (`--log debug`) shows `Missing token header 'kid'`.
:::

## Using SurrealDB as Authorizer's database too

Authorizer can also keep its own data — users, sessions, clients, organizations — in SurrealDB with `--database-type=surrealdb` (see [Databases](../core/databases)). Point both at the same SurrealDB and your identities, auth data and application data live in one database, backed up together. Authorizer's tables use the `authorizer_` prefix, so they sit alongside yours.

## How it works

1. The user signs in with Authorizer and receives an access token.
2. The application sends the token to SurrealDB, with the SDK's `authenticate()` or an `Authorization: Bearer` header.
3. SurrealDB finds the access method named by the token's `ns`, `db` and `ac` claims, and verifies the signature against Authorizer's JWKS at `/.well-known/jwks.json`.
4. The access method's `AUTHENTICATE` block checks the issuer, audience and verified email, and returns the user's record.
5. Table `PERMISSIONS` apply to every query in that session.

## Step 1: Configure Authorizer

Authorizer must sign tokens with an asymmetric key: `--jwt-type=RS256` (or `ES256`) with `--jwt-private-key` and `--jwt-public-key`. HMAC keys (`HS256`) are never published in the JWKS, so SurrealDB cannot verify tokens signed with them.

SurrealDB needs the namespace, database and access method in the token. Add them with a [custom access token script](../core/server-config):

```bash
--custom-access-token-script='function(user, tokenPayload) {
  return {
    ns: "main",            // namespace used in DEFINE ACCESS
    db: "main",            // database used in DEFINE ACCESS
    ac: "authorizer",      // name of the access method
    email: user.email,
    email_verified: user.email_verified
  };
}'
```

Every access token already carries `iss` (your `--url`), `aud` and `client_id` (your `--client-id`), `sub` (the user ID), `exp` and `roles`.

Add your application's origin to `--allowed-origins` (for example `--allowed-origins=https://app.example.com`). With the default, `*`, Authorizer accepts sign-in requests only from its own origin and refuses the rest with `403 Origin not allowed`.

## Step 2: Configure SurrealDB

Start SurrealDB with network access to Authorizer, so it can download the JWKS:

```bash
surreal start --user root --pass secret --allow-net auth.example.com
```

:::caution Private networks
SurrealDB also checks the IP address the host resolves to. If Authorizer runs on a private network (for example as another container), allow that address too: `--allow-net auth.internal,10.0.0.12`. If the JWKS cannot be downloaded, every token is refused with 401, and SurrealDB logs the reason, for example `Access to network target '10.0.0.12/32' is not allowed`.
:::

Then define a table and the access method:

```sql
USE NS main DB main;

-- Each user can only see and change their own record.
DEFINE TABLE user SCHEMAFULL
  PERMISSIONS FOR select, update, delete, create
  WHERE $access = "authorizer" AND id = $auth;
DEFINE FIELD email ON user TYPE string ASSERT string::is_email($value);
DEFINE INDEX email ON user FIELDS email UNIQUE;
DEFINE FIELD nickname ON user TYPE option<string>;

DEFINE ACCESS authorizer ON DATABASE TYPE RECORD
  WITH JWT URL "https://auth.example.com/.well-known/jwks.json"
  AUTHENTICATE {
    IF (
      $token.iss = "https://auth.example.com"
      AND $token.aud = "<YOUR_CLIENT_ID>"
      AND $token.email_verified = true
    ) {
      -- The record is keyed by the Authorizer user ID, which never changes.
      LET $user = type::record("user", $token.sub);
      -- Create it the first time this user authenticates.
      IF !record::exists($user) {
        CREATE $user SET email = $token.email;
      };
      RETURN $user;
    }
  };
```

Replace `https://auth.example.com` with your Authorizer URL and `<YOUR_CLIENT_ID>` with your client ID.

### Role-based permissions

The `roles` claim can be used directly in permissions. Here every signed-in user can read posts, but only users with the `admin` role can write them:

```sql
DEFINE TABLE post SCHEMAFULL
  PERMISSIONS
    FOR select WHERE $access = "authorizer"
    FOR create, update, delete WHERE $access = "authorizer" AND $token.roles CONTAINS "admin";
DEFINE FIELD title ON post TYPE string;
```

## Step 3: Sign in and query

```ts
import { Authorizer } from '@authorizerdev/authorizer-js';
import { Surreal } from 'surrealdb';

const authorizer = new Authorizer({
  authorizerURL: 'https://auth.example.com',
  redirectURL: window.location.origin,
  clientID: '<YOUR_CLIENT_ID>',
});

const { data, errors } = await authorizer.login({ email, password });
if (errors.length) throw errors[0];

const db = new Surreal();
await db.connect('wss://your-surrealdb.example.com');
await db.authenticate(data.access_token);

// One result per statement. The first holds only the signed-in user's own record.
const [users] = await db.query('SELECT * FROM user');
```

`login()` returns a token only once sign-in is complete. If the user has set up multi-factor authentication, or Authorizer is offering to set it up, the response asks for that step first; the [hosted login page](../core/oauth2-oidc) handles it for you.

Or over HTTP:

```bash
curl -X POST https://your-surrealdb.example.com/sql \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data-binary 'SELECT * FROM user;'
```

## Notes

- **Sign-out and revocation:** SurrealDB verifies tokens on its own and does not ask Authorizer whether a session is still active. Signing out stops new tokens being issued, but a token already in use stays valid until it expires. Access tokens last 30 minutes; refresh them with the SDK.
- **Key rotation:** SurrealDB caches the JWKS for up to 12 hours and downloads it again for an unknown `kid` at most once every 5 minutes. During a [manual key rotation](../core/oauth2-oidc#manual-key-rotation) this means:
  - after Authorizer starts signing with the new key, SurrealDB can refuse tokens signed with it for up to 5 minutes;
  - a key you remove from Authorizer stays trusted by SurrealDB until its cache is replaced, up to 12 hours. Its tokens still expire after 30 minutes, so this matters only for a compromised key: restart SurrealDB to empty the cache.

  Both periods are set with SurrealDB's `SURREAL_JWKS_CACHE_COOLDOWN_SECONDS` and `SURREAL_JWKS_CACHE_EXPIRATION_SECONDS`. Each key's `kid` is its thumbprint and does not change when it becomes the secondary key, so tokens signed before the swap keep working.
- **Security checks:** SurrealDB rejects tokens with a tampered signature or claims, `alg: none`, and HMAC tokens forged against the published key.
