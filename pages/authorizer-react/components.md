# Components

`@authorizerdev/authorizer-react` exports the few components that you can use in your react application. This will help you build authentication and authorization faster for your application.

## Table of contents

- [`AuthorizerProvider`](#authorizerprovider)
- [`Authorizer`](#authorizer)
- [`AuthorizerSignup`](#authorizersignup)
- [`AuthorizerBasicAuthLogin`](#authorizerbasicauthlogin)
- [`AuthorizerMagicLinkLogin`](#authorizermagiclinklogin)
- [`AuthorizerSocialLogin`](#authorizersociallogin)
- [`AuthorizerForgotPassword`](#authorizerforgotpassword)
- [`AuthorizerResetPassword`](#authorizerresetpassword)

## `AuthorizerProvider`

`AuthorizerProvider` is the container component that wraps all the Authorizer components. It binds the backend configuration in the app and renders various views accordingly.

### Props

- `config`: Object to configure the `authorizer` backend URL and redirect URL. It accepts JSON object with following keys

| Key                     | Type       | Description                                                                                                                | Required |
| ----------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| `authorizerURL`         | `string`   | Authorizer backend URL                                                                                                     | `true`   |
| `redirectURL`           | `string`   | Frontend application URL or the page where you want to redirect user post login. Default value is `window.location.origin` | `true`   |
| `onStateChangeCallback` | `function` | [optional] Async callback that is called whenever context state information changes.                                       | `false`  |

### Sample Usage

```jsx
import { AuthorizerProvider } from '@authorizerdev/authorizer-react'

const App = () => {
  return (
    <AuthorizerProvider
      config={{
        authorizerURL: 'http://localhost:8080',
        redirectURL: window.location.origin,
      }}
      onStateChangeCallback={async (newState) => {}}
    >
      // REST of the components goes here.
    </AuthorizerProvider>
  )
}
```

## `Authorizer`

A core component that includes:

- social logins
- signup view
- login view
- forgot password view

Pre configured component that shows various login/signup options based on the backend configurations. Make sure it is used as Child of `AuthorizerProvider`.

### Props

It has following optional props as callback events that are triggered via various user events.

- `onLogin={(loginResponse)=>{}}`: event called when login form is submitted successfully.
- `onMagicLinkLogin={(magicLinkResponse)=>{}}`: event called when magic link login form is submitted successfully.
- `onSignup={(signupResponse)=>{}}`: event called when signup form is submitted successfully.
- `onForgotPassword={(forgotPasswordResponse)={}}`: called when forgot password form is submitted successfully.

### Sample Usage

```jsx
import { Authorizer } from '@authorizerdev/authorizer-react'

const LoginPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Login / Signup</h1>
      <br />
      <Authorizer
        onLogin={(loginResponse) => {}}
        onMagicLinkLogin={(magicLinkResponse) => {}}
        onSignup={(signupResponse) => {}}
        onForgotPassword={(forgotPasswordResponse = {})}
      />
    </>
  )
}
```

## `AuthorizerSignup`

A component to render basic authentication singup form. Make sure it is used as Child of `AuthorizerProvider`.

### Props

- `onSignup={(response)=>{}}`: event called when signup form is submitted successfully.

### Sample Usage

```jsx
import { AuthorizerSignup } from '@authorizerdev/authorizer-react'

const SignupPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Signup</h1>
      <br />
      <AuthorizerSignup onSignup={(response) => {}} />
    </>
  )
}
```

## `AuthorizerBasicAuthLogin`

A component to render basic authentication login form. Make sure this is used as Child of `AuthorizerProvider`.

### Props

- `onLogin={(response)=>{}}`: event called when login form is submitted successfully.

### Sample Usage

```jsx
import { AuthorizerBasicAuthLogin } from '@authorizerdev/authorizer-react'

const LoginPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Login</h1>
      <br />
      <AuthorizerBasicAuthLogin onLogin={(response) => {}} />
    </>
  )
}
```

## `AuthorizerMagicLinkLogin`

A component to render magic link login form. Make sure this is used as Child of `AuthorizerProvider`.

### Props

- `onMagicLinkLogin={(response)=>{}}`: event called when magic link login form is submitted successfully.

### Sample Usage

```jsx
import { AuthorizerMagicLinkLogin } from '@authorizerdev/authorizer-react'

const LoginPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Login</h1>
      <br />
      <AuthorizerMagicLinkLogin onMagicLinkLogin={(response) => {}} />
    </>
  )
}
```

## `AuthorizerSocialLogin`

A component to render list of social media login buttons based on backend configurations. Make sure this is used as Child of `AuthorizerProvider`.

### Props

- `onForgotPassword={(response)=>{}}`: event called when forgot password form is submitted successfully.

### Sample Usage

```jsx
import { AuthorizerSocialLogin } from '@authorizerdev/authorizer-react'

const LoginPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Login / Signup</h1>
      <br />
      <AuthorizerSocialLogin />
    </>
  )
}
```

## `AuthorizerForgotPassword`

A component to render forgot password form. Make sure this is used as Child of `AuthorizerProvider`.

### Props

No props exposed for this components

### Sample Usage

```jsx
import { AuthorizerForgotPassword } from '@authorizerdev/authorizer-react'

const ForgotPasswordPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Forgot Password?</h1>
      <br />
      <AuthorizerForgotPassword onForgotPassword={(response) => {}} />
    </>
  )
}
```

## `AuthorizerResetPassword`

A component that can be used to reset the password. This component can be used in the page, which is configured with the backend as `RESET_PASSWORD_URL`, check [environment variables](/core/env) for more details. This component validates the token in the URL sent via email to the user and helps resetting the password.

### Props

It has following optional prop as callback event that is triggered on form submit.

- `onReset={(response) => {}}`: Called when reset form is submitted

### Sample Usage

```jsx
import { AuthorizerResetPassword } from '@authorizerdev/authorizer-react'

const ResetPassword = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Reset Password</h1>
      <br />
      <AuthorizerResetPassword onReset={(response) => {}} />
    </>
  )
}
```
