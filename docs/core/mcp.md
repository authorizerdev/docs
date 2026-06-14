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
permission-aware [RAG](https://github.com/authorizerdev) pattern, but driven from inside
the model.

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
  --fga-store=file://./fga_store \
  --mcp-bearer="$USER_ACCESS_TOKEN" \
  --mcp-authorizer-url=https://auth.example.com
```

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
        "--fga-store", "file://./fga_store",
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

## See also

- [Authorization (FGA)](./authorization) — the relationship model behind the permission tools.
- [REST API](./rest-api) / [GraphQL API](./graphql-api) — the same operations over HTTP.
- [FGA Guide](./fga-guide) — building an authorization model and writing tuples.
