---
title: Authorizer Environment Variables
layout: ../../layouts/Main.astro
---

Authorizer server supports the following environment variables

| Variable                       | Description                                                                                            | Required | Default Value                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ | -------- | --------------------------------- |
| `ENV`                          | Which env you are running your server in. Supported envs `production`, `development`                   | true     | `production`                      |
| `ADMIN_SECRET`                 | Super admin secret used to access the master data                                                      | true     |                                   |
| `DATABASE_TYPE`                | Which database you are using. Supported database types are `postgres`, `mysql`, `sqlite`               | true     |                                   |
| `DATABASE_URL`                 | Database connection string                                                                             | true     |                                   |
| `PORT`                         | Port on which server should be running                                                                 | true     | 8080                              |
| `AUTHORIZER_URL`               | Domain name of the server, eg https://authorizer.herokuapp.com                                         | false    |                                   |
| `REDIS_URL`                    | Redis URL where sessions can be persisted                                                              | false    | sessions will be stored in memory |
| `COOKIE_NAME`                  | Name of cookie to be set by server                                                                     | true     | authorizer                        |
| `SMTP_HOST`                    | SMTP host is used to send email verification emails and forgot password emails                         | false    | If not set email sending can fail |
| `SMTP_PORT`                    | SMTP Port is used along with SMTP host                                                                 | false    |                                   |
| `SENDER_EMAIL`                 | Email address using which system can send emails                                                       | false    |                                   |
| `SENDER_PASSWORD`              | Password for the above email address. This is used by SMTP server to authenticate before sending email | false    |                                   |
| `GOOGLE_CLIENT_ID`             | OAuth [Google login](https://developers.google.com/identity/sign-in/web/sign-in) client id             | false    |                                   |
| `GOOGLE_CLIENT_SECRET`         | OAuth [Google login client secret](https://developers.google.com/identity/sign-in/web/sign-in)         | false    |                                   |
| `GITHUB_CLIENT_ID`             | OAuth [Github login](https://docs.github.com/en/rest/guides/basics-of-authentication) client id        | false    |                                   |
| `GITHUB_CLIENT_SECRET`         | OAuth [Github login](https://docs.github.com/en/rest/guides/basics-of-authentication) client secret    | false    |
| `FACEBOOK_CLIENT_ID`           | OAuth [Facebook login](https://docs.github.com/en/rest/guides/basics-of-authentication) client id      | false    |                                   |
| `FACEBOOK_CLIENT_SECRET`       | OAuth [Facebook login](https://docs.github.com/en/rest/guides/basics-of-authentication) client secret  | false    |                                   |
| `RESET_PASSWORD_URL`           | Reset password link, that can be used to send the correct forgot password link                         | true     | `/reset-password`                 |
| `DISABLE_BASIC_AUTHENTICATION` | Used to explicitly disable email and password based authentication                                     | false    | false                             |
| `DISABLE_EMAIL_VERIFICATION`   | Used to disable the email verification while signing up                                                | false    | false                             |
| `ROLES` | Comma separated list of roles that your platform supports | true | `user,admin` |
| `DEFAULT_ROLE` | Default role that you would like to assign to users with signup | true | `user` |
| `JWT_ROLE_CLAIM` | Claim key that will be part of JWT token | true | `role` |

It is expected for this variable to be present as system env or `.env` at the root of project.
