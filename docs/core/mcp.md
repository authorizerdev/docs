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

## Design & security model

The MCP server is deliberately minimal and **stdio-only**:

- **Transport is stdio only.** The host launches `authorizer mcp` as a child process and
  talks to it over standard input/output using MCP's JSON-RPC framing. There is **no**
  HTTP, SSE, or TCP listener — the server cannot be exposed over the network. This is
  enforced in code, not configuration.
- **Only safe tools are exposed.** Credential-issuing operations (`signup`, `login`,
  `session`) and destructive ones (`deactivate_account`) are explicitly **not** exposed
  as tools. The model can read identity and permissions, never mint tokens or mutate
  accounts.
- **Identity comes from a bearer token** you pass at launch — the model never sees a
  login form and cannot escalate beyond that token's subject. Permission checks run
  through the exact same FGA trust gates as the GraphQL/REST APIs.

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

## Running the server

```bash
authorizer mcp \
  --client-id=YOUR_CLIENT_ID \
  --database-type=sqlite \
  --database-url=auth.db \
  --encryption-key=your-encryption-key \
  --mcp-bearer="$USER_ACCESS_TOKEN" \
  --mcp-authorizer-url=https://auth.example.com
```

With a SQLite/Postgres/MySQL `--database-type`, FGA reuses the main database
automatically — no `--fga-store` flag needed (see
[Enabling FGA](./authorization#1-enabling-fga)). Only pass `--fga-store` /
`--fga-store-url` when the main database is NoSQL (MongoDB, DynamoDB, …) or
you want FGA on a separate store; `--fga-store` takes one of `sqlite`,
`postgres`, `mysql`, or `memory` — not a URI.

The `mcp` command inherits the root server flags (database, JWT, client-id, `--fga-store`,
etc.) so it can resolve identity and run the FGA engine in-process.

### MCP-specific flags

| Flag                    | Description                                                                                                        | Required        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------- |
| `--mcp-bearer`          | Access token attached as `Authorization: Bearer <token>` on every tool call. Needed for `profile`/`*_permissions`. | for auth tools  |
| `--mcp-authorizer-url`  | Public URL of your Authorizer instance, used for JWT issuer validation (e.g. `https://auth.example.com`).          | with `--mcp-bearer` |

> Logging goes to **stderr** only — `stdout` is reserved for the MCP JSON-RPC stream, so
> never print to it.

## Connecting a host

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
        "--encryption-key", "your-encryption-key",
        "--mcp-bearer", "USER_ACCESS_TOKEN",
        "--mcp-authorizer-url", "https://auth.example.com"
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
`FailedPrecondition` (e.g. *fga is not enabled*).

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
`client_credentials` (rejected — wrong `aud`) → [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) token exchange with
`resource=<mcp-server-uri>` → 200. Its own bonus section documents this page's
built-in stdio server too, for the "which one do I want" question.

## See also

- [Authorization (FGA)](./authorization) — the relationship model behind the permission tools.
- [REST API](./rest-api) / [GraphQL API](./graphql-api) — the same operations over HTTP.
- [FGA Guide](./fga-guide) — building an authorization model and writing tuples.
- [OAuth2 / OIDC](./oauth2-oidc) — the authorization-server surface used to protect a custom MCP server.
- [Token Exchange & Delegation](../enterprise/token-exchange) — agent-acting-for-user delegated tokens (RFC 8693).
