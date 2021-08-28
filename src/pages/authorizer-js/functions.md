---
title: Functions
layout: ../../layouts/Main.astro
---

[`@authorizerdev/authorizer-js`](https://www.npmjs.com/package/@authorizerdev/authorizer-js) SDK comes with bunch of utility functions, that you can use to perform various operations without worrying about the API details!

**Table of Contents**

- [fingertipLogin](#--fingertiplogin)
- [login](#--login)
- [signup](#--signup)
- [verifyEmail](#--verifyemail)
- [getProfile](#--getprofile)
- [updateProfile](#--updateprofile)
- [forgotPassword](#--forgotpassword)
- [resetPassword](#--resetPassword)
- [oauthLogin](#--oauthlogin)
- [getMetadata](#--getmetadata)
- [getSession](#--getsession)
- [logout](#--logout)

These functions can be invoked using the `Authorizer` instance:

```js
const authRef = new Authorizer({
  authorizerURL: "https://app.herokuapp.com",
  redirectURL: window.location.origin,
});
```

## - `fingertipLogin`

Function to auto login from browser using the builtin UI of `authorizer`. It checks for session, if available returns the user information, else redirects to login page.

If session exists following keys are returned.

**Response**
| Key | Description |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `message` | Error / Success message from server |
| `accessToken` | accessToken that frontend application can use for further authorized requests |
| `accessTokenExpiresAt` | timestamp when the current token is going to expire, so that frontend can request for new access token |
| `user` | User object with all the basic profile information |

**Sample Usage**

```js
const res = await authRef.fingertipLogin();
```

## - `login`

Function to login user using email and password.

It accepts JSON object as a parameter with following keys

| Key        | Description           | Required |
| ---------- | --------------------- | -------- |
| `email`    | Email address of user | true     |
| `password` | Password of user      | true     |

Following is the response for `login` function

**Response**
| Key | Description |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `message` | Error / Success message from server |
| `accessToken` | accessToken that frontend application can use for further authorized requests |
| `accessTokenExpiresAt` | timestamp when the current token is going to expire, so that frontend can request for new access token |
| `user` | User object with all the basic profile information |

**Sample Usage**

```js
const res = await authRef.login({
  email: "foo@bar.com",
  password: "test",
});
```

## - `signup`

Function to sign-up user using email and password.

It accepts JSON object as a parameter with following keys

| Key               | Description                                                     | Required |
| ----------------- | --------------------------------------------------------------- | -------- |
| `email`           | Email address of user                                           | true     |
| `password`        | Password that user wants to set                                 | true     |
| `confirmPassword` | Value same as password to make sure that its user and not robot | true     |
| `firstName`       | First name of the user                                          | false    |
| `lastName`        | Last name of the user                                           | false    |
| `image`           | Profile picture URL                                             | false    |

Following is the response for `signup` function

**Response**

| Key                    | Description                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`              | Success / Error message from server                                                                                                                                                 |
| `accessToken`          | Token that can be used for further authorized requests. This is only returned if `DISABLE_EMAIL_NOTIFICATION` is set to `true` in environment variables                             |
| `accessTokenExpiresAt` | Timestamp when the access Token will expire so that frontend can request new token. This is only returned if `DISABLE_EMAIL_NOTIFICATION` is set to `true` in environment variables |
| `user`                 | User object with its profile keys mentioned [above](#--getprofile). This is only returned if `DISABLE_EMAIL_NOTIFICATION` is set to `true` in environment variables                 |

**Sample Usage**

```js
const res = await authRef.signup({
  email: "foo@bar.com",
  password: "test",
  confirmPassword: "test",
});
```

## - `verifyEmail`

Function to verify email address of user when they signup.

It accepts JSON object as a parameter with following keys

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
| `user`                 | User object with its profile keys mentioned [above](#--getprofile).                 |

**Sample Usage**

```js
const res = await authRef.verifyEmail({
  token: `some_token`,
});
```

## - `getProfile`

Function to get profile of user. This function makes an authorized request, hence if it is used from the browser the HTTP cookie is sent if user has logged in else you need to pass headers object.

It accepts the optional JSON object as parameter, you can pass the HTTP Headers there.

| Key             | Description                                                                          | Required |
| --------------- | ------------------------------------------------------------------------------------ | -------- |
| `Authorization` | Authorization header passed to the server. It needs `Bearer some_token` as its value | false    |

**Response**

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

**Sample Usage**

```js
// from browser if HTTP cookie is present
const user = await authRef.getProfile();

// from NodeJS / if HTTP cookie is not used
const user = await authRef.getProfile({
  Authorization: `Bearer ${token}`,
});
```

## - `updateProfile`

Function to update profile of user. This function makes an authorized request, hence if it is used from the browser the HTTP cookie is sent if user has logged in else you need to pass headers object.

It accepts 2 JSON object as its parameters.

1. data - User data that needs to be updated
2. headers - Optional parameter to pass Authorization header if HTTP Cookie is not used.

Here are the keys that `data` object accepts

| Key                  | Description                                                                                                                                                      | Required |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `firstName`          | New first name of the user                                                                                                                                       | false    |
| `lastName`           | New last name of the user                                                                                                                                        | false    |
| `email`              | New email of th user. This will logout the user and send the new verification mail to user if `DISABLE_EMAIL_NOTIFICATION` is set to false                       | false    |
| `oldPassword`        | In case if user wants to change password they need to specify the older password here. In this scenario `newPassword` and `confirmNewPassword` will be required. | false    |
| `newPassword`        | New password that user wants to set. In this scenario `oldPassword` and `confirmNewPassword` will be required                                                    | false    |
| `confirmNewPassword` | Value same as the new password to make sure it matches the password entered by user. In this scenario `oldPassword` and `newPassword` will be required           | false    |

Here is sample of `headers` object

| Key             | Description                                                                          | Required |
| --------------- | ------------------------------------------------------------------------------------ | -------- |
| `Authorization` | Authorization header passed to the server. It needs `Bearer some_token` as its value | false    |

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Usage**

```js
// from browser with HTTP Cookie
const res = await authRef.updateProfile({
  firstName: `bob`,
});

// from NodeJS / if HTTP cookie is not used
const res = await authRef.updateProfile(
  {
    firstName: `bob`,
  },
  {
    Authorization: `Bearer some_token`,
  }
);
```

## - forgotPassword

Function that can be used in case if user has forgotten their password. Forgot password is 2 step process.

Step 1: Send email to registered user
Step 2: Reset password.

This function is Step 1 process.

It accepts JSON object as parameter with following keys

| Key     | Description                                  | Required |
| ------- | -------------------------------------------- | -------- |
| `email` | Email for which password needs to be changed | true     |

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const res = await authRef.forgotPassword({
  email: "foo@bar.com",
});
```

## - `resetPassword`

Function to reset password. This is the step 2 of forgot password process.

It accepts JSON object as a parameter with following keys

| Key     | Description                       | Required |
| ------- | --------------------------------- | -------- |
| `token` | Token sent to the user in step 1. | true     |

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const res = await authRef.resetPassword({
  token: `some_token`,
});
```

## - `oauthLogin`

Function to login using OAuth Providers. This is mainly used in browser as user is redirect to respective oauth platform.

> Note only enabled oauth providers can be used here. To get the information about enabled oauth provider you can use [`getMetadata`](#--getmetadata) function

**Sample Usage**

```js
await authRef.oauthLogin("google");
```

## - `getMetadata`

Function to get meta information about your authorizer instance. eg, version, configurations, etc

**Response**

| Key                          | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| `version`                    | Authorizer version that is currently deployed                         |
| `isGoogleLoginEnabled`       | It gives information if google login is configured or not             |
| `isGithubLoginEnabled`       | It gives information if github login is configured or not             |
| `isGithubLoginEnabled`       | It gives information if facebook login is configured or not           |
| `isGithubLoginEnabled`       | It gives information if twitter login is configured or not            |
| `isGithubLoginEnabled`       | It gives information if username and password login is enabled or not |
| `isEmailVerificationEnabled` | It gives information if email verification is enabled or not          |

**Sample Usage**

```js
const res await authRef.getMetadata()
```

## - `getSession`

Function to get session information. This function makes an authorized request, hence if it is used from the browser the HTTP cookie is sent if user has logged in else you need to pass headers object.

It accepts the optional JSON object as parameter, you can pass the HTTP Headers there.

| Key             | Description                                                                          | Required |
| --------------- | ------------------------------------------------------------------------------------ | -------- |
| `Authorization` | Authorization header passed to the server. It needs `Bearer some_token` as its value | false    |

**Response**

| Key                    | Description                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `message`              | Error / Success message from server                                                                    |
| `accessToken`          | accessToken that frontend application can use for further authorized requests                          |
| `accessTokenExpiresAt` | timestamp when the current token is going to expire, so that frontend can request for new access token |
| `user`                 | User object with all the basic profile information                                                     |

**Sample Usage**

```js
// from browser with HTTP Cookie
const res = await authRef.getSession();

// from NodeJS / if HTTP cookie is not used
const res = await authRef.getSession({
  Authorization: `Bearer some_token`,
});
```

## - `logout`

Function to logout user. This function makes an authorized request, hence if it is used from the browser the HTTP cookie is sent if user has logged in else you need to pass headers object.

It accepts the optional JSON object as parameter, you can pass the HTTP Headers there.

| Key             | Description                                                                          | Required |
| --------------- | ------------------------------------------------------------------------------------ | -------- |
| `Authorization` | Authorization header passed to the server. It needs `Bearer some_token` as its value | false    |

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Usage**

```js
// from browser with HTTP Cookie
const res = await authRef.logout();

// from NodeJS / if HTTP cookie is not used
const res = await authRef.logout({
  Authorization: `Bearer some_token`,
});
```
