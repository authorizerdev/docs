---
title: Heroku
layout: ../../layouts/Main.astro
---

## Deploying new heroku instance

Deploy Authorizer using [heroku](https://github.com/authorizerdev/authorizer-heroku) with Postgres database for free and quickly play with it in 30seconds
<br/>

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku)

After click the above button you will see screen as below, follow the steps mentioned below:

<img src="/images/heroku.png" style="height:20em;width:100%;object-fit:contain;"/>

### Step 1: Enter the App name

App name becomes the url for your application. Example if you have entered `authorizer-demo` as the app name then the authorizer url will be `authorizer-demo.herokuapp.com`.

### Step 2: Choose the Region

Select the region you want to deploy you application in. Heroku supports United States and Europe only.

### Step 3: Configure the Environment Variables

Required envs are pre-configured, but based on the production and social logins, please configure the environment variables. Please refer to [environment variables docs](/core/env) for more information

## Updating Authorizer to latest version on existing Heroku instance

### Pre requisites

- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
- [Git](https://git-scm.com/downloads)

### Step 1: Clone Authorizer Heroku App

The Authorizer app with Heroku buildpack/configuration is available at: https://github.com/authorizerdev/authorizer-heroku.

Clone the above repository.

```sh
git clone https://github.com/authorizerdev/authorizer-heroku
cd authorizer-heroku
```

If you already have this, then pull the latest changes which will have the updated GraphQL engine Docker image.

### Step 2: Attach Heroku app

Let’s say your Heroku app is called authorizer-heroku and is running on https://authorizer-heroku.herokuapp.com.

From inside the graphql-engine-heroku directory, use the Heroku CLI to configure the git repo you cloned in Step 1 to be able to push to this app.

```sh
# Replace <authorizer-heroku> with your Heroku app's name

heroku git:remote -a <authorizer-heroku>
heroku stack:set container -a <authorizer-heroku>
```

You can find your Heroku git repo in your Heroku - Settings - Info - Heroku Git URL

### Step 3: git push to deploy the latest Authorizer GraphQL engine

When you git push to deploy, the Heroku app will get updated with the latest changes:

```sh
git push heroku main
```
