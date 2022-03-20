# Deploy on [Render](https://render.com/)

Click to deploy a [Authorizer](https://authorizer.dev) instance with a managed PostgreSQL database on [Render](https://render.com/).

<a target="_blank" href="https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render"><img alt="render button" src="https://render.com/images/deploy-to-render-button.svg" /></a>

After clicking the above button, follow the steps mentioned below:

### Step 1: Enter app details

Enter the name for your instance.

> Note: Optionally you can choose to deploy a branch `without-postgres` and configure database env, if you already have an postgres instance running.

<img src="/images/render_1.png" />

### Step 2: Configure Envs

- Open authorizer instance endpoint in browser
- Sign up as an admin with a secure password
- Configure environment variables from authorizer dashboard. Check env [docs](/core/env) for more information

> Note: `DATABASE_URL`, `DATABASE_TYPE` and `DATABASE_NAME` are only configurable via platform envs

<img src="/images/render_2.png" />

That's all 🎉 you can start integrating [Authorizer](https://docs.authorizer.dev/getting-started) in your frontend application.
