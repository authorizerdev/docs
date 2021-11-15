---
title: GraphQL API
layout: ../../layouts/Main.astro
---

Authorizer instance supports GraphQL natively and thus helps you share the common schema for your frontend applications.
You can play with GraphQL API using the GraphQL playground that comes with your Authorizer instance. Access GraphQL playground on the
instance same as of your Authorizer instance URL.

Table of Contents

- [Schema](#schema)
- [Queries](#queries)
  - [`meta`](#--meta)
  - [`token`](#--token)
  - [`profile`](#--profile)
  - [`users`](#--users)
  - [`verificationRequests`](#--verificationrequests)
- [Mutations](#mutations)
  - [`signup`](#--signup)
  - [`login`](#--login)
  - [`magicLogin`](#--magiclogin)
  - [`logout`](#--logout)
  - [`updateProfile`](#--updateprofile)
  - [`verifyEmail`](#--verifyemail)
  - [`resendVerifyEmail`](#--resendverifyemail)
  - [`forgotPassword`](#--forgotpassword)
  - [`resetPassword`](#--resetpassword)
  - [`adminUpdateUser`](#--adminupdateuser)
  - [`deleteUser`](#--deleteuser)

## Schema

Available types with the Authorizer:

```graphql
type Meta {
  version: String!
  isGoogleLoginEnabled: Boolean!
  isFacebookLoginEnabled: Boolean!
  isTwitterLoginEnabled: Boolean!
  isGithubLoginEnabled: Boolean!
  isEmailVerificationEnabled: Boolean!
  isBasicAuthenticationEnabled: Boolean!
  isMagicLoginEnabled: Boolean!
}

type User {
  id: ID!
  email: String!
  signupMethod: String!
  firstName: String
  lastName: String
  emailVerifiedAt: Int64
  image: String
  createdAt: Int64
  updatedAt: Int64
  roles: [String!]!
}

type VerificationRequest {
  id: ID!
  identifier: String
  token: String
  email: String
  expires: Int64
  createdAt: Int64
  updatedAt: Int64
}

type Error {
  message: String!
  reason: String!
}

type AuthResponse {
  message: String!
  accessToken: String
  accessTokenExpiresAt: Int64
  user: User
}

type Response {
  message: String!
}

input SignUpInput {
  firstName: String
  lastName: String
  email: String!
  password: String!
  confirmPassword: String!
  image: String
  roles: [String!]
}

input LoginInput {
  email: String!
  password: String!
  roles: [String!]
}

input VerifyEmailInput {
  token: String!
}

input ResendVerifyEmailInput {
  email: String!
}

input UpdateProfileInput {
  oldPassword: String
  newPassword: String
  confirmNewPassword: String
  firstName: String
  lastName: String
  image: String
  email: String
  # roles: [String]
}

input AdminUpdateUserInput {
  id: ID!
  email: String
  firstName: String
  lastName: String
  image: String
  roles: [String]
}

input ForgotPasswordInput {
  email: String!
}

input ResetPasswordInput {
  token: String!
  password: String!
  confirmPassword: String!
}

input DeleteUserInput {
  email: String!
}

input MagicLoginInput {
  email: String!
  roles: [String!]
}

type Mutation {
  signup(params: SignUpInput!): AuthResponse!
  login(params: LoginInput!): AuthResponse!
  magicLogin(params: MagicLoginInput!): Response!
  logout: Response!
  updateProfile(params: UpdateProfileInput!): Response!
  adminUpdateUser(params: AdminUpdateUserInput!): User!
  verifyEmail(params: VerifyEmailInput!): AuthResponse!
  resendVerifyEmail(params: ResendVerifyEmailInput!): Response!
  forgotPassword(params: ForgotPasswordInput!): Response!
  resetPassword(params: ResetPasswordInput!): Response!
  deleteUser(params: DeleteUserInput!): Response!
}

type Query {
  meta: Meta!
  users: [User!]!
  token(roles: [String!]): AuthResponse
  profile: User!
  verificationRequests: [VerificationRequest!]!
}
```

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
| `isMagicLoginEnabled`        | It gives information if password less login is enabled or not         |

**Sample Query**

```graphql
query {
  meta {
    version
    isGoogleLoginEnabled
    isGithubLoginEnabled
    isBasicAuthenticationEnabled
    isMagicLoginEnabled
    isEmailVerificationEnabled
    isFacebookLoginEnabled
    isTwitterLoginEnabled
  }
}
```

### - `token`

Query to get the `token` information. It returns `AuthResponse` type with the following keys.

> Note: If `token` is present as HTTP Cookie / Authorization header with bearer token. If the token is not present or an invalid token is present it throws `unauthorized` error

This query can take a optional input `roles` of type `string array` to verify if the current token is valid for a given roles.

**Example**

```graphql
query {
  token(roles: ["admin"]) {
    user {
      ...
    }
  }
}
```

**Response**

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
      roles
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
| `roles`           | List of roles assigned to user                               |
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
    roles
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
    roles
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

## Mutations

### - `signup`

A mutation to signup users using email and password. It accepts `params` of type `SignUpInput` with following keys as parameter

**Request Params**

| Key               | Description                                                                             | Required |
| ----------------- | --------------------------------------------------------------------------------------- | -------- |
| `email`           | Email address of user                                                                   | true     |
| `password`        | Password that user wants to set                                                         | true     |
| `confirmPassword` | Value same as password to make sure that its user and not robot                         | true     |
| `firstName`       | First name of the user                                                                  | false    |
| `lastName`        | Last name of the user                                                                   | false    |
| `image`           | Profile picture URL                                                                     | false    |
| `roles`           | List of roles to be assigned. If not specified `DEFAULT_ROLE` value of env will be used | false    |

This mutation returns `AuthResponse` type with following keys

**Response**

| Key                    | Description                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`              | Success / Error message from server                                                                                                                                                 |
| `accessToken`          | Token that can be used for further authorized requests. This is only returned if `DISABLE_EMAIL_NOTIFICATION` is set to `true` in environment variables                             |
| `accessTokenExpiresAt` | Timestamp when the access Token will expire so that frontend can request new token. This is only returned if `DISABLE_EMAIL_NOTIFICATION` is set to `true` in environment variables |
| `user`                 | User object with its profile keys mentioned [above](#--profile). This is only returned if `DISABLE_EMAIL_NOTIFICATION` is set to `true` in environment variables                    |

**Sample Mutation**

```graphql
mutation {
  signup(
    params: { email: "foo@bar.com", password: "test", confirmPassword: "test" }
  ) {
    message
  }
}
```

### - `login`

A mutation to login users using email and password. It accepts `params` of type `LoginInput` with following keys as parameter

**Request Params**

| Key        | Description                     | Required |
| ---------- | ------------------------------- | -------- |
| `email`    | Email address of user           | true     |
| `password` | Password that user wants to set | true     |
| `roles`    | Roles to login with             | false    |

This mutation returns `AuthResponse` type with following keys

**Response**

| Key                    | Description                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `message`              | Success / Error message from server                                                 |
| `accessToken`          | Token that can be used for further authorized requests.                             |
| `accessTokenExpiresAt` | Timestamp when the access Token will expire so that frontend can request new token. |
| `user`                 | User object with its profile keys mentioned [above](#--profile).                    |

**Sample Mutation**

```graphql
mutation {
  login(params: { email: "foo@bar.com", password: "test" }) {
    user {
      email
      firstName
      lastName
      image
      roles
    }
    accessToken
    accessTokenExpiresAt
    message
  }
}
```

### - `magicLogin`

A mutation to perform password less login. It accepts `params` of type `MagicLoginInput` with following keys as parameter. When the operation is successful, it sends user email with magic link to login. This link is valid for 30 minutes only.

> Note: You will need a SMTP server with an email address and password configured as [authorizer environment](/core/env/) using which system can send emails.

**Request Params**

| Key     | Description           | Required |
| ------- | --------------------- | -------- |
| `email` | Email address of user | true     |
| `roles` | Roles to login with   | false    |

This mutation returns `Response` type with following keys

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Mutation**

```graphql
mutation {
  magicLogin(params: { email: "foo@bar.com" }) {
    message
  }
}
```

### - `logout`

Mutation to logout user. This is authorized request and accepts `token` as HTTP cookie or Authorization header with `Bearer token`.
This action clears the session data from server. It returns `Response` type with following keys

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Mutation**

```graphql
mutation {
  logout {
    message
  }
}
```

### - `updateProfile`

Mutation to update profile of user. It accepts `params` of type `UpdateProfileInput` with following keys as parameter

**Request Params**

| Key                  | Description                                                                                                                                                      | Required |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `firstName`          | New first name of the user                                                                                                                                       | false    |
| `lastName`           | New last name of the user                                                                                                                                        | false    |
| `email`              | New email of th user. This will logout the user and send the new verification mail to user if `DISABLE_EMAIL_NOTIFICATION` is set to false                       | false    |
| `oldPassword`        | In case if user wants to change password they need to specify the older password here. In this scenario `newPassword` and `confirmNewPassword` will be required. | false    |
| `newPassword`        | New password that user wants to set. In this scenario `oldPassword` and `confirmNewPassword` will be required                                                    | false    |
| `confirmNewPassword` | Value same as the new password to make sure it matches the password entered by user. In this scenario `oldPassword` and `newPassword` will be required           | false    |

This mutation returns `Response` type with following keys

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Mutation**

```graphql
mutation {
  updateProfile(params: { firstName: "bob" }) {
    message
  }
}
```

### - `verifyEmail`

Mutation to verify email address of user. It accepts `params` of type `VerifyEmailInput` with following keys as parameter

**Request Params**

| Key     | Description                   | Required |
| ------- | ----------------------------- | -------- |
| `token` | Token sent for verifying user | true     |

This mutation returns `AuthResponse` type with following keys

**Response**

| Key                    | Description                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `message`              | Success / Error message from server                                                 |
| `accessToken`          | Token that can be used for further authorized requests.                             |
| `accessTokenExpiresAt` | Timestamp when the access Token will expire so that frontend can request new token. |
| `user`                 | User object with its profile keys mentioned [above](#--profile).                    |

**Sample Mutation**

```graphql
mutation {
  verifyEmail(params: { token: "some token" }) {
    user {
      email
      firstName
      lastName
      image
    }
    accessToken
    accessTokenExpiresAt
    message
  }
}
```

### - `resendVerifyEmail`

Mutation to resend verification email. This is helpful if user does not receive verification email. It accepts `params` of type `ResendVerifyEmailInput` with following keys as parameter

**Request Params**

| Key     | Description                                           | Required |
| ------- | ----------------------------------------------------- | -------- |
| `email` | Email on which the verification email is not received | true     |

This mutation returns `Response` type with following keys

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Mutation**

```graphql
mutation {
  resendVerifyEmail(params: { email: "foo@bar.com" }) {
    message
  }
}
```

### - `forgotPassword`

Mutation to reset the password in case user have forgotten it. For security reasons this is 2 step process, we send email to the registered and then the are redirect to reset password url through the link in that email. In the first step, it accepts `params` of type `ForgotPasswordInput` with following keys as parameter

**Request Params**

| Key     | Description                                  | Required |
| ------- | -------------------------------------------- | -------- |
| `email` | Email for which password needs to be changed | true     |

This mutation returns `Response` type with following keys

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Mutation**

```graphql
mutation {
  forgotPassword(params: { email: "foo@bar.com" }) {
    message
  }
}
```

### - `resetPassword`

Mutation to reset the password. For security reasons this is 2 step process, we send email to the registered and then the are redirect to reset password url through the link in that email. In the second step, it accepts `params` of type `ResetPasswordInput` with following keys as parameter

**Request Params**

| Key               | Description                                                                 | Required |
| ----------------- | --------------------------------------------------------------------------- | -------- |
| `token`           | Token sent via email in step 1                                              | true     |
| `password`        | New password that user wants to set                                         | true     |
| `confirmPassword` | Same as password just to make sure the values match and is entered by human | true     |

This mutation returns `Response` type with following keys

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Mutation**

```graphql
mutation {
  resetPassword(
    params: { token: "some token", password: "test", confirmPassword: "test" }
  ) {
    message
  }
}
```

### - `adminUpdateProfile`

Mutation to update the profile of users. This mutation is only allowed for super admins. It accepts `params` of type `AdminUpdateUserInput` with following keys

> Note: the super admin query can be access via special header with super admin secret (this is set via ENV) as value

**Request Params**

| Key         | Description                       | Required |
| ----------- | --------------------------------- | -------- |
| `id`        | ID of user to be updated          | true     |
| `email`     | New email address of user         | false    |
| `firstName` | Updated first name of user        | false    |
| `lastName`  | Updated last name of user         | false    |
| `image`     | Updated image url of user         | false    |
| `roles`     | Set of new roles for a given user | false    |

This mutation returns `User` type with update values

**Sample Mutation**

```graphql
mutation {
  adminUpdateUser(
    params: { id: "20", firstName: "Bob", roles: ["user", "admin"] }
  ) {
    id
    firstName
    roles
    createdAt
    updatedAt
  }
}
```

### - `deleteUser`

Mutation to delete user. This mutation is only allowed for super admins. It accepts `params` of type `DeleteUserInput` with following keys

> Note: the super admin query can be access via special header with super admin secret (this is set via ENV) as value

**Request Params**

| Key     | Description                                          | Required |
| ------- | ---------------------------------------------------- | -------- |
| `email` | Email of user that needs to be removed from platform | true     |

This mutation returns `Response` type with following keys

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Mutation**

```graphql
mutation {
  deleteUser(params: { email: "foo@bar.com" }) {
    message
  }
}
```
