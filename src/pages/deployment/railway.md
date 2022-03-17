---
title: railway.app
layout: ../../layouts/Main.astro
---

## Deploying new instance

Deploy production ready Authorizer instance using [railway.app](https://github.com/authorizerdev/authorizer-railway) with postgres and redis for free
<br/>

<a target="_blank" href="https://railway.app/new/template?template=https://github.com/authorizerdev/authorizer-railway&amp;plugins=postgresql,redis"><img src="https://railway.app/button.svg" style="height: 44px" alt="Deploy on Railway"></a>

After clicking the above button, follow the steps mentioned below:

### Step 1: Give permission for Github

Railway app will create a repository in your github account and will use that for further deployments

<img src="/images/railway.png" style="height:20em;width:100%;object-fit:contain;"/>

### Step 2: Set the repository name

Default repository name will be `authorizer-railway` but you can choose a different name and domain will be created accordingly

### Step 3: Setup Instance

- Open authorizer instance endpoint in browser
- Sign up as an admin with a secure password
- Configure environment variables from authorizer dashboard. Check env [docs](/core/env) for more information

> Note: `DATABASE_URL`, `DATABASE_TYPE` and `DATABASE_NAME` are only configurable via platform envs

## Updating Authorizer on existing Railway instance

- You can update the [docker image](https://github.com/authorizerdev/authorizer-railway/blob/main/Dockerfile#L1) to the desired version in your repository which gets created with your deployment.

- You can find all the versions on [github](https://github.com/authorizerdev/authorizer/releases) or [dockerhub](https://hub.docker.com/r/lakhansamani/authorizer)
