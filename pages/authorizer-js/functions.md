# Functions

[`@authorizerdev/authorizer-js`](https://www.npmjs.com/package/@authorizerdev/authorizer-js) SDK comes with bunch of utility functions, that you can use to perform various operations without worrying about the API details.

# Migration Guide from 1.x -> 2.x

`2.x` version of `@authorizerdev/authorizer-js` has a uniform response structure that will help your applications to get right error codes and success response. Methods here have `{data, errors}` as response objects for methods of this library.

For `1.x` version of this library you can get only data in response and error would be thrown so you had to handle that in catch.

---

**Table of Contents**

- [authorize](#--authorize)
- [getToken](#--gettoken)
- [login](#--login)
- [signup](#--signup)
- [verifyEmail](#--verifyemail)
- [getProfile](#--getprofile)
- [updateProfile](#--updateprofile)
- [forgotPassword](#--forgotpassword)
- [resetPassword](#--resetPassword)
- [oauthLogin](#--oauthlogin)
- [magicLinkLogin](#--magiclinklogin)
- [getMetadata](#--getmetadata)
- [getSession](#--getsession)
- [revokeToken](#--revoketoken)
- [logout](#--logout)
- [validateJWTToken](#--validatejwttoken)
- [validateSession](#--validatesession)
- [verifyOtp](#--verifyotp)
- [resendOtp](#--resendotp)
- [deactivateAccount](#--deactivateaccount)

These functions can be invoked using the `Authorizer` instance:

```js
const authRef = new Authorizer({
  authorizerURL: 'YOUR_AUTHORIZER_INSTANCE_URL',
  redirectURL: window.location.origin,
  clientID: 'YOUR_CLIENT_ID',
})
```

## - `authorize`

Function to auto login from browser using the builtin UI of `authorizer`. It checks for session, if available returns the token information, else redirects to login page.

- It supports [PKCE flow](https://datatracker.ietf.org/doc/html/rfc7636). This will help user to perform authentication and authorization in safe memory and prevent from CSRF attack. It also enables perform authorization with safety on mobile applications (Tried and tested with [Expo AuthSession](https://github.com/authorizerdev/examples/tree/main/with-react-native-expo))

- It supports [Implicit Flow](https://datatracker.ietf.org/doc/html/rfc6749#section-1.3.2)

It accepts JSON object as a parameter with following keys

| Key                 | Description                                                                                                                                                                                                      | Required |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `response_type`     | What type of response you want. It supports `code` & `token` as response types. Default value is `token`                                                                                                         | false    |
| `response_mode`     | Response is required in which format. Supports 2 forms `query` (returns redirect url with response in query string) and `web_message` (returns html page with data embedded in JS). Default its value is `query` | false    |
| `use_refresh_token` | Whether to include refresh token in response or not                                                                                                                                                              | false    |

If session exists following keys are returned in `data` object.

**Response**
| Key | Description |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `access_token` | accessToken that frontend application can use for further authorized requests |
| `expires_in` | timestamp when the current token is going to expire, so that frontend can request for new access token |
| `id_token` | JWT token holding the user information |
| `refresh_token` | When scope includes `offline_access`, Long living token is returned which can be used to get new access tokens. This is rotated with each request |

**Sample Usage**

```js
const { data, errors } = await authRef.authorize({
  response_type: 'code',
  response_mode: 'query',
})
```

## - `getToken`

Function to get token information based on code / refresh_token

It accepts JSON object as a parameter with following keys

| Key             | Description                                                                                                                  | Required |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| `grant_type`    | Supports `authorization_code` & `refresh_token` grant types. Default is `authorization_code`                                 | false    |
| `code_verifier` | Code verifier to verify against the code_challenge sent in authorize request. Required if `authorization_code` flow is used. | false    |
| `code`          | Code returned form authorize request is sent to make sure it is follow up of same request                                    | false    |
| `refresh_token` | Refresh token used to get the new access token. Required in case of `refresh_token` grant type                               | false    |

If session exists following keys are returned in the `data` object.

**Response**
| Key | Description |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `access_token` | accessToken that frontend application can use for further authorized requests |
| `expires_in` | timestamp when the current token is going to expire, so that frontend can request for new access token |
| `id_token` | JWT token holding the user information |
| `refresh_token` | When scope includes `offline_access`, Long living token is returned which can be used to get new access tokens. This is rotated with each request |

**Sample Usage**

```js
// for web apps
const { data, errors } = await authRef.getToken({
  response_type: 'code',
  response_mode: 'query',
})

// for mobile applications / desktop apps
const { data, errors } = await authRef.getToken({
  grant_type: 'refresh_token',
  refresh_token:
    'your refresh_token from login (should store in memmory such as store, variables)',
})
```

## - `signup`

Function to sign-up user using email and password.

It accepts JSON object as a parameter with the following keys

| Key                | Description                                                                                                   | Required |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | -------- |
| `email`            | Email address of user                                                                                         | true     |
| `password`         | Password that user wants to set                                                                               | true     |
| `confirm_password` | Value same as password to make sure that its user and not robot                                               | true     |
| `given_name`       | First name of the user                                                                                        | false    |
| `family_name`      | Last name of the user                                                                                         | false    |
| `picture`          | Profile picture URL                                                                                           | false    |
| `roles`            | Array of string with valid roles. Defaults to `[user]` if not configured                                      | false    |
| `middle_name`      | middle name of user                                                                                           | false    |
| `nickname`         | nick name of user                                                                                             | false    |
| `gender`           | gender of user                                                                                                | false    |
| `birthdate`        | birthdate of user                                                                                             | false    |
| `phone_number`     | phone number of user                                                                                          | false    |
| `redirect_uri`     | URL where user should be redirected after login                                                               | false    |
| `scope`            | List of openID scopes. If not present default scopes ['openid', 'email', 'profile', 'offline_access'] is used | false    |

Following is the response for the `signup` in the `data` object

**Response**

| Key                             | Description                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`                       | Success / Error message from server                                                                                                                                 |
| `access_token`                  | accessToken that frontend application can use for further authorized requests                                                                                       |
| `expires_in`                    | timestamp when the current token is going to expire, so that frontend can request for new access token                                                              |
| `id_token`                      | JWT token holding the user information                                                                                                                              |
| `refresh_token`                 | When scope includes `offline_access`, Long living token is returned which can be used to get new access tokens. This is rotated with each request                   |
| `user`                          | User object with its profile keys mentioned [above](#--getprofile). This is only returned if `DISABLE_EMAIL_NOTIFICATION` is set to `true` in environment variables |
| `should_show_email_otp_screen`  | Is set to true if email based multi factor authentication is enabled                                                                                                |
| `should_show_mobile_otp_screen` | Is set to true if mobiled based multi factor authentication is enabled                                                                                              |
| `should_show_totp_screen`       | Is set to true if totp based multi factor authentication is enabled                                                                                                 |
| `authenticator_scanner_image`   | If totp registration is pending it sends base64 encoded image string that can be rendered by totp app scanners like Google Authentication                           |
| `authenticator_secret`          | If totp registration is pending, then this secret can be used for registration instead of image on authenticator apps                                               |
| `authenticator_recovery_codes`  | If totp registration is pending, then recovery codes are sent using which totp can be accessed again                                                                |

**Sample Usage**

```js
const { data, errors } = await authRef.signup({
  email: 'foo@bar.com',
  password: 'test',
  confirm_password: 'test',
  scope: ['offline_access'], // for refresh token
})
```

## - `login`

Function to login user using email and password.

It accepts JSON object as a parameter with the following keys

| Key        | Description                                                                                                            | Required |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| `email`    | Email address of user                                                                                                  | true     |
| `password` | Password of user                                                                                                       | true     |
| `roles`    | Roles of user that he/she wants to login with. It accepts array of string. Defaults to `[user]` role if not configured | false    |
| `scope`    | List of openID scopes. If not present default scopes ['openid', 'email', 'profile'] is used                            | false    |

Following is the response for `login` in the `data` object

**Response**
| Key | Description |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `message` | Error / Success message from server |
| `access_token` | accessToken that frontend application can use for further authorized requests |
| `expires_in` | timestamp when the current token is going to expire, so that frontend can request for new access token |
| `id_token` | JWT token holding the user information |
| `refresh_token` | When scope includes `offline_access`, Long living token is returned which can be used to get new access tokens. This is rotated with each request |
| `user` | User object with all the basic profile information |
| `should_show_email_otp_screen` | Is set to true if email based multi factor authentication is enabled |
| `should_show_mobile_otp_screen` | Is set to true if mobiled based multi factor authentication is enabled |
| `should_show_totp_screen` | Is set to true if totp based multi factor authentication is enabled |
| `authenticator_scanner_image` | If totp registration is pending it sends base64 encoded image string that can be rendered by totp app scanners like Google Authentication |
| `authenticator_secret` | If totp registration is pending, then this secret can be used for registration instead of image on authenticator apps |
| `authenticator_recovery_codes` | If totp registration is pending, then recovery codes are sent using which totp can be accessed again |

**Sample Usage**

```js
const { data, errors } = await authRef.login({
  email: 'foo@bar.com',
  password: 'test',
})
```

## - `verifyEmail`

Function to verify email address of user when they signup.

It accepts JSON object as a parameter with following keys

| Key     | Description                   | Required |
| ------- | ----------------------------- | -------- |
| `token` | Token sent for verifying user | true     |

This mutation returns `AuthResponse` type with the following keys in the `data` object

**Response**

| Key                             | Description                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`                       | Success / Error message from server                                                                                                               |
| `should_show_email_otp_screen`  | Boolean value for frontend application to show otp input for email based login screen                                                             |
| `should_show_mobile_otp_screen` | Boolean value for frontend application to show otp input for mobile based login screen                                                            |
| `access_token`                  | accessToken that frontend application can use for further authorized requests                                                                     |
| `expires_in`                    | timestamp when the current token is going to expire, so that frontend can request for new access token                                            |
| `id_token`                      | JWT token holding the user information                                                                                                            |
| `refresh_token`                 | When scope includes `offline_access`, Long living token is returned which can be used to get new access tokens. This is rotated with each request |
| `user`                          | User object with its profile keys mentioned [above](#--getprofile).                                                                               |
| `should_show_email_otp_screen`  | Is set to true if email based multi factor authentication is enabled                                                                              |
| `should_show_mobile_otp_screen` | Is set to true if mobiled based multi factor authentication is enabled                                                                            |
| `should_show_totp_screen`       | Is set to true if totp based multi factor authentication is enabled                                                                               |
| `authenticator_scanner_image`   | If totp registration is pending it sends base64 encoded image string that can be rendered by totp app scanners like Google Authentication         |
| `authenticator_secret`          | If totp registration is pending, then this secret can be used for registration instead of image on authenticator apps                             |
| `authenticator_recovery_codes`  | If totp registration is pending, then recovery codes are sent using which totp can be accessed again                                              |

**Sample Usage**

```js
const { data, errors } = await authRef.verifyEmail({
  token: `some_token`,
})
```

## - `getProfile`

Function to get profile of user. This function makes an authorized request, hence if it is used from the browser the HTTP cookie is sent if user has logged in else you need to pass headers object.

It accepts the optional JSON object as parameter, you can pass the HTTP Headers there.

| Key             | Description                                                                            | Required |
| --------------- | -------------------------------------------------------------------------------------- | -------- |
| `Authorization` | Authorization header passed to the server. It needs `Bearer access_token` as its value | true     |

It returns the following keys in response `data` object

**Response**

| Key              | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `id`             | user unique identifier                                       |
| `email`          | email address of user                                        |
| `given_name`     | first name of user                                           |
| `family_name`    | last name of user                                            |
| `signup_methods` | methods using which user have signed up, eg: `google,github` |
| `email_verified` | determine if email is verified or not                        |
| `picture`        | profile picture URL                                          |
| `roles`          | user roles                                                   |
| `created_at`     | timestamp at which the user entry was created                |
| `updated_at`     | timestamp at which the user entry was updated                |

**Sample Usage**

```js
// from browser if HTTP cookie is present
const { data, errors } = await authRef.getProfile()

// from NodeJS / if HTTP cookie is not used
const { data, errors } = await authRef.getProfile({
  Authorization: `Bearer ${token}`,
})
```

## - `updateProfile`

Function to update profile of user. This function makes an authorized request, hence if it is used from the browser the HTTP cookie is sent if user has logged in else you need to pass headers object.

It accepts 2 JSON object as its parameters.

1. data - User data that needs to be updated
2. headers - To pass Authorization header

Here are the keys that `data` object accepts

| Key                  | Description                                                                                                                                                      | Required |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `given_name`         | New first name of the user                                                                                                                                       | false    |
| `family_name`        | New last name of the user                                                                                                                                        | false    |
| `email`              | New email of th user. This will logout the user and send the new verification mail to user if `DISABLE_EMAIL_NOTIFICATION` is set to false                       | false    |
| `old_password`       | In case if user wants to change password they need to specify the older password here. In this scenario `newPassword` and `confirmNewPassword` will be required. | false    |
| `newPassword`        | New password that user wants to set. In this scenario `old_password` and `confirmNewPassword` will be required                                                   | false    |
| `confirmNewPassword` | Value same as the new password to make sure it matches the password entered by user. In this scenario `old_password` and `newPassword` will be required          | false    |

Here is sample of `headers` object

| Key             | Description                                                                            | Required |
| --------------- | -------------------------------------------------------------------------------------- | -------- |
| `Authorization` | Authorization header passed to the server. It needs `Bearer access_token` as its value | true     |

It returns the following keys in response `data` object

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const { data, errors } = await authRef.updateProfile(
  {
    given_name: `bob`,
  },
  {
    Authorization: `Bearer some_token`,
  },
)
```

## - forgotPassword

Function that can be used in case if user has forgotten their password. Forgot password is 2 step process.

Step 1: Send email to registered user
Step 2: Reset password.

This function is Step 1 process.

It accepts JSON object as parameter with the following keys

> Note: You will need a SMTP server with an email address and password configured as [authorizer environment](/core/env/) using which system can send emails.

| Key     | Description                                  | Required |
| ------- | -------------------------------------------- | -------- |
| `email` | Email for which password needs to be changed | true     |

It returns the following keys in response `data` object

**Response**

| Key                             | Description                             |
| ------------------------------- | --------------------------------------- |
| `message`                       | Success / Error message from server     |
| `should_show_mobile_otp_screen` | Show OTP screen if mobile login is used |

**Sample Usage**

```js
const { data, errors } = await authRef.forgotPassword({
  email: 'foo@bar.com',
})
```

## - `resetPassword`

Function to reset password. This is the step 2 of forgot password process.

It accepts JSON object as a parameter with following keys

| Key     | Description                       | Required |
| ------- | --------------------------------- | -------- |
| `token` | Token sent to the user in step 1. | true     |

It returns the following keys in response `data` object

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const { data, errors } = await authRef.resetPassword({
  token: `some_token`,
})
```

## - `oauthLogin`

Function to login using OAuth Providers. This is mainly used in browser as user is redirect to respective oauth platform.

> Note only enabled oauth providers can be used here. To get the information about enabled oauth provider you can use [`getMetadata`](#--getmetadata) function

It supports optional argument for `role` based login

**Sample Usage**

```js
await authRef.oauthLogin('google')

// login with specific role
await authRef.oauthLogin('google', 'admin')
```

## - magicLinkLogin

Function to perform password less login.

> Note: You will need a SMTP server with an email address and password configured as [authorizer environment](/core/env/) using which system can send emails.

| Key            | Description                                                                                 | Required |
| -------------- | ------------------------------------------------------------------------------------------- | -------- |
| `email`        | Email using which user needs to login                                                       | true     |
| `roles`        | List of valid valid roles using which user needs to login                                   | false    |
| `scope`        | List of openID scopes. If not present default scopes ['openid', 'email', 'profile'] is used | false    |
| `redirect_uri` | URL where user should be redirected after login                                             | false    |

It returns the following keys in response `data` object

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const { data, errors } = await authRef.magicLinkLogin({
  email: 'foo@bar.com',
})
```

## - `getMetadata`

Function to get meta information about your authorizer instance. eg, version, configurations, etc

It returns the following keys in response `data` object

**Response**

| Key                               | Description                                                   |
| --------------------------------- | ------------------------------------------------------------- |
| `version`                         | Authorizer version that is currently deployed                 |
| `client_id`                       | Identifier of your instance                                   |
| `is_google_login_enabled`         | It gives information if google login is configured or not     |
| `is_github_login_enabled`         | It gives information if github login is configured or not     |
| `is_facebook_login_enabled`       | It gives information if facebook login is configured or not   |
| `is_email_verification_enabled`   | It gives information if email verification is enabled or not  |
| `is_basic_authentication_enabled` | It gives information, if basic auth is enabled or not         |
| `is_magic_link_login_enabled`     | It gives information if password less login is enabled or not |

**Sample Usage**

```js
const { data, errors } await authRef.getMetadata()
```

## - `getSession`

Function to get session information. This function makes an authorized request, hence if it is used from the browser the HTTP cookie is sent if user has logged in else you need to pass headers object.

It accepts the optional JSON object as parameter, you can pass the HTTP Headers there. Optionally you can also validate the roles against the given token by passing the `roles` as second argument to function.

| Key             | Description                                                                          | Required |
| --------------- | ------------------------------------------------------------------------------------ | -------- |
| `Authorization` | Authorization header passed to the server. It needs `Bearer some_token` as its value | false    |

It returns the following keys in response `data` object

**Response**

| Key                             | Description                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `message`                       | Error / Success message from server                                                                                                       |
| `access_token`                  | accessToken that frontend application can use for further authorized requests                                                             |
| `expires_in`                    | timestamp when the current token is going to expire, so that frontend can request for new access token                                    |
| `user`                          | User object with all the basic profile information                                                                                        |
| `should_show_email_otp_screen`  | Is set to true if email based multi factor authentication is enabled                                                                      |
| `should_show_mobile_otp_screen` | Is set to true if mobiled based multi factor authentication is enabled                                                                    |
| `should_show_totp_screen`       | Is set to true if totp based multi factor authentication is enabled                                                                       |
| `authenticator_scanner_image`   | If totp registration is pending it sends base64 encoded image string that can be rendered by totp app scanners like Google Authentication |
| `authenticator_secret`          | If totp registration is pending, then this secret can be used for registration instead of image on authenticator apps                     |
| `authenticator_recovery_codes`  | If totp registration is pending, then recovery codes are sent using which totp can be accessed again                                      |

**Sample Usage**

```js
// from browser with HTTP Cookie
const { data, errors } = await authRef.getSession()

// role validation with http cookie
const { data, errors } = await authRef.getSession(null, 'admin')

// from NodeJS / if HTTP cookie is not used
const { data, errors } = await authRef.getSession(
  {
    Authorization: `Bearer some_token`,
  },
  'admin',
)
```

## - `revokeToken`

Function to revoke refresh token. It accepts json object as its parameter with following keys

**JSON Object**

| Key             | Description                 | Required |
| --------------- | --------------------------- | -------- |
| `refresh_token` | Refresh token to be revoked | true     |

It returns the following keys in response `data` object

**Response**

| Key       | Description     |
| --------- | --------------- |
| `message` | Success message |

**Sample Usage**

```js
const { data, errors } = await authRef.revokeToken({
  refresh_token: 'foo',
})
```

## - `logout`

Function to logout user. This function makes an authorized request, hence if it is used from the browser the HTTP cookie is sent if user has logged in else you need to pass headers object.

It accepts the optional JSON object as parameter, you can pass the HTTP Headers there.

| Key             | Description                                                                          | Required |
| --------------- | ------------------------------------------------------------------------------------ | -------- |
| `Authorization` | Authorization header passed to the server. It needs `Bearer some_token` as its value | false    |

It returns the following keys in response `data` object

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Usage**

```js
// from browser with HTTP Cookie
const { data, errors } = await authRef.logout()

// from NodeJS / if HTTP cookie is not used
const { data, errors } = await authRef.logout({
  Authorization: `Bearer some_token`,
})
```

## - `validateJWTToken`

Function to validate jwt tokens.

It expects the JSON object as parameter with following parameters

| Key          | Description                                                                                              | Required |
| ------------ | -------------------------------------------------------------------------------------------------------- | -------- |
| `token_type` | Type of token that needs to be validated. It can be one of `access_token`, `refresh_token` or `id_token` | `true`   |
| `token`      | Jwt token string                                                                                         | `true`   |
| `roles`      | Array of roles to validate jwt token for                                                                 | `false`  |

It returns the following keys in response `data` object

**Response**

| Key        | Description                                        |
| ---------- | -------------------------------------------------- |
| `is_valid` | Boolean indicating if given token was valid or not |

**Sample Usage**

```js
const { data, errors } = await authRef.validateJWTToken({
  token_type: `access_token`
  token: `some jwt token string`
})
```

## - `validateSession`

Function to validate cookie / browser session.

It expects the JSON object as parameter with following parameters

| Key      | Description                                                                                         | Required |
| -------- | --------------------------------------------------------------------------------------------------- | -------- |
| `cookie` | browser session cookie value. If not present it will need coookie present in header as https cookie | `false`  |
| `roles`  | Array of roles to validate jwt token for                                                            | `false`  |

It returns the following keys in response `data` object

**Response**

| Key        | Description                                        |
| ---------- | -------------------------------------------------- |
| `is_valid` | Boolean indicating if given token was valid or not |

**Sample Usage**

```js
const { data, errors } = await authRef.validateSession({
  cookie: ``,
})
```

## - `verifyOtp`

Function to verify OTP sent to the user when they login.

It accepts JSON object as a parameter with following keys

| Key            | Description                                        | Required |
| -------------- | -------------------------------------------------- | -------- |
| `email`        | Email address of user                              | false    |
| `phone_number` | Phone number of user                               | false    |
| `otp`          | OTP (One Time Password) sent to user email address | true     |

Either `email` or `phone_number` is required

It returns the following keys in response `data` object

**Response**
| Key | Description |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `message` | Error / Success message from server |
| `access_token` | accessToken that frontend application can use for further authorized requests |
| `expires_in` | timestamp when the current token is going to expire, so that frontend can request for new access token |
| `id_token` | JWT token holding the user information |
| `refresh_token` | When scope includes `offline_access`, Long living token is returned which can be used to get new access tokens. This is rotated with each request |
| `user` | User object with all the basic profile information |
| `should_show_email_otp_screen` | Is set to true if email based multi factor authentication is enabled |
| `should_show_mobile_otp_screen` | Is set to true if mobiled based multi factor authentication is enabled |
| `should_show_totp_screen` | Is set to true if totp based multi factor authentication is enabled |
| `authenticator_scanner_image` | If totp registration is pending it sends base64 encoded image string that can be rendered by totp app scanners like Google Authentication |
| `authenticator_secret` | If totp registration is pending, then this secret can be used for registration instead of image on authenticator apps |
| `authenticator_recovery_codes` | If totp registration is pending, then recovery codes are sent using which totp can be accessed again |

**Sample Usage**

```js
const { data, errors } = await authRef.verifyOtp({
  email: 'foo@bar.com',
  otp: 'AB123C',
})
```

## - `resendOtp`

Function to resend OTP to the user.

It accepts JSON object as a parameter with following keys

| Key            | Description           | Required |
| -------------- | --------------------- | -------- |
| `email`        | Email address of user | false    |
| `phone_number` | Phone number of user  | false    |

Either `email` or `phone_number` is required

It returns the following keys in response `data` object

**Response**
| Key | Description |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `message` | Error / Success message from server |

**Sample Usage**

```js
const { data, errors } = await authRef.resendOtp({
  email: 'foo@bar.com',
})
```

## - `deactivateAccount`

Function to deactivate user account. This function makes an authorized request, hence if it is used from the browser the HTTP cookie is sent if user has logged in else you need to pass headers object.

It accepts 1 JSON object as its parameters.

1. headers - To pass Authorization header

Here is sample of `headers` object

| Key             | Description                                                                            | Required |
| --------------- | -------------------------------------------------------------------------------------- | -------- |
| `Authorization` | Authorization header passed to the server. It needs `Bearer access_token` as its value | true     |

It returns the following keys in response `data` object

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const { data, errors } = await authRef.deactivateAccount({
  Authorization: `Bearer some_token`,
})
```
