---
sidebar_position: 2
title: React Native
---

# Using Authorizer with React Native Expo

In this doc we will see how you can have authentication ready for your mobile application, which is developed using react native and expo.
This is the [github repository](https://github.com/authorizerdev/examples/tree/main/with-react-native-expo) having the sample code

Here are the 10 steps you need to follow:

## Step 1: Get Authorizer Instance

Deploy production ready Authorizer instance using one click deployment options available below

| **Infra provider** |                                                                                           **One-click link**                                                                                            |               **Additional information**               |
| :----------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------: |
|    Railway.app     |                      <a target="_blank" href="https://railway.com/deploy/authorizer-1?referralCode=FEF4uT&utm_medium=integration&utm_source=template&utm_campaign=generic"><img src="https://railway.com/button.svg" alt="Deploy on Railway"/></a>                      | [docs](/deployment/railway) |
|       Heroku       |  <a target="_blank" href="https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku"><img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku" /></a>   | [docs](/deployment/heroku)  |
|       Render       | <a target="_blank" href="https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render"><img alt="render button" src="https://render.com/images/deploy-to-render-button.svg" /></a> | [docs](/deployment/render)  |

For more information check [docs](/getting-started/)

## Step 2: Setup Instance

Start your Authorizer instance with the required CLI flags:

```bash
./authorizer \
  --database-type=sqlite \
  --database-url=test.db \
  --url=http://localhost:8080 \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --encryption-key=test-encryption-key \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```

Note the `--client-id` value -- you will need it in the SDK configuration below. Check [Server Configuration](/core/server-config) for all available flags.

## Step 3: Bootstrap react native project

The legacy global `expo-cli` (`expo init`) is deprecated. Use `create-expo-app` instead:

```
npx create-expo-app with-react-native-expo --template blank-typescript
```

## Step 4: Install dependencies

```
npm install @authorizerdev/authorizer-js expo-auth-session expo-crypto expo-secure-store expo-web-browser
```

> Note: `jwt-decode` and `react-native-base64` are **not** needed -- the flow below fetches the user profile via `authorizerRef.getProfile()` instead of decoding a JWT client-side.

## Step 5: Create redirect url

Redirect URL is used to redirect back to your application once the authentication process is complete. The `useProxy` option (Expo's auth proxy service) has been removed from `expo-auth-session` -- call `makeRedirectUri()` with no arguments:

```js
const redirectUri = AuthSession.makeRedirectUri()
```

## Step 6: Create AuthorizerJS Client

- Get your client ID from the `--client-id` flag used when starting the server

```js
const authorizerClientID = 'YOUR_CLIENT_ID'
const authorizerURL = 'YOUR_AUTHORIZER_INSTANCE_URL'
const authorizationEndpoint = `${authorizerURL}/authorize`
const tokenEndpoint = `${authorizerURL}/oauth/token`
const authorizerRef = new Authorizer({
  clientID: authorizerClientID,
  authorizerURL: authorizerURL,
  redirectURL: redirectUri,
})
```

## Step 7: Setup Expo AuthSession

Configure `useAuthRequest` hook with above configs. The example uses the **authorization code + PKCE** flow (`responseType: 'code'`, `usePKCE: true`) rather than the implicit `token` flow, since Expo's `expo-auth-session` treats PKCE as the secure default for public clients.

> Note: Use `offline_access` in scope if you want to get refresh token and want to perform silent refresh when user comes back to app. If your app is data sensitive we do not recommend using refresh token (example banking / finance app)

```js
const [request, result, promptAsync] = AuthSession.useAuthRequest(
  {
    redirectUri,
    clientId: authorizerClientID,
    responseType: 'code',
    // use offline access to get a refresh token and perform silent refresh in background
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    extraParams: {
      // ideally, this will be a random value
      nonce: 'nonce',
    },
    usePKCE: true,
  },
  { authorizationEndpoint }
)
```

## Step 8: Handle the authentication result

On success, exchange the authorization code for tokens with `AuthSession.exchangeCodeAsync()`, store the refresh token, then fetch the profile with the access token to get the user's email.

```js
const authorizerRefreshTokenKey = `authorizer_refresh_token`

useEffect(() => {
  async function setResult() {
    if (result && result.type === 'success') {
      if (result.error) {
        Alert.alert(
          'Authentication error',
          result.params.error_description || 'something went wrong'
        )
        return
      }

      const codeRes = await AuthSession.exchangeCodeAsync(
        {
          code: result.params.code,
          redirectUri,
          clientId: authorizerClientID,
          extraParams: {
            code_verifier: request?.codeVerifier || '',
          },
        },
        { tokenEndpoint }
      )

      if (codeRes?.refreshToken) {
        await SecureStore.setItemAsync(
          authorizerRefreshTokenKey,
          codeRes.refreshToken
        )
      }

      // get profile using the access token
      const { data: profileData } = await authorizerRef.getProfile({
        Authorization: `Bearer ${codeRes?.accessToken}`,
      })
      setEmail(profileData?.email ?? undefined)
    }
  }
  setResult()
}, [result])
```

## Step 9: Silent Refresh

Perform Silent Refresh. Note silent refresh will give you a new access token and refresh token, which you can then use to re-fetch the profile.

```js
// on init of app silently refresh token if it exists
useEffect(() => {
  async function silentRefresh() {
    try {
      const refreshToken = await SecureStore.getItemAsync(
        authorizerRefreshTokenKey
      )
      if (refreshToken) {
        try {
          const { data } = await authorizerRef.getToken({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          })
          await SecureStore.setItemAsync(
            authorizerRefreshTokenKey,
            data?.refresh_token || ''
          )

          // get profile using the new access token
          const { data: profileData } = await authorizerRef.getProfile({
            Authorization: `Bearer ${data?.access_token}`,
          })
          setEmail(profileData?.email ?? undefined)
        } catch (err) {
          console.error(err)
          await SecureStore.deleteItemAsync(authorizerRefreshTokenKey)
        }
      }
    } catch (error) {
      setEmail(undefined)
      await SecureStore.deleteItemAsync(authorizerRefreshTokenKey)
    } finally {
      setLoading(false)
    }
  }
  silentRefresh()
}, [])
```

Also you can perform silent refresh when the access token expires. You also get `expires_in` in the response of token which you can use. So you can set time interval after which it should fetch new tokens.

## Step 10: Logout

Revoke the refresh token, clear it from `SecureStore`, and open the Authorizer `/logout` endpoint in a browser session so the server-side cookie is cleared too:

```js
const handleLogout = async () => {
  setLoading(true)
  setEmail(undefined)

  try {
    const refreshToken = await SecureStore.getItemAsync(
      authorizerRefreshTokenKey
    )
    await authorizerRef.revokeToken({
      refresh_token: refreshToken || '',
    })
    await SecureStore.deleteItemAsync(authorizerRefreshTokenKey)
    await WebBrowser.openAuthSessionAsync(
      `${authorizerURL}/logout?redirect_uri=${redirectUri}`,
      'redirectUrl'
    )
  } catch (err) {
    console.log(err)
  } finally {
    setLoading(false)
  }
}
```
