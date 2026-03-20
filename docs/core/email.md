---
sidebar_position: 6
title: Email Configuration
---

# Email

## SMTP Configuration

Authorizer can be configured to send emails as part of the authentication flow. For example, to verify a user's email address, to send a user a magic link for password less login, or to allow a user to reset their password.

Authorizer should work with any [SMTP](https://en.wikipedia.org/wiki/Simple_Mail_Transfer_Protocol) compliant email server. Please refer to the [Server Configuration](../core/server-config) documentation for the flags required to configure SMTP host, port and authentication.

## Using Sendgrid

[Sendgrid](https://sendgrid.com) is configured using an API Key, rather than traditional username/password login. To use Sendgrid you must:

1. Create a Sendgrid account and login
2. Create an API Key for your application under `Settings > API Keys` within the Sendgrid console
3. Ensure that you are using a verified sender email under `Settings > Sender Authentication` within the Sendgrid console. Sendgrid will reject email sent `From:` unverified email addresses.
4. Set the relevant Authorizer configuration flags. You can set them via CLI flags:

```sh
--smtp-host=smtp.sendgrid.net
--smtp-password=<Sendgrid API Key>
--smtp-port=587
--smtp-username=apikey
--smtp-sender-email=<Sendgrid verified email>
```

> Note: the `--smtp-username` flag must be set to the literal string `apikey` **not** your API key value.
