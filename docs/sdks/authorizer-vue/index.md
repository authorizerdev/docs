---
sidebar_position: 1
title: Getting Started
---

# Getting Started

Vue 3 SDK for [authorizer.dev](https://authorizer.dev) integration in your [Vue](https://vuejs.org/) application. This will allow you to have authentication and authorization ready in minutes.

Here is a quick guide on getting started with `@authorizerdev/authorizer-vue` package.

## Step 1: Get Authorizer Instance

Deploy production ready Authorizer instance using one click deployment options available below

| **Infra provider** | **One-click link** | **Additional information** |
| :----------------: | :-----------------: | :----------------------------------------------------: |
| Railway.app | [Deploy on Railway](https://railway.com/deploy/authorizer-1?referralCode=FEF4uT&utm_medium=integration&utm_source=template&utm_campaign=generic) | [docs](https://docs.authorizer.dev/deployment/railway) |
| Heroku | [Deploy to Heroku](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku) | [docs](https://docs.authorizer.dev/deployment/heroku) |
| Render | [Deploy to Render](https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render) | [docs](https://docs.authorizer.dev/deployment/render) |

For more information check [docs](https://docs.authorizer.dev/getting-started/)

## Step 2: Setup Instance

Start your Authorizer instance with the required CLI flags:

```bash
./authorizer \
  --database-type=sqlite \
  --database-url=test.db \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

Note the `--client-id` value -- you will need it in the SDK configuration below. Check [Server Configuration](/core/server-config) for all available flags.

## Step 3 - Install package

Assuming you have a Vue 3 application up and running, install the following package in your application

```sh
npm i --save @authorizerdev/authorizer-vue
OR
yarn add @authorizerdev/authorizer-vue
```

## Step 4 - Configure Provider and use Authorizer Components

`AuthorizerProvider` uses Vue's [provide/inject](https://vuejs.org/api/composition-api-dependency-injection.html#provide) to make a reactive auth context available to all descendants via the `useAuthorizer` injection key.

Configure `AuthorizerProvider` at the root of your application and import `default.css`.

> Note: You can override default style with `css` variables. See [Updating styles](#updating-styles) below for more details.

`eg: App.vue`

```vue
<template>
  <authorizer-provider
    :config="{
      authorizerURL: 'YOUR_AUTHORIZER_INSTANCE_URL',
      redirectURL: window.location.origin,
      clientID: 'YOUR_CLIENT_ID',
    }"
  >
    <router-view />
  </authorizer-provider>
</template>

<script lang="ts">
import { AuthorizerProvider } from '@authorizerdev/authorizer-vue';
import '@authorizerdev/authorizer-vue/dist/style.css';

export default {
  components: {
    'authorizer-provider': AuthorizerProvider,
  },
};
</script>
```

**Use `AuthorizerRoot` Component**

`eg: views/Login.vue`

```vue
<template>
  <div>
    <h1 :style="{ textAlign: 'center' }">Welcome to Authorizer</h1>
    <br />
    <authorizer-root :on-login="onLogin" />
  </div>
</template>

<script lang="ts">
import { inject, watch } from 'vue';
import { AuthorizerRoot } from '@authorizerdev/authorizer-vue';
import type { AuthorizerContextOutputType } from '@authorizerdev/authorizer-vue/dist/types/types';

export default {
  name: 'Login',
  components: {
    'authorizer-root': AuthorizerRoot,
  },
  setup() {
    const useAuthorizer = inject('useAuthorizer') as () => AuthorizerContextOutputType;
    const { token, user, loading, logout } = useAuthorizer();

    const onLogin = () => {
      console.log('login event');
    };

    return { onLogin };
  },
};
</script>
```

## Components

`@authorizerdev/authorizer-vue` exports the following components that you can use in your Vue application to build authentication and authorization faster:

- [`AuthorizerProvider`](#authorizerprovider)
- [`AuthorizerRoot`](#authorizerroot)
- [`AuthorizerSignup`](#authorizersignup)
- [`AuthorizerBasicAuthLogin`](#authorizerbasicauthlogin)
- [`AuthorizerMagicLinkLogin`](#authorizermagiclinklogin)
- [`AuthorizerSocialLogin`](#authorizersociallogin)
- [`AuthorizerForgotPassword`](#authorizerforgotpassword)
- [`AuthorizerResetPassword`](#authorizerresetpassword)
- [`AuthorizerVerifyOtp`](#authorizerverifyotp)

### `AuthorizerProvider`

`AuthorizerProvider` is the container component that wraps all the Authorizer components. It binds the backend configuration in the app and renders various views accordingly. It exposes a reactive context via the `useAuthorizer` provide/inject key, which you can `inject` in any descendant component.

#### Props

| Prop                    | Type                                | Required | Description                                                                                                                 |
| ----------------------- | ------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------|
| `config`                | `AuthorizerConfigInput`              | Yes      | Authorizer connection config (see below)                                                                                    |
| `onStateChangeCallback` | `(state: AuthorizerState) => void`   | No       | [optional] Callback that is called whenever context state information changes.                                             |

`config` accepts the following keys:

| Key            | Type                    | Description                                                                                                                 | Required |
| -------------- | ------------------------| ----------------------------------------------------------------------------------------------------------------------------| -------- |
| `authorizerURL`| `string`                | Authorizer backend URL                                                                                                      | `true`   |
| `redirectURL`  | `string`                | Frontend application URL or the page where you want to redirect user post login. Default value is `window.location.origin` | `true`   |
| `clientID`     | `string`                | Client ID of the application, generated from the Authorizer dashboard                                                      | `true`   |
| `protocol`     | `'graphql' \| 'rest'`   | [optional] Transport protocol used by the underlying `authorizer-js` SDK. Defaults to `'graphql'`                          | `false`  |

#### Sample Usage

```vue
<authorizer-provider
  :config="{
    authorizerURL: 'http://localhost:8080',
    redirectURL: window.location.origin,
    clientID: 'YOUR_CLIENT_ID',
  }"
  :on-state-change-callback="(state) => {}"
>
  <router-view />
</authorizer-provider>
```

### `AuthorizerRoot`

A core component that includes:

- social logins
- signup view
- login view
- magic link login view
- forgot password view

Pre configured component that shows various login/signup options based on the backend configurations. Make sure it is used as a descendant of `AuthorizerProvider`.

#### Props

It has the following optional props as callback events that are triggered via various user events, plus a `roles` prop.

- `onLogin`: event called when login form is submitted successfully.
- `onSignup`: event called when signup form is submitted successfully.
- `onMagicLinkLogin`: event called when magic link login form is submitted successfully.
- `onForgotPassword`: event called when forgot password form is submitted successfully.
- `roles`: [optional] `string[]` list of roles to request for the logged in / signed up user.

#### Sample Usage

```vue
<template>
  <h1 :style="{ textAlign: 'center' }">Login / Signup</h1>
  <authorizer-root
    :on-login="(res) => {}"
    :on-signup="(res) => {}"
    :on-magic-link-login="(res) => {}"
    :on-forgot-password="(res) => {}"
  />
</template>

<script lang="ts">
import { AuthorizerRoot } from '@authorizerdev/authorizer-vue';

export default {
  components: {
    'authorizer-root': AuthorizerRoot,
  },
};
</script>
```

### `AuthorizerSignup`

A component to render the basic authentication signup form. Make sure it is used as a descendant of `AuthorizerProvider`.

#### Props

- `onSignup`: event called when signup form is submitted successfully.
- `setView`: [optional] callback used internally by `AuthorizerRoot` to switch between `Login`/`Signup`/`ForgotPassword` views. Only needed if you are composing your own view switcher.
- `urlProps`: [optional] object to override the `scope`, `redirect_uri` and `state` query params used for the signup request.
- `roles`: [optional] `string[]` list of roles to request for the signed up user.

#### Sample Usage

```vue
<authorizer-signup :on-signup="(res) => {}" />
```

### `AuthorizerBasicAuthLogin`

A component to render the basic authentication login form. Make sure it is used as a descendant of `AuthorizerProvider`.

#### Props

- `onLogin`: event called when login form is submitted successfully.
- `setView`: [optional] callback used internally by `AuthorizerRoot` to switch between `Login`/`Signup`/`ForgotPassword` views. Only needed if you are composing your own view switcher.
- `urlProps`: [optional] object to override the `scope`, `redirect_uri` and `state` query params used for the login request.
- `roles`: [optional] `string[]` list of roles to request for the logged in user.

#### Sample Usage

```vue
<authorizer-basic-auth-login :on-login="(res) => {}" />
```

### `AuthorizerMagicLinkLogin`

A component to render the magic link login form. Make sure it is used as a descendant of `AuthorizerProvider`.

#### Props

- `onMagicLinkLogin`: event called when magic link login form is submitted successfully.
- `urlProps`: [optional] object to override the `redirect_uri` and `state` query params used for the request.
- `roles`: [optional] `string[]` list of roles to request for the logged in user.

#### Sample Usage

```vue
<authorizer-magic-link-login :on-magic-link-login="(res) => {}" />
```

### `AuthorizerSocialLogin`

A component to render the list of social media login buttons based on backend configurations. Supports Google, GitHub, Facebook, LinkedIn, Apple, Twitter, Microsoft, Discord and Roblox. Make sure it is used as a descendant of `AuthorizerProvider`.

#### Props

- `urlProps`: [optional] object to override the `scope` query param sent with the social login request.
- `roles`: [optional] `string[]` list of roles to request for the logged in user.

#### Sample Usage

```vue
<authorizer-social-login />
```

### `AuthorizerForgotPassword`

A component to render the forgot password form. Make sure it is used as a descendant of `AuthorizerProvider`.

#### Props

- `onForgotPassword`: event called when forgot password form is submitted successfully.
- `setView`: [optional] callback used internally by `AuthorizerRoot` to switch between `Login`/`Signup`/`ForgotPassword` views. Only needed if you are composing your own view switcher.
- `urlProps`: [optional] object to override the `redirect_uri` and `state` query params used for the request.

#### Sample Usage

```vue
<authorizer-forgot-password :on-forgot-password="(res) => {}" />
```

### `AuthorizerResetPassword`

A component that can be used to reset the password. This component can be used on the page which is configured with the backend as `RESET_PASSWORD_URL`, check [environment variables](/core/server-config) for more details. This component validates the token in the URL sent via email to the user and helps reset the password.

#### Props

- `onReset`: [optional] event called when the reset form is submitted successfully.

#### Sample Usage

```vue
<authorizer-reset-password :on-reset="(res) => {}" />
```

### `AuthorizerVerifyOtp`

A component to render the OTP verification form. Make sure it is used as a descendant of `AuthorizerProvider`.

#### Props

- `email`: (required) user email address on which the OTP was sent.
- `onLogin`: [optional] event called when the verify OTP form is submitted successfully.
- `setView`: [optional] callback used internally by `AuthorizerRoot` to switch between `Login`/`Signup`/`ForgotPassword` views. Only needed if you are composing your own view switcher.
- `urlProps`: [optional] object to override the `state` query param used for the verify request.

#### Sample Usage

```vue
<authorizer-verify-otp email="foo@bar.com" :on-login="(res) => {}" />
```

## Updating styles

Components in `@authorizerdev/authorizer-vue` are designed using css variables and come with a default stylesheet which declares these variables. You can override these css variables to update styling as per your theme:

> Note: Given are the default values for the variables.

```css
--authorizer-primary-color: #3b82f6;
--authorizer-primary-disabled-color: #60a5fa;
--authorizer-gray-color: #d1d5db;
--authorizer-white-color: #ffffff;
--authorizer-danger-color: #dc2626;
--authorizer-success-color: #10b981;
--authorizer-text-color: #374151;
--authorizer-fonts-font-stack: -apple-system, system-ui, sans-serif;
--authorizer-fonts-large-text: 18px;
--authorizer-fonts-medium-text: 14px;
--authorizer-fonts-small-text: 12px;
--authorizer-fonts-tiny-text: 10px;
--authorizer-radius-card: 5px;
--authorizer-radius-button: 5px;
--authorizer-radius-input: 5px;
```

## Examples

Please check the [example repo](https://github.com/authorizerdev/examples) to see how to use this component library.
