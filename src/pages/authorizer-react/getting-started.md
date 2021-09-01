---
title: Authorizer React Getting Started
layout: ../../layouts/Main.astro
---

Authorizer React SDK allows you to implement authentication in your [React](https://reactjs.org/) application quickly. It also allows you to access the user profile.

Here is a quick guide on getting started with `@authorizerdev/authorizer-react` package.

## Step 1 - Create Instance

Get Authorizer URL by instantiating [Authorizer instance](/deployment) and configuring it with necessary [environment variables](/core/env).

## Step 2 - Install package

Install `@authorizerdev/authorizer-react` library

```sh
npm i --save @authorizerdev/authorizer-react
OR
yarn add @authorizerdev/authorizer-react
```

## Step 3 - Configure Provider and use Authorizer Components

Authorizer comes with [react context](https://reactjs.org/docs/context.html) which serves as `Provider` component for the application

```jsx
import {
  AuthorizerProvider,
  Authorizer,
  useAuthorizer,
} from "@authorizerdev/authorizer-react";

const App = () => {
  return (
    <AuthorizerProvider
      config={{
        authorizerURL: "http://localhost:8080",
        redirectURL: window.location.origin,
      }}
    >
      <LoginSignup />
      <Profile />
    </AuthorizerProvider>
  );
};

const LoginSignup = () => {
  return <Authorizer />;
};

const Profile = () => {
  const { user } = useAuthorizer();

  if (user) {
    return <div>{user.email}</div>;
  }

  return null;
};
```

## Examples

Here are link to examples that covers the use of above mentioned components with auth based routing.

- [Basic Example with React Router](https://github.com/authorizerdev/authorizer-react/tree/main/example)
- [Example with Gatsby]() - Coming Soon
- [Example with NextJS]() - Coming Soon
- [Example with custom theme]() - Coming Soon
