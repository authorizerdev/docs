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

### Step 3: Configure the Environment Variables

- Database url will be configured automatically based on postgres plugin deployment

- Redis url will be configured automatically based on redis plugin deployment

- Some of the required envs are pre configured but you will have to add value for admin secret and jwt token secrets

- Also based on the production and social logins, please configure the environment variables.

Please refer to [environment variables docs](/core/env) for more information

## Updating Authorizer on existing Railway instance

- You can update the [docker image](https://github.com/authorizerdev/authorizer-railway/blob/main/Dockerfile#L1) to the desired version in your repository which gets created with your deployment.

- You can find all the versions on [github](https://github.com/authorizerdev/authorizer/releases) or [dockerhub](https://hub.docker.com/r/lakhansamani/authorizer)
