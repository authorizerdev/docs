# Databases

## Supported Databases

- [Postgres](https://www.postgresql.org/)
- [MySQL](https://www.mysql.com/)
- [SQLite](https://www.sqlite.org/index.html)
- [SQLServer](https://www.microsoft.com/en-us/sql-server/)
- [MongoDB](https://www.mongodb.com)
- [ArangoDB](https://www.arangodb.com/)
- [Yugabyte](https://www.yugabyte.com/)
- [MariaDB](https://mariadb.org/)
- [CassandraDB](https://cassandra.apache.org/)
- [ScyllaDB](https://www.scylladb.com/)
- [CockroachDB](https://www.cockroachlabs.com)

> Note: New environment variable is introduced - `DATABASE_NAME`: as database name, is not part of connection URL in case of arangodb and mongodb.

> Note for CassandraDB/ScyllaDB: If you are using cloud provider like [DataStax](https://www.datastax.com/products/datastax-astra), they don't allow creating `keyspace`. So please make sure you have `keyspace` named `authorizer` created from their [GUI](https://docs.datastax.com/en/astra/docs/datastax-astra-faq.html#_i_am_trying_to_create_a_keyspace_in_the_cql_shell_and_i_am_running_into_an_error_how_do_i_fix_this).

## Tables / collections created and used by Authorizer

- `authorizer_users` - store the basic user information
- `authorizer_verification_requests` - store the email verification / forgot password verification requests
- `authorizer_sessions` - store the user sessions generated

## Data Store used for Authorization

With each user request, for which we want to make sure that user is making request with correct permissions, we need to validate HTTP Cookie / Authorization Header. JWT tokens send via request headers can still be manipulated, so in order authorize user we should not only validate JWT but validate them against the long living token stored on server. To improve the throughput/response time for each request we need to make sure that authorization doesn't take long time to resolve. Hence we need in-memory store.

Currently, Authorizer Supports two in-memory stores

- [Redis](https://redis.io/) - persisted as long as a Redis server is on / user logs out.
- In-memory - stores in the memory of the current machine. Not recommended for production as machine memory might be less. Also, data it saves data till the system stops / restarts.
