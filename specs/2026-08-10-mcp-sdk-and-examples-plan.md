# MCP rollout — SDK and examples changes

Companion to `2026-08-10-mcp-http-transport.md`. Server work is PR
authorizerdev/authorizer#757; this is what has to follow it, and in what order.

**Status**: plan only, nothing implemented.

---

## 0. Correction after testing with a real client

An earlier version of this plan (and of the docs) claimed Claude Code could
connect over OAuth once RFC 8252 loopback matching landed. **That is wrong.**
Tested against Claude Code 2.1.226:

```
authorizer-local: http://localhost:8099/mcp (HTTP)
  - ✘ Failed to connect — Incompatible auth server: does not support dynamic client registration
```

Claude Code does not fall back to a manually-supplied client id; it refuses the
server. The loopback fix is necessary but nowhere near sufficient. The only
verified path today is a static bearer token bound to `<url>/mcp`, which does
work — `claude mcp list` reports **✔ Connected**, and `tools/list` and
`tools/call` both function over the wire.

This raises the priority of CIMD from "nice for zero-touch onboarding" to "the
thing that makes the OAuth machinery reachable by the flagship client at all".

## 1. What actually changed for a client

Three server changes have client-visible consequences. Everything below follows
from them.

| Change | Consequence for a client |
|---|---|
| `POST <url>/mcp` exists, OAuth-protected | A client can talk MCP to Authorizer, but only with a token whose `aud` is `<url>/mcp` |
| RFC 8707 `resource` now survives the login redirect and token refresh | Requesting a resource-bound token actually works end to end; SDKs need a way to ask for one |
| A refresh naming a *different* resource is rejected with `invalid_target` | An SDK that sets `resource` on refresh must send the same value it was granted, or omit it |

The last one is the only **breaking** change, and only for callers who were
already passing a mismatched `resource` on refresh — previously ignored, now a
`400`. That was never a working configuration, but it did not error before.

## 2. SDK changes

### 2.1 `authorizer-js` — required

`authorize()` (`src/index.ts:113`) builds the `/authorize` query from a fixed
set of parameters and has **no way to pass `resource`**. A browser client
therefore cannot obtain an MCP-bound token at all.

- Add `resource?: string` to `Types.AuthorizeRequest`, forwarded to the
  `/authorize` query when set.
- Forward the same value on the code→token exchange, since the token endpoint
  requires the echoed `resource` to match the one bound to the code.
- Do **not** send it on refresh unless the caller asked for it. The server now
  carries the binding itself, and sending a stale or guessed value turns a
  working refresh into `invalid_target`.
- Types are hand-maintained here (see the release runbook's note on why
  `authorizer-js` stays hand-typed), so the type addition is manual.

### 2.2 `authorizer-go` — small

`GetTokenRequest.Resource` already exists (`get_token.go:37`) and is sent
(`get_token.go:101`), so the authorization-code path works today.

- Audit the refresh path for the same "don't send unless asked" rule as above.
- Add a `Resource` option wherever the SDK builds an authorization URL, matching
  the JS change, so both SDKs can request an MCP-bound token.

### 2.3 `authorizer-react` — none expected

It delegates to `authorizer-js`; the change surfaces automatically once 2.1
lands. Verify the `authorize()` passthrough does not strip unknown fields.

### 2.4 `authorizer-python` — audit only

Confirm whether its token request exposes `resource`. Same rules if it does.

### 2.5 Not affected

`authorizer-flutter-sdk`, `authorizer-svelte`, `authorizer-vue` — no OAuth
parameter surface of their own.

## 3. Examples

### 3.1 `with-mcp` — needs the biggest rewrite

Today it demonstrates the **inverse** pattern: a ~150-line Express MCP server
that Authorizer protects as an external resource server, plus a bonus section on
the stdio subcommand. Both framings are now partly wrong.

- Lead with Authorizer's **own** MCP server: `--mcp-enabled`, the discovery
  chain, connecting Claude Code and a claude.ai custom connector.
- Keep the external-resource-server walkthrough — it is still valid and is what
  someone protecting *their* MCP server needs — but demote it to the second half
  and stop describing the stdio subcommand as the built-in option.
- Its client walkthrough currently ends at `client_credentials` being rejected
  for wrong `aud` and then uses token exchange. Worth adding the plain
  authorization-code path with `resource`, which is what a real MCP client does.

### 3.2 `with-claude-agents` — needs updating

Almost certainly wires `claude mcp add` against the stdio subcommand. Should
become `claude mcp add --transport http authorizer https://auth.example.com/mcp`
with a note about registering the loopback redirect URIs.

### 3.3 Verify, likely no change

`with-agent-delegation`, `with-agent-permissions`, `with-a2a-agent-card`,
`with-agents-python`, `with-m2m-client-credentials` — these exercise token
exchange and `client_credentials`, which are unchanged. Check only that none of
them sets `resource` on a refresh call.

### 3.4 New example, optional

A minimal "connect Claude to your Authorizer" walkthrough would carry more
weight than docs alone, since the client-side configuration (which redirect URI,
which client ID, the exact resource URL) is where people will get stuck.

## 4. Docs

`authorizer-docs/docs/core/mcp.md` is already rewritten in the working tree and
needs its own PR — separate repo. It documents the discovery chain, the client
compatibility matrix, and the absence of dynamic client registration.

Also worth a pass: `docs/core/oauth2-oidc.md` should mention that `resource`
survives refresh, since that is now a guarantee clients can rely on.

## 5. Order

1. **Server PR merges** (#757). Nothing below is testable before it.
2. **`authorizer-js`** — the only hard blocker for a browser client.
3. **`authorizer-docs`** — so the client instructions exist before examples cite
   them.
4. **`with-mcp` + `with-claude-agents`** — the two examples that are actively
   misleading once the server ships.
5. **`authorizer-go`**, python audit, remaining example verification.

Per the release runbook the server releases first and SDKs follow, so steps 2
and 5 are SDK releases in their own right, not part of the server tag.

## 6. Open question for the SDKs

Neither SDK has an opinion about **which** resource to request. A client
targeting Authorizer's own MCP server needs `<authorizerURL>/mcp`, which the SDK
already knows. Worth deciding whether `authorize({ resource: 'mcp' })` should be
sugar for that, or whether callers always pass the full URI. Sugar is friendlier
and removes a class of typo that produces a permanent, hard-to-diagnose 401; a
literal URI is more honest about what is being requested. My inclination is the
literal URI, with the docs showing the exact string, because the same parameter
is used for third-party resource servers where no sugar is possible.
