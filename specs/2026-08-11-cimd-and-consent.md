# Client ID Metadata Documents + consent screen

Follow-up to `2026-08-10-mcp-http-transport.md` (shipped as authorizerdev/authorizer#757).

**Why now**: verified against Claude Code 2.1.226, the OAuth path to `/mcp` does
not work — the client refuses with *"Incompatible auth server: does not support
dynamic client registration"*. Everything #757 built (PKCE, discovery, audience
binding, loopback redirects) is unreachable by the flagship client without a
client-registration mechanism. CIMD is that mechanism.

---

## 1. Why CIMD and not DCR

The MCP authorization spec (2025-11-25) demoted DCR: authorization servers
**SHOULD** support Client ID Metadata Documents and **MAY** support DCR, which it
keeps only *"for backwards compatibility with earlier versions"*. Client priority
order is pre-registered → CIMD → DCR → prompt.

Auth0 ships DCR Enterprise-only, disabled by default, behind ACLs or a reverse
proxy, and recommends CIMD instead. Anthropic steers directory traffic away from
DCR because it registers a fresh client on every connection — unbounded row
growth in every self-hosted deployment.

CIMD avoids all of it: the `client_id` **is** an HTTPS URL the authorization
server fetches. No write endpoint, no rows, no schema change.

## 2. What has to be built

### 2.1 The resolver

When `client_id` is an HTTPS URL with a path component:

1. Fetch it through `validators.SafeHTTPClient` — already exists, resolves the
   host once and pins the dial to the validated IP, so DNS-rebinding TOCTOU is
   closed. This is the SSRF mitigation the spec's §6 security considerations
   demand, and it is why this feature is small rather than dangerous.
2. Require `client_id` in the document to equal the URL **exactly** (spec MUST).
3. Require `client_name` and `redirect_uris` (spec MUST).
4. Validate the presented `redirect_uri` against the document's list (spec MUST),
   reusing `redirectURIMatches` so RFC 8252 loopback rules apply identically.
5. Cache respecting HTTP cache headers (spec SHOULD), bounded, with a floor and
   ceiling so a hostile `max-age` cannot pin or thrash the cache.

### 2.2 The consent screen

Mandatory, not optional. CIMD makes client identity **self-asserted**: anyone can
host a metadata document. The spec requires the authorization server to display
the redirect URI hostname, and to warn when the redirect URIs are localhost-only
(because any local process can bind a port and claim to be the legitimate client).

Scoped to **CIMD clients only**. Pre-registered and first-party clients keep
today's silent approval — the operator already vouched for them, and changing
that would be an unrelated behaviour break.

No persistence. `/authorize` is hit once per connector setup; refreshes go to
`/oauth/token`. A "remember this grant" table would mean a schema change across
13 providers for no benefit here.

### 2.3 Discovery

Advertise `client_id_metadata_document_supported: true` — but only when the
feature is enabled, because advertising a capability that is not implemented
makes a client select it and then fail.

## 3. Configuration

| Flag | Default | Why |
|---|---|---|
| `--enable-client-id-metadata-document` | `false` | Changes the authorization endpoint's trust model for *every* client, not just MCP. Explicit opt-in. |
| `--client-id-metadata-allowed-domains` | empty (any HTTPS) | The spec's optional domain trust policy. Empty = open server, which is what public MCP servers want; an allowlist is for locked-down deployments. |

## 4. Threat model

| Threat | Mitigation |
|---|---|
| SSRF to internal endpoints via a hostile `client_id` URL | `validators.SafeHTTPClient` — one-shot DNS, IP pinned, private/loopback rejected |
| Client impersonation (attacker hosts a doc claiming another's name) | Consent screen shows the redirect URI **hostname**, which is what actually receives the code |
| Localhost port race (any local process claims to be the client) | Explicit warning on the consent screen for loopback-only clients; the spec says this cannot be fully solved server-side |
| Cache poisoning / pinning via hostile cache headers | Clamp TTL to a floor and ceiling; bound total entries |
| Resource exhaustion via many distinct client_id URLs | Response size cap, request timeout, bounded cache, existing rate limiting on `/authorize` |
| Token minted for an unintended audience | Unchanged: RFC 8707 `resource` still binds `aud`, still enforced at `/mcp` |

## 5. Test plan

- Resolver: happy path; `client_id` mismatch rejected; non-HTTPS rejected; no
  path component rejected; missing required fields rejected; oversized response
  rejected; private/loopback URL rejected (SSRF); cache hit does not refetch;
  hostile `max-age` clamped.
- `/authorize`: a CIMD client reaches consent, not a silent redirect; a
  pre-registered client is unaffected; a `redirect_uri` absent from the document
  is rejected; loopback port-agnostic matching still applies.
- Consent: approving issues a code; denying returns `access_denied` to the
  registered redirect; the redirect hostname is displayed; a loopback-only client
  shows the warning; CSRF-protected.
- Discovery: `client_id_metadata_document_supported` present only when enabled.
- **End-to-end against a real Claude Code client** — the step whose absence
  produced a wrong claim last time. Not "believed to work": observed connecting.

## 6. Out of scope

- ~~RFC 7591 DCR~~ — **no longer out of scope**: implemented in this same PR
  behind `--enable-dynamic-client-registration`, off by default. CIMD stayed the
  preferred mechanism, but Claude Code's released version predates CIMD and
  refuses a server without a `registration_endpoint`, so CIMD alone left the
  flagship client unable to connect — the exact problem §1 opens with. Both
  mechanisms share the consent screen and the mandatory-S256-PKCE rule.
- `private_key_jwt` for CIMD clients (spec MAY).
- Persisted consent grants.
- Delegated (RFC 8693) tokens at `/mcp` — still deferred, see the transport spec.
