# Using Authorizer with [Hasura](https://hasura.io/)

## Step 1: Deploy Authorizer instance

Deploy production ready Authorizer instance using one click deployment options available below

| **Infra provider** |                                                                                                      **One-click link**                                                                                                      |               **Additional information**               |
| :----------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------: |
|    Railway.app     | <a target="_blank" href="https://railway.app/new/template?template=https://github.com/authorizerdev/authorizer-railway&amp;plugins=postgresql,redis"><img src="https://railway.app/button.svg" alt="Deploy on Railway"/></a> | [docs](https://docs.authorizer.dev/deployment/railway) |
|       Heroku       |             <a target="_blank" href="https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku"><img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku" /></a>             | [docs](https://docs.authorizer.dev/deployment/heroku)  |
|       Render       |           <a target="_blank" href="https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render"><img alt="render button" src="https://render.com/images/deploy-to-render-button.svg" /></a>            | [docs](https://docs.authorizer.dev/deployment/render)  |

For more information check [docs](https://docs.authorizer.dev/getting-started/)

## Step 2: Setup Instance

- Open authorizer instance endpoint in browser
- Signup with a secure password
- Configure social logins / smtp server and other environment variables based on your needs

For more information please check [docs](https://docs.authorizer.dev/core/env/)

## Step 3: Setup Hasura Instance

- Signup to [https://cloud.hasura.io/](https://cloud.hasura.io/)
- Create a free tire project
- Set the config variables for your instance

```
DATABASE_URL: <AUTHORIZER_DATABASE_URL>
HASURA_GRAPHOL_JWT_SECRET: {"type": <JWT_TYPE>, "key": <JWT_KEY>}
HASURA_GRAPHOL_ADMIN_SECRET: <YOUR_ADMIN_SECRET>
```

Example for Heroku, check out [docs](https://devcenter.heroku.com/articles/config-vars)
![image](https://i.ibb.co/mGXp8dC/authorizer-heroku-config.png)

Check the [hasura docs](https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt/) for more information.

## Step 4: Configure Database with Hasura

- Open the hasura endpoint for your instance and configure the database that you have used for authorizer.

Check the [hasura docs](https://hasura.io/docs/latest/graphql/cloud/getting-started/index/) for more information.

> Note: if you have used single click deployment option for authorizer you can get database URL from respective platform's env sections.

## Step 5: Configure JWT token Authorization Script

In order for Hasura to authorize a user, JWT token needs to have specific keys, you can add those keys by modifying JWT token script in your Authorizer Dashboard.

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

![image](https://res.cloudinary.com/practicaldev/image/fetch/s--VDmobd4x--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_880/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/45d40ae1dz21ppox82pz.png)

Once user login they get `id_token` which should be used with hasura queries as `Authorization: Bearer ID_TOKEN`. This will help in making `Authorized` requests.

You can configure access control for various roles that your application needs. You can also configure same roles in your authorizer dashboard.

For more information on access control check [hasura docs](https://hasura.io/docs/latest/graphql/core/auth/authorization/basics/)

You can also stitch Authorizer Graphql Endpoint with Hasura Remote Schema, that way you can have single endpoint for all your GraphQL queries / mutations.
