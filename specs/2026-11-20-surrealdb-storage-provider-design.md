# SurrealDB storage provider — design

**Status:** implemented in authorizerdev/authorizer#906 (merged) · **Target:** Authorizer 2.5.0, alongside the `kid` header fix (authorizerdev/authorizer#904, merged) and the SurrealDB integration guide (authorizerdev/docs#99)

## Goal

Let Authorizer keep its own data — users, sessions, tokens, clients, organizations, audit logs — in SurrealDB, with `--database-type=surrealdb`. Together with the integration already built (SurrealDB verifies Authorizer tokens through `DEFINE ACCESS ... WITH JWT URL`), an application can then run its identities, its auth data and its app data in one SurrealDB.

Non-goals:
- **FGA on SurrealDB.** OpenFGA has no SurrealDB datastore. As with CockroachDB and SereneDB, FGA needs an explicit `--fga-store`.
- **Live queries, graph relations, vector fields.** The provider stores Authorizer's records; it does not use SurrealDB-specific features beyond what correctness needs.

## Verified behaviour (SurrealDB 4.0.1, Go SDK `surrealdb.go/v2` v2.0.1)

Probed against a live server before writing this design, not taken from docs:

| Requirement | Result |
|---|---|
| Unique index, incl. composite | Enforced; any number of `null`/absent values allowed |
| 20 concurrent inserts of one unique key | 1 succeeds, 19 rejected |
| 20 concurrent `UPSERT ... WHERE` of a new key | All succeed, exactly 1 row |
| 20 concurrent consume-once (`DELETE ... RETURN BEFORE`) | Exactly 1 gets the row |
| Read-your-writes through an index | 0 misses in 200 |
| Transaction failing mid-way | Fully rolled back |
| Indexed lookup | `EXPLAIN` shows `IndexScan` |
| Decode into Authorizer's json-tagged schema structs | Works with `SELECT *, record::id(id) AS _id OMIT id` |
| One SDK client shared by 20 goroutines | Safe on both `ws://` and `http://` |
| Concurrent multi-statement transactions on the same rows | **Conflict**: most fail with `Transaction write conflict. This transaction can be retried` |
| Unique violation error | A `*QueryError` with the message `Database index ... already contains ...` — **no typed kind** |
| Missing record | Empty result, **no error** |
| SDK `IsTransactionConflict` | **Does not** recognise the conflict above (it is a `QueryError`, not a `ServerError`) |

The last four rows drive most of the design.

## Configuration

```bash
--database-type=surrealdb
--database-url=https://surreal.example.com      # or wss://; http(s) recommended (see below)
--database-username=authorizer --database-password=...
--database-name=authorizer                       # SurrealDB database
--surrealdb-namespace=authorizer                 # new flag, default "authorizer"
```

- **Namespace:** SurrealDB has namespace *and* database; Authorizer has one `--database-name`. A dedicated `--surrealdb-namespace` flag follows the existing per-backend precedent (`--couchbase-bucket`, `--couchbase-scope`).
- **Engine:** the SDK picks HTTP or WebSocket from the URL. Both passed the probes. **HTTP is recommended**: it is stateless, so there is no session to restore after a dropped connection; WebSocket reconnection with session restore lives in the SDK's `contrib/rews`, which is outside its compatibility guarantee. Both are accepted.
- **Credentials:** a root, namespace or database user. The provider signs in at startup and signs in again when SurrealDB refuses a request because the sign-in token expired (1h by default), then retries that request once. *Changed during implementation:* the SDK's token renewal only covers `SignInWithRefresh` pairs, which system users do not get, so relying on it left the server refusing every query after an hour over HTTP. `TestReauthenticatesAfterTokenExpiry` covers HTTP and WebSocket.
- **Minimum version:** SurrealDB 4.0 (tested on 4.0.1). The SDK supports 3.3+, but nothing below 4.0 is tested.

## Data model

- One table per collection, named from `schemas.Collections` (e.g. `authorizer_users`), the same names as every other backend.
- Record ID = Authorizer's string ID: `type::record("authorizer_users", $id)`. Lookups by ID are direct record fetches, not index scans.
- Reads project `record::id(id) AS _id` and omit `id`, so results decode straight into the existing `schemas.*` structs via their `json` tags. No new types.
- Tables are `SCHEMALESS`, like the MongoDB/ArangoDB/Couchbase providers: field types come from the Go structs. Indexes are defined explicitly (below).

## Schema and migrations

Reuse the SereneDB provider's approach (authorizerdev/authorizer#792): hand-written, versioned DDL applied by a small runner, recorded in an `authorizer_schema_migrations` table.

- Each version runs in one transaction together with its record; DDL uses `DEFINE ... IF NOT EXISTS`, so re-runs and concurrent boots are harmless. Concurrent boots resolve the same way as SereneDB's: retry on conflict, and a version found recorded afterwards counts as applied.
- **Indexes mirror the SQL models exactly**, so uniqueness behaviour is identical across backends:
  - Unique: verification request `(identifier, email)`, authenticator `(user_id, method)`, OAuth state `state_key`, client `client_id`, trusted issuer `issuer_url`, organization `name`, org membership `(org_id, user_id)`, federated identity `(org_id, issuer, subject)`, SCIM endpoint `org_id`, WebAuthn `credential_id`, webhook `event_name`, email template `event_name`.
  - Non-unique: user `email`, `phone_number`, `external_id`; OTP `email`, `phone_number`; session-token / MFA-session `(user_id, key_name)` and `expires_at`; and every `org_id` / `user_id` / `client_id` foreign-key column the SQL models index.
  - User email and phone uniqueness stays in the application layer (`AddUser`/`UpdateUser`), as on every v2 backend.
- A **static parity test** (like SereneDB's `TestSchemaDDLMatchesModels`) compares the index DDL against the GORM index tags, so a model change without a SurrealDB migration fails `make test` with no database needed.

## Query patterns

All values are bound as query variables; table and field names come from constants. Nothing request-derived is concatenated into SurrealQL.

| Operation | SurrealQL |
|---|---|
| Insert | `CREATE type::record($tb, $id) CONTENT $doc` |
| Update (full replace) | `UPDATE type::record($tb, $id) CONTENT $doc` |
| Get by field | `SELECT *, record::id(id) AS _id OMIT id FROM <table> WHERE field = $v LIMIT 1` |
| List + total | `... ORDER BY created_at DESC LIMIT $limit START $offset` and `SELECT count() FROM <table> [WHERE ...] GROUP ALL` |
| Search (`ListUsers`) | `string::contains(string::lowercase(field ?? ""), $q)` on the same fields as other backends; `%`/`_` in input are literal, so no wildcard escaping is needed |
| Upsert on a unique key | `UPSERT <table> SET ... WHERE <key> = $k` — race-safe (verified above) |
| Consume-once (OAuth state, session token by key) | `DELETE ... WHERE ... RETURN BEFORE`; one caller gets the row, the rest get nothing |
| Compare-and-set (`ConsumeAuthenticatorRecoveryCode`) | `UPDATE ... SET recovery_codes = $new WHERE id = $id AND recovery_codes = $old RETURN AFTER`; success iff a row comes back |
| Bulk `UpdateUsers` | Rejects empty `ids`; fields restricted to the allow-list other backends use |
| `ListAuditLogs` filters | Allow-listed filter keys only, each bound as a variable |

## Not-found contract

- Single-entity getters return `fmt.Errorf("...: %w", ErrNotFound)` when the query returns no row — the same pattern as ArangoDB and DynamoDB, whose drivers also have no not-found error.
- `GetClientByClientID` returns `(nil, nil)`, the documented legacy exception.
- Add `surrealdb.IsNotFound` to `storage.IsNotFound`, and the provider to `TestNotFoundContractIsUniform`.

## Errors and retries

- **Duplicate key:** classified by a helper that recognises the unique-index message on a `*QueryError`. It is message-based because SurrealDB 4.0.1 returns no typed kind for it; a test pins the exact message so an SDK or server change that alters it fails CI.
- **Transaction conflicts:** cascade deletes (user, client, organization, webhook) and the migration runner run as one `BEGIN ... COMMIT` query and are **replayed whole** on a conflict — bounded attempts, jittered backoff, context-aware — the same policy as the SQL provider's `RetryTransactions`. Single statements did not conflict in the probes, so they are not retried; a contention test guards that.

## Testing

- `make test-surrealdb`: pinned image (`surrealdb/surrealdb:v4.0.1`), readiness via `surreal isready` in the container (the image has no shell), then `TEST_DBS=surrealdb` over the whole module. Added to `test-all-db`, `test-docker-up` and `test-cleanup`.
- **The existing storage-provider suite** (`internal/storage/provider_test.go`) exercises all 124 interface methods on the new backend, plus the not-found contract tests.
- **New provider tests:** migrations (fresh, restart no-op, upgrade, failed version rolls back, concurrent boot); static schema parity; contention (signup race, OTP consume-once, upsert race, concurrent cascade deletes — each with a check that it fails without the fix it guards); duplicate-key message pin.
- **Integration:** the full module suite with `TEST_DBS=surrealdb`, and `make test-all-db` across all backends before release.

## Docs and release

Databases page entry (flags, minimum version, HTTP recommendation, `--fga-store`), README/site/Helm lists (17 databases), changelog, and the 2.5.0 release notes together with the `kid` change.

## Plan

1. Scaffold from `provider_template` (`make generate-db-template dbname=surrealdb`), wiring, config flag, constants, FGA mapping test.
2. Connection, migrations, schema parity test.
3. Methods by area: users → verification/OTP/sessions/tokens → MFA/authenticators/WebAuthn → clients/trusted issuers/SAML → organizations/SCIM/domains → webhooks/templates/audit.
4. Retry, error classification, contention tests.
5. Full suite on SurrealDB, `make test-all-db`, lint; docs and site.

Each step lands with its tests passing on SurrealDB before the next.

## Risks

- **SDK maturity:** `surrealdb.go/v2` is weeks old (v2.0.0 on 2026-11-05). Pin it; keep the SDK surface to `Query`, sign-in and `Use`.
- **Message-based error classification** (duplicate key, conflict): pinned by tests, but brittle across SurrealDB versions — another reason to pin the tested server version in docs.
- **`count()` over large tables** for pagination totals is a full scan; same as several existing backends, but worth noting for very large audit-log tables.

## Decisions (resolved 2026-11-20)

1. **Namespace:** new `--surrealdb-namespace` flag, default `authorizer`; `--database-name` is the SurrealDB database.
2. **Engine:** docs recommend HTTP(S); WebSocket URLs are still accepted.
3. **Minimum SurrealDB:** 4.0, tested on 4.0.1.
