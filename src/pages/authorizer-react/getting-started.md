---
title: Authorizer React Getting Started
layout: ../../layouts/Main.astro
---

Authorizer React SDK allows you to implement authentication in your [React](https://reactjs.org/) application quickly. It also allows you to access the user profile.

Here is a quick guide on getting started with `@authorizerdev/authorizer-react` package.

<div class="video-container">
  <iframe class="frame" width="560" height="315" src="https://www.youtube.com/embed/2aOTuwkfYvM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

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

Please check the [example repo](https://github.com/authorizerdev/examples) to see how to use this component library.
