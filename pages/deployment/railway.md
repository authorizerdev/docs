# Deploy Authorizer on Railway

## Introduction

This guide explains how to deploy a ready-to-use Authorizer instance on Railway.

[Railway](https://railway.app/) is a deployment platform where you can provision infrastructure, develop with that infrastructure locally, and then deploy to the cloud.

Railway aims to be the simplest way to develop, deploy, and diagnose issues with your application.

## Requirements

To follow along, you need a [Railway account](https://railway.app/). If you don't have one, you can visit the link above and click on "Login" in the top right corner to log in either with your GitHub account or email.

## Deploy an Authorizer Instance

Deploy production ready Authorizer instance using [railway.app](https://github.com/authorizerdev/authorizer-railway) with postgres and redis for free

Click the button below to deploy an Authorizer instance to Railway quickly.

<br />

<a target="_blank" href="https://railway.app/new/template/nwXp1C?referralCode=FEF4uT"><img src="https://railway.app/button.svg" alt="Deploy on Railway"/></a>

Follow the below steps after clicking the button:

Before getting started on below steps make sure you have given permission to railway for further deployments as it will create a repository in your github account.

<br/>

<img src="/images/railway.png" />

## Setup Instance

- Open authorizer instance endpoint in browser
- Sign up as an admin with a secure password
- Configure environment variables from authorizer dashboard. Check env [docs](/core/env) for more information

> Note: `DATABASE_URL`, `DATABASE_TYPE` and `DATABASE_NAME` are only configurable via platform envs

## Update Instance

Update existing Authorizer on existing instance

- You can update the [Docker image](https://github.com/authorizerdev/authorizer-railway/blob/main/Dockerfile#L1) to the desired version in your repository which gets created with your deployment.

- You can find all the versions on [GitHub](https://github.com/authorizerdev/authorizer/releases) or [dockerhub](https://hub.docker.com/r/lakhansamani/authorizer)
