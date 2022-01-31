---
title: Render
layout: ../../layouts/Main.astro
---

## Deploying new instance

Click to deploy a [Authorizer](https://authorizer.dev) instance with a managed PostgreSQL database on [Render](https://render.com/).

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render)

After clicking the above button, follow the steps mentioned below:

### Step 1: Enter app details

Enter the name for your instance.

> Note: Optionally you can choose to deploy a branch `without-postgres` and configure database env, if you already have an postgres instance running.

<img src="/images/render_1.png" style="height:20em;width:100%;object-fit:contain;"/>

### Step 2: Configure Envs

Open authorizer URL in your browser and configure rest of your [envs](https://docs.authorizer.dev/core/env).

> Note: `DATABASE_URL` and `DATABASE_TYPE` are only configurable via render envs

<img src="/images/render_2.png" style="height:20em;width:100%;object-fit:contain;"/>

That's all 🎉 you can get started with [Authorizer](https://docs.authorizer.dev/getting-started) now! You have your authentication and authorization layer ready.
