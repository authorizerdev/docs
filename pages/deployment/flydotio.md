# Deploy on [Fly.io](https://fly.io)

## Create Instance

Deploy production ready Authorizer instance using [fly.io](https://fly.io) with Postgres and Redis for free.

### Prerequisites

- [Fly CLI](https://fly.io/docs/app-guides/run-a-private-dns-over-https-service/#install-fly-cli)

### Step 1: Login to Fly.io

```sh
flyctl auth login
```

### Step 2: Create Fly.io app

Create new empty directory and move to this directory:

```sh
mkdir authorizer-fly
cd authorizer-fly
```

Create new Fly.io app instance:

```sh
flyctl launch --no-deploy
```

Follow the wizard to set the application name, region, etc. You will find new file named `fly.toml`.

![Authorizer at Fly.io](/images/fly-01.png)

### Step 4: Setup Postgres instance

Fly.io provide free tier Postgres with limited resource. Consider to use larger Posgres instance when using at production.
Read more details about Postgres at Fly [here](https://fly.io/docs/reference/postgres/).

```sh
flyctl postgres create --password <YOUR_SECURE_DATABASE_PASSWORD>
```

Follow the wizard just like previous command. You will be given the option to provide a name, location, and configuration.
Choose `Development` configuration to use free instance of Postgres.

![Authorizer at Fly.io](/images/fly-02.png)

To connecting the Postgres database with the app, we need to attach by using this command:

```sh
flyctl postgres attach --postgres-app <POSTGRES_APP_NAME>
```

### Step 5: Setup Redis instance

To spin up a Redis instance, please follow [this official documentation](https://fly.io/docs/reference/redis/).

### Step 6: Configure `fly.toml` file

Add this part to fly.toml file:

```toml
[build]
image = "lakhansamani/authorizer:latest"

[experimental]
cmd = ["./build/server", "--database_type=postgres"]
private_network = true
auto_rollback = true

[env]
  PORT = "8080"
```

Change internal_port to 8080 inside the [[services]] section just like this:

```toml
[[services]]
  internal_port = 8080
  ...
```

This is a complete example `fly.toml` file (_don't forget to change the `app` value_):

```toml
app = "authorizer"
kill_signal = "SIGINT"
kill_timeout = 5
processes = []

[build]
image = "lakhansamani/authorizer:latest"

[experimental]
cmd = ["./build/server", "--database_type=postgres"]
private_network = true
auto_rollback = true

[env]
  PORT = "8080"

[[services]]
  internal_port = 8080
  processes = ["app"]
  protocol = "tcp"
  script_checks = []

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.tcp_checks]]
    grace_period = "1s"
    interval = "15s"
    restart_limit = 0
    timeout = "2s"
```

### Step 7: Configure Authorizer Environment

```sh
flyctl secrets set \
    ENV="production" \
    ADMIN_SECRET=CHANGE_THIS_WITH_YOUR_SECURE_SECRET \
    DATABASE_TYPE="postgres" \
    REDIS_URL=CHANGE_THIS
    SENDER_EMAIL=CHANGE_THIS \
    SMTP_HOST=CHANGE_THIS \
    SMTP_PASSWORD=CHANGE_THIS \
    SMTP_PORT=587 \
    SMTP_USERNAME=CHANGE_THIS \
    URL="https://<YOUR_FLY_APP_NAME>.fly.dev"
```

> Don't forget to replace the values.

Refer to [Environment Variables](/core/env) section to see all variables.

### Step 8: Deploy

Finally, deploy the app by execute this command:

```sh
flyctl deploy
```

After the deployment process has been finish, check the application logs:

```sh
flyctl logs
```

That's all 🎉 you can start integrating [Authorizer](https://docs.authorizer.dev/getting-started) in your frontend application.

## Update Instance

Since we using `lakhansamani/authorizer:latest` Docker image, to updating Authorizer on Fly.io is easy.
You only need to redeploy the app using `flyctl deploy` command inside the directory containing `fly.toml` configuration file.

## Custom Domain and SSL

Fly.io provide custom domain configuration and free SSL using Let's Encrypt via the CLI.
To setup custom domain, please refer to [this documentation](https://fly.io/docs/app-guides/custom-domains-with-fly/).
