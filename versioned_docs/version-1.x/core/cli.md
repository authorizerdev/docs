---
sidebar_position: 3
title: CLI Arguments
---

# Command Line Arguments

Authorizer v1 has the following command line arguments:

| Argument        | Allowed Values                                                                                                                                              | Description                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `database_url`  | Correct connection string                                                                                                                                   | Database connection URL                                                    |
| `database_type` | `postgres`, `mysql`, `planetscale`, `sqlite`, `sqlserver`, `mongodb`, `arangodb`, `yugabyte`, `mariadb`, `cassandradb`, `scylladb`, `couchbase`, `dynamodb` | Type of database that you want to configure with authorizer               |
| `env_file`      | Correct path string                                                                                                                                         | Path to env file (deprecated in v2)                                       |
| `log_level`     | `debug`, `info`, `warn`, `error`, `fatal`, `panic`                                                                                                          | Level of logs that you want to print in your console. Defaults to `info`. |

## Sample Usage

```sh
./build/server --log_level="debug" --env_file=".env"
```
