# Command Line Arguments

Authorizer has following command line arguments

| Argument        | Allowed Values                                                                                                                                  | Description                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `database_url`  | Correct connection string                                                                                                                       | Database connection URL                                                   |
| `database_type` | `postgres`, `mysql`, `planetscale`, `sqlite`, `sqlserver`, `mongodb`, `arangodb`, `yugabyte`, `mariadb`, `cassandradb`, `scylladb`, `couchbase` | Type of database that you want to configure with authorizer               |
| `env_file`      | Correct path string                                                                                                                             | Path to env file                                                          |
| `log_level`     | `debug`, `info`, `warn`, `error`, `fatal`, `panic`                                                                                              | Level of logs that you want to print in your console. Defaults to `info`. |

## Sample Usage

```sh
./build/server --log_level="debug" --env_file=".env"
```
