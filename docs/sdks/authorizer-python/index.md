---
sidebar_position: 1
title: Getting Started
---

# Getting Started

[`authorizer-py`](https://pypi.org/project/authorizer-py/) is the official Python SDK for
the [Authorizer](https://authorizer.dev) API. It ships **both a synchronous and an
asynchronous client**, full type hints, and dataclass request/response models — including
the [fine-grained authorization (FGA)](../../core/authorization) `check_permissions` and
`list_permissions` helpers.

- Python **3.9+**
- Sync (`AuthorizerClient`) and async (`AsyncAuthorizerClient`) clients
- Built on [`httpx`](https://www.python-httpx.org/)
- Apache-2.0 licensed

## Step 1: Get an Authorizer instance

Deploy a production-ready Authorizer instance using one of the one-click options:

| **Infra provider** | **One-click link** | **Additional information** |
| :----------------: | :-----------------: | :----------------------------------------------------: |
| Railway.app | [Deploy on Railway](https://railway.app/new/template/nwXp1C?referralCode=FEF4uT) | [docs](https://docs.authorizer.dev/deployment/railway) |
| Heroku | [Deploy to Heroku](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku) | [docs](https://docs.authorizer.dev/deployment/heroku) |
| Render | [Deploy to Render](https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render) | [docs](https://docs.authorizer.dev/deployment/render) |

For more information check the [deployment docs](https://docs.authorizer.dev/deployment/).

## Step 2: Set up the instance

Start your Authorizer instance with the required CLI flags:

```bash
./authorizer \
  --database-type=sqlite \
  --database-url=test.db \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

Note the `--client-id` value — you will need it in the SDK configuration below. See
[Server Configuration](../../core/server-config) for all available flags.

## Step 3: Install the package

```bash
pip install authorizer-py
```

The import name is `authorizer`:

```python
from authorizer import AuthorizerClient
```

## Step 4: Initialize the client

### Synchronous

```python
from authorizer import AuthorizerClient, LoginRequest

client = AuthorizerClient(
    client_id="YOUR_CLIENT_ID",
    authorizer_url="https://your-instance.authorizer.dev",
)

token = client.login(LoginRequest(email="user@example.com", password="Abc@123"))
print(token.access_token)

client.close()
```

Or as a context manager (auto-closes the HTTP session):

```python
with AuthorizerClient(
    client_id="YOUR_CLIENT_ID",
    authorizer_url="https://your-instance.authorizer.dev",
) as client:
    token = client.login(LoginRequest(email="user@example.com", password="Abc@123"))
    print(token.access_token)
```

### Asynchronous

```python
import asyncio
from authorizer import AsyncAuthorizerClient, LoginRequest

async def main() -> None:
    async with AsyncAuthorizerClient(
        client_id="YOUR_CLIENT_ID",
        authorizer_url="https://your-instance.authorizer.dev",
    ) as client:
        token = await client.login(
            LoginRequest(email="user@example.com", password="Abc@123")
        )
        print(token.access_token)

asyncio.run(main())
```

The async client mirrors the sync client method-for-method; only `await` and the
`async with` / `aclose()` lifecycle differ.

## Constructor options

```python
AuthorizerClient(
    client_id: str,
    authorizer_url: str,
    redirect_url: str = "",
    extra_headers: dict[str, str] | None = None,
)
```

| Parameter        | Description                                                                       | Required |
| ---------------- | --------------------------------------------------------------------------------- | -------- |
| `client_id`      | Your Authorizer app's client ID (value of `--client-id`).                         | yes      |
| `authorizer_url` | Base URL of your Authorizer instance, **no trailing slash**.                      | yes      |
| `redirect_url`   | Default redirect URL used by magic-link and forgot-password flows.                | no       |
| `extra_headers`  | Extra headers sent on every request (e.g. a custom `Origin` for CSRF).            | no       |

> **CSRF (v2.3.0+):** the SDK automatically sets an `Origin` header so state-changing
> requests aren't rejected with `403`. Override it via `extra_headers` if you need a
> specific origin.

## Authenticating subsequent requests

Methods that act on a logged-in user (`get_profile`, `update_profile`, `logout`,
`check_permissions`, `list_permissions`, …) take a `headers` argument — pass the access
token as a bearer credential:

```python
auth = {"Authorization": f"Bearer {token.access_token}"}
user = client.get_profile(headers=auth)
print(user.email)
```

## Next steps

- [Functions](./functions) — the complete method, request, and response reference.
- [Fine-Grained Authorization](./fga) — `check_permissions` and `list_permissions`.
