---
sidebar_position: 1
title: Getting Started
---

# Getting Started

[`@authorizerdev/authorizer-js`](https://www.npmjs.com/package/@authorizerdev/authorizer-js) is universal javaScript SDK for Authorizer API.
It supports:

- [UMD (Universal Module Definition)](https://github.com/umdjs/umd) build for browsers
- [CommonJS(cjs)](https://flaviocopes.com/commonjs/) build for NodeJS version that don't support ES Modules
- [ESM (ES Modules)](https://hacks.mozilla.org/2018/03/es-modules-a-cartoon-deep-dive/) build for modern javascript standard, i.e. ES Modules

Here is a quick guide on getting started with [`@authorizerdev/authorizer-js`](/sdks/authorizer-js) package.

## Step 1: Get Authorizer Instance

Deploy production ready Authorizer instance using one click deployment options available below

| **Infra provider** | **One-click link** | **Additional information** |
| :----------------: | :-----------------: | :----------------------------------------------------: |
| Railway.app | [Deploy on Railway](https://railway.app/new/template/nwXp1C?referralCode=FEF4uT) | [docs](https://docs.authorizer.dev/deployment/railway) |
| Heroku | [Deploy to Heroku](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku) | [docs](https://docs.authorizer.dev/deployment/heroku) |
| Render | [Deploy to Render](https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render) | [docs](https://docs.authorizer.dev/deployment/render) |

For more information check [docs](https://docs.authorizer.dev/getting-started/)

## Step 2: Setup Instance

Start your Authorizer instance with the required CLI flags:

```bash
./build/server \
  --database-type=sqlite \
  --database-url=test.db \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

Note the `--client-id` value -- you will need it in the SDK configuration below. Check [Server Configuration](/core/server-config) for all available flags.

## Step 3 - Install SDK

Load the `@authorizerdev/authorizer-js` library and initialize the authorizer object. Authorizer object can be instantiated with JSON object with following keys in its constructor.

| Key             | Description                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `authorizerURL` | Authorizer server endpoint                                                                       |
| `redirectURL`   | URL to which you would like to redirect the user in case of successful login                     |
| `clientID`      | Your client identifier (the value of `--client-id` flag used when starting the server)           |
| `extraHeaders`  | Optional JSON object that you can pass to send extra headers to your gateway / authorizer server |

**Example**

```js
const authRef = new Authorizer({
  authorizerURL: 'YOUR_AUTHORIZER_INSTANCE_URL',
  redirectURL: window.location.origin,
  clientID: 'YOUR_CLIENT_ID', // value of --client-id flag used to start the server
})
```

### UMD

- Step 1: Load Javascript using CDN

```html
<script src="https://unpkg.com/@authorizerdev/authorizer-js/lib/authorizer.min.js"></script>
```

- Step 2: Use the library to instantiate `Authorizer` instance and access [various methods](/sdks/authorizer-js/functions)

```html
<script type="text/javascript">
  const authorizerRef = new authorizerdev.Authorizer({
    authorizerURL: `YOUR_AUTHORIZER_INSTANCE_URL`,
    redirectURL: window.location.origin,
    clientID: 'YOUR_CLIENT_ID', // value of --client-id flag used to start the server
  })

  // use the button selector as per your application
  const logoutBtn = document.getElementById('logout')
  logoutBtn.addEventListener('click', async function () {
    await authorizerRef.logout()
    window.location.href = '/'
  })

  async function onLoad() {
    const { data, errors } = await authorizerRef.authorize({
      response_type: 'code',
      use_refresh_token: false,
    })
    if (data && data.access_token) {
      // you can use user information here, eg:
      const user = await authorizerRef.getProfile({
        Authorization: `Bearer ${data.access_token}`,
      })
      const userSection = document.getElementById('user')
      const logoutSection = document.getElementById('logout-section')
      logoutSection.classList.toggle('hide')
      userSection.innerHTML = `Welcome, ${user.data.email}`
    }
  }
  onLoad()
</script>
```

### CommonJS

- Step 1: Install dependencies

```sh
npm i --save @authorizerdev/authorizer-js
OR
yarn add @authorizerdev/authorizer-js
```

- Step 2: Import and initialize the authorizer instance

```js
const { Authorizer } = require("@authorizerdev/authorizer-js");

const authRef = new Authorizer({
  authorizerURL: "https://app.heroku.com",
  redirectURL: "http://app.heroku.com/app",
  clientID:
});

async function main() {
  await authRef.login({
    email: "foo@bar.com",
    password: "test",
  });
}
```

### ES Modules

- Step 1: Install dependencies

```sh
npm i --save @authorizerdev/authorizer-js
OR
yarn add @authorizerdev/authorizer-js
```

- Step 2: Import and initialize the authorizer instance

```js
import { Authorizer } from '@authorizerdev/authorizer-js'

const authRef = new Authorizer({
  authorizerURL: 'AUTHORIZER_URL',
  redirectURL: 'YOUR_APP',
  clientID: 'YOUR_CLIENT_ID', // value of --client-id flag used to start the server
})

async function main() {
  await authRef.login({
    email: 'foo@bar.com',
    password: 'test',
  })
}
```
