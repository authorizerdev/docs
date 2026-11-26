---
sidebar_position: 3
title: Databases
---

# Databases

## Supported Databases

Authorizer v2 configures the database via CLI flags. The required flags are `--database-type` and `--database-url`.

- [Postgres](https://www.postgresql.org/)

  ```bash
  --database-type=postgres --database-url="postgres://username:password@localhost:5432/postgres"
  ```

  To keep Authorizer's tables in their own schema, see [Using a Postgres schema](#postgres-schema).

- [Yugabyte](https://www.yugabyte.com/)

  ```bash
  --database-type=yugabyte --database-url="postgres://username:password@localhost:5432/postgres"
  ```

- [CockroachDB](https://www.cockroachlabs.com)

  ```bash
  --database-type=cockroachdb --database-url="postgres://username:password@localhost:26257/defaultdb"
  ```

  > Use `--database-type=cockroachdb`, not `postgres`: CockroachDB speaks the PostgreSQL wire protocol, but Authorizer needs to know it is CockroachDB to migrate its schema correctly.
  >
  > **Already running with `--database-type=postgres`?** Before v2.4.7 these docs showed `postgres` for CockroachDB. That configuration starts once, but every restart fails with `constraint "uni_authorizer_oauth_states_state_key" ... does not exist (SQLSTATE 42704)` and `failed to create storage provider`. Change the flag to `--database-type=cockroachdb` and start again: the existing schema and data are kept, and later restarts work.

- [SereneDB](https://www.serenedb.com/) (since v2.4.7)

  ```bash
  --database-type=serenedb --database-url="postgres://postgres:password@localhost:7890/postgres"
  ```

  > SereneDB speaks the PostgreSQL wire protocol (default port `7890`). Use SereneDB **26.11 or later**; Authorizer is tested against 26.11.2. Authorizer creates and upgrades its tables with its own versioned migrations, recorded in the `authorizer_schema_migrations` table, instead of the automatic migration it uses on other SQL databases. SereneDB is not an OpenFGA datastore, so to use [fine-grained authorization](./authorization) pass an explicit `--fga-store`.

- [SurrealDB](https://surrealdb.com/) (since v2.4.8)

  ```bash
  --database-type=surrealdb \
  --database-url="https://surreal.example.com" \
  --database-username="authorizer" \
  --database-password="*********" \
  --database-name=authorizer \
  --surrealdb-namespace=authorizer
  ```

  > Use SurrealDB **4.0 or later**; Authorizer is tested against 4.0.1. Prefer an `http(s)://` URL: it is stateless, so there is nothing to restore after a dropped connection (`ws(s)://` is also accepted). `--database-name` is the SurrealDB database and `--surrealdb-namespace` (default `authorizer`) its namespace; both are created on first start when the credentials allow it. The credentials can be a root, namespace or database user. Authorizer creates its tables and indexes with its own versioned migrations, recorded in the `authorizer_schema_migrations` table. SurrealDB is not an OpenFGA datastore, so to use [fine-grained authorization](./authorization) pass an explicit `--fga-store`. To let SurrealDB verify Authorizer's tokens for your own tables, see [SurrealDB integration](../integrations/surrealdb).

- [MySQL](https://www.mysql.com/)

  ```bash
  --database-type=mysql --database-url="username:password@tcp(localhost:port)/database_name"
  ```

- [PlanetScale](https://planetscale.com/)

  ```bash
  --database-type=planetscale --database-url="username:password@tcp(localhost:port)/database_name"
  ```

- [MariaDB](https://mariadb.org/)

  ```bash
  --database-type=mariadb --database-url="username:password@tcp(localhost:port)/database_name"
  ```

- [SQLite](https://www.sqlite.org/index.html)

  ```bash
  --database-type=sqlite --database-url=test.db
  ```

- [libSQL / Turso](https://turso.tech/)

  ```bash
  --database-type=libsql --database-url="libsql://your-db.turso.io?authToken=YOUR_TOKEN"
  ```

- [SQLServer](https://www.microsoft.com/en-us/sql-server/)

  ```bash
  --database-type=sqlserver --database-url="sqlserver://gorm:LoremIpsum86@localhost:9930?database=gorm"
  ```

- [MongoDB](https://www.mongodb.com)

  ```bash
  --database-type=mongodb --database-url="mongodb://localhost:27017" --database-name=authorizer
  ```

- [ArangoDB](https://www.arangodb.com/)

  ```bash
  --database-type=arangodb --database-url="https://root:password@localhost.arangodb.cloud:8529" --database-name=authorizer
  ```

- [CassandraDB](https://cassandra.apache.org/)

  ```bash
  --database-type=cassandradb \
  --database-host="db-connection-string" \
  --database-username="test" \
  --database-password="*********" \
  --database-cert="Base64 encoded cert string" \
  --database-cert-key="Base64 encoded cert key" \
  --database-ca-cert="Base64 encoded CA cert"
  ```

  > Note for CassandraDB: If using a cloud provider like [DataStax](https://www.datastax.com/products/datastax-astra), they don't allow creating `keyspace`. Please create a `keyspace` named `authorizer` from their GUI.

  > Note for CassandraDB and ScyllaDB: filtering audit logs by `resource_type` or
  > `resource_id` is served by secondary indexes, which the server creates on
  > startup (since v2.4.2). On an existing deployment with a large `authorizer_audit_logs` table
  > those indexes backfill in the background — Scylla builds them as materialized
  > views — so those two filters can return **incomplete** results until the
  > backfill completes. Check `nodetool viewbuildstatus` before treating a
  > filtered audit query as authoritative, and expect elevated cluster I/O while
  > it runs. Filtering by a `from_timestamp`/`to_timestamp` range cannot use an
  > index at all (the range is on a non-key column), so it performs a scan with
  > `ALLOW FILTERING`. So does any query that combines two or more filters,
  > because one query can use only one index. This is fine for an occasional
  > admin query and gets slower as the table grows.

- [ScyllaDB](https://www.scylladb.com/)

  ```bash
  --database-type=scylladb \
  --database-host="192.168.0.1,192.168.0.2,192.168.0.3" \
  --database-username="scylladb" \
  --database-password="*********"
  ```

- [DynamoDB](https://aws.amazon.com/dynamodb/)

  ```bash
  --database-type=dynamodb \
  --aws-region=ap-south-1 \
  --aws-access-key-id=YOUR_ACCESS_KEY \
  --aws-secret-access-key=YOUR_SECRET
  ```

- [Couchbase](https://www.couchbase.com/)

  ```bash
  --database-type=couchbase \
  --database-url="couchbase://127.0.0.1" \
  --database-username="admin" \
  --database-password="*********" \
  --couchbase-bucket="authorizer" \
  --couchbase-ram-quota=1000 \
  --couchbase-scope="_default"
  ```

  > Note for Couchbase: the server creates its secondary indexes (GSIs) on
  > startup. Couchbase builds an index synchronously, so when a new index is
  > added against a collection that already holds a lot of data — an upgrade on a
  > large `authorizer_audit_logs` collection, for example — the statement can
  > outrun the client. That is handled: the attempt is retried, and because the
  > index definition is registered server-side the retry sees it already exists
  > and startup continues while the build finishes in the background. No action
  > is needed, but index builds may show activity for a while after a version
  > upgrade.

> Note: For MongoDB and ArangoDB, use `--database-name` since the database name is not part of the connection URL.

## Using a Postgres schema {#postgres-schema}

By default Authorizer creates its tables in the database's default schema,
usually `public`. To keep them in a dedicated schema, for example when
Authorizer shares a database with your application, add `search_path` to the
connection URL. There is no separate flag for this.

```bash
--database-type=postgres \
--database-url="postgres://username:password@localhost:5432/mydb?sslmode=disable&search_path=authz"
```

Create the schema before you start Authorizer. Authorizer does not create it:
with a `search_path` that names a schema that doesn't exist, startup fails
with `no schema has been selected to create in (SQLSTATE 3F000)`.

```sql
CREATE SCHEMA authz;
-- If Authorizer connects as a role that does not own the schema:
GRANT USAGE, CREATE ON SCHEMA authz TO authorizer_role;
```

When the schema exists, Authorizer creates every table there on first start
and uses only that schema from then on. This covers the `authorizer_*` tables
and also the [fine-grained authorization](./authorization) (OpenFGA) tables
(`store`, `tuple`, `authorization_model`, `assertion`, `changelog`,
`goose_db_version`), which share the main database by default. Tables of the
same name in `public` are not read or changed.

Notes:

- Name a single schema, such as `search_path=authz`. A list like
  `authz,public` is not tested: new tables would go in the first schema, but a
  table that already exists in a later schema could be found and used.
- The `search_path` must stay the same on every start. If you change it,
  Authorizer creates a new, empty set of tables in the new schema. It does not
  move existing data.
- This was tested with `--database-type=postgres`. CockroachDB, Yugabyte and
  SereneDB also speak the PostgreSQL protocol, but `search_path` has not been
  tested with them.

## Tables / Collections

Authorizer creates and manages the following tables/collections:

- `authorizer_users` -- stores basic user information
- `authorizer_verification_requests` -- stores email verification and forgot password requests
- `authorizer_sessions` -- stores user sessions

## Session Store

For each request requiring authorization, Authorizer validates the HTTP Cookie or Authorization header. To improve throughput, an in-memory store is used.

Authorizer supports two session stores:

- [Redis](https://redis.io/) -- configured via `--redis-url`. Persisted as long as Redis is running.
- In-memory -- default when no Redis URL is set. Not recommended for production.

Example with Redis:

```bash
./authorizer \
  --database-type=sqlite \
  --database-url=test.db \
  --url=http://localhost:8080 \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --encryption-key=test-encryption-key \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret \
  --redis-url=redis://localhost:6379
```
