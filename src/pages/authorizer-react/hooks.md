---
title: Hooks
layout: ../../layouts/Main.astro
---

`@authorizerdev/authorizer-react` exports a hook which can be used in any child component for `AuthorizerProvider`.

## `useAuthorizer`

It gives global state stored in the context, which can be used further in the component. It also returns few setter methods which can be used to manipulate the state.

Here is the complete list of state variables and functions that are returned by `useAuthorizer` hook.

| Variable name   | Description                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config`        | Root configuration object passed to `AuthorizerProvider` + backend configuration obtained via [`meta`](/authorizer-js/functions#--getmetadata) api                                               |
| `user`          | If not logged in this is `null`, else it includes all the user related information like `email`, `given_name`, `family_name`, `picture`, and [more](/authorizer-js/functions#--getprofile)       |
| `token`         | If not logged in it is `null` else it is access token string which can be used to make authorized requests                                                                                       |
| `loading`       | Loading state for the application to know if its fetching token or user profile data                                                                                                             |
| `setUser`       | Function to set user profile information. Accepts JSON object with all the possible profile values                                                                                               |
| `setToken`      | Function to set token. Accepts string with correct access token value                                                                                                                            |
| `setLoading`    | Function to set loading state. Accepts boolean value                                                                                                                                             |
| `setAuthData`   | Function to set all the state data, `user`, `token`, `loading`, `config`. Accepts object with `{user, token, config, loading}` as value                                                          |
| `logout`        | Function to logout user                                                                                                                                                                          |
| `authorizerRef` | Reference to [authorizer-js](/authorizer-js/getting-started) instance which can be used to call [functions](/authorizer-js/functions) exposed by [authorizer-js](/authorizer-js/getting-started) |

### Sample Usage

```jsx
import {useAuthorizer} from '@authorizerdev/authorizer-react`

const Component = () => {

	const { user} = useAuthorizer();

	if (!user) {
		return null
	}

	return (
		<div>{user.email}</div>
	)
}
```
