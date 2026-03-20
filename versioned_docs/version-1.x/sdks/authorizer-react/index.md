---
sidebar_position: 1
title: Getting Started
---

# Getting Started

Authorizer React SDK allows you to implement authentication in your [React](https://reactjs.org/) application quickly. It also allows you to access the user profile.

Here is a quick guide on getting started with `@authorizerdev/authorizer-react` package.

## Step 1: Get Authorizer Instance

Deploy production ready Authorizer instance using one click deployment options available below

| **Infra provider** | **One-click link** | **Additional information** |
| :----------------: | :----------------: | :------------------------: |
| Railway.app | [Deploy on Railway](https://railway.app/new/template/nwXp1C?referralCode=FEF4uT) | [docs](https://docs.authorizer.dev/deployment/railway) |
| Heroku | [Deploy to Heroku](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku) | [docs](https://docs.authorizer.dev/deployment/heroku) |
| Render | [Deploy to Render](https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render) | [docs](https://docs.authorizer.dev/deployment/render) |

For more information check [docs](https://docs.authorizer.dev/getting-started/)

## Step 2: Setup Instance

- Open authorizer instance endpoint in browser
- Sign up as an admin with a secure password
- Configure environment variables from authorizer dashboard. Check env [docs](/1.x/core/env) for more information

> Note: `DATABASE_URL`, `DATABASE_TYPE` and `DATABASE_NAME` are only configurable via platform envs

## Step 3 - Install package

Install `@authorizerdev/authorizer-react` library

```sh
npm i --save @authorizerdev/authorizer-react
OR
yarn add @authorizerdev/authorizer-react
```

## Step 4 - Configure Provider and use Authorizer Components

Authorizer comes with [react context](https://reactjs.org/docs/context.html) which serves as `Provider` component for the application

```jsx
import {
  AuthorizerProvider,
  Authorizer,
  useAuthorizer,
} from '@authorizerdev/authorizer-react'

const App = () => {
  return (
    <AuthorizerProvider
      config={{
        authorizerURL: 'http://localhost:8080',
        redirectURL: window.location.origin,
        clientID: 'YOUR_CLIENT_ID', // obtain your client id from authorizer dashboard
        extraHeaders: {}, // Optional JSON object to pass extra headers in each authorizer requests.
      }}
    >
      <LoginSignup />
      <Profile />
    </AuthorizerProvider>
  )
}

const LoginSignup = () => {
  return <Authorizer />
}

const Profile = () => {
  const { user } = useAuthorizer()

  if (user) {
    return <div>{user.email}</div>
  }

  return null
}
```

## Updating styles

Components in `@authorizerdev/authorizer-react` are designed using css variables and comes with `default.css` which declares this variables. You can modify these css variable to update styling as per your theme:

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
