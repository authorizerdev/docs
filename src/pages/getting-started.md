---
title: Getting Started
layout: ../layouts/Main.astro
---

## Trying out Authorizer

This guide helps you practice using Authorizer to evaluate it before you use it in a production environment. It includes instructions for installing the Authorizer server in standalone mode.

## Get Authorizer Instance

Deploy production ready Authorizer instance using one click deployment options available below

| **Infra provider** |                                                                                                                **One-click link**                                                                                                                |               **Additional information**               |
| :----------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------: |
|    Railway.app     | <a target="_blank" href="https://railway.app/new/template?template=https://github.com/authorizerdev/authorizer-railway&amp;plugins=postgresql,redis"><img src="https://railway.app/button.svg" style="height: 44px" alt="Deploy on Railway"></a> | [docs](https://docs.authorizer.dev/deployment/railway) |
|       Heroku       |             <a target="_blank" href="https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku"><img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku" style="height: 44px;"></a>             | [docs](https://docs.authorizer.dev/deployment/heroku)  |
|       Render       |                     <a target="_blank" href="https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render"><img alt="render button" src="https://render.com/images/deploy-to-render-button.svg" /></a>                      | [docs](https://docs.authorizer.dev/deployment/render)  |

For more information check [docs](https://docs.authorizer.dev/getting-started/)

## Setup Instance

- Open authorizer instance endpoint in browser
- Sign up as an admin with a secure password
- Configure environment variables from authorizer dashboard. Check env [docs](/core/env) for more information

> Note: `DATABASE_URL`, `DATABASE_TYPE` and `DATABASE_NAME` are only configurable via platform envs

### Things to consider

- For social logins, you will need respective social platform key and secret
- For having verified users, you will need an SMTP server with an email address and password using which system can send emails. The system will send a verification link to an email address. Once an email is verified then, only able to access it.
  > Note: One can always disable the email verification to allow open sign up, which is not recommended for production as anyone can use anyone's email address 😅
- For persisting user sessions, you will need Redis URL (not in case of railway app). If you do not configure a Redis server, sessions will be persisted until the instance is up or not restarted. For better response time on authorization requests/middleware, we recommend deploying Redis on the same infra/network as your authorizer server.

## Integrating into your website

This example demonstrates how you can use [`@authorizerdev/authorizer-js`](/authorizer-js/getting-started) CDN version and have login ready for your site in few seconds. You can also use the ES module version of [`@authorizerdev/authorizer-js`](/authorizer-js/getting-started) or framework-specific versions like [`@authorizerdev/authorizer-react`](/authorizer-react/getting-started)

### Copy the following code in `html` file

> **Note:** Change AUTHORIZER_URL in the below code with your authorizer URL. Also, you can change the logout button component

```html
<script src="https://unpkg.com/@authorizerdev/authorizer-js/lib/authorizer.min.js"></script>

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
