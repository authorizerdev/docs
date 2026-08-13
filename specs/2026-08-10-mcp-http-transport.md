# Remote MCP transport — Authorizer as an OAuth 2.1 resource server

**Status**: planned for 2.4.0 (currently rc.18). PR 1 merged to branch, reviewed and amended.
**Owner**: principal-engineer
**Security review**: required on PR 1 and PR 2

---

## 1. Problem

MCP today is `authorizer mcp` (`cmd/mcp.go`): a second process, stdio only.

Two properties make it undeployable:

1. **It re-instantiates the entire server.** Storage, memory store, token, email, SMS,
   audit, events, the embedded FGA engine, authenticators, webauthn, *and a second
   `grpcsrv.Server`* (`cmd/mcp.go:89-182`). Running MCP means a second DB pool, a
   second Redis connection and a second FGA engine.
2. **Identity is one static `--mcp-bearer` per process** (`internal/mcp/server.go:50`).
   One process serves exactly one user, forever.

`internal/mcp/server.go:26-36` documents stdio-only as deliberate, guarded by
`TestServer_StdioOnly`, and states its own exit condition: *"To deliberately add a
new transport: implement an auth+rate-limit interceptor for MCP first, then update
this test's allow-list."* This spec satisfies that precondition.

**Release window.** Stdio MCP has only ever shipped in release candidates, never in
a stable release. Replacing it before 2.4.0 GA breaks no compatibility promise;
after GA it becomes a breaking change that must wait for 2.5.0.

## 2. Decision: path-mount `/mcp` on the main HTTP listener

Rejected: a dedicated port alongside gRPC (`9091`) and metrics (`8081`). Those two
are separate for reasons MCP does not share.

| Listener | Why separate |
|---|---|
| gRPC | HTTP/2 wire protocol gin cannot route |
| metrics | must **not** be publicly exposed; binds `127.0.0.1` by default |
| MCP | plain HTTP/1.1 JSON-RPC that **must** be publicly reachable, on the same origin as the AS metadata |

A separate port costs:

1. **Discovery breaks.** The canonical resource URI becomes
   `https://auth.example.com:9092/mcp` — a different origin from the authorization
   server. Several MCP clients resolve `.well-known` against the root authority only.
2. **A second ingress + TLS cert + hostname in every deployment.** Authorizer is one
   binary behind one ingress today.
3. **The middleware stack gets re-implemented.** Mounting on the gin router inherits
   CORS, security headers, rate limiting, trusted proxies, logging, metrics and
   graceful shutdown — which is exactly the "no auth/rate-limit interceptors"
   objection recorded in the stdio-only comment.

Precedent: `mcp.sentry.dev/mcp`, `api.githubcopilot.com/mcp`; Linear, Atlassian,
Stripe and Cloudflare all serve remote MCP at a path on an HTTPS host.

## 3. Scope

**In 2.4.0**: `POST /mcp` as an OAuth 2.1 resource server, opt-in via `--mcp-enabled`;
RFC 9728 protected resource metadata; RFC 8707 audience validation; per-request
caller identity; RFC 8252 loopback redirect matching. Client onboarding via
**pre-registered OAuth clients** (§8), which needs no new endpoint. `authorizer mcp`
keeps working with a deprecation notice.

**Deferred to 2.5.0**: CIMD (Client ID Metadata Documents) for zero-touch client
onboarding, and the `/authorize` consent screen that CIMD requires (§8.4); per-tool
scope gating; MCP audit events; SSE / stateful sessions; MCP resources and prompts;
delegated (RFC 8693) tokens at `/mcp` (§7).

**Superseded**: this spec listed RFC 7591 dynamic client registration as "not
planned" (§8.3 collects the vendor arguments against it, and they still stand as
reasons to keep it OFF by default). It shipped anyway in 2.4.0 behind
`--enable-dynamic-client-registration`, because the reasoning was about what
*should* be preferred and not about what shipping clients *can do*: Claude Code
reads `client_id_metadata_document_supported` and still refuses without a
`registration_endpoint`. See `2026-08-11-cimd-and-consent.md` §1.

## 4. Architecture

### 4.1 Audience scoping is structural

`ValidateAccessToken` rejects any token whose `aud` is an absolute URI
(`internal/token/auth_token.go`) — and an MCP token's `aud` is *required* to be a
URI. The naive fix, adding an MCP branch to the shared resolver, would make a token
minted for `resource=<url>/mcp` valid at `/graphql` as well, defeating the audience
binding that makes the surface safe.

Instead, MCP gets its **own bufconn-only `grpcsrv.Server`**, built from the same
providers, never bound to TCP, whose auth interceptor uses an MCP-specific
`TokenResolver`. The public gRPC / REST / GraphQL path is untouched.

Three things make that boundary real rather than asserted. The first shipped with
the design; the other two came out of review, where the original claim of
"structural" turned out to hold only by coincidence:

1. **The resolver is per-server, not per-request.** A token can only be accepted
   where its audience says it belongs, because the two servers are different objects.
2. **A non-nil resolver is the interceptor's SOLE authority.** It also disables the
   two paths that authenticate without consulting a resolver at all: the super-admin
   check (admin cookie / `x-authorizer-admin-secret`) and the `Session` RPC's
   cookie-only branch. `transport.MetaFromGRPC` reconstructs cookies from gRPC
   metadata, so leaving those active meant a browser session was one proto
   annotation away from authenticating a tool call on a CSRF-exempt endpoint.
   Pinned by `TestAuth_SoleAuthorityDisablesCookieAndAdminSecretPaths`, including
   the inverse case that default servers are unaffected.
3. **`public` methods are kept out of the gap.** The interceptor attaches no
   principal for a method marked `public`, and the service layer then resolves the
   caller itself with the DEFAULT rule (`service.callerTokenData`,
   `resolveFgaCaller`). A method that is both `mcp_tool.exposed` and `public` *and*
   identity-resolving would therefore bypass the MCP audience rule entirely.
   `TestExposedMCPToolsCannotBypassTheMCPTokenRule` (`internal/mcp`) keeps that
   intersection empty. Today the exposed set is `Profile`, `Meta`,
   `CheckPermissions`, `ListPermissions`; only `Meta` is `public`, and it resolves
   no caller. Adding a name to that test's allow-list is a security assertion, not
   a formality.

```
POST /mcp ──► gin (CORS, sec headers, rate limit, logging)
           └► StreamableHTTPHandler (stateless, JSON response)
              └► tool dispatch ──bufconn──► MCP grpc.Server
                                            └► interceptors.Auth(TokenResolver = MCP)
                                               └► ValidateMCPAccessToken(aud == <url>/mcp)
```

### 4.2 One normalizer for the canonical origin

`Config.CanonicalURL()` reduces `--url` to scheme+host, stripping path, query,
fragment, userinfo and any trailing slash — matching `parsers.SetTrustedURL`
exactly. `Config.MCPResource()` is `CanonicalURL() + "/mcp"`.

Everything self-referential derives from that one function: the PRM `resource`, the
PRM `authorization_servers` and `jwks_uri`, and the `aud` comparison in
`ValidateMCPAccessToken`. `parsers.GetHost` applies the same normalization, and it
is the normalized value that becomes every token's `iss`.

This is not hypothetical tidiness. Review caught the metadata document building its
issuer from the RAW `--url` while `resource` was normalized: an operator running
`--url https://auth.example.com/auth` passed startup and published an authorization
server and a `jwks_uri` that both 404, against tokens whose `iss` was
`https://auth.example.com`. A discovery chain that dead-ends with no error anywhere.
`TestProtectedResourceMetadataNormalizesIssuer` covers the path and trailing-slash
cases; the config test asserts `CanonicalURL() + "/mcp" == MCPResource()`.

The canonical origin is derived from `--url` and never from a request.
`parsers.GetHost` falls back to request headers when `--url` is unset, and an
audience check against a header the caller controls authenticates anyone. So
`--mcp-enabled` **hard-fails at startup without `--url`**.

### 4.3 Discovery: one metadata path

RFC 9728 §3.1 builds the metadata URL by inserting the well-known segment between
the host and the resource identifier's **path**, so
`/.well-known/oauth-protected-resource/mcp` is the URL that denotes `<url>/mcp`. The
bare `/.well-known/oauth-protected-resource` denotes the origin, and §3.3 requires a
client to reject a document whose `resource` is not identical to the identifier it
used to build the request.

So the document is served at **one** path. Serving it at both would hand strict
clients a mismatch to reject. Discovery reaches it the way §5.1 intends: the `401`
from `/mcp` carries `WWW-Authenticate: Bearer resource_metadata="<this URL>"`, which
is the primary mechanism; well-known probing is the fallback. Anthropic documents
Claude probing the path-inserted form first, so Claude is unaffected either way.

`scopes_supported` is shared with the authorization server metadata via one
`supportedScopes` var. A protected-resource document that omitted `offline_access`
while the AS advertised it would send clients into a flow that returns no refresh
token, and the agent's session would die at access-token expiry.

### 4.4 Token passthrough

Forwarding the caller's bearer across the in-process bufconn hop is **not** the
pattern the MCP spec forbids. That prohibition covers forwarding a client's token to
an *upstream third-party API*. Here the resource server and the "downstream" are the
same process, same issuer, same trust domain — identical to what the REST gateway
already does with `grpcgateway-authorization`.

### 4.5 Stateless transport

`mcp.NewStreamableHTTPHandler` with `Stateless: true, JSONResponse: true`.

The main listener sets `WriteTimeout: 60s` (`internal/server/server.go:98`), which
would kill a long-lived SSE stream. In stateless mode the SDK returns `405` + `Allow`
on GET (`streamable.go:335-340`), which is spec-conformant. Every exposed tool is
request/response, so nothing is lost, and horizontal scaling needs no sticky sessions.

## 5. Work breakdown

### PR 1 — `security/mcp-resource-server` ✅ done

No behaviour change to any existing surface.

| File | Change |
|---|---|
| `internal/token/auth_token.go` | Extracted `validateStatefulAccessToken`, parameterized by an audience policy and a subject-liveness policy. `ValidateAccessToken` keeps today's rules verbatim. |
| `internal/token/mcp_access_token.go` | `ValidateMCPAccessToken(gc, token, resource)`. Same stateful core; audience inverted to `sameAudience(aud, resource)`; subject liveness via `subjectIsLive` (§6). |
| `internal/grpcsrv/interceptors/auth.go` | `TokenResolver` override at both identity-resolution sites; a non-nil resolver becomes the sole authority (§4.1). |
| `internal/grpcsrv/interceptors/mcp_auth.go` | `MCPTokenResolver(tp, resource)` — bearer only, no cookie fallback. |
| `internal/config/mcp.go` | `CanonicalURL()` + `MCPResource()` (§4.2). |
| `internal/http_handlers/protected_resource.go` | RFC 9728 document, all URLs from `CanonicalURL()`. |
| `internal/http_handlers/openid_config.go` | `supportedScopes` shared by both discovery documents. |
| `internal/server/http_routes.go` | One PRM route, registered only when `--mcp-enabled`. |
| `cmd/root.go` | `--mcp-enabled` (default `false`); hard-fail without `--url`. |

Review found and fixed: the raw-`--url` issuer (§4.2), the two resolver-bypassing
auth paths and the `public`-method gap (§4.1), the two-path PRM (§4.3), the
divergent `scopes_supported`, `MCPTokenResolver` shipping untested, and the audience
test asserting one layer below the real entry point.

### PR 2 — `feat/mcp-http-transport`

| File | Change |
|---|---|
| `internal/mcp/server.go` | Drop the static `bearer` / `authorizerURL` fields. `stampAuth` reads the caller's `Authorization` from `req.Extra.Header` (SDK `shared.go:487`) per call. Add `Handler() http.Handler`. |
| `internal/server/http_routes.go` | `router.Any("/mcp", ...)` when enabled; `401` + `WWW-Authenticate: Bearer resource_metadata="…"` on unauthenticated calls. |
| `internal/http_handlers/csrf.go` | Exempt `/mcp` beside the existing `/scim/v2/` — bearer-authenticated, cookieless. |
| `internal/http_handlers/authorize.go` | RFC 8252 §7.3 loopback redirect matching (§8.5). |
| `cmd/root.go` | Build the bufconn MCP server from the already-wired providers. |
| `internal/mcp/transport_test.go` | Replace `TestServer_StdioOnly` per its own exit condition. |

With `--url` mandatory, `parsers.GetHost` short-circuits to `trustedURL`, so the
`x-authorizer-url` stamping dance is unnecessary — the bridge forwards only
`Authorization`.

Carried over from PR 1 review, to be done against a working endpoint:

- Extract one `token.SessionDataFromClaims(claims)` helper; `MCPTokenResolver`
  currently hand-copies the claims mapping from `auth_token.go`, so a new field on
  `SessionOrAccessTokenData` would silently reach MCP as a zero value.
- `subjectIsLive` always tries `GetUserByID` before `GetClientByID`, so machine
  tokens — the dominant MCP caller — pay two serial DB reads. The claims carry
  `login_method`, so the order can be chosen. Touches the delegated path too, so
  measure before changing.

**Open item:** the `Session` RPC is `exposed: false`, so it is unreachable as an MCP
tool, and the sole-authority guard now disables its cookie branch anyway. No action
needed unless it is ever exposed.

### PR 2a — `security/machine-token-liveness`

Separate commit so it can be reverted independently. See §6. This is the only part
of the plan that is **not** backward compatible, deliberately.

### PR 3 — `docs/mcp-http`

```go
mcpCmd.Deprecated = "the stdio MCP transport will be removed in 2.5.0. " +
    "Run the server with --mcp-enabled and connect to POST <url>/mcp instead. " +
    "See https://docs.authorizer.dev/core/mcp"
```

Plus one `log.Warn()` in `runMCP` so it lands in logs, not only the terminal.

- `authorizer-docs/docs/core/mcp.md` — rewrite. `## Design & security model` and
  `## Running the server` are now wrong. Must include the client-onboarding table
  from §8.2 and the exact resource URL operators hand to users (§8.6).
- `docs/core/oauth2-oidc.md`, `docs/core/endpoints.md` — add the PRM endpoint.
- `README.md:75` — MCP is a server transport, not a CLI subcommand.
- `ROADMAP_V2.md` §4.1 — mark MCP resource-server + RFC 9728 delivered; leave CIMD
  and consent open.
- `CHANGELOG.md` — Added + Deprecated entries.

## 6. Service-account liveness (PR 2a)

`userIsRevoked` (`auth_token.go`) looks the subject up **as a user only** and returns
`false` when it finds nothing — so a machine token, whose `sub` is `schemas.Client.ID`,
reports "not revoked" and keeps working after the service account is deactivated.
`subjectIsLive` (`delegated_access_token.go`) already resolves user-then-client and
fails closed.

PR 1 uses `subjectIsLive` for the MCP path only. PR 2a points the shared core at it
too, which changes GraphQL, gRPC and REST:

- A deactivated service account's `client_credentials` token stops working. That is
  the fix.
- Fail-closed when the subject resolves to neither a user nor a client. Today that
  fails open; it matters as a fallback, since `DeleteUser` purges sessions via
  `asyncutil.Go` best-effort (`admin_users.go:483`).
- No change for any live user or active service account. One extra `GetClientByID`
  read, only on machine-token validation.

**Do it before GA.** Service accounts, `client_credentials` and workload identity are
all new in 2.4.0 (#641–#647, #654), so there is no installed base. Fixed now it is a
bug that never shipped; fixed in 2.5.0 it is a behaviour change to a GA'd feature.
Industry norm is looser — Auth0, Okta and Keycloak treat `client_credentials` tokens
as non-revocable before expiry — but a check that *looks* like it enforces and
silently does not is worse than no check.

## 7. Deferred: delegated tokens at `/mcp`

An RFC 8693 delegated token bound to `resource=<url>/mcp` fails both validators
today: the stateful path because delegated tokens carry no nonce and no session
entry, and `ValidateDelegatedAccessToken` because it requires `aud` to equal the bare
host, not `<host>/mcp`.

This is a **decision, not an oversight**. The delegated path is the weaker one (no
byte-for-byte comparison against a stored token), and its doc comment states that
widening it must be a deliberate edit to that function. The strong path ships first.

## 8. Client onboarding

### 8.1 What Claude actually requires

From [Anthropic's connector authentication docs](https://claude.com/docs/connectors/building/authentication),
the supported types are `oauth_dcr`, `oauth_cimd`, `oauth_anthropic_creds`,
`custom_connection`, `static_headers` (beta), and `none`.

> "Supplying your own pre-registered client ID (and secret, if your server requires
> one) as static client credentials is a good option when you want a stable OAuth
> client per organization: **it avoids dynamic client registration entirely**, and
> the credentials are scoped to the organization that entered them."

Custom connectors take an OAuth Client ID under **Advanced settings**; the Client
Secret is optional. So DCR is **not** required for claude.ai remote connectors.

### 8.2 Compatibility with what 2.4.0 ships

| Client | Works | How |
|---|---|---|
| claude.ai / Desktop / mobile custom connector | yes | Operator creates a client at `/identity/clients`, redirect URI `https://claude.ai/api/mcp/auth_callback`, pastes the client ID into Advanced settings |
| Claude Code, VS Code — static header | yes | Token from `/oauth/token` with `resource=<url>/mcp`; `client_credentials` + `resource` already supported (`token.go:293`) |
| Claude Code — OAuth | yes, with the §8.5 fix | RFC 8252 loopback redirect, ephemeral port |
| Directory listing / zero-touch onboarding | 2.5.0 | Needs CIMD (§8.4) |

Note: a pure machine-to-machine `client_credentials` grant is **not supported** by
Claude connectors — "Every connection requires user consent." The `client_credentials`
path above is only for the static-header mode, where the operator mints the token
themselves.

### 8.3 Why not DCR

Anthropic's own guidance argues against it:

> "For servers expecting high traffic from the directory, **prefer CIMD or
> `oauth_anthropic_creds` over DCR. DCR causes Claude to register a new client on
> every fresh connection**, which can result in very large numbers of registered
> clients on your authorization server."

That is unbounded row growth from *normal traffic*, in every operator's deployment,
in exchange for an open unauthenticated write endpoint. Keycloak and Ory Hydra both
gate registration behind an initial access token or registration policies for the
same reason.

### 8.4 CIMD is the 2.5.0 path, and it needs consent

[Client ID Metadata Documents](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization#client-id-metadata-documents)
(MCP spec 2025-11-25) make the `client_id` a URL the authorization server fetches —
no registration endpoint, no write path, no row growth. Claude selects CIMD when the
AS metadata advertises both `"client_id_metadata_document_supported": true` and
`"none"` in `token_endpoint_auth_methods_supported`. Claude Code already uses it.

CIMD makes client identity **self-asserted**, which is exactly when a consent screen
becomes load-bearing — the MCP spec requires the authorization server to display the
redirect URI hostname on consent, with an extra warning for loopback-only clients.
Authorizer has no consent screen today: `prompt=consent` is accepted and ignored
(`authorize.go:142-145`), so with a live session `/authorize` issues a code silently.

That is safe for 2.4.0 because every client is operator-created — the trust decision
is the operator's, the same posture every first-party client has today. It stops
being safe the moment a client can assert its own identity. **CIMD and consent land
together in 2.5.0, or neither does.**

Consent needs no persistence: `/authorize` is hit once per connector setup, and
refreshes go to `/oauth/token`. `web/templates/logout_confirm.tmpl` is the existing
server-rendered confirmation pattern to copy — no SPA build, no schema change across
13 providers.

### 8.5 RFC 8252 loopback redirect matching (PR 2)

Claude Code uses an RFC 8252 loopback redirect on an **ephemeral port**, declares
`http://localhost/callback` and `http://127.0.0.1/callback` in its CIMD, and requires
that *"your authorization server must accept both with the port component ignored."*

`authorize.go:166-182` does exact string matching against registered redirect URIs,
so `http://localhost:3118/callback` never matches. [RFC 8252
§7.3](https://datatracker.ietf.org/doc/html/rfc8252#section-7.3) mandates
port-agnostic matching for the IP-literal form regardless of MCP, so this is a
compliance gap for every native app.

Scope the change to loopback hosts, and only when the *registered* URI is itself
loopback. It only widens — nothing previously accepted becomes rejected — but it is a
loosening of a security-critical check and should be reviewed as one.

### 8.6 Verified already correct

- `code_challenge_methods_supported` is advertised (`openid_config.go`).
- Refresh-token rotation with reuse detection exists (`token.go`, `ErrRefreshTokenReuse`).
- The PRM path matches Claude's documented probe order.

## 9. Open items

- **No per-client gate on the MCP resource.** `/authorize` accepts any absolute URI
  as `resource`, so any client a user can log in through can request
  `resource=<url>/mcp`. Tools still enforce their own FGA/principal checks, but MCP
  itself has no client-level gate. Either an allow-list of clients permitted to
  request the MCP resource, or bring per-tool scope gating forward. Decide in PR 2.
- **`sameAudience` is case-sensitive on the host.** It tolerates a trailing slash, but
  `https://AUTH.example.com/mcp` would not match. The MCP spec says servers SHOULD
  accept uppercase scheme/host for robustness, and Anthropic requires the PRM
  `resource` to match the URL "exactly as the user enters it in Claude". Low
  likelihood — clients echo the `resource` from our document — but the docs must tell
  operators the exact URL to hand out.
- **`--url` should become required.** Its own flag help says leaving it unset
  "exposes host-header-injection account takeover (CWE-640)". Keycloak requires
  `--hostname` in its production profile, Ory Hydra requires `urls.self.issuer`, Dex
  requires `issuer`. Recommendation: startup `WARN` in 2.4.0, required in 2.5.0 with
  a documented escape hatch for multi-tenant reverse-proxy deployments. Not a hard
  break in 2.4.0 — the release already carries one (`--encryption-key`).
- **Verification bar.** For any auth-path change, revert the fix and watch the new
  test fail before restoring. Build, vet, lint and 42 packages of tests were all
  green on a half-wired security seam in PR 1; only the revert-and-fail step proves
  a test tests anything. Worth adding to `AGENTS.md`.

## 10. Test plan

Both directions of the audience boundary must be pinned:

- MCP-audience token **rejected** by the regular public path — asserted at
  `GetUserIDFromSessionOrAccessToken`, the entry point gRPC/REST/GraphQL actually
  use, not only at `ValidateAccessToken` (which the delegated fallback sits behind).
- `client_id`-audience token **rejected** by `ValidateMCPAccessToken`.
- Empty `aud`, bare-host `aud`, foreign-resource `aud`, expired, revoked session,
  deactivated service account, wrong `token_type`.
- PRM document correct at the §3.1 path, including `offline_access` in
  `scopes_supported`; issuer and `jwks_uri` normalized for path and trailing-slash
  `--url`; unaffected by a hostile `Host` / `X-Authorizer-URL`.
- Every `mcp_tool.exposed` method is non-`public` or explicitly identity-free.
- A custom `TokenResolver` is used at every identity-resolution site, and the cookie
  and admin-secret paths are disabled — plus the inverse, that default servers keep
  both.
- `/mcp` unauthenticated → `401` + `WWW-Authenticate: Bearer resource_metadata=…`;
  `GET /mcp` → `405`; `--mcp-enabled=false` → `404`.
- `internal/e2e/smoke_test.go` gains the HTTP MCP surface; the stdio subprocess test
  stays while the command exists.

Verification bar (`AGENTS.md`): `go build ./...` → `go vet ./...` → `make test` →
`make lint`, plus `make smoke` before cutting rc.19. No storage changes, so no
cross-DB run needed.

## 11. References

- [MCP Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [Anthropic — Authentication for connectors](https://claude.com/docs/connectors/building/authentication)
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707.html)
- [RFC 8252 — OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252)
- [Keycloak — Configuring the hostname](https://www.keycloak.org/server/hostname)
