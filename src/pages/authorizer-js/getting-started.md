---
title: Authorizer-js Getting Started
layout: ../../layouts/Main.astro
---

[`@authorizerdev/authorizer-js`](https://www.npmjs.com/package/@authorizerdev/authorizer-js) is universal javaScript SDK for Authorizer API.
It supports:

- [UMD (Universal Module Definition)](https://github.com/umdjs/umd) build for browsers
- [CommonJS(cjs)](https://flaviocopes.com/commonjs/) build for NodeJS version that don't support ES Modules
- [ESM (ES Modules)](https://hacks.mozilla.org/2018/03/es-modules-a-cartoon-deep-dive/) build for modern javascript standard, i.e. ES Modules

Here is a quick guide on getting started with [`@authorizerdev/authorizer-js`](/authorizer-js/getting-started) package.

## Step 1: Get Authorizer Instance

Deploy production ready Authorizer instance using one click deployment options available below

| **Infra provider** |                                                                                                                **One-click link**                                                                                                                |               **Additional information**               |
| :----------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------: |
|    Railway.app     | <a target="_blank" href="https://railway.app/new/template?template=https://github.com/authorizerdev/authorizer-railway&amp;plugins=postgresql,redis"><img src="https://railway.app/button.svg" style="height: 44px" alt="Deploy on Railway"></a> | [docs](https://docs.authorizer.dev/deployment/railway) |
|       Heroku       |             <a target="_blank" href="https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku"><img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku" style="height: 44px;"></a>             | [docs](https://docs.authorizer.dev/deployment/heroku)  |
|       Render       |                     <a target="_blank" href="https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render"><img alt="render button" src="https://render.com/images/deploy-to-render-button.svg" /></a>                      | [docs](https://docs.authorizer.dev/deployment/render)  |

For more information check [docs](https://docs.authorizer.dev/getting-started/)

## Step 2: Setup Instance

- Open authorizer instance endpoint in browser
- Sign up as an admin with a secure password
- Configure environment variables from authorizer dashboard. Check env [docs](/core/env) for more information

> Note: `DATABASE_URL`, `DATABASE_TYPE` and `DATABASE_NAME` are only configurable via platform envs

## Step 3 - Install SDK

Load the `authorizer-js` library and initialize the authorizer object. Authorizer object can be instantiated with JSON object with following keys in its constructor.

| Key             | Description                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| `authorizerURL` | Authorizer server endpoint                                                   |
| `redirectURL`   | URL to which you would like to redirect the user in case of successful login |
| `clientID`      | Your client id that is obtained from authorizer dashboard                    |

**Example**

```js
const authRef = new Authorizer({
  authorizerURL: "YOUR_AUTHORIZER_INSTANCE_URL",
  redirectURL: window.location.origin,
  clientID: "YOUR_CLIENT_ID", // obtain your client id from authorizer dashboard
});
```

### UMD

- Step 1: Load Javascript using CDN

```html
<script src="https://unpkg.com/@authorizerdev/authorizer-js/lib/authorizer.min.js"></script>
```

- Step 2: Use the library to instantiate `Authorizer` instance and access [various methods](/authorizer-js/functions)

```html
<script type="text/javascript">
  const authorizerRef = new authorizerdev.Authorizer({
    authorizerURL: `YOUR_AUTHORIZER_INSTANCE_URL`,
    redirectURL: window.location.origin,
    clientID: "YOUR_CLIENT_ID", // obtain your client id from authorizer dashboard
  });

  // use the button selector as per your application
  const logoutBtn = document.getElementById("logout");
  logoutBtn.addEventListener("click", async function () {
    await authorizerRef.logout();
    window.location.href = "/";
  });

  async function onLoad() {
    const res = await authorizerRef.authorize({
      response_type: "code",
      use_refresh_token: false,
    });
    if (res && res.access_token) {
      // you can use user information here, eg:
      const user = await authorizerRef.getProfile({
        Authorization: `Bearer ${res.access_token}`,
      });
      const userSection = document.getElementById("user");
      const logoutSection = document.getElementById("logout-section");
      logoutSection.classList.toggle("hide");
      userSection.innerHTML = `Welcome, ${user.email}`;
    }
  }
  onLoad();
</script>
```

### CommonJS

- Step 1: Install dependencies

```sh
npm i --save @authorizerdev/authorizer-js
OR
yarn add @authorizerdev/authoirzer-js
```

- Step 2: Import and initialize the authorizer instance

```js
const { Authorizer } = require("@authorizerdev/authoirzer-js");

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
yarn add @authorizerdev/authoirzer-js
```

- Step 2: Import and initialize the authorizer instance

```js
import { Authorizer } from "@authorizerdev/authoirzer-js";

const authRef = new Authorizer({
  authorizerURL: "AUTHORIZER_URL",
  redirectURL: "YOUR_APP",
  clientID: "YOUR_CLIENT_ID", // obtain your client id from authorizer dashboard
});

async function main() {
  await authRef.login({
    email: "foo@bar.com",
    password: "test",
  });
}
```
