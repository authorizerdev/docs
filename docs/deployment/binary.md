---
sidebar_position: 3
title: Binary Deployment
---

# Binary (v2)

This guide shows how to run the **Authorizer v2 binary** in environments where you download or build the binary yourself.
Unlike v1, **all configuration is passed as CLI flags** -- the server does not read `.env` files or dashboard-managed env.

If you are migrating from v1, compare with the original [Binary](../deployment/binary) page and the [Migration v1 to v2](../migration/v1-to-v2) guide.

---

## 1. Download or build the v2 binary

You can either:

- Download a v2 release archive from the GitHub releases page, or
- Build from source:

```bash
git clone https://github.com/authorizerdev/authorizer.git
cd authorizer

go build -o build/server .
```

After extraction or build, you should have:

```bash
./build/server
```

---

## 2. Decide your CLI configuration

At minimum, Authorizer v2 needs:

- Database configuration.
- `--client-id` and `--client-secret`.
- Admin and JWT configuration.

Example for SQLite:

```bash
./build/server \
  --env=production \
  --http-port=8080 \
  --database-type=sqlite \
  --database-url=data.db \
  --client-id=YOUR_CLIENT_ID \
  --client-secret=YOUR_CLIENT_SECRET \
  --admin-secret=your-admin-secret \
  --jwt-type=HS256 \
  --jwt-secret=your-jwt-secret
```

> **Note:** In v2, flags such as `database_url`, `env_file`, and dashboard mutations like `_update_env` are **deprecated** -- use the `kebab-case` flags above instead.

For more options (Redis, SMTP, social providers, etc.), see [Server Configuration (v2)](../core/server-config).

---

## 3. Running the binary in production

You can still use process managers like `systemd`, but instead of relying on `.env`, configure the **ExecStart** with CLI flags.

Example `systemd` service file:

```ini
[Unit]
Description=Authorizer v2

[Service]
Type=simple
Restart=always
RestartSec=5
ExecStart=/path_to_authorizer_parent_folder/authorizer/build/server \
  --env=production \
  --http-port=8080 \
  --database-type=postgres \
  --database-url=${DATABASE_URL} \
  --client-id=${CLIENT_ID} \
  --client-secret=${CLIENT_SECRET} \
  --admin-secret=${ADMIN_SECRET} \
  --jwt-type=RS256 \
  --jwt-private-key=${JWT_PRIVATE_KEY} \
  --jwt-public-key=${JWT_PUBLIC_KEY}
WorkingDirectory=/path_to_authorizer_parent_folder/authorizer/
Environment=DATABASE_URL=postgres://user:pass@host/db
Environment=CLIENT_ID=your-client-id
Environment=CLIENT_SECRET=your-client-secret
Environment=ADMIN_SECRET=your-admin-secret
Environment=JWT_PRIVATE_KEY=...
Environment=JWT_PUBLIC_KEY=...

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl restart authorizer
```

This pattern lets your platform manage secrets as **env vars**, while Authorizer still receives them **only as CLI flags**, which is the v2 model.
