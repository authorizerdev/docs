# Deploy Authorizer on Render

## Introduction

This guide explains how to deploy a ready-to-use Authorizer instance on Render.

[Render](https://render.com/) is a unified cloud to build and run all your apps and websites with free SSL, a global CDN, DDoS protection, private networks and auto-deploys from Git.

## Requirements

To follow along, you need a [Render account](https://render.com/). If you don't have one, you can visit the link above and click on "Sign In" in the top right corner to log in either with your GitHub, Gitlab, Google account or email.

## Deploy an Authorizer Instance

Deploy production ready Authorizer instance using [render.com](https://github.com/authorizerdev/authorizer-render) with a managed PostgreSQL database.

Click the button below to deploy an Authorizer instance to Render quickly.

<br />

<a target="_blank" href="https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render"><img alt="render button" src="https://render.com/images/deploy-to-render-button.svg" /></a>

After clicking the above button, follow the steps mentioned below:

> Note: If you already  have an postgres instance running. You can choose to deploy a branch [`without-postgres`](https://github.com/authorizerdev/authorizer-render/tree/without-postgres)

### Step 1: Enter app details

Enter the name for your instance.

<br />

<img src="/images/render_1.png" />

### Step 2: Configure Envs

- Open authorizer instance endpoint in browser
- Sign up as an admin with a secure password
- Configure environment variables from authorizer dashboard. Check env [docs](/core/env) for more information

> Note: `DATABASE_URL`, `DATABASE_TYPE` and `DATABASE_NAME` are only configurable via platform envs

<br/>

<img src="/images/render_2.png" />

That's all 🎉 you can start integrating [Authorizer](https://docs.authorizer.dev/getting-started) in your frontend application.
