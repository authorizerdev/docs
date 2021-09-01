---
title: Heroku
layout: ../../layouts/Main.astro
---

Deploy Authorizer using [heroku](https://github.com/authorizerdev/authorizer-heroku) with Postgres database for free and quickly play with it in 30seconds
<br/>

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku)

After click the above button you will see screen as below, follow the steps mentioned below:

<img src="/images/heroku.png" style="height:20em"/>

## Step 1: Enter the App name

App name becomes the url for your application. Example if you have entered `authorizer-demo` as the app name then the authorizer url will be `authorizer-demo.herokuapp.com`.

## Step 2: Choose the Region

Select the region you want to deploy you application in. Heroku supports United States and Europe only.

## Step 3: Configure the Environment Variables

Required envs are pre-configured, but based on the production and social logins, please configure the environment variables. Please refer to [environment variables docs](/core/env) for more information
