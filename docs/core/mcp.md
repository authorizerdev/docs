---
sidebar_position: 7
title: MCP Server
---

# MCP Server

Authorizer ships a built-in [Model Context Protocol](https://modelcontextprotocol.io)
(MCP) server. It lets an LLM agent — Claude Desktop, Claude Code, Cursor, or any
MCP-compatible host — call a **curated, read-only subset** of Authorizer's API as tools:
identify the current user and answer fine-grained authorization questions on their
behalf.

The headline use case: give an AI assistant the ability to ask *"is this user allowed to
see this document?"* before it retrieves or summarizes content — the same
permission-aware RAG pattern as the
[`with-rag-fga`](https://github.com/authorizerdev/examples/tree/main/with-rag-fga)
example (see [Real-world recipes → Permission-aware retrieval](./authorization#permission-aware-retrieval-rag--ai-agents)),
but driven from inside the model instead of your backend.

## Two ways to run it

| | **Remote (`--mcp-enabled`)** | **Local (`authorizer mcp`)** |
| --- | --- | --- |
| Transport | Streamable HTTP at `POST <url>/mcp` | stdio subprocess |
| Identity | per request, from the caller's own token | one process-wide `--mcp-bearer` |
| Runs | inside the server you already run | a second process with its own DB pool |
| Status | **use this** | deprecated, removed in 2.5.0 |

The stdio subcommand still works and still prints a deprecation notice. It cannot be
deployed: it starts a second copy of every provider — storage, memory store, embedded
FGA engine — and serves exactly one user for the lifetime of the process.

## Remote MCP server

Enable it on the server you already run:

```sh
authorizer --url https://auth.example.com --mcp-enabled  # ...your other flags
```

`--url` is already required to start the server at all; with `--mcp-enabled` it must also
be a usable `http(s)` origin, and startup refuses anything else (no scheme, userinfo, a
non-http scheme). Every token presented at `/mcp` is checked against this deployment's
canonical resource identifier, `<url>/mcp` — scheme + host only, with any path, query or
trailing slash stripped. Without `--url` that identifier would be derived from request
headers, which would let a caller name the audience their own token has to match — no
check at all.

### Security model

- **Every request carries its own token.** No ambient authority, no shared credential.
- **Audience-bound tokens only.** A token is accepted at `/mcp` only when its `aud` is
  exactly `<url>/mcp`. An ordinary login token — the kind that works at `/graphql`,
  `/v1/*` and gRPC — is rejected here, and an MCP token is rejected there. Neither rule
  has an "or" in it: a token you hand to a semi-trusted agent cannot become a full API
  credential. The mapping from audience to surface is a bijection, and that holds for
  [delegated tokens](#agent-delegation-rfc-8693) too.
- **Bearer only.** No cookie, no admin secret, and no admin operation reaches this
  surface, so it is safe to expose to the public internet and exempt from CSRF.
- **Shared middleware.** Because it is mounted on the main listener, it inherits CORS,
  security headers, rate limiting, trusted-proxy handling, request logging and metrics.

### Discovery

Authorizer is both the authorization server and the resource server here, so a client
needs nothing configured beyond the URL:

1. The client calls `POST https://auth.example.com/mcp` with no token.
2. Authorizer answers `401` with
   `WWW-Authenticate: Bearer realm="authorizer", resource_metadata="https://auth.example.com/.well-known/oauth-protected-resource/mcp"`.
3. The client fetches that document ([RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728)):

   ```json
   {
     "resource": "https://auth.example.com/mcp",
     "authorization_servers": ["https://auth.example.com"],
     "bearer_methods_supported": ["header"],
     "scopes_supported": ["openid", "email", "profile", "phone", "offline_access"],
     "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
     "resource_documentation": "https://docs.authorizer.dev/core/mcp"
   }
   ```

4. It reads Authorizer's own metadata from `/.well-known/oauth-authorization-server`,
   runs the OAuth 2.1 authorization-code flow with PKCE, and passes
   `resource=https://auth.example.com/mcp` on both the authorization and token requests
   ([RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707)) so the issued token is
   bound to this server.

That `resource` value must match **exactly** what a user types when adding the connector,
including the path — give them `https://auth.example.com/mcp`, not the bare origin.

An expired token gets the same `401`, which is what tells a client to refresh rather than
retry. The audience binding survives refresh, so a rotated token keeps working.

### Connecting a client

**Verified against a real Claude Code client**, so this table says what actually
happens rather than what the specs allow.

| Client | Works | How |
| --- | --- | --- |
| **Claude Code, VS Code** — static token | **yes, verified** | Mint a token bound to `<url>/mcp` and pass it as a fixed header (below) |
| **Claude Code** — [delegated token](#agent-delegation-rfc-8693) | **yes, verified** | Same fixed-header setup, with an RFC 8693 token bound to `<url>/mcp`. Verified on Claude Code 2.1.233: `✔ Connected`, and a `check_permissions` tool call returned the agent's own intersected answer |
| **Claude Code** — OAuth | with `--enable-dynamic-client-registration` | Claude Code's released version predates CIMD: it reads `client_id_metadata_document_supported`, ignores it, and refuses unless a `registration_endpoint` is advertised. With DCR enabled it registers itself (verified: `POST /oauth/register` → 201, public client, loopback callback) and runs the flow |
| **Claude.ai custom connector** — pasted client ID | unverified | Anthropic documents an OAuth Client ID field under *Advanced settings*; not confirmed here |
| Any client that needs to self-register | yes | Enable `--enable-client-id-metadata-document` (preferred) or `--enable-dynamic-client-registration` (RFC 7591, for clients that predate CIMD) |

Both self-registration mechanisms ship in 2.4.0 and are **off by default**. Turn
on the one your client can use — see [Self-registering clients](#self-registering-clients-cimd-vs-dcr)
below. The static-token path remains the simplest option when you control the
client and do not want an interactive flow at all.

```sh
# 1. Create a service account: dashboard → Identity → Clients (note the id + secret)
# 2. Mint a token bound to the MCP resource
curl -s -X POST https://auth.example.com/oauth/token \
  -d grant_type=client_credentials \
  -d client_id=$CLIENT_ID -d client_secret=$CLIENT_SECRET \
  -d scope=openid \
  -d resource=https://auth.example.com/mcp

# 3. Register it
claude mcp add --transport http authorizer https://auth.example.com/mcp \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

`claude mcp list` should then report **✔ Connected**.

The `resource` parameter is the part people miss: without it the token's audience
is the client id, and `/mcp` rejects it. That is the audience binding working, not
a bug.

Note this token identifies the *service account*, not a human — `profile` returns
nothing useful and permission checks resolve to `service_account:<client_id>`. For
per-user identity you need the OAuth flow, which is why DCR/CIMD support matters
and is tracked for a future release.

### Connecting a client that self-registers (CIMD)

Set `--enable-client-id-metadata-document` alongside `--mcp-enabled` and a client
can identify itself with an HTTPS URL pointing at a JSON document, instead of a
`client_id` you registered in advance:

```json
{
  "client_id": "https://app.example.com/oauth/client.json",
  "client_name": "Example MCP Client",
  "redirect_uris": ["http://127.0.0.1:0/callback"],
  "token_endpoint_auth_method": "none"
}
```

The `client_id` must be an **https URL with a path** (a bare origin like
`https://app.example.com` is not treated as a document URL and falls through to a
registry lookup), and it must equal the URL the document is served from — that equality
is what stops any host claiming to be any client. Authorizer fetches it through an
SSRF-hardened client (one-shot DNS, dial pinned to the validated IP, private and
loopback addresses refused), validates the presented `redirect_uri` against the
document's list, and caches it with a clamped TTL.

Because such a client asserts its own identity, **a consent screen is shown
before any code is issued**. It leads with the redirect host — the only fact
about the client the server has verified — and warns when a client's redirect
URIs are all loopback, since any local process can bind the same port and present
the same document. Clients you registered yourself are unaffected.

Restrict which hosts may serve a document with
`--client-id-metadata-allowed-domains` if you want a closed deployment; leaving it
empty accepts any HTTPS host, which is what a public MCP server wants.

### Self-registering clients: CIMD vs DCR

Authorizer implements **both**, off by default, and CIMD is the one to prefer.

The [MCP authorization spec (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
demoted it. Authorization servers **SHOULD** support Client ID Metadata
Documents and **MAY** support DCR, which the spec keeps only *"for backwards
compatibility with earlier versions of the MCP authorization spec"*. The client
priority order it defines is: pre-registered → CIMD → DCR → prompt the user.

The industry moved the same way:

| Product | Approach |
| --- | --- |
| [Auth0](https://auth0.com/ai/docs/mcp/guides/registering-your-mcp-client-application/dynamic-client-registration) | DCR is Enterprise-only, disabled by default, and needs tenant ACLs or a reverse proxy in front. Auth0 recommends CIMD instead for production |
| Keycloak | Has had OIDC DCR for years; ships experimental CIMD |
| Google Drive's MCP server | Rejects DCR outright (HTTP 400) |
| [Anthropic](https://claude.com/docs/connectors/building/authentication) | Steers directory traffic to CIMD or Anthropic-held credentials, because DCR registers a fresh client on every connection |

Auth0's stated objections — resource depletion from mass registration, security
probing, unvetted misconfigured clients, audit gaps — apply with more force to a
self-hosted product, where every operator would inherit an open, unauthenticated
write endpoint and unbounded client-row growth.

**CIMD is therefore the preferred path.** It makes the `client_id` an HTTPS URL
that the authorization server fetches and validates — no write endpoint, no row
growth, no schema change.

**RFC 7591 DCR ships anyway, behind `--enable-dynamic-client-registration`,
because the clients have not caught up.** Claude Code reads
`client_id_metadata_document_supported: true` from our metadata and still
refuses without a `registration_endpoint`. Without DCR those clients cannot
connect at all. Enabling it does not downgrade anyone: the spec's priority order
is pre-registered → CIMD → DCR, so a CIMD-capable client never reaches the DCR
path.

Auth0's objections are answered rather than ignored:

| Risk | Mitigation |
| --- | --- |
| Mass registration / resource depletion | Per-IP rate limiting plus a hard ceiling on registry rows |
| Unvetted, misconfigured clients | PUBLIC clients only — `token_endpoint_auth_method` must be `none`, `client_credentials` is refused, `redirect_uris` must be https or loopback http |
| Impersonation of a known product | Consent screen on every authorization, naming the client and leading with the verified redirect host ([RFC 7591 §5](https://www.rfc-editor.org/rfc/rfc7591.html#section-5) asks for this warning) |
| Weak client authentication | S256 PKCE required at `/authorize`; implicit response types refused |
| Standing client management surface | RFC 7592 not implemented — a self-registered client cannot be read back, modified or deleted through this endpoint |

Both mechanisms make client identity **self-asserted**, which is why both go
through the same consent screen: the spec requires the authorization server to
display the redirect URI hostname and to warn on `localhost`-only clients.

```sh
# Preferred: clients that support Client ID Metadata Documents
authorizer --mcp-enabled --url=https://auth.example.com \
  --enable-client-id-metadata-document

# Add DCR only if your client cannot do CIMD (e.g. current Claude Code)
authorizer --mcp-enabled --url=https://auth.example.com \
  --enable-client-id-metadata-document \
  --enable-dynamic-client-registration
```

Registration itself is one unauthenticated POST:

```sh
curl -X POST https://auth.example.com/oauth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "client_name": "My MCP Client",
    "redirect_uris": ["http://127.0.0.1:5599/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "token_endpoint_auth_method": "none"
  }'
# 201 Created -> {"client_id": "...", "client_id_issued_at": ..., ...}
# No client_secret is ever issued: these are public clients.
```

### Agent delegation (RFC 8693)

`/mcp` accepts **delegated** access tokens — the "agent X acting for user Y" kind minted
by [token exchange](../enterprise/token-exchange) — as well as ordinary first-party ones.
This is what lets an agent ask Authorizer about *its own* authority through the tools it
was granted, rather than needing a credential that speaks for the whole user.

Mint one by naming the MCP server as the `resource`:

```sh
curl -s -X POST https://auth.example.com/oauth/token \
  -d grant_type=urn:ietf:params:oauth:grant-type:token-exchange \
  -d client_id=$AGENT_ID -d client_secret=$AGENT_SECRET \
  -d subject_token=$USER_ACCESS_TOKEN \
  -d subject_token_type=urn:ietf:params:oauth:token-type:access_token \
  -d actor_token=$AGENT_ACCESS_TOKEN \
  -d actor_token_type=urn:ietf:params:oauth:token-type:access_token \
  -d resource=https://auth.example.com/mcp
```

`resource=<url>/mcp`, not `<url>`. The two are different audiences and therefore
different surfaces: a delegated token bound to the bare URL authenticates GraphQL, REST
and gRPC and is **refused** at `/mcp`; this one is the exact mirror. A 401 from `/mcp`
is far more often this than a permissions problem — check the `aud` claim first.

**The answers are the agent's, not the user's.** `check_permissions` and
`list_permissions` evaluate `perms(agent) ∩ perms(user)`, so an agent that was never
granted a document is denied it even when the delegating user can read it, and
enumeration omits it rather than leaking the name. Supplying an explicit `user` cannot
shed the agent half, and a delegated caller naming any *other* subject is refused
outright.

Two limits worth planning around:

- **A delegated token lives 5 minutes and has no refresh token.** The `401` an expired
  one gets carries the same discovery challenge as any other, but an MCP client cannot
  refresh its way out — the agent has to redo the exchange. Non-interactive agents that
  re-exchange on demand fit this well; a long-lived chat session does not.
- **Revocation still flows through the user's session.** Logout, password reset and
  admin revoke all take the agent's access down with them, because the token names the
  originating session and that session is checked on every call.

Verified against a real Claude Code client (2.1.233): a delegated token bound to
`<url>/mcp` reports `✔ Connected` and its `check_permissions` calls come back with the
agent's intersected answer — `allowed: false` for a document the delegating user *can*
read but the agent was never granted. The same token bound to the bare `<url>` fails the
connection with `invalid_token`, which is the audience boundary doing its job.

The [`with-agent-permissions`](https://github.com/authorizerdev/examples/tree/main/with-agent-permissions)
example runs this end to end and asserts the intersection through the real tool surface.

## Exposed tools

| Tool                | Auth required | Description                                                          |
| ------------------- | ------------- | ------------------------------------------------------------------- |
| `meta`              | no            | Server feature flags & provider availability.                       |
| `profile`           | yes           | The authenticated caller's profile.                                 |
| `check_permissions` | yes           | Batch-evaluate `(relation, object)` permission checks.              |
| `list_permissions`  | yes           | List the objects/relations the caller can access.                   |

Each tool's input schema is generated from the underlying proto message, so the arguments
match the [REST](./rest-api) and [GraphQL](./graphql-api) request shapes exactly. For
example, `check_permissions` accepts:

```json
{
  "checks": [
    { "relation": "can_view", "object": "document:1" }
  ],
  "user": "optional-explicit-subject"
}
```

## Local stdio server (deprecated)

Kept working for existing setups, with a deprecation notice on every run. Prefer
`--mcp-enabled` above.

### Running the server

```bash
authorizer mcp \
  --client-id=YOUR_CLIENT_ID \
  --database-type=sqlite \
  --database-url=auth.db \
  --url=http://localhost:8080 \
  --jwt-type=HS256 \
  --jwt-secret=your-jwt-secret \
  --encryption-key=your-encryption-key \
  --mcp-bearer="$USER_ACCESS_TOKEN"
```

With a SQLite/Postgres/MySQL/MariaDB `--database-type`, FGA reuses the main database
automatically — no `--fga-store` flag needed (see
[Enabling FGA](./authorization#1-enabling-fga)). Postgres- and MySQL-compatible
variants beyond those (CockroachDB, YugabyteDB, libSQL, PlanetScale) are *not*
auto-mapped and need an explicit `--fga-store`. Only pass `--fga-store` /
`--fga-store-url` when the main database is NoSQL (MongoDB, DynamoDB, …), SQL Server, or
you want FGA on a separate store; `--fga-store` takes one of `sqlite`,
`postgres`, `mysql`, or `memory` — not a URI.

:::warning `--mcp-authorizer-url` has no effect as of 2.4.0
Pass `--url` with the same value instead — it is inherited from the root flag
set and is what the token's `iss` claim is validated against.

The old flag is still accepted so existing setups keep starting, but it is
**ignored**: it only ever stamped an `x-authorizer-url` header, and `--url`
is consulted before any header. It warns when used and goes away in 2.5.0
with the subcommand.

`--mcp-bearer` without `--url` is now refused at startup, rather than failing
later as `Unauthenticated` on every tool call.
:::

The `mcp` command inherits the root server flags (database, JWT, client-id, `--fga-store`,
etc.) so it can resolve identity and run the FGA engine in-process.

#### MCP-specific flags

| Flag                    | Description                                                                                                        | Required        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------- |
| `--mcp-bearer`          | Access token attached as `Authorization: Bearer <token>` on every tool call. Needed for `profile`/`*_permissions`. | for auth tools  |
| `--url` | This server's own base URL — the value the token's `iss` claim is validated against. Inherited from the root flag set. | with `--mcp-bearer` |

> Logging goes to **stderr** only — `stdout` is reserved for the MCP JSON-RPC stream, so
> never print to it.

### Connecting a host

Most MCP hosts read a JSON config that declares the command to spawn. For
**Claude Desktop** (`claude_desktop_config.json`) or **Claude Code**
(`.mcp.json`):

```json
{
  "mcpServers": {
    "authorizer": {
      "command": "authorizer",
      "args": [
        "mcp",
        "--client-id", "YOUR_CLIENT_ID",
        "--database-type", "sqlite",
        "--database-url", "auth.db",
        "--jwt-type", "HS256",
        "--jwt-secret", "your-jwt-secret",
        "--encryption-key", "your-encryption-key",
        "--url", "https://auth.example.com",
        "--mcp-bearer", "USER_ACCESS_TOKEN"
      ]
    }
  }
}
```

Restart the host; the `authorizer` tools (`meta`, `profile`, `check_permissions`,
`list_permissions`) become available to the model.

## Errors

When a tool call fails — bad arguments, an unauthenticated call, or a permission denial —
the server returns an MCP tool result with `isError: true` and the error message as text,
so the host surfaces it to the model as a recoverable failure (not a protocol abort).
Typical messages mirror the gRPC status: `Unauthenticated`, `PermissionDenied`,
`FailedPrecondition` (e.g. *fine-grained authorization is not enabled*).

## Authorizer as the authorization server protecting *your own* MCP server

Everything above is about Authorizer's **own** MCP surface. The other direction is just
as common: your MCP server, hosted anywhere, needs a real OAuth 2.1 authorization server
in front of it, and Authorizer can be that AS. Same specs, different division of labour —
there, you implement the resource-server half:

| Spec | What it says | Who implements it |
| --- | --- | --- |
| OAuth 2.1 | Bearer tokens, token endpoint, client auth | **Authorizer** (`/oauth/token`, JWKS, OIDC discovery) |
| [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728) (protected resource metadata) | Your resource server publishes `/.well-known/oauth-protected-resource` naming its `resource` URI and `authorization_servers`, pointed at from a `401` `WWW-Authenticate` header | **your MCP server** |
| [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) (resource indicators) | The client passes `resource=<your MCP server URI>` when requesting a token; the AS binds the token's `aud` to it | **Authorizer** binds it (see the `resource` parameter on the [Authorization Endpoint](./oauth2-oidc#authorization-endpoint) and [Token Exchange](../enterprise/token-exchange)); **your MCP server** enforces `aud` on every call |
| [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) (token exchange) | An agent gets a token that says "agent X acting for user Y" — see [Token Exchange & Delegation](../enterprise/token-exchange) | **Authorizer** (`grant_type=...token-exchange` on `/oauth/token`) |

Authorizer also serves the [RFC 8414 alias](./oauth2-oidc#rfc-8414-alias)
`/.well-known/oauth-authorization-server` — the identical metadata document as
`/.well-known/openid-configuration` — for MCP clients that probe the OAuth-only
discovery path instead of falling back to OIDC discovery.

The [`with-mcp`](https://github.com/authorizerdev/examples/tree/main/with-mcp) example
builds this end to end: a ~150-line Express MCP server that validates Authorizer-issued
JWTs (issuer + `aud`) and a client walkthrough that goes 401 → RFC 9728 discovery →
`client_credentials` (rejected — wrong `aud`) → [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) token exchange with
`resource=<mcp-server-uri>` → 200. Its own bonus section documents this page's
built-in stdio server too, for the "which one do I want" question.

## Authorizer as the authorization server protecting *your own* MCP server

Everything above is about the **built-in stdio server** — Authorizer's own tools,
consumed by a host on your machine. The other direction is just as common: your MCP
server (streamable HTTP, hosted anywhere) needs a real OAuth 2.1 authorization server
in front of it, and Authorizer can be that AS. This is a **different pattern** —
plain OAuth, no `authorizer mcp` involved:

| Spec | What it says | Who implements it |
| --- | --- | --- |
| OAuth 2.1 | Bearer tokens, token endpoint, client auth | **Authorizer** (`/oauth/token`, JWKS, OIDC discovery) |
| [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728) (protected resource metadata) | Your resource server publishes `/.well-known/oauth-protected-resource` naming its `resource` URI and `authorization_servers`, pointed at from a `401` `WWW-Authenticate` header | **your MCP server** |
| [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) (resource indicators) | The client passes `resource=<your MCP server URI>` when requesting a token; the AS binds the token's `aud` to it | **Authorizer** binds it (see the `resource` parameter on the [Authorization Endpoint](./oauth2-oidc#authorization-endpoint) and [Token Exchange](../enterprise/token-exchange)); **your MCP server** enforces `aud` on every call |
| [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) (token exchange) | An agent gets a token that says "agent X acting for user Y" — see [Token Exchange & Delegation](../enterprise/token-exchange) | **Authorizer** (`grant_type=...token-exchange` on `/oauth/token`) |

Authorizer also serves the [RFC 8414 alias](./oauth2-oidc#rfc-8414-alias)
`/.well-known/oauth-authorization-server` — the identical metadata document as
`/.well-known/openid-configuration` — for MCP clients that probe the OAuth-only
discovery path instead of falling back to OIDC discovery.

The [`with-mcp`](https://github.com/authorizerdev/examples/tree/main/with-mcp) example
builds this end to end: a ~150-line Express MCP server that validates Authorizer-issued
JWTs (issuer + `aud`) and a client walkthrough that goes 401 → RFC 9728 discovery →
`client_credentials` (rejected — wrong `aud`) → RFC 8693 token exchange with
`resource=<mcp-server-uri>` → 200. Its own bonus section documents this page's
built-in stdio server too, for the "which one do I want" question.

## See also

- [Authorization (FGA)](./authorization) — the relationship model behind the permission tools.
- [REST API](./rest-api) / [GraphQL API](./graphql-api) — the same operations over HTTP.
- [FGA Guide](./fga-guide) — building an authorization model and writing tuples.
- [OAuth2 / OIDC](./oauth2-oidc) — the authorization-server surface used to protect a custom MCP server.
- [Token Exchange & Delegation](../enterprise/token-exchange) — agent-acting-for-user delegated tokens (RFC 8693).
