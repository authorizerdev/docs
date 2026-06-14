---
sidebar_position: 4
title: Integration Guide
---

# Integration Guide

This guide goes beyond the [components](./components) and [hooks](./hooks) reference and
shows how to wire `@authorizerdev/authorizer-react` into a real application: protecting
routes, calling your backend with the access token, rendering UI by role, and integrating
with Next.js.

All patterns build on the `AuthorizerProvider` + `useAuthorizer()` pair — set up the
provider once near the root, then read `user`, `token`, and `loading` anywhere below it.

## Provider setup

Wrap your app in `AuthorizerProvider` and import the stylesheet once:

```jsx
import { AuthorizerProvider } from '@authorizerdev/authorizer-react';
import '@authorizerdev/authorizer-react/styles.css';

export default function Root({ children }) {
  return (
    <AuthorizerProvider
      config={{
        authorizerURL: 'https://your-instance.authorizer.dev',
        redirectURL: window.location.origin,
        clientID: 'YOUR_CLIENT_ID',
      }}
      onStateChangeCallback={async ({ user, token }) => {
        // Fires on every auth-state change — good place to sync
        // analytics, external stores, etc.
        console.log('auth state changed', { user, token });
      }}
    >
      {children}
    </AuthorizerProvider>
  );
}
```

The provider fetches the server's feature flags from `/meta` and automatically refreshes
the access token before it expires, so `useAuthorizer()` always reflects the live session.

## Protecting routes

Read `token` and `loading` from the hook and branch on them. While the provider is
restoring the session, `loading` is `true` — render a spinner, not your login screen, to
avoid a flash.

```jsx
import { Routes, Route } from 'react-router-dom';
import { useAuthorizer, Authorizer } from '@authorizerdev/authorizer-react';
import Dashboard from './Dashboard';

function App() {
  const { token, loading } = useAuthorizer();

  if (loading) return <h1>Loading…</h1>;

  if (!token) {
    return <Authorizer onLogin={(data) => console.log('logged in', data)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
    </Routes>
  );
}
```

For a reusable guard component:

```jsx
function RequireAuth({ children }) {
  const { token, loading } = useAuthorizer();
  if (loading) return <h1>Loading…</h1>;
  if (!token) return <Authorizer />;
  return children;
}

// <RequireAuth><Dashboard /></RequireAuth>
```

## Calling your backend with the token

The `token` object exposes `access_token` (and `id_token`, `refresh_token`). Attach it as
a bearer credential on your API calls:

```jsx
import { useAuthorizer } from '@authorizerdev/authorizer-react';

function useApi() {
  const { token } = useAuthorizer();

  return async function api(path, options = {}) {
    const res = await fetch(`https://api.example.com${path}`, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token.access_token}` : '',
      },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  };
}
```

Your backend validates that token with Authorizer's
[`validate_jwt_token`](../../core/graphql-api#validate_jwt_token) (or the JWKS at
`/.well-known/jwks.json`).

### Permission-aware UI with FGA

If you use [fine-grained authorization](../../core/authorization), ask the server what the
user can do via the [REST](../../core/rest-api#post-v1check_permissions) or
[GraphQL](../../core/graphql-api#check_permissions) `check_permissions` endpoint, using the
same bearer token, and render accordingly:

```jsx
const api = useApi();

const { results } = await api('/v1/check_permissions', {
  method: 'POST',
  body: JSON.stringify({
    checks: [{ relation: 'can_edit', object: 'document:1' }],
  }),
});

const canEdit = results[0]?.allowed;
// {canEdit && <EditButton />}
```

## Rendering UI by role

`user.roles` holds the roles assigned at signup/login. Gate UI on it:

```jsx
import { useAuthorizer } from '@authorizerdev/authorizer-react';

function AdminPanel() {
  const { user } = useAuthorizer();
  const isAdmin = user?.roles?.includes('admin');

  if (!isAdmin) return null;
  return <div>{/* admin-only UI */}</div>;
}
```

You can also restrict which roles a login grants by passing `roles` to the auth
components, e.g. `<Authorizer roles={['user']} />`.

## Logout

`useAuthorizer()` returns a `logout` function that clears the session both server-side and
in context:

```jsx
function LogoutButton() {
  const { logout } = useAuthorizer();
  return <button onClick={logout}>Log out</button>;
}
```

## Next.js integration

`authorizer-react` is a client-side library — render the provider in a client component
and keep it out of server components.

### App Router

Create a client-side providers wrapper:

```tsx
// app/providers.tsx
'use client';

import { AuthorizerProvider } from '@authorizerdev/authorizer-react';
import '@authorizerdev/authorizer-react/styles.css';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthorizerProvider
      config={{
        authorizerURL: process.env.NEXT_PUBLIC_AUTHORIZER_URL!,
        redirectURL: typeof window !== 'undefined' ? window.location.origin : '',
        clientID: process.env.NEXT_PUBLIC_AUTHORIZER_CLIENT_ID!,
      }}
    >
      {children}
    </AuthorizerProvider>
  );
}
```

Use it in the root layout:

```tsx
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Then mark any component that calls `useAuthorizer()` or renders an Authorizer component
with `'use client'`.

### Pages Router

Wrap your app in `pages/_app.tsx`:

```tsx
import type { AppProps } from 'next/app';
import { AuthorizerProvider } from '@authorizerdev/authorizer-react';
import '@authorizerdev/authorizer-react/styles.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthorizerProvider
      config={{
        authorizerURL: process.env.NEXT_PUBLIC_AUTHORIZER_URL!,
        redirectURL: typeof window !== 'undefined' ? window.location.origin : '',
        clientID: process.env.NEXT_PUBLIC_AUTHORIZER_CLIENT_ID!,
      }}
    >
      <Component {...pageProps} />
    </AuthorizerProvider>
  );
}
```

> For SSR data fetching that needs the user, read the session cookie on the server and
> validate it with [`validate_session`](../../core/graphql-api#validate_session) rather
> than relying on the client-side context.

## Reset-password page

Social and email flows redirect back to your `redirectURL`. For password resets, render
`AuthorizerResetPassword` on the route you configured (e.g. `/reset-password`) — it reads
the `token` and `redirect_uri` from the URL automatically:

```jsx
import { AuthorizerResetPassword } from '@authorizerdev/authorizer-react';

export default function ResetPasswordPage() {
  return <AuthorizerResetPassword onReset={() => (window.location.href = '/')} />;
}
```

## See also

- [Components](./components) — every prop of every Authorizer component.
- [Hooks](./hooks) — the full `useAuthorizer()` return shape.
- [authorizer-js](../authorizer-js/) — the underlying JS SDK (`authorizerRef`) for advanced calls.
