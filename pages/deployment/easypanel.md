# Deploy Authorizer on Easypanel

## Introduction

This guide explains how to deploy a ready-to-use Authorizer instance on Easypanel.

[Easypanel](https://easypanel.io/) is a next generation server control panel powered by docker.

## Requirements

To follow along, you need a [Easypanel installation](https://easypanel.io/). If you don't have one, you can visit the link above and copy the install command.

## Deploy an Authorizer Instance

Deploy production ready Authorizer instance using [easypanel.io](https://easypanel.io/docs/templates/authorizer) with postgres and redis

Click the button below to deploy an Authorizer instance to Railway quickly.

<br />

<a target="_blank" href="https://easypanel.io/docs/templates/authorizer"><img src="https://easypanel.io/img/deploy-on-easypanel-40.svg" alt="Deploy on Easypanel"/></a>

Follow the below steps after clicking the button:

Before getting started on below steps make sure you have given permission to railway for further deployments as it will create a repository in your github account.

<br/>

<img src="https://easypanel.io/img/deploy-on-easypanel-40-outline.svg" />

## Setup Instance

- Open authorizer instance endpoint in browser
- Sign up as an admin with a secure password
- Configure environment variables from environment tab. Check env [docs](/core/env) for more information

> Note: `ENV`, `DATABASE_URL`, `DATABASE_TYPE` and `REDIS_URL` are configured automatically

## Update Instance

Update existing Authorizer on existing instance

- You can update the [Docker image](https://github.com/authorizerdev/authorizer/blob/main/Dockerfile) to the desired version in your repository which gets created with your deployment.

- You can find all the versions on [GitHub](https://github.com/authorizerdev/authorizer/releases) or [dockerhub](https://hub.docker.com/r/lakhansamani/authorizer)
