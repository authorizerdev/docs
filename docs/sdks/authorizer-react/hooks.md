---
sidebar_position: 3
title: Hooks
---

# Hooks

`@authorizerdev/authorizer-react` exports a hook which can be used in any child component for `AuthorizerProvider`.

## `useAuthorizer`

It gives global state stored in the context, which can be used further in the component. It also returns few setter methods which can be used to manipulate the state.

Here is the complete list of state variables and functions that are returned by `useAuthorizer` hook.

| Variable name   | Description                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config`        | Root configuration object passed to `AuthorizerProvider` + backend configuration obtained via [`meta`](/sdks/authorizer-js/functions#--getmetadata) api. Includes feature flags such as `is_discord_login_enabled`, `is_webauthn_enabled`, `is_totp_mfa_enabled`, `is_email_otp_mfa_enabled`, `is_sms_otp_mfa_enabled`, and `is_mfa_enforced`.                                               |
| `configLoadError` | `string \| null`. Set when the initial `meta` fetch from `authorizerURL` fails (e.g. the backend is unreachable). Login methods that depend on that config — basic auth, signup, social login, magic link — won't render until it succeeds.                                            |
| `user`          | If not logged in this is `null`, else it includes all the user related information like `email`, `given_name`, `family_name`, `picture`, and [more](/sdks/authorizer-js/functions#--getprofile)       |
| `token`         | If not logged in it is `null` else it is access token string which can be used to make authorized requests                                                                                       |
| `loading`       | Loading state for the application to know if its fetching token or user profile data                                                                                                             |
| `setUser`       | Function to set user profile information. Accepts JSON object with all the possible profile values                                                                                               |
| `setToken`      | Function to set token. Accepts string with correct access token value                                                                                                                            |
| `setLoading`    | Function to set loading state. Accepts boolean value                                                                                                                                             |
| `setAuthData`   | Function to set all the state data, `user`, `token`, `loading`, `config`. Accepts object with `{user, token, config, loading}` as value                                                          |
| `logout`        | Function to logout user                                                                                                                                                                          |
| `authorizerRef` | Reference to [authorizer-js](/sdks/authorizer-js) instance which can be used to call [functions](/sdks/authorizer-js/functions) exposed by [authorizer-js](/sdks/authorizer-js) |

### Sample Usage

```jsx
import { useAuthorizer } from '@authorizerdev/authorizer-react'

const Component = () => {
  const { user } = useAuthorizer()

  if (!user) {
    return null
  }

  return <div>{user.email}</div>
}
```
