---
sidebar_position: 8
title: Workload Identity
---

# Workload Identity (Secretless Client Authentication)

A [`service_account` client](../core/client-registry) normally authenticates with a stored `client_secret`. Workload identity removes the stored secret entirely: the workload authenticates at `POST /oauth/token` with a signed JWT it **already possesses** — a Kubernetes projected ServiceAccount token or a SPIFFE JWT-SVID — presented as an [RFC 7523](https://www.rfc-editor.org/rfc/rfc7523) `client_assertion`. Nothing to distribute, rotate, or leak.

The assertion works as client authentication on both machine grants: [`client_credentials`](../core/client-registry) and [token exchange](./token-exchange).

```mermaid
sequenceDiagram
    participant W as Workload
    participant A as Authorizer

    Note over W: holds a platform-issued JWT<br/>(K8s SA token / SPIFFE JWT-SVID)
    W->>A: POST /oauth/token grant_type=client_credentials<br/>client_assertion_type=...jwt-bearer<br/>client_assertion=&lt;JWT&gt;
    Note over A: iss → trusted issuer row → JWKS verify<br/>→ aud/exp/subject/replay checks
    A->>A: authenticate AS the bound service_account
    A-->>W: Authorizer access token
```

## Request

No `client_id` and no `client_secret` — the client is derived from the trusted issuer the assertion's `iss` resolves to. Presenting a `client_assertion` together with any other authentication method is rejected (RFC 6749 §2.3).

| Parameter | Value |
|-----------|-------|
| `client_assertion_type` | `urn:ietf:params:oauth:client-assertion-type:jwt-bearer` (K8s SA tokens, cloud/generic OIDC tokens) or `urn:ietf:params:oauth:client-assertion-type:jwt-spiffe` (SPIFFE JWT-SVIDs) |
| `client_assertion` | The external JWT itself |

## Trusted issuers (admin API)

An assertion is only accepted if its `iss` matches a **trusted issuer** the admin has registered and bound to a specific service account. Super-admin GraphQL operations (also on `AuthorizerAdminService` gRPC/REST):

| Operation | Type | Purpose |
|-----------|------|---------|
| `_add_trusted_issuer` | mutation | Register an issuer for a service account |
| `_update_trusted_issuer` | mutation | Update `name`, `jwks_url`, `expected_aud`, `allowed_subjects`, `is_active` |
| `_delete_trusted_issuer` | mutation | Remove the issuer |
| `_trusted_issuer` | query | Fetch one by `id` |
| `_trusted_issuers` | query | Paginated list, optionally filtered by `service_account_id` |

Fields:

| Field | Notes |
|-------|-------|
| `service_account_id` | Internal `id` of the `service_account` client this issuer authenticates |
| `issuer_url` | Must equal the assertion's `iss` claim exactly. Globally unique across all trusted issuers (including per-org SSO connections) |
| `key_source_type` | `oidc_discovery` (fetch `jwks_uri` from `{issuer_url}/.well-known/openid-configuration`) or `static_jwks_url` (fetch `jwks_url` directly — required when the issuer's discovery document is not reachable) |
| `jwks_url` | Required for `static_jwks_url` |
| `expected_aud` | The `aud` the assertion **must** contain exactly — set it to your Authorizer URL and mint tokens with that audience, so a token minted for another service can never be replayed here |
| `subject_claim` | Claim that identifies the workload; defaults to `sub` |
| `allowed_subjects` | Comma-separated **exact-match** subject allow-list. **Empty = deny-all** — a row with no subjects authenticates nobody |
| `issuer_type` | `kubernetes_sa` \| `spiffe_jwt` \| `oidc` \| `cloud_oidc` |

> JWKS/discovery fetches use an SSRF-hardened HTTP client — host-pinned, redirects refused, response size capped, and private/loopback addresses rejected. The issuer's key endpoint must therefore be reachable at a publicly-routable address. The `spiffe_bundle_endpoint` key source (and its `spiffe_refresh_hint_seconds`) is accepted in the API but its fetcher is not active yet — use `oidc_discovery` or `static_jwks_url` for SPIFFE issuers today.

## Validation rules

Every check is fail-closed, and every rejection returns the same generic `invalid_client` so no check leaks which one failed:

| Check | Rule |
|-------|------|
| Algorithm | Asymmetric only (`RS*`, `PS*`, `ES*`); `alg:none` and `HS*` rejected (RFC 8725) |
| Signature | Verified against the issuer's JWKS (cached 10 minutes) |
| Issuer | `iss` must resolve to an **active** client-assertion trust row — a per-org [SSO issuer](./org-sso-oidc) at the same URL can never authenticate an OAuth client |
| Audience | `aud` must contain the row's `expected_aud` exactly |
| Lifetime | `exp` and `iat` required; declared lifetime (`exp − iat`) must be ≤ 1 hour; `exp`/`nbf`/`iat` checked with 60 s clock skew |
| Subject | `subject_claim` value must exactly match an `allowed_subjects` entry (never prefix/substring); empty list is deny-all |
| Replay | Assertions are **single-use** — keyed by `jti`, or by `(iss, sub, iat, exp)` when `jti` is absent (K8s SA tokens carry none), held until the token's `exp` |
| Type match | `jwt-bearer` assertions only match non-SPIFFE rows; `jwt-spiffe` only matches `spiffe_jwt` rows |
| Bound client | Must exist, be active, and be a `service_account` |

Because assertions are single-use, **mint a fresh platform token per token-endpoint call** (Kubernetes TokenRequest API, SPIFFE Workload API) rather than re-presenting a cached one.

## Kubernetes ServiceAccount tokens

Kubernetes clusters are OIDC issuers: projected ServiceAccount tokens are JWTs signed by the cluster, with `iss` = the cluster's issuer URL and `sub` = `system:serviceaccount:<namespace>:<name>`.

### 1. Register the trusted issuer

Find the cluster issuer with `kubectl get --raw /.well-known/openid-configuration | jq -r .issuer` (on managed clusters — EKS/GKE/AKS — this is a public URL and `oidc_discovery` works; for a private cluster expose the JWKS and use `static_jwks_url`):

```graphql
mutation {
  _add_trusted_issuer(
    params: {
      service_account_id: "CLIENT_UUID" # the service_account client's internal id
      name: "prod-cluster payments-worker"
      issuer_url: "https://oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE"
      key_source_type: "oidc_discovery"
      expected_aud: "https://your-authorizer.example"
      allowed_subjects: "system:serviceaccount:payments:worker"
      issuer_type: "kubernetes_sa"
    }
  ) {
    id
    issuer_url
    is_active
  }
}
```

### 2. Project a token with the right audience

```yaml
volumes:
  - name: authorizer-token
    projected:
      sources:
        - serviceAccountToken:
            path: authorizer-token
            audience: https://your-authorizer.example # must equal expected_aud
            expirationSeconds: 3600 # ≤ the 1-hour lifetime ceiling
```

### 3. Authenticate

```bash
JWT=$(cat /var/run/secrets/tokens/authorizer-token)
curl -s -X POST $AUTHORIZER_URL/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  --data-urlencode "client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer" \
  --data-urlencode "client_assertion=$JWT" \
  -d "scope=read:payments"
```

For testing: `kubectl create token worker -n payments --audience=https://your-authorizer.example --duration=10m`.

### Online hardening: Kubernetes TokenReview

Offline JWKS validation proves the token was signed by the cluster — **not** that the bound Pod/ServiceAccount still exists. A deleted pod's not-yet-expired token would still verify. For high-security workloads a trust row can opt in to online validation via `enable_token_review` + `kubernetes_api_server_url` — admin-settable fields on `_add_trusted_issuer` / `_update_trusted_issuer` (`kubernetes_api_server_url` must be a non-empty `https` URL whenever `enable_token_review` is `true`, checked at write time): after the offline checks pass, Authorizer calls the cluster's `authentication.k8s.io/v1` TokenReview API and rejects the assertion fail-closed unless the apiserver reports it still authenticated.

```graphql
mutation {
  _update_trusted_issuer(
    params: {
      id: "TRUSTED_ISSUER_UUID"
      enable_token_review: true
      kubernetes_api_server_url: "https://<managed-cluster-public-api-endpoint>"
    }
  ) {
    id
    enable_token_review
    kubernetes_api_server_url
  }
}
```

- Authorizer authenticates the TokenReview call with its **own** in-cluster ServiceAccount token, which needs the `system:auth-delegator` ClusterRole.
- The apiserver URL goes through the same SSRF-hardened client, so only a **publicly-routable apiserver endpoint** (e.g. a managed cluster's public API endpoint) works today — `https://kubernetes.default.svc` (a private ClusterIP) is rejected by design.

## SPIFFE JWT-SVIDs (preview)

For workloads in a [SPIFFE/SPIRE](https://spiffe.io) trust domain, the JWT-SVID is the client credential (per `draft-ietf-oauth-spiffe-client-auth` — an expired individual draft, so this ships as a **preview**). Two differences from the generic path:

- `client_assertion_type` is `urn:ietf:params:oauth:client-assertion-type:jwt-spiffe` and the trust row's `issuer_type` must be `spiffe_jwt` — the profiles cannot be crossed.
- `iss` is the **SPIRE server**, and `sub` is the workload's **SPIFFE ID** (`spiffe://…`) — `iss ≠ sub` is expected. The subject must be a `spiffe://` URI and appear exactly in `allowed_subjects`.

Register the issuer with `issuer_url` set to the SPIRE server's configured `jwt_issuer` and point the key source at the [SPIRE OIDC Discovery Provider](https://spiffe.io/docs/latest/keyless/) (`oidc_discovery`, or `static_jwks_url` at its keys endpoint), with `issuer_type: "spiffe_jwt"` and the workload's SPIFFE ID in `allowed_subjects`.

```bash
# Fetch a fresh JWT-SVID from the local SPIRE agent (each fetch mints a new one)
SVID=$(spire-agent api fetch jwt \
  -audience https://your-authorizer.example -output json | jq -r '.[0].svids[0].svid')

curl -s -X POST $AUTHORIZER_URL/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  --data-urlencode "client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-spiffe" \
  --data-urlencode "client_assertion=$SVID" \
  -d "scope=read:payments"
```

## Errors

| Error | Cause |
|-------|-------|
| `invalid_request` | Unsupported `client_assertion_type`, or more than one client authentication method presented |
| `invalid_client` | Any assertion validation failure (deliberately indistinguishable) |
| `unauthorized_client` | The bound client is not a `service_account` for this grant |
| `invalid_scope` | Requested scope outside the client's [`allowed_scopes`](../core/client-registry) |
