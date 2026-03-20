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

- [Yugabyte](https://www.yugabyte.com/)

  ```bash
  --database-type=yugabyte --database-url="postgres://username:password@localhost:5432/postgres"
  ```

- [CockroachDB](https://www.cockroachlabs.com)

  ```bash
  --database-type=postgres --database-url="postgres://username:password@localhost:5432/postgres"
  ```

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
  --couchbase-bucket-ram-quota=1000 \
  --couchbase-scope="_default"
  ```

> Note: For MongoDB and ArangoDB, use `--database-name` since the database name is not part of the connection URL.

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
./build/server \
  --database-type=sqlite \
  --database-url=test.db \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret \
  --redis-url=redis://localhost:6379
```
