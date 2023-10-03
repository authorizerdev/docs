# Deploy Authorizer on Koyeb

## Introduction

This guide explains how to deploy a ready-to-use Authorizer instance on Koyeb.

[Koyeb](https://www.koyeb.com/) is a developer-friendly serverless platform to deploy apps globally.

The platform lets you seamlessly run Docker containers, web apps, workers, and APIs with git-based deployment, native autoscaling, a global edge network, and built-in service mesh and discovery.

## Requirements

To follow along, you need to complete the steps below:

- A [Koyeb account](https://www.koyeb.com/). If you don't have one, click "Sign Up" in the top right corner of the page to open a free account.

- A PostgreSQL database.  Providers like [Neon](https://neon.tech/) and [Aiven](https://aiven.io/) offer free tiers that can be used to provision a PostgreSQL database.

## Deploy an Authorizer Instance

Deploy production ready Authorizer instance using [Koyeb](https://www.koyeb.com/) with an external PostgreSQL database.

Click the button below to deploy an Authorizer instance to Koyeb quickly.

[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?name=authorizer&type=docker&image=docker.io/lakhansamani/authorizer&env[PORT]=8000&env[DATABASE_TYPE]=postgres&env[DATABASE_URL]=CHANGE_ME&ports=8000;http;/)

After clicking the button, follow the steps mentioned below.

### Step 1: Enter application details

Choose the configuration you'd like to use for your image:

* Name: The name you want to give the service in Koyeb.
* Region: Where you want to deploy to.
* Instance: The size of instance you wish to use.
* Scaling: How many instances you want to deploy.
* App name: The name you want to give the application in Koyeb.

![Koyeb control panel](/images/koyeb_app_config.png)

### Step 2: Configure the database URL

In the "Environment variables" section, modify the value of the `DATABASE_URL` variable to use the connection string for your PostgreSQL database.

![Koyeb set database URL](/images/koyeb_database_url.png)

### Step 3: Configure the environment

- Open authorizer instance endpoint in browser.
- Sign up as an admin with a secure password.
- Configure environment variables from authorizer dashboard. Check [env docs](/core/env) for more information.

> Note: `DATABASE_URL`, `DATABASE_TYPE` and `DATABASE_NAME` are only configurable via platform envs

![Koyeb authorizer instance URL](/images/koyeb_authorizer_url.png)

That's all! 🎉 You can start integrating [Authorizer](https://docs.authorizer.dev/getting-started) in your frontend application.
