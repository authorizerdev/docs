# WebAuthn / Passkey Support Design Spec

**Date**: 2026-07-10
**Status**: Approved
**Priority**: P1 -- Auth0 parity
**Approach**: Standard WebAuthn Relying Party via `github.com/go-webauthn/webauthn`, end-user (`web/app`) scope only

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Model](#3-data-model)
4. [Ceremonies](#4-ceremonies)
5. [GraphQL API](#5-graphql-api)
6. [Frontend](#6-frontend)
7. [Security Considerations](#7-security-considerations)
8. [Testing Strategy](#8-testing-strategy)
9. [Backward Compatibility](#9-backward-compatibility)
10. [Out of Scope](#10-out-of-scope)
11. [Build Order](#11-build-order)

---

## 1. Problem Statement

Authorizer has no WebAuthn/passkey support today (confirmed by full-repo grep -- no `webauthn`/`passkey`/`fido` references in the Go backend, `web/app`, `web/dashboard`, `go.mod`, or either frontend's `package.json`). TOTP-based MFA exists and is solid, but there is no biometric (Touch ID / Face ID / Windows Hello / Android biometric) or hardware security key support, and no passwordless signup/login path. To match Auth0's actual passkey feature set, Authorizer needs:

- A passkey usable as a full passwordless, usernameless "Sign in with a passkey" method (discoverable/resident credentials)
- A passkey usable as an MFA alternative to TOTP on existing password accounts
- Passkey-only signup (no password at all)
- Multi-passkey management (add, name, list, delete) per account

## 2. Architecture Overview

```
Browser (web/app)                    authorizer-js SDK              Go backend
------------------                   ------------------              ----------
navigator.credentials.create()  <--  webauthn_registration_options -- go-webauthn.BeginRegistration
       |                                                                      |
       v                                                                      v
 attestation response           -->  webauthn_registration_verify  -- go-webauthn.FinishRegistration
                                                                              |
                                                                              v
                                                                   persist WebauthnCredential

navigator.credentials.get()     <--  webauthn_login_options        -- go-webauthn.BeginLogin
       |                                                                      |
       v                                                                      v
 assertion response              -->  webauthn_login_verify        -- lookup credential_id -> user_id,
                                                                        go-webauthn.FinishLogin,
                                                                        issue tokens (same path as login/verify_otp)
```

**Library**: `github.com/go-webauthn/webauthn` -- the standard Go WebAuthn Relying Party implementation. Handles attestation/assertion cryptographic verification per spec; we do not hand-roll any of the WebAuthn crypto.

**New package**: `internal/authenticators/webauthn/`, structured like the existing `internal/authenticators/totp/` (a `Provider` wrapping the library, dependency-injected the same way).

**Challenge storage**: WebAuthn ceremonies are two-step (options -> verify) and need a server-side challenge held between steps. Reuse `internal/memory_store` (the same KV store already used for OAuth state and the pending-MFA session), keyed per ceremony, short TTL (60s, matching the existing MFA pending-session pattern).

## 3. Data Model

New entity `WebauthnCredential`, added to `internal/storage/schemas/` and every storage provider (SQL dialects, MongoDB, ArangoDB, Cassandra/ScyllaDB, DynamoDB, Couchbase -- all 13+ backends, per the project's standing rule that schema changes must land across every provider):

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | primary key |
| `user_id` | UUID, indexed | FK to `User` |
| `credential_id` | bytes/base64, **UNIQUE, indexed** | the WebAuthn credential ID -- the only way to resolve a user during usernameless login |
| `public_key` | bytes | COSE-encoded public key |
| `sign_count` | uint32 | cloned-authenticator detection per WebAuthn spec |
| `transports` | []string | e.g. `["internal","hybrid"]` |
| `aaguid` | bytes | authenticator model identifier |
| `name` | string | user-supplied label, e.g. "MacBook Touch ID" |
| `created_at`, `updated_at`, `last_used_at` | timestamp | |

The unique index on `credential_id` is the one genuinely new storage requirement this feature introduces -- everything else follows the existing per-user child-record pattern already used for TOTP authenticators.

## 4. Ceremonies

### 4.1 Registration (attach a passkey to an account)

Applies to: adding a passkey from account settings on an existing account, or the first passkey during passkey-only signup.

1. `webauthn_registration_options` -- server calls `go-webauthn.BeginRegistration`, stores the challenge in `memory_store` keyed to the requesting session, returns the `PublicKeyCredentialCreationOptions` JSON.
2. Browser calls `navigator.credentials.create(options)`. The browser/OS handles authenticator selection -- platform (Touch ID, Face ID, Windows Hello, Android biometric) or cross-device (QR/hybrid transport) or a roaming security key -- transparently; the server does not need per-authenticator-type logic.
3. `webauthn_registration_verify` -- server retrieves the stored challenge, calls `go-webauthn.FinishRegistration`, persists a new `WebauthnCredential` row.

### 4.2 Login, usernameless (discoverable credentials)

1. `webauthn_login_options()` -- no email required. `go-webauthn.BeginLogin` with empty `allowCredentials` so the browser surfaces any resident passkey registered for this origin.
2. Browser calls `navigator.credentials.get(options)`.
3. `webauthn_login_verify` -- server extracts `credential_id` from the assertion response, looks up `WebauthnCredential.credential_id -> user_id` (the indexed lookup), verifies the signature against the stored public key via `go-webauthn.FinishLogin`, checks the account's email is verified (see [Security Considerations](#7-security-considerations)), issues tokens through the same code path `login`/`verify_otp` already use (session creation, cookies, audit log).

### 4.3 Login, MFA-alternative

Same two calls, but `webauthn_login_options(email)` is scoped to the authenticated user's own credential IDs (`allowCredentials` populated), offered after password auth succeeds -- alongside or instead of the existing `should_show_totp_screen` branch.

### 4.4 Signup, passkey-only

1. Account created via the existing signup path with no password (email + optional profile fields only).
2. Registration ceremony (4.1) runs immediately to attach the first passkey.
3. Per the locked decision below, login via that passkey is refused with a clear, distinct error until the account's email is verified -- stricter than password-based login, applied consistently as a WebAuthn-specific policy rather than changing existing password-login behavior.

## 5. GraphQL API

Self-service surface (no `_` admin prefix), mirroring the existing TOTP mutation shape:

```graphql
webauthn_registration_options(email: String): WebauthnRegistrationOptionsResponse!
webauthn_registration_verify(params: WebauthnRegistrationVerifyRequest!): Response!

webauthn_login_options(email: String): WebauthnLoginOptionsResponse!   # email omitted = usernameless
webauthn_login_verify(params: WebauthnLoginVerifyRequest!): AuthResponse!  # same response shape as login/verify_otp

webauthn_credentials: [WebauthnCredentialInfo!]!       # list caller's own passkeys
webauthn_delete_credential(id: ID!): Response!
```

`AuthResponse` is the existing type (`should_show_totp_screen`, `access_token`, etc.) -- `webauthn_login_verify` returns it unmodified so all downstream token/session/cookie logic is shared, not duplicated.

Run `make generate-graphql` after the schema addition; this regenerates gqlgen output and must be committed.

## 6. Frontend (`web/app` only)

- "Sign in with a passkey" button on the login screen using `navigator.credentials.get()` (usernameless flow).
- Account-settings section: list registered passkeys (name, created/last-used), add a new one (`navigator.credentials.create()`), rename, delete.
- `authorizer-js`: new SDK methods wrapping the 4 GraphQL operations, plus the base64url <-> `ArrayBuffer` conversion glue between the server's JSON challenge/response shapes and the browser's binary `PublicKeyCredential` objects (this encoding boundary is the fiddly part of any WebAuthn client integration; well-documented, no novel design needed).
- `web/dashboard` is explicitly untouched (see [Out of Scope](#10-out-of-scope)).

## 7. Security Considerations

- **Attestation**: `none` (privacy-preserving default recommended by the WebAuthn spec and used by virtually every consumer-facing passkey implementation) -- we are not building an enterprise attestation-allowlist feature.
- **Resident/discoverable keys**: required (`requireResidentKey: true` / `residentKey: "required"`) since usernameless login depends on them.
- **Sign-count regression**: `go-webauthn.FinishLogin` already checks the assertion's counter against the stored `sign_count` and rejects a regression (clone detection) -- must not be bypassed.
- **Email verification gate**: per the locked decision, `webauthn_login_verify` must check `user.EmailVerifiedAt != nil` before issuing tokens, returning a distinct, actionable error (not the generic invalid-credential error) -- mirrors how other verification gates in the codebase (e.g. `verify_email.go`) surface distinct errors.
- **Challenge replay**: the memory-store-held challenge must be single-use and deleted (or the whole key expired) immediately on both success and failure of `*_verify`, same pattern as `GetAndRemoveState` for OAuth.
- **Rate limiting**: `webauthn_login_verify` sits behind the existing global per-IP rate limiter; no separate per-account lockout is needed the way TOTP needed one, because a forged assertion isn't guessable the way a 6-digit OTP is -- brute force isn't a meaningful threat model here the way it was for TOTP.
- **Mandatory `security-engineer` review** before merge, per `AGENTS.md` (any change to `internal/authenticators/`, `internal/http_handlers/`, or auth-sensitive GraphQL surface).

## 8. Testing Strategy

- Unit tests for the `internal/authenticators/webauthn/` package: registration/login ceremony success and failure paths, sign-count regression rejection, challenge expiry/replay rejection.
- Integration tests (SQLite, per project convention) covering: full registration -> login round trip, usernameless login resolving the correct user from `credential_id`, MFA-alternative login scoped to the right user's credentials, email-verification gate rejecting an unverified passkey-only signup's login attempt.
- Storage-provider tests for the new `WebauthnCredential` CRUD across `TEST_DBS`.
- Live UAT (matching the pattern already used for the TOTP lockout feature in this session): drive the real registration and login ceremonies through `web/app` (or the `authorizer-react` example app) in an actual browser against a local backend, using Chrome's built-in virtual authenticator (WebAuthn testing API) since a real Touch ID/Face ID prompt cannot be automated -- confirm both the registration and usernameless-login ceremonies work end-to-end through the real GraphQL wire format, not just mocked unit tests.

## 9. Backward Compatibility

Fully additive: new table/entity, new GraphQL operations, no changes to any existing schema field, mutation signature, or login/signup response shape. Existing password and TOTP flows are untouched. A deployment that never calls the new mutations behaves exactly as it does today.

## 10. Out of Scope

- **Admin dashboard (`web/dashboard`) passkey login** -- dashboard auth is a separate `_admin_login` flow with its own session/cookie mechanism; out of scope per the locked decision, could be a future extension.
- **Trusted-device / "remember this device"** and **per-client/per-org MFA policy** -- separately flagged during the TOTP hardening work, not part of this design.
- **Enterprise attestation allowlisting** -- `none` attestation only for now.
- **OAuth generic/custom OIDC connector** -- separate design, not part of this spec.

## 11. Build Order

1. Backend: schema across all 13+ DB providers, `internal/authenticators/webauthn/` package, GraphQL schema + resolvers, `make generate-graphql`.
2. `authorizer-js`: SDK methods + binary/base64url glue.
3. `authorizer-react`: login button, account-settings passkey management UI.
4. `security-engineer` review pass.
5. Live UAT through the real browser (Chrome virtual authenticator) against a local backend, mirroring the verification rigor used for the TOTP lockout feature earlier in this program.
