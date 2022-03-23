# Using Authorizer with [Gatsby](https://www.gatsbyjs.com/)

## Step 1: Get Authorizer Instance

Deploy production ready Authorizer instance using one click deployment options available below

| **Infra provider** |                                                                                                      **One-click link**                                                                                                      |               **Additional information**               |
| :----------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------: |
|    Railway.app     | <a target="_blank" href="https://railway.app/new/template?template=https://github.com/authorizerdev/authorizer-railway&amp;plugins=postgresql,redis"><img src="https://railway.app/button.svg" alt="Deploy on Railway"/></a> | [docs](https://docs.authorizer.dev/deployment/railway) |
|       Heroku       |             <a target="_blank" href="https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku"><img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku" /></a>             | [docs](https://docs.authorizer.dev/deployment/heroku)  |
|       Render       |           <a target="_blank" href="https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render"><img alt="render button" src="https://render.com/images/deploy-to-render-button.svg" /></a>            | [docs](https://docs.authorizer.dev/deployment/render)  |

For more information check [docs](https://docs.authorizer.dev/getting-started/)

## Step 2: Setup Instance

- Open authorizer instance endpoint in browser
- Signup with a secure password
- Configure social logins / smtp server and other environment variables based on your needs

For more information please check [docs](https://docs.authorizer.dev/core/env/)

## Step 3: Bootstrap Gatsby Site

Run `npm init gatsby` this will call `create-gatsby` and help you bootstrap gatsby site

Answer the few bootstrapping questions,

- Give your site a name
- Select the repo name
- Select CMS (For demo purpose I did not select any cms)
- Selected `styled-components` for styling system
- Select the additional features you want

## Step 3: Install `@authorizerdev/authorizer-react`

```sh
npm install @authorizerdev/authorizer-react
```

OR

```sh
yarn add @authorizerdev/authorizer-react
```

## Step 4: Create Root Layout

Create `src/components/layout.js` as the root layout for app with `AuthorizerProvider`

> Note: Replace `YOUR_AUTHORIZER_URL` with your authorizer instance URL obtained on step 2. Also replace `YOUR_CLIENT_ID` with your client ID obtained from dashboard in step 2.

```jsx
import React from 'react'
import { AuthorizerProvider } from '@authorizerdev/authorizer-react'

// styles
const pageStyles = {
  color: '#232129',
  padding: 96,
  fontFamily: '-apple-system, Roboto, sans-serif, serif',
}

export default function Layout({ children }) {
  return (
    <AuthorizerProvider
      config={{
        authorizerURL: 'YOUR_AUTHORIZER_URL',
        redirectURL:
          typeof window !== 'undefined' ? window.location.origin : '/',
        clientID: 'YOUR_CLIENT_ID',
      }}
    >
      <div
        style={{
          margin: `0 auto`,
          maxWidth: 650,
          padding: `0 1rem`,
          ...pageStyles,
        }}
      >
        {children}
      </div>
    </AuthorizerProvider>
  )
}
```

## Step 5: Update browser config

Add root layout in gatsby browser config. Create `gatsby-browser.js` in the root of project with following content

```jsx
const React = require('react')
const Layout = require('./src/components/layout').default

// Wraps every page in a component
exports.wrapPageElement = ({ element, props }) => {
  return <Layout {...props}>{element}</Layout>
}
```

This will prevent re-rendering of layout every time the page changes.

## Step 6: Add Authorizer component

Add `Authorizer` component in `src/pages/index.js` page with redirects.

Here in case if user is logged in we would like to redirect them to private route using `useEffect`

Replace content of Index page with following

```jsx
import { Authorizer, useAuthorizer } from '@authorizerdev/authorizer-react'
import * as React from 'react'
import { navigate } from 'gatsby'

const IndexPage = () => {
  const { loading, user } = useAuthorizer()
  React.useEffect(() => {
    if (!loading && user) {
      navigate('/private/dashboard')
    }
  }, [loading, user])

  if (loading) {
    return <h3>loading...</h3>
  }

  return (
    <main>
      <Authorizer
        onSignup={() => {
          navigate('/private/dashboard')
        }}
        onLogin={() => {
          navigate('/private/dashboard')
        }}
      />
    </main>
  )
}

export default IndexPage
```

## Step 7: Add private route layout

Add `src/components/private.js` with following content

Here if user is not logged in we would redirect them to home page where we have our Authorizer login component. This also adds logout button which will be common for all private routes

```jsx
import * as React from 'react'
import { useAuthorizer } from '@authorizerdev/authorizer-react'
import { navigate } from 'gatsby'

export default function PrivateLayout({ children }) {
  const { user, loading, authorizerRef, setUser } = useAuthorizer()
  React.useEffect(() => {
    if (!loading && !user) {
      navigate('/')
    }
  }, [loading, user])

  const handleLogout = async () => {
    await authorizerRef.logout()
    setUser(null)
    navigate('/')
  }

  if (loading) {
    return <h3>loading...</h3>
  }

  return (
    <div
      style={{
        margin: `0 auto`,
        maxWidth: 650,
        padding: `0 1rem`,
      }}
    >
      <button onClick={handleLogout}>Logout</button>
      {children}
    </div>
  )
}
```

## Step 7: Add private route

Add `src/pages/private/dashboard.js` with following content

```jsx
import * as React from 'react'
import { useAuthorizer } from '@authorizerdev/authorizer-react'
import PrivateLayout from '../../components/private'

export default function Dashboard() {
  const { user } = useAuthorizer()
  return (
    <PrivateLayout>
      <code>{JSON.stringify(user, null, 2)}</code>
    </PrivateLayout>
  )
}
```
