---
sidebar_position: 1
title: Hasura
---

# Using Authorizer with Hasura

In this section you will learn how to integrate [Authorizer](https://authorizer.dev) with your Hasura instance and have authorized GraphQL API ready for your application.

### Step 1: Deploy Authorizer Instance

To integrate Authorizer with Hasura, you will need an Authorizer instance deployed on your infrastructure or 3rd party cloud services. You can deploy authorizer instance using following one click deployment options:

| **Infra provider** |                                                                                           **One-click link**                                                                                            |               **Additional information**               |
| :----------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------: |
|    Railway.app     |                      <a target="_blank" href="https://railway.app/new/template/nwXp1C?referralCode=FEF4uT"><img src="https://railway.app/button.svg" alt="Deploy on Railway"/></a>                      | [docs](https://docs.authorizer.dev/deployment/railway) |
|       Heroku       |  <a target="_blank" href="https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku"><img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku" /></a>   | [docs](https://docs.authorizer.dev/deployment/heroku)  |
|       Render       | <a target="_blank" href="https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render"><img alt="render button" src="https://render.com/images/deploy-to-render-button.svg" /></a> | [docs](https://docs.authorizer.dev/deployment/render)  |

OR

You can also deploy Authorizer instance using

- [Docker Image + Kubernetes](https://docs.authorizer.dev/deployment/kubernetes)
- [Kubernetes HelmChart](https://github.com/authorizerdev/authorizer-helm-chart)
- [Binary](https://docs.authorizer.dev/deployment/binary)
- [fly.io](https://docs.authorizer.dev/deployment/flydotio)

> **Note:** If you are trying out with one click deployment options like railway then template is configured in a way that it will also deploy postgres + redis for you. For other deployment options, start the server with the required CLI flags:
> ```bash
> ./build/server --database-type=sqlite --database-url=test.db --jwt-type=HS256 --jwt-secret=test --admin-secret=admin --client-id=123456 --client-secret=secret
> ```
> You can also configure `--redis-url` to have persisted sessions. For more information check [Server Configuration](/core/server-config).

In case of Hasura, we need to have database type as `postgres` / `mysql` or the one that is supported by Hasura and connect that database with Authorizer instance via Database Environment Variables.

### Step 2: Configure Authorizer instance

Configure your Authorizer instance using CLI flags at startup. In v2, all configuration is passed via CLI flags (no dashboard-based env configuration). For example:

```bash
./build/server \
  --database-type=postgres \
  --database-url="postgres://user:pass@host:5432/authorizer" \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret \
  --google-client-id=YOUR_GOOGLE_CLIENT_ID \
  --google-client-secret=YOUR_GOOGLE_CLIENT_SECRET \
  --roles=user,admin \
  --default-roles=user
```

See [Server Configuration](/core/server-config) for all available flags including social logins, SMTP, roles, and more.

### Step 3: Setup Hasura Instance

- Signup on https://cloud.hasura.io/
- Create a project

### Step 4: Configure Database with Hasura Instance

- Open the dashboard of Hasura cloud and navigate to your project
- Click on `Launch Console` on top right corner
- Go to `Data` section and connect to your database

  Example
  ![hasura_db_conenction](https://res.cloudinary.com/dcfpom7fo/image/upload/v1661837009/Authorizer/hasura_db_setting_ckdsqu.png)

Check the [hasura docs](https://hasura.io/docs/latest/graphql/cloud/getting-started/index/) for more information.

> **Note:** If you have used one click deployment option for authorizer you can get database URL from respective platform's env sections.

## Step 5: Configure JWT token with Hasura

- Get the JWT type and secret from the `--jwt-type` and `--jwt-secret` (or `--jwt-public-key` for RS256/ES256) flags you used when starting the server
- Open the Hasura dashboard and navigate to your project
- Open settings and go to `Env vars` section
- Add the following env variable to configure the JWT token

  ```
  HASURA_GRAPHQL_JWT_SECRET: {"type": <JWT_TYPE>, "key": <JWT_KEY>}
  ```

  Example
  ![image](https://res.cloudinary.com/dcfpom7fo/image/upload/v1661837310/Authorizer/hasura_jwt_ttuqp2.png)

> **Note:** In case of RSA and ECDSA JWT types only provide the public key in PEM encoded string format. Use the values from `--jwt-type` and `--jwt-public-key` flags used when starting the server.

Check the [hasura docs](https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt/) for more information.

## Step 6: Configure JWT token Authorization Script

In order for Hasura to authorize a user, JWT token needs to have specific keys. You can add those keys by using the `--custom-access-token-script` flag when starting the server.

Example:

```js
function(user,tokenPayload) {
  var data = tokenPayload;
  data['https://hasura.io/jwt/claims'] = {
    'x-hasura-user-id': user.id,
    'x-hasura-default-role': tokenPayload.allowed_roles[0],
    'x-hasura-allowed-roles': user.roles
  }

  return data;
}
```

![script-image](https://res.cloudinary.com/dcfpom7fo/image/upload/v1661836293/Authorizer/configure_id_token_yrwb6z.png)

Once user login they will get a `id_token` in the response, this token should be used with Hasura queries as `Authorization: Bearer ID_TOKEN`. This will help in making `Authorized` requests.

You can configure access control for the various roles that your application needs from Hasura. Configure roles in Authorizer using the `--roles`, `--default-roles`, and `--protected-roles` flags.

![authorizer_roles](https://res.cloudinary.com/dcfpom7fo/image/upload/v1661836262/Authorizer/configure_roles_tfxfyq.png)

For more information on access control check [Hasura docs](https://hasura.io/docs/latest/graphql/core/auth/authorization/basics/)

You can also stitch Authorizer GraphQl Endpoint with Hasura Remote Schema, that way you can have single endpoint for all your GraphQL queries / mutations.
