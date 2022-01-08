---
title: Components
layout: ../../layouts/Main.astro
---

`@authorizerdev/authorizer-react` exports the few components that you can use in your react application. This will help you build authentication and authorization faster for your application.

## Table of contents

- [`AuthorizerProvider`](#authorizerprovider)
- [`Authorizer`](#authorizer)
- [`AuthorizerResetPassword`](#authorizerresetpassword)

## `AuthorizerProvider`

`AuthorizerProvider` is the container component that wraps all the Authorizer components. It binds the backend configuration in the app and renders various views accordingly.

### Props

- `config`: Object to configure the `authorizer` backend URL and redirect URL. It accepts JSON object with following keys

| Key             | Type     | Description                                                                                                                | Required |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| `authorizerURL` | `string` | Authorizer backend URL                                                                                                     | `true`   |
| `redirectURL`   | `string` | Frontend application URL or the page where you want to redirect user post login. Default value is `window.location.origin` | `true`   |

- `onStateChangeCallback`: [optional] Async callback that is called whenever context state information changes.

### Sample Usage

```jsx
import { AuthorizerProvider } from "@authorizerdev/authorizer-react";

const App = () => {
  return (
    <AuthorizerProvider
      config={{
        authorizerURL: "http://localhost:8080",
        redirectURL: window.location.origin,
      }}
      onStateChangeCallback={async (newState) => {}}
    >
      // REST of the components goes here.
    </AuthorizerProvider>
  );
};
```

## `Authorizer`

A core component that includes:

- signup view
- login view
- forgot password view

It shows various login/signup options based on the backend configurations. Make sure this is used as Child of `AuthorizerProvider`.

### Props

It has following optional props as callback events that are triggered via various user events.

- `onLogin={(loginResponse)=>{}}`: event called when login form is submitted successfully
- `onMagicLinkLogin={(magicLinkResponse)=>{}}`: event called when magic link login form is submitted successfully
- `onSignup={(signupResponse)=>{}}`: event called when signup form is submitted successfully
- `onForgotPassword={(forgotPasswordResponse)={}}`: called when forgot password form is submitted successfully

### Sample Usage

```jsx
import { Authorizer } from "@authorizerdev/authorizer-react";

const LoginPage = () => {
  return (
    <>
      <h1 style={{ textAlign: "center" }}>Login / Signup</h1>
      <br />
      <Authorizer
        onLogin={(loginResponse) => {}}
        onMagicLinkLogin={(magicLinkResponse) => {}}
        onSignup={(signupResponse) => {}}
        onForgotPassword={(forgotPasswordResponse = {})}
      />
    </>
  );
};
```

## `AuthorizerResetPassword`

A component that can be used to reset the password. This component can be used in the page, which is configured with the backend as `RESET_PASSWORD_URL`, check [environment variables](/core/env) for more details. This component validates the token in the URL sent via email to the user and helps resetting the password.

### Props

It has following optional prop as callback event that is triggered on form submit.

- `onReset={(response) => {}}`: Called when reset form is submitted

### Sample Usage

```jsx
import { AuthorizerResetPassword } from "@authorizerdev/authorizer-react";

const ResetPassword = () => {
  return (
    <>
      <h1 style={{ textAlign: "center" }}>Reset Password</h1>
      <br />
      <AuthorizerResetPassword onReset={(response) => {}} />
    </>
  );
};
```
