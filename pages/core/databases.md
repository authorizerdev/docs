# Databases

## Supported Databases

- [Postgres](https://www.postgresql.org/)

  Sample connection string: `postgres://username:password@localhost:5432/postgres`

- [Yugabyte](https://www.yugabyte.com/)

  Sample connection string: `postgres://username:password@localhost:5432/postgres`

- [CockroachDB](https://www.cockroachlabs.com)

  Sample connection string: `postgres://username:password@localhost:5432/postgres`

- [MySQL](https://www.mysql.com/)

  Sample connection string: `username:password@tcp(localhost:port)/database_name`

- [MariaDB](https://mariadb.org/)

  Sample connection string: `username:password@tcp(localhost:port)/database_name`

- [SQLite](https://www.sqlite.org/index.html)

  Sample connection string: `test.db`

- [SQLServer](https://www.microsoft.com/en-us/sql-server/)

  Sample connection string: `sqlserver://gorm:LoremIpsum86@localhost:9930?database=gorm"`

- [MongoDB](https://www.mongodb.com)

  Sample connection string: `mongodb://localhost:27017`

- [ArangoDB](https://www.arangodb.com/)

  Sample connection string: `https://root:password@localhost.arangodb.cloud:8529`

- [CassandraDB](https://cassandra.apache.org/)

  Sample config

  ```
    DATABASE_TYPE=cassandradb
    DATABASE_HOST="db connection string"
    DATABASE_USERNAME="test"
    DATABASE_PASSWORD="*********"
    DATABASE_CERT="Base64 encoded cert string"
    DATABASE_CERT_KEY="Base64 encoded cert key"
    DATABASE_CA_CERT="Base64 encoded CA cert"
  ```

  > Note for CassandraDB: If you are using cloud provider like [DataStax](https://www.datastax.com/products/datastax-astra), they don't allow creating `keyspace`. So please make sure you have `keyspace` named `authorizer` created from their [GUI](https://docs.datastax.com/en/astra/docs/datastax-astra-faq.html#_i_am_trying_to_create_a_keyspace_in_the_cql_shell_and_i_am_running_into_an_error_how_do_i_fix_this).

- [ScyllaDB](https://www.scylladb.com/)

  Sample config

  ```
    DATABASE_TYPE=scylladb
    DATABASE_HOST="192.168.0.1,192.168.0.2,192.168.0.3"
    DATABASE_USERNAME="scylladb"
    DATABASE_PASSWORD="*********"
  ```

> Note: New environment variable is introduced - `DATABASE_NAME`: as database name, is not part of connection URL in case of arangodb and mongodb.

## Tables / collections created and used by Authorizer

- `authorizer_users` - store the basic user information
- `authorizer_verification_requests` - store the email verification / forgot password verification requests
- `authorizer_sessions` - store the user sessions generated

## Data Store used for Authorization

With each user request, for which we want to make sure that user is making request with correct permissions, we need to validate HTTP Cookie / Authorization Header. JWT tokens send via request headers can still be manipulated, so in order authorize user we should not only validate JWT but validate them against the long living token stored on server. To improve the throughput/response time for each request we need to make sure that authorization doesn't take long time to resolve. Hence we need in-memory store.

Currently, Authorizer Supports two in-memory stores

- [Redis](https://redis.io/) - persisted as long as a Redis server is on / user logs out.
- In-memory - stores in the memory of the current machine. Not recommended for production as machine memory might be less. Also, data it saves data till the system stops / restarts.
