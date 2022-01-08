---
title: Email
layout: ../../layouts/Main.astro
---

## Email Configuration

Authorizer can be configured to send emails as part of the authentication flow. For example, to
verify a users email address, to send a user a magic link for passwordless login, or to allow a
user to reset their password.

Authorizer should work with any [SMTP](https://en.wikipedia.org/wiki/Simple_Mail_Transfer_Protocol) compliant email server. Please refer to the [environment variables](/core/env) documentation for the environment variables required to configure SMTP host, port and authentication.

## Using Sendgrid

[Sendgrid](https://sendgrid.net) is configured using an API Key, rather than traditional username/password login. To use Sendgrid you must:

1. Create a Sendgrid account and login
1. Create an API Key for your application under `Settings > API Keys` within the Sendgrid console
1. Ensure that you are using a verified sender email under `Settings > Sender Authentication` within the Sendgrid console. Sendgrid will reject email sent `From:` unverified email addresses.
1. Set the relevant Authenticator environment variables as follows:
```
   SMTP_HOST: smtp.sendgrid.net
   SMTP_PASSWORD: <Sendgrid API Key>
   SMTP_PORT: 587
   SMTP_USERNAME: apikey
   SENDER_EMAIL: <Sendgrid verified email>
```
   > Note: the `SMTP_USERNAME` environment variable must be set to the liternal string `apikey` **not** your API key value.