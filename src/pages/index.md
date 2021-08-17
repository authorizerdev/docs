---
title: Introduction
layout: ../layouts/Main.astro
---

## What is Authorizer?

**Authorizer** is an open source authentication and authorization solution for your applications. Bring your own database and have complete control over the user information. Authorizer can be deployed anywhere and can be connected to any data source.

<img src="/images/authorizer-architecture.png" style="height:20em"/>

## Project Status

⚠️ **Authorizer is still an early beta, missing features and bugs are to be expected!** If you can stomach it, then bring authentication and authorization to your site today!

## Features

### Flexible and easy to use

- Designed to work with any OAuth service, it supports OAuth 1.0, 1.0A and 2.0
- Built-in support for many popular sign-in services
- Supports email / passwordless authentication
- Supports stateless authentication with any backend (Active Directory, LDAP, etc)
- Supports both JSON Web Tokens and database sessions
- Easy to deploy with docker, heroku, kubernetes, and VMs
- SDKs for popular languages
- Quick frontend page library for (react, vue, svelete, vanilla)

### Own your own data

- An open source solution that allows you to keep control of your data
- Supports Bring Your Own Database (BYOD) and can be used with any SQL database
- Persist user session using Redis

### Secure by default

- Designed to be secure by default and encourage best practice for safeguarding user data
- Uses Cross Site Request Forgery Tokens on POST routes (sign in, sign out)
- Default cookie policy aims for the most restrictive policy appropriate for each cookie
- When JSON Web Tokens are enabled, they are signed by default (JWS) with HS512
- Use JWT encryption (JWE) by setting the option encryption: true (defaults to A256GCM)
- Auto-generates symmetric signing and encryption keys for developer convenience
- Attempts to implement the latest guidance published by Open Web Application Security Project
- Advanced options allow you to define your own routines to handle controlling what accounts are allowed to sign in, for encoding and decoding JSON Web Tokens and to set custom cookie security policies and session properties, so you can control who is able to sign in and how often sessions have to be re-validated.
- Promotes the use of passwordless sign in mechanisms

## Roadmap

- Coming soon..

## Quick Start

Authorizer is built using [Go](), [GraphQL](), [Redis]()(Optional). Binary of authorizer can be downloaded from releases and deployed any where.

One can also deploy using [heroku]() and quickly play with authorizer in 30seconds
<br/><br/>
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku)

### Things to consider

- For social logins you will need respective social platform key and secret
- For having verified users you will need smtp server with email address using which system can send emails. System will send verify email link to email address and once verified then only user will be able to access it. _(Note: One can always disable to email verification to allow open sign up)_
- For persisting user sessions you will need Redis username and password. Else user session will be only persisted till the server is on, which not recommended for production.

### Local Setup

#### Prerequisites

- OS: Linux or macOS or windows
- Go: (Golang)(https://golang.org/dl/) >= v1.15

#### Setup

- Fork the [authorizer](https://github.com/authorizerdev/authorizer) repository (**Skip this step if you have access to repo**)
- `git clone https://github.com/authorizerdev/authorizer.git`
- `cd authorizer`
- `cp .env.sample .env` Check all the supported env [here](TODO)
- Build the code `make clean && make`
  > Note: if you don't have [`make`](https://www.ibm.com/docs/en/aix/7.2?topic=concepts-make-command), you can `cd` into `server` dir and build using `go build` command
- Run binary `./build/server`
