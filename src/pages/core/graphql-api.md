---
title: GraphQL API
layout: ../../layouts/Main.astro
---

Authorizer instance supports GraphQL natively and thus helps you share the common schema for your frontend applications.
You can play with GraphQL API using the GraphQL playground that comes with your Authorizer instance. Access GraphQL playground on the
instance same as of your Authorizer instance URL.

## Queries

### - `meta`

Query to get the `meta` information about your authorizer instance. eg, version, configurations, etc
It returns `Meta` type with the following possible values

| Key                          | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| `version`                    | Authorizer version that is currently deployed                         |
| `isGoogleLoginEnabled`       | It gives information if google login is configured or not             |
| `isGithubLoginEnabled`       | It gives information if github login is configured or not             |
| `isGithubLoginEnabled`       | It gives information if facebook login is configured or not           |
| `isGithubLoginEnabled`       | It gives information if twitter login is configured or not            |
| `isGithubLoginEnabled`       | It gives information if username and password login is enabled or not |
| `isEmailVerificationEnabled` | It gives information if email verification is enabled or not          |

**Sample Query**

```graphql
query {
	meta {
		version
		isGoogleLoginEnabled
		isGithubLoginEnabled
		isBasicAuthenticationEnabled
		isEmailVerificationEnabled
		isFacebookLoginEnabled
		isTwitterLoginEnabled
	}
}
```

### - `token`

Query to get the `token` information. It returns `AuthResponse` type with the following keys.

> Note: If `token` is present as HTTP Cookie / Authorization header with bearer token. If the token is not present or an invalid token is present it throws `unauthorized` error

| Key                    | Description                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `message`              | Error / Success message from server                                                                    |
| `accessToken`          | accessToken that frontend application can use for further authorized requests                          |
| `accessTokenExpiresAt` | timestamp when the current token is going to expire, so that frontend can request for new access token |
| `user`                 | User object with all the basic profile information                                                     |

**Sample Query**

```graphql
query {
	token {
		message
		accessToken
		accessTokenExpiresAt
		user {
			id
			firstName
			lastName
			email
			image
		}
	}
}
```

### - `profile`

Query to get the `profile` information of a user. It returns `User` type with the following keys.

> Note: this is authorized route, so HTTP Cookie / Authorization Header with bearer token must be present.

| Key               | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `id`              | user unique identifier                                       |
| `email`           | email address of user                                        |
| `firstName`       | first name of user                                           |
| `lastName`        | last name of user                                            |
| `signupMethod`    | methods using which user have signed up, eg: `google,github` |
| `emailVerifiedAt` | timestamp at which the email address was verified            |
| `image`           | profile picture URL                                          |
| `createdAt`       | timestamp at which the user entry was created                |
| `updatedAt`       | timestamp at which the user entry was updated                |

**Sample Query**

```graphql
query {
	profile {
		firstName
		lastName
		email
		image
	}
}
```

### - `users`

Query to get all the `users`. This query is only allowed for super admins. It returns array of users `[User!]!` with above mentioned keys.

> Note: the super admin query can be access via special header with super admin secret (this is set via ENV) as value.

```json
{
	"x-authorizer-admin-secret": "ADMIN_SECRET"
}
```

**Sample Query**

```graphql
query {
	users {
		id
		firstName
		lastName
		email
		image
	}
}
```

### - `verificationRequests`

Query to get all the `verificationRequests`. This query is only allowed for super admins. It returns array of verification requests `[VerificationRequest!]!` with following keys.

> Note: the super admin query can be access via special header with super admin secret (this is set via ENV) as value.

```json
{
	"x-authorizer-admin-secret": "ADMIN_SECRET"
}
```

| Key          | Description                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`         | user unique identifier                                                                                                         |
| `identified` | which type of verification request it is. `basic_auth_signup`, `update_email`, `forgot_password` are the supported identifiers |
| `email`      | email address of user                                                                                                          |
| `token`      | verification token                                                                                                             |
| `expires`    | timestamp at which token expires                                                                                               |

**Sample Query**

```graphql
query {
	verificationRequests {
		id
		token
		email
		expires
		identifier
	}
}
```
