---
sidebar_position: 2
title: Functions
---

# Functions

[`@authorizerdev/authorizer-js`](https://www.npmjs.com/package/@authorizerdev/authorizer-js) SDK comes with bunch of utility functions, that you can use to perform various operations without worrying about the API details.

---

**Table of Contents**

- [authorize](#--authorize)
- [browserLogin](#--browserlogin)
- [getToken](#--gettoken)
- [login](#--login)
- [signup](#--signup)
- [verifyEmail](#--verifyemail)
- [resendVerifyEmail](#--resendverifyemail)
- [getProfile](#--getprofile)
- [updateProfile](#--updateprofile)
- [forgotPassword](#--forgotpassword)
- [resetPassword](#--resetpassword)
- [oauthLogin](#--oauthlogin)
- [magicLinkLogin](#--magiclinklogin)
- [getMetaData](#--getmetadata)
- [getSession](#--getsession)
- [revokeToken](#--revoketoken)
- [logout](#--logout)
- [validateJWTToken](#--validatejwttoken)
- [validateSession](#--validatesession)
- [checkPermissions](#--checkpermissions)
- [listPermissions](#--listpermissions)
- [verifyOtp](#--verifyotp)
- [resendOtp](#--resendotp)
- [deactivateAccount](#--deactivateaccount)
- [skipMfaSetup](#--skipmfasetup)
- [lockMfa](#--lockmfa)
- [emailOtpMfaSetup](#--emailotpmfasetup)
- [smsOtpMfaSetup](#--smsotpmfasetup)
- [totpMfaSetup](#--totpmfasetup)
- [webauthnRegistrationOptions](#--webauthnregistrationoptions)
- [webauthnRegistrationVerify](#--webauthnregistrationverify)
- [webauthnLoginOptions](#--webauthnloginoptions)
- [webauthnLoginVerify](#--webauthnloginverify)
- [webauthnCredentials](#--webauthncredentials)
- [webauthnDeleteCredential](#--webauthndeletecredential)
- [registerPasskey](#--registerpasskey)
- [loginWithPasskey](#--loginwithpasskey)
- [loginWithPasskeyAutofill](#--loginwithpasskeyautofill)
- [cancelPasskeyAutofill](#--cancelpasskeyautofill)
- [isWebauthnSupported](#--iswebauthnsupported)
- [parseMfaRedirectParams](#--parsemfaredirectparams)

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

## - `browserLogin`

Function to silently check for an existing browser session (via `getSession`) and return its tokens. If no session exists it falls back to redirecting the browser to the hosted login app (`{authorizerURL}/app`), the same fallback `authorize` uses when the iframe check fails. Browser-only; it takes no parameters.

**Sample Usage**

```js
const { data, errors } = await authRef.browserLogin()
if (data?.access_token) {
  // an existing session was found
}
```

## - `getToken`

Function to exchange credentials for tokens at `/oauth/token`. This call always goes over REST regardless of the client's configured `protocol` (see [Protocols & Admin API](/sdks/authorizer-js/admin)).

Supports 4 grant types: `authorization_code` (default), `refresh_token`, `client_credentials` ([RFC 6749 §4.4](https://datatracker.ietf.org/doc/html/rfc6749#section-4.4)), and token exchange ([RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693), `urn:ietf:params:oauth:grant-type:token-exchange`).

> **Server-side only:** `client_credentials` and token exchange are machine/service flows for trusted server-side code. Never ship `client_secret`, `client_assertion`, or subject/actor tokens in a browser bundle.

It accepts JSON object as a parameter with following keys

| Key                     | Description                                                                                                                  | Required |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| `grant_type`             | `authorization_code`, `refresh_token`, `client_credentials`, or `urn:ietf:params:oauth:grant-type:token-exchange`. Default is `authorization_code` | false    |
| `code_verifier`          | Code verifier to verify against the code_challenge sent in authorize request. Required if `authorization_code` flow is used (handled automatically by the SDK). | false    |
| `code`                   | Code returned form authorize request is sent to make sure it is follow up of same request                                    | false    |
| `refresh_token`          | Refresh token used to get the new access token. Required in case of `refresh_token` grant type                               | false    |
| `client_secret`          | Service-account secret. Used with `client_credentials`. Server-side only.                                                     | false    |
| `scope`                  | Space-delimited OAuth2 scope. Omit for `client_credentials` to get the service account's full allowed scope set.             | false    |
| `client_assertion`       | RFC 7523 JWT-bearer client credential (secretless workload identity: K8s SA tokens, SPIFFE JWT-SVIDs, cloud OIDC tokens).     | false    |
| `client_assertion_type`  | Type of `client_assertion`. Use the exported `CLIENT_ASSERTION_TYPE_JWT_BEARER` constant.                                     | false    |
| `subject_token`          | The authority being exercised (the user's token). Required for token exchange.                                               | false    |
| `subject_token_type`     | Type of `subject_token`. Use the exported `TOKEN_TYPE_ACCESS_TOKEN` / `TOKEN_TYPE_JWT` constants.                             | false    |
| `actor_token`            | The acting agent's token; its presence selects the delegation profile. Used for token exchange.                              | false    |
| `actor_token_type`       | Type of `actor_token`.                                                                                                        | false    |
| `resource`               | RFC 8707 resource indicator the issued token should be audience-bound to.                                                     | false    |

If session exists following keys are returned in the `data` object.

**Response**

| Key | Description |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `access_token` | accessToken that frontend application can use for further authorized requests |
| `expires_in` | timestamp when the current token is going to expire, so that frontend can request for new access token |
| `id_token` | JWT token holding the user information. Only issued on user grants (`authorization_code` / `refresh_token`) — absent for `client_credentials` and token exchange |
| `refresh_token` | When scope includes `offline_access`, Long living token is returned which can be used to get new access tokens. This is rotated with each request |
| `token_type` | Token type, e.g. `Bearer` |
| `scope` | Granted scope. Returned by `client_credentials` and token exchange grants |
| `issued_token_type` | The token type URN issued. Returned by the token exchange grant ([RFC 8693 §2.2](https://datatracker.ietf.org/doc/html/rfc8693#section-2.2)) |

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

// server-side machine-to-machine (client_credentials) — never in a browser bundle
const { data, errors } = await authRef.getToken({
  grant_type: 'client_credentials',
  client_secret: 'YOUR_CLIENT_SECRET',
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
| `state`            | Opaque state string round-tripped through the flow. Auto-generated by the SDK if omitted                      | false    |
| `app_data`         | Arbitrary JSON object of application-specific data stored on the user                                        | false    |

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
| `should_offer_webauthn_mfa_verify` | Is set to true if the user should be offered to verify with an existing passkey as their second factor                                                          |
| `should_offer_webauthn_mfa_setup`  | Is set to true if the user should be offered to enroll a passkey as their second factor                                                                         |
| `should_offer_email_otp_mfa_setup` | Is set to true if the user should be offered email-OTP MFA enrollment                                                                                            |
| `should_offer_sms_otp_mfa_setup`   | Is set to true if the user should be offered SMS-OTP MFA enrollment                                                                                              |
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
| `email`    | Email address of user                                                                                                  | false    |
| `phone_number` | Phone number of user (alternative to `email`)                                                                      | false    |
| `password` | Password of user                                                                                                       | true     |
| `roles`    | Roles of user that he/she wants to login with. It accepts array of string. Defaults to `[user]` role if not configured | false    |
| `scope`    | List of openID scopes. If not present default scopes ['openid', 'email', 'profile'] is used                            | false    |
| `state`    | Opaque state string round-tripped through the flow                                                                     | false    |

Either `email` or `phone_number` is required.

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
| `should_offer_webauthn_mfa_verify` | Is set to true if the user should be offered to verify with an existing passkey as their second factor |
| `should_offer_webauthn_mfa_setup` | Is set to true if the user should be offered to enroll a passkey as their second factor |
| `should_offer_email_otp_mfa_setup` | Is set to true if the user should be offered email-OTP MFA enrollment |
| `should_offer_sms_otp_mfa_setup` | Is set to true if the user should be offered SMS-OTP MFA enrollment |
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
| `state` | Opaque state string round-tripped through the flow | false |

This mutation returns `AuthResponse` type with the following keys in the `data` object

**Response**

| Key                             | Description                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`                       | Success / Error message from server                                                                                                               |
| `access_token`                  | accessToken that frontend application can use for further authorized requests                                                                     |
| `expires_in`                    | timestamp when the current token is going to expire, so that frontend can request for new access token                                            |
| `id_token`                      | JWT token holding the user information                                                                                                            |
| `refresh_token`                 | When scope includes `offline_access`, Long living token is returned which can be used to get new access tokens. This is rotated with each request |
| `user`                          | User object with its profile keys mentioned [above](#--getprofile).                                                                               |
| `should_show_email_otp_screen`  | Is set to true if email based multi factor authentication is enabled                                                                              |
| `should_show_mobile_otp_screen` | Is set to true if mobiled based multi factor authentication is enabled                                                                            |
| `should_show_totp_screen`       | Is set to true if totp based multi factor authentication is enabled                                                                               |
| `should_offer_webauthn_mfa_verify` | Is set to true if the user should be offered to verify with an existing passkey as their second factor                                        |
| `should_offer_webauthn_mfa_setup`  | Is set to true if the user should be offered to enroll a passkey as their second factor                                                       |
| `should_offer_email_otp_mfa_setup` | Is set to true if the user should be offered email-OTP MFA enrollment                                                                          |
| `should_offer_sms_otp_mfa_setup`   | Is set to true if the user should be offered SMS-OTP MFA enrollment                                                                            |
| `authenticator_scanner_image`   | If totp registration is pending it sends base64 encoded image string that can be rendered by totp app scanners like Google Authentication         |
| `authenticator_secret`          | If totp registration is pending, then this secret can be used for registration instead of image on authenticator apps                             |
| `authenticator_recovery_codes`  | If totp registration is pending, then recovery codes are sent using which totp can be accessed again                                              |

**Sample Usage**

```js
const { data, errors } = await authRef.verifyEmail({
  token: `some_token`,
})
```

## - `resendVerifyEmail`

Function to resend the verification email to a user who signed up but hasn't verified their email yet.

It accepts JSON object as a parameter with following keys

| Key          | Description                                  | Required |
| ------------ | --------------------------------------------- | -------- |
| `email`      | Email address to resend the verification to   | true     |
| `identifier` | Verification identifier (`basic_signup`)      | true     |
| `state`      | Opaque state string round-tripped through the flow | false |

It returns the following keys in response `data` object

**Response**

| Key       | Description                         |
| --------- | ------------------------------------ |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const { data, errors } = await authRef.resendVerifyEmail({
  email: 'foo@bar.com',
  identifier: 'basic_signup',
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

| Key                             | Description                                                       |
| -------------------------------- | ------------------------------------------------------------------ |
| `id`                             | user unique identifier                                             |
| `email`                          | email address of user                                              |
| `email_verified`                 | determine if email is verified or not                              |
| `given_name`                     | first name of user                                                 |
| `family_name`                    | last name of user                                                  |
| `middle_name`                    | middle name of user                                                |
| `nickname`                       | nick name of user                                                  |
| `preferred_username`             | preferred username of user                                         |
| `gender`                         | gender of user                                                     |
| `birthdate`                      | birthdate of user                                                  |
| `phone_number`                   | phone number of user                                                |
| `phone_number_verified`          | determine if phone number is verified or not                       |
| `picture`                        | profile picture URL                                                |
| `signup_methods`                 | methods using which user have signed up, eg: `google,github`       |
| `roles`                          | user roles                                                          |
| `created_at`                     | timestamp at which the user entry was created                      |
| `updated_at`                     | timestamp at which the user entry was updated                      |
| `revoked_timestamp`              | timestamp at which access was revoked, if any                      |
| `is_multi_factor_auth_enabled`   | whether the user has multi-factor authentication enabled           |
| `has_skipped_mfa_setup_at`       | timestamp at which the user skipped MFA setup, if any               |
| `mfa_locked_at`                  | timestamp at which MFA was locked for the user, if any              |
| `enrolled_mfa_methods`           | list of MFA methods the user has enrolled (e.g. `totp`, `webauthn`) |
| `app_data`                       | arbitrary JSON object of application-specific data on the user      |

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

| Key                     | Description                                                                                                                                                        | Required |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `given_name`            | New first name of the user                                                                                                                                         | false    |
| `family_name`           | New last name of the user                                                                                                                                          | false    |
| `middle_name`           | New middle name of the user                                                                                                                                        | false    |
| `nickname`              | New nickname of the user                                                                                                                                           | false    |
| `gender`                | New gender of the user                                                                                                                                             | false    |
| `birthdate`             | New birthdate of the user                                                                                                                                          | false    |
| `phone_number`          | New phone number of the user                                                                                                                                       | false    |
| `picture`               | New profile picture URL of the user                                                                                                                                | false    |
| `email`                 | New email of th user. This will logout the user and send the new verification mail to user if `DISABLE_EMAIL_NOTIFICATION` is set to false                        | false    |
| `old_password`          | In case if user wants to change password they need to specify the older password here. In this scenario `new_password` and `confirm_new_password` will be required. | false    |
| `new_password`          | New password that user wants to set. In this scenario `old_password` and `confirm_new_password` will be required                                                   | false    |
| `confirm_new_password`  | Value same as the new password to make sure it matches the password entered by user. In this scenario `old_password` and `new_password` will be required           | false    |
| `is_multi_factor_auth_enabled` | Toggle whether MFA is enabled for the user                                                                                                                   | false    |
| `app_data`              | Arbitrary JSON object of application-specific data stored on the user                                                                                              | false    |

> Note: earlier versions of this doc referred to these password fields as `newPassword` / `confirmNewPassword` (camelCase) — the SDK and server both expect the snake_case `new_password` / `confirm_new_password` shown above.

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

> Note: You will need a SMTP server with an email address and password configured as [authorizer environment](/core/server-config) using which system can send emails.

| Key            | Description                                                | Required |
| -------------- | ------------------------------------------------------------ | -------- |
| `email`        | Email for which password needs to be changed                | false    |
| `phone_number` | Phone number for which password needs to be changed (alternative to `email`) | false |
| `redirect_uri` | URL where user should be redirected after resetting password. Defaults to the client's configured `redirectURL` | false |
| `state`        | Opaque state string round-tripped through the flow. Auto-generated by the SDK if omitted | false |

Either `email` or `phone_number` is required.

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

| Key                | Description                                                        | Required |
| -------------------- | --------------------------------------------------------------------- | -------- |
| `token`             | Token sent to the user by email in step 1 (`forgotPassword`)        | false    |
| `otp`               | OTP sent to the user by SMS in step 1, if mobile-based reset is used | false    |
| `phone_number`      | Phone number the OTP was sent to. Required if `otp` is used          | false    |
| `password`          | New password to set                                                 | true     |
| `confirm_password`  | Value same as `password` to make sure it matches                     | true     |

Either `token` (email flow) or `otp` + `phone_number` (mobile flow) is required, along with `password` and `confirm_password`.

It returns the following keys in response `data` object

**Response**

| Key       | Description                         |
| --------- | ----------------------------------- |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const { data, errors } = await authRef.resetPassword({
  token: `some_token`,
  password: 'newPass123',
  confirm_password: 'newPass123',
})
```

## - `oauthLogin`

Function to login using OAuth Providers. This is mainly used in browser as user is redirect to respective oauth platform.

> Note only enabled oauth providers can be used here. To get the information about enabled oauth provider you can use [`getMetaData`](#--getmetadata) function

It accepts the following positional arguments:

| Argument         | Description                                                                                       | Required |
| ------------------ | ----------------------------------------------------------------------------------------------------- | -------- |
| `oauthProvider`   | One of `apple`, `github`, `google`, `facebook`, `linkedin`, `twitter`, `microsoft`, `twitch`, `roblox`, `discord` | true     |
| `roles`           | Array of role strings to log in with                                                                  | false    |
| `redirect_uri`    | URL to redirect to after the OAuth flow completes. Defaults to the client's configured `redirectURL`  | false    |
| `state`           | Opaque state string round-tripped through the flow. Auto-generated by the SDK if omitted              | false    |

**Sample Usage**

```js
await authRef.oauthLogin('google')

// login with specific role(s)
await authRef.oauthLogin('google', ['admin'])

// override the redirect_uri
await authRef.oauthLogin('github', undefined, 'https://your-app.example.com/callback')
```

## - magicLinkLogin

Function to perform password less login.

> Note: You will need a SMTP server with an email address and password configured as [authorizer environment](/core/server-config) using which system can send emails.

| Key            | Description                                                                                 | Required |
| -------------- | ------------------------------------------------------------------------------------------- | -------- |
| `email`        | Email using which user needs to login                                                       | true     |
| `roles`        | List of valid valid roles using which user needs to login                                   | false    |
| `scope`        | List of openID scopes. If not present default scopes ['openid', 'email', 'profile'] is used | false    |
| `redirect_uri` | URL where user should be redirected after login                                             | false    |
| `state`        | Opaque state string round-tripped through the flow. Auto-generated by the SDK if omitted     | false    |

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

## - `getMetaData`

Function to get meta information about your authorizer instance. eg, version, configurations, etc

It returns the following keys in response `data` object

**Response**

| Key                                        | Description                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `version`                                  | Authorizer version that is currently deployed                       |
| `client_id`                                | Identifier of your instance                                         |
| `is_google_login_enabled`                  | It gives information if google login is configured or not           |
| `is_github_login_enabled`                  | It gives information if github login is configured or not           |
| `is_facebook_login_enabled`                | It gives information if facebook login is configured or not         |
| `is_linkedin_login_enabled`                | It gives information if linkedin login is configured or not         |
| `is_apple_login_enabled`                   | It gives information if apple login is configured or not            |
| `is_discord_login_enabled`                 | It gives information if discord login is configured or not          |
| `is_twitter_login_enabled`                 | It gives information if twitter login is configured or not          |
| `is_microsoft_login_enabled`               | It gives information if microsoft login is configured or not        |
| `is_twitch_login_enabled`                  | It gives information if twitch login is configured or not           |
| `is_roblox_login_enabled`                  | It gives information if roblox login is configured or not           |
| `is_email_verification_enabled`            | It gives information if email verification is enabled or not        |
| `is_basic_authentication_enabled`          | It gives information, if basic auth is enabled or not               |
| `is_magic_link_login_enabled`              | It gives information if password less login is enabled or not       |
| `is_sign_up_enabled`                       | It gives information if new sign ups are allowed                    |
| `is_strong_password_enabled`               | It gives information if strong password policy is enforced          |
| `is_multi_factor_auth_enabled`             | It gives information if multi-factor authentication is enabled      |
| `is_mobile_basic_authentication_enabled`   | It gives information if mobile (phone number) basic auth is enabled |
| `is_phone_verification_enabled`            | It gives information if phone verification is enabled               |
| `is_totp_mfa_enabled`                      | It gives information if TOTP is available as an MFA method          |
| `is_email_otp_mfa_enabled`                 | It gives information if email OTP is available as an MFA method     |
| `is_sms_otp_mfa_enabled`                   | It gives information if SMS OTP is available as an MFA method       |
| `is_webauthn_enabled`                      | It gives information if WebAuthn/passkeys are available as an MFA method |
| `is_mfa_enforced`                          | It gives information if MFA is enforced for all users               |
| `is_org_discovery_enabled`                 | It gives information if home-realm/org discovery is enabled         |

**Sample Usage**

```js
const { data, errors } = await authRef.getMetaData()
```

## - `getSession`

Function to get session information. This function makes an authorized request, hence if it is used from the browser the HTTP cookie is sent if user has logged in else you need to pass headers object.

It accepts the optional JSON object as parameter, you can pass the HTTP Headers there. Optionally you can also pass a `SessionQueryRequest` object (`{ roles?: string[], scope?: string[] }`) as the second argument to validate `roles` / `scope` against the session.

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
| `id_token`                      | JWT token holding the user information                                                                                                    |
| `refresh_token`                 | When scope includes `offline_access`, Long living token is returned which can be used to get new access tokens. This is rotated with each request |
| `user`                          | User object with all the basic profile information                                                                                        |
| `should_show_email_otp_screen`  | Is set to true if email based multi factor authentication is enabled                                                                      |
| `should_show_mobile_otp_screen` | Is set to true if mobiled based multi factor authentication is enabled                                                                    |
| `should_show_totp_screen`       | Is set to true if totp based multi factor authentication is enabled                                                                       |
| `should_offer_webauthn_mfa_verify` | Is set to true if the user should be offered to verify with an existing passkey as their second factor                                |
| `should_offer_webauthn_mfa_setup`  | Is set to true if the user should be offered to enroll a passkey as their second factor                                               |
| `should_offer_email_otp_mfa_setup` | Is set to true if the user should be offered email-OTP MFA enrollment                                                                  |
| `should_offer_sms_otp_mfa_setup`   | Is set to true if the user should be offered SMS-OTP MFA enrollment                                                                    |
| `authenticator_scanner_image`   | If totp registration is pending it sends base64 encoded image string that can be rendered by totp app scanners like Google Authentication |
| `authenticator_secret`          | If totp registration is pending, then this secret can be used for registration instead of image on authenticator apps                     |
| `authenticator_recovery_codes`  | If totp registration is pending, then recovery codes are sent using which totp can be accessed again                                      |

**Sample Usage**

```js
// from browser with HTTP Cookie
const { data, errors } = await authRef.getSession()

// role validation with http cookie — the second argument is a SessionQueryRequest object, not a bare string
const { data, errors } = await authRef.getSession(null, { roles: ['admin'] })

// from NodeJS / if HTTP cookie is not used
const { data, errors } = await authRef.getSession(
  {
    Authorization: `Bearer some_token`,
  },
  { roles: ['admin'] },
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
| `token_type`            | Type of token that needs to be validated. It can be one of `access_token`, `refresh_token` or `id_token`                  | `true`   |
| `token`                 | Jwt token string                                                                                                          | `true`   |
| `roles`                 | Array of roles to validate jwt token for                                                                                  | `false`  |

It returns the following keys in response `data` object

**Response**

| Key        | Description                                        |
| ---------- | -------------------------------------------------- |
| `is_valid` | Boolean indicating if given token was valid or not |
| `claims`   | Decoded JWT claims of the validated token          |

**Sample Usage**

```js
const { data, errors } = await authRef.validateJWTToken({
  token_type: `access_token`,
  token: `some jwt token string`,
})
```

## - `validateSession`

Function to validate cookie / browser session.

It expects the JSON object as parameter with following parameters

| Key      | Description                                                                                         | Required |
| -------- | --------------------------------------------------------------------------------------------------- | -------- |
| `cookie`               | browser session cookie value. If not present it will need coookie present in header as https cookie                       | `false`  |
| `roles`                | Array of roles to validate jwt token for                                                                                  | `false`  |

It returns the following keys in response `data` object

**Response**

| Key        | Description                                        |
| ---------- | -------------------------------------------------- |
| `is_valid` | Boolean indicating if given token was valid or not |
| `user`     | User object with all the basic profile information |

**Sample Usage**

```js
const { data, errors } = await authRef.validateSession({
  cookie: ``,
})
```

## - `checkPermissions`

Function to evaluate one or more fine-grained authorization (FGA) permission checks against the embedded [OpenFGA](https://openfga.dev) engine, in a single call. `results` come back in the same order as `checks` and echo each pair.

This function makes an authorized request, hence from the browser the HTTP cookie is sent automatically if the user has logged in. From NodeJS pass the `Authorization` header as the optional second argument.

The subject defaults to the caller's token. An optional `user` ("type:id", or a bare id treated as `user:<id>`) is honored only for super-admins or when it equals the caller's own token subject; anything else is rejected by the server — never silently ignored.

For complete worked scenarios — Express middleware, list filtering, and tuple lifecycle — see [Authorization recipes](/core/authorization#9-real-world-recipes).

It accepts 2 JSON objects as its parameters.

1. data - Permission checks to evaluate
2. headers - To pass Authorization header (optional in the browser)

Here are the keys that the `data` object accepts

| Key      | Description                                                                                                                  | Required |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| `checks` | Array of checks, each `{ relation, object, contextual_tuples? }`. `contextual_tuples` (array of `{ user, relation, object }`) are evaluated for that check only and never persisted | true     |
| `user`   | Subject override ("type:id", or a bare id treated as `user:<id>`). Honored only for super-admins or self; defaults to the caller | false    |

It returns the following keys in response `data` object

**Response**

| Key       | Description                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------- |
| `results` | One result per supplied check, in order, each `{ relation, object, allowed }` echoing the checked pair |

**Sample Usage**

```js
const { data, errors } = await authRef.checkPermissions(
  {
    checks: [
      { relation: 'can_view', object: 'document:1' },
      { relation: 'can_edit', object: 'document:1' },
    ],
  },
  { Authorization: `Bearer ${token}` }, // omit in the browser to use the cookie
);

if (data?.results?.[0]?.allowed) {
  // caller may view document:1
}

// "What-if" check with contextual tuples (evaluated for this call only):
const { data: whatIf } = await authRef.checkPermissions(
  {
    checks: [
      {
        relation: 'can_view',
        object: 'document:1',
        contextual_tuples: [
          { user: 'user:1b9d…', relation: 'viewer', object: 'document:1' },
        ],
      },
    ],
  },
  { Authorization: `Bearer ${token}` },
);
```

## - `listPermissions`

Function to list which objects of a given type the subject holds a relation on — ideal for filtering a list page down to what the user may see ("which `object_type`s can I `relation`?"). Subject resolution follows the same rules as `checkPermissions`.

It accepts 2 JSON objects as its parameters.

1. data - Relation / object type to enumerate
2. headers - To pass Authorization header (optional in the browser)

Here are the keys that the `data` object accepts

| Key           | Description                                                                                          | Required |
| ------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| `relation`    | Relation to list for (e.g. `can_view`)                                                                | true     |
| `object_type` | Object type to enumerate (e.g. `document`)                                                            | true     |
| `user`        | Subject override ("type:id", or a bare id treated as `user:<id>`). Honored only for super-admins or self | false    |

It returns the following keys in response `data` object

**Response**

| Key           | Description                                                                              |
| ------------- | ------------------------------------------------------------------------------------------ |
| `objects`     | Distinct fully-qualified ids of the objects the subject holds the relation on, e.g. `["document:1"]` |

**Sample Usage**

```js
const { data, errors } = await authRef.listPermissions(
  { relation: 'can_view', object_type: 'document' },
  { Authorization: `Bearer ${token}` },
);
// data?.objects => ['document:1', 'document:7', ...]
```

## - `verifyOtp`

Function to verify OTP sent to the user when they login.

It accepts JSON object as a parameter with following keys

| Key            | Description                                        | Required |
| -------------- | -------------------------------------------------- | -------- |
| `email`        | Email address of user                              | false    |
| `phone_number` | Phone number of user                               | false    |
| `otp`          | OTP (One Time Password) sent to user email address | true     |
| `is_totp`      | Set to `true` when verifying/enrolling a TOTP code instead of an email/SMS OTP | false |
| `state`        | Opaque state string round-tripped through the flow | false    |

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
| `should_offer_webauthn_mfa_verify` | Is set to true if the user should be offered to verify with an existing passkey as their second factor |
| `should_offer_webauthn_mfa_setup` | Is set to true if the user should be offered to enroll a passkey as their second factor |
| `should_offer_email_otp_mfa_setup` | Is set to true if the user should be offered email-OTP MFA enrollment |
| `should_offer_sms_otp_mfa_setup` | Is set to true if the user should be offered SMS-OTP MFA enrollment |
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
| `state`        | Opaque state string round-tripped through the flow | false |

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

## - `skipMfaSetup`

Function to skip a first-time MFA enrollment offer mid login (the `should_offer_*` gate) when the user has a completed-login state to fall back to. Returns the full `AuthResponse`/token shape (same as `login`/`signup`), since skipping completes the gate.

It accepts JSON object as a parameter with following keys

| Key            | Description                                          | Required |
| -------------- | ------------------------------------------------------ | -------- |
| `email`        | Email address of user                                 | false    |
| `phone_number` | Phone number of user                                  | false    |
| `state`        | Opaque state string round-tripped through the flow    | false    |

**Sample Usage**

```js
const { data, errors } = await authRef.skipMfaSetup({
  email: 'foo@bar.com',
})
```

## - `lockMfa`

Function to lock multi-factor authentication for a user by email or phone number.

It accepts JSON object as a parameter with following keys

| Key            | Description            | Required |
| -------------- | ------------------------ | -------- |
| `email`        | Email address of user  | false    |
| `phone_number` | Phone number of user   | false    |

It returns the following keys in response `data` object

**Response**

| Key       | Description                         |
| --------- | ------------------------------------ |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const { data, errors } = await authRef.lockMfa({
  email: 'foo@bar.com',
})
```

## - `emailOtpMfaSetup`

Function to enroll email-OTP as a multi-factor authentication method — sends an OTP to the user's email to be verified with [`verifyOtp`](#--verifyotp).

It accepts an optional JSON object as a parameter with following keys

| Key            | Description            | Required |
| -------------- | ------------------------ | -------- |
| `email`        | Email address of user  | false    |
| `phone_number` | Phone number of user   | false    |

It returns the following keys in response `data` object

**Response**

| Key       | Description                         |
| --------- | ------------------------------------ |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const { data, errors } = await authRef.emailOtpMfaSetup()
```

## - `smsOtpMfaSetup`

Function to enroll SMS-OTP as a multi-factor authentication method — sends an OTP to the user's phone number to be verified with [`verifyOtp`](#--verifyotp).

It accepts an optional JSON object as a parameter with following keys

| Key            | Description            | Required |
| -------------- | ------------------------ | -------- |
| `email`        | Email address of user  | false    |
| `phone_number` | Phone number of user   | false    |

It returns the following keys in response `data` object

**Response**

| Key       | Description                         |
| --------- | ------------------------------------ |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const { data, errors } = await authRef.smsOtpMfaSetup()
```

## - `totpMfaSetup`

Function to generate a fresh TOTP secret/QR code/recovery-codes for the caller to enroll as an MFA method — the TOTP twin of `emailOtpMfaSetup`/`smsOtpMfaSetup`. Unlike those, nothing is sent anywhere: the enrollment payload comes back directly in the response, so the caller scans/enters it, then completes enrollment via `verifyOtp({ is_totp: true, otp: '...' })`.

It accepts an optional JSON object as a parameter with following keys

| Key            | Description            | Required |
| -------------- | ------------------------ | -------- |
| `email`        | Email address of user  | false    |
| `phone_number` | Phone number of user   | false    |

It returns the following keys in response `data` object

**Response**

| Key                             | Description                                                                                                                                 |
| ---------------------------------| ------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`                       | Success / Error message from server                                                                                                        |
| `should_show_totp_screen`       | Boolean indicating the TOTP enrollment screen should be shown                                                                              |
| `authenticator_scanner_image`   | Base64 encoded QR image that can be scanned by authenticator apps like Google Authenticator                                                |
| `authenticator_secret`          | Secret that can be entered manually instead of scanning the QR image                                                                       |
| `authenticator_recovery_codes`  | Recovery codes that can be used to regain TOTP access if the device is lost                                                                 |

**Sample Usage**

```js
const { data, errors } = await authRef.totpMfaSetup()
// render data.authenticator_scanner_image, then:
await authRef.verifyOtp({ is_totp: true, otp: '123456' })
```

## WebAuthn / Passkeys

The following methods drive [WebAuthn](https://www.w3.org/TR/webauthn-3/) passkey registration and login. The low-level `webauthn*` methods talk to the server only (GraphQL-only, no REST route) and expect/return the opaque JSON strings the WebAuthn spec defines; the higher-level `registerPasskey`/`loginWithPasskey*` helpers additionally drive the browser's `navigator.credentials` ceremony for you and are what most apps should use directly.

## - `webauthnRegistrationOptions`

Function to fetch passkey registration ceremony options from the server.

| Argument      | Description                                                                | Required |
| --------------- | ----------------------------------------------------------------------------- | -------- |
| `email`       | Email of the user to register a passkey for (MFA-session-cookie path only)  | false    |
| `phoneNumber` | Phone number of the user (MFA-session-cookie path only)                     | false    |

**Response**

| Key       | Description                                                    |
| --------- | ------------------------------------------------------------------ |
| `options` | Opaque JSON string (`PublicKeyCredentialCreationOptionsJSON`) to pass to the browser's WebAuthn API |

**Sample Usage**

```js
const { data, errors } = await authRef.webauthnRegistrationOptions()
```

## - `webauthnRegistrationVerify`

Function to verify a completed passkey registration ceremony.

| Key            | Description                                                                                          | Required |
| ---------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| `credential`   | Opaque JSON string (`RegistrationResponseJSON`) returned by the browser's WebAuthn ceremony              | true     |
| `name`         | Friendly name to store for this credential                                                                | false    |
| `email`        | Only used on the MFA-session-cookie path (registering a passkey mid login-time MFA offer)                 | false    |
| `phone_number` | Only used on the MFA-session-cookie path                                                                  | false    |
| `state`        | Opaque state string round-tripped through the flow                                                        | false    |

Returns the full `AuthResponse`/token shape: on the MFA-session-cookie path this also completes the gate, so `access_token` and friends are populated exactly like `verifyOtp`/`skipMfaSetup`. On the ordinary authenticated-settings-page path `access_token` is always `null` — the caller already has one.

**Sample Usage**

```js
const { data, errors } = await authRef.webauthnRegistrationVerify({
  credential: credentialJSON,
  name: 'My laptop',
})
```

## - `webauthnLoginOptions`

Function to fetch passkey login (assertion) ceremony options from the server.

| Argument | Description                                                                            | Required |
| ---------- | ------------------------------------------------------------------------------------------ | -------- |
| `email`  | Scopes the ceremony to one account's own passkeys. Omit for usernameless (discoverable-credential) login | false    |

**Response**

| Key       | Description                                                    |
| --------- | ------------------------------------------------------------------ |
| `options` | Opaque JSON string (`PublicKeyCredentialRequestOptionsJSON`) to pass to the browser's WebAuthn API |

**Sample Usage**

```js
const { data, errors } = await authRef.webauthnLoginOptions()
```

## - `webauthnLoginVerify`

Function to verify a completed passkey login (assertion) ceremony.

| Key          | Description                                                                              | Required |
| -------------- | --------------------------------------------------------------------------------------------- | -------- |
| `credential` | Opaque JSON string (`AuthenticationResponseJSON`) returned by the browser's WebAuthn ceremony | true     |
| `state`      | Opaque state string round-tripped through the flow                                            | false    |

Returns the full `AuthResponse`/token shape, same as `login`.

**Sample Usage**

```js
const { data, errors } = await authRef.webauthnLoginVerify({
  credential: credentialJSON,
})
```

## - `webauthnCredentials`

Function to list the caller's enrolled passkeys. Takes no parameters.

**Response** (array of)

| Key            | Description                                       |
| ---------------- | ------------------------------------------------------ |
| `id`           | Credential id                                         |
| `name`         | Friendly name for the credential                      |
| `transports`   | Transports the authenticator advertised (e.g. `internal`, `usb`) |
| `created_at`   | Timestamp the credential was registered                |
| `updated_at`   | Timestamp the credential was last updated               |
| `last_used_at` | Timestamp the credential was last used to log in         |

**Sample Usage**

```js
const { data, errors } = await authRef.webauthnCredentials()
```

## - `webauthnDeleteCredential`

Function to delete one of the caller's enrolled passkeys by id.

| Argument | Description                | Required |
| ---------- | ----------------------------- | -------- |
| `id`     | Id of the credential to delete | true     |

**Response**

| Key       | Description                         |
| --------- | ------------------------------------ |
| `message` | Success / Error message from server |

**Sample Usage**

```js
const { data, errors } = await authRef.webauthnDeleteCredential('credential-id')
```

## - `registerPasskey`

High-level helper that drives a full passkey registration ceremony end to end: fetch options from the server (`webauthnRegistrationOptions`), prompt the platform authenticator via the browser's WebAuthn API, then verify (`webauthnRegistrationVerify`). Normally requires an authenticated session (a passkey is added to the caller's own account) — pass `mfaSetup` to instead authenticate via the MFA session cookie mid a login-time MFA offer.

| Argument   | Description                                                                                          | Required |
| ------------ | ----------------------------------------------------------------------------------------------------- | -------- |
| `name`     | Friendly name to store for this credential                                                            | false    |
| `mfaSetup` | `{ email?, phoneNumber?, state? }` — only used to authenticate via the MFA-session-cookie path         | false    |

**Sample Usage**

```js
const { data, errors } = await authRef.registerPasskey('My laptop')
```

## - `loginWithPasskey`

High-level helper that drives a full passkey login ceremony end to end. Omit `email` for a usernameless (discoverable-credential) login; pass it to scope the ceremony to one account's own passkeys (the MFA-alternative flow).

| Argument | Description                                                                                                    | Required |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| `email`  | Scopes the ceremony to one account's own passkeys                                                                   | false    |
| `opts`   | `{ mediation?: CredentialMediationRequirement, signal?: AbortSignal }` — pass `mediation: 'conditional'` for passkey autofill (prefer `loginWithPasskeyAutofill` instead) | false    |

**Sample Usage**

```js
const { data, errors } = await authRef.loginWithPasskey()
```

## - `loginWithPasskeyAutofill`

Starts a "passkey autofill" (conditional mediation) login: the browser offers discoverable passkeys inline in a username field's autofill dropdown rather than a modal. The returned promise resolves only when the user actually picks a passkey (or rejects when aborted/cancelled) — fire it on mount and ignore abort errors. Requires an `<input autocomplete="username webauthn">` on the page. Takes no parameters; only one autofill ceremony runs at a time (a new call, or an explicit modal `loginWithPasskey()`, aborts the previous one).

**Sample Usage**

```js
useEffect(() => {
  authRef.loginWithPasskeyAutofill().then(({ data }) => {
    if (data?.access_token) {
      // logged in via autofilled passkey
    }
  })
  return () => authRef.cancelPasskeyAutofill()
}, [])
```

## - `cancelPasskeyAutofill`

Aborts a pending `loginWithPasskeyAutofill` ceremony, e.g. on component unmount. Safe to call when none is in flight. Synchronous, returns nothing.

**Sample Usage**

```js
authRef.cancelPasskeyAutofill()
```

## - `isWebauthnSupported`

Standalone function (not a method on the `Authorizer` instance) that reports whether the current browser supports the WebAuthn `PublicKeyCredential` JSON APIs this SDK's passkey methods rely on.

**Sample Usage**

```js
import { isWebauthnSupported } from '@authorizerdev/authorizer-js'

if (isWebauthnSupported()) {
  // show a "Sign in with a passkey" button
}
```

## - `parseMfaRedirectParams`

Standalone function (not a method on the `Authorizer` instance) that parses the `mfa_required` / `mfa_methods` / `mfa_gate` query params the server's OAuth callback appends to the redirect URL instead of the normal `state`/`code` params when a first-time MFA offer or verification is needed before a token can be issued. Useful on the page your OAuth `redirectURL` points to.

| Argument | Description                                                                                                  | Required |
| ---------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| `url`    | The full redirect URL (e.g. `window.location.href`), or a `URL` instance. Must be absolute — a bare path/search string throws | true     |

Returns `null` if the URL has no `mfa_required=1` param, otherwise an object:

| Key          | Description                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `mfaRequired` | Always `true` when non-null                                                                        |
| `mfaMethods`  | Raw method-name strings from the server (e.g. `totp`, `webauthn`, `email_otp`, `sms_otp`)           |
| `mfaGate`     | `'verify'` — the user has a completed second factor to challenge; or `'offer'` — first-time enrollment with a Skip option. Defaults to `'offer'` when absent |

**Sample Usage**

```js
import { parseMfaRedirectParams } from '@authorizerdev/authorizer-js'

const params = parseMfaRedirectParams(window.location.href)
if (params?.mfaRequired) {
  // route to the MFA setup/verify screen for params.mfaMethods
}
```
