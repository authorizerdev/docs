---
title: React Native Expo
layout: ../../layouts/Main.astro
---

In this doc we will see how you can have authentication ready for your mobile application, which is developed using react native and expo.
This is the github repository having the sample code: https://github.com/authorizerdev/examples/tree/main/with-react-native-expo

Here are the 10 steps you need to follow:

## Step 1: Get Authorizer Instance

Deploy production ready Authorizer instance using one click deployment options available below

| **Infra provider** |                                                                                                                **One-click link**                                                                                                                |               **Additional information**               |
| :----------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------: |
|    Railway.app     | <a target="_blank" href="https://railway.app/new/template?template=https://github.com/authorizerdev/authorizer-railway&amp;plugins=postgresql,redis"><img src="https://railway.app/button.svg" style="height: 44px" alt="Deploy on Railway"></a> | [docs](https://docs.authorizer.dev/deployment/railway) |
|       Heroku       |             <a target="_blank" href="https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku"><img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku" style="height: 44px;"></a>             | [docs](https://docs.authorizer.dev/deployment/heroku)  |
|       Render       |                     <a target="_blank" href="https://render.com/deploy?repo=https://github.com/authorizerdev/authorizer-render"><img alt="render button" src="https://render.com/images/deploy-to-render-button.svg" /></a>                      | [docs](https://docs.authorizer.dev/deployment/render)  |

For more information check [docs](https://docs.authorizer.dev/getting-started/)

## Step 2: Setup Instance

- Open authorizer instance endpoint in browser
- Sign up as an admin with a secure password
- Configure environment variables from authorizer dashboard. Check env [docs](/core/env) for more information

> Note: `DATABASE_URL`, `DATABASE_TYPE` and `DATABASE_NAME` are only configurable via platform envs

## Step 3: Install expo

```
npm install --global expo-cli
```

## Step 4: Bootstrap react native project

```
expo init with-react-native-expo
```

Select blank default app

## Step 5: Install dependencies

```
npm install @authorizerdev/authorizer-js expo-auth-session expo-random expo-secure-store expo-web-browser jwt-decode react-native-base64
```

## Step 6: Create redirect url

Redirect URL is used to redirect back to your application once the authentication process is complete

```js
const useProxy = false;
const redirectUri = AuthSession.makeRedirectUri({ useProxy });
```

## Step 7: Create AuthorizerJS Client

- Get your client ID from authorizer dashboard environment variable section

```js
const authorizerClientID = "YOUR_CLIENT_ID";
const authorizerURL = "YOUR_AUTHORIZER_INSTANCE_URL";
const authorizationEndpoint = `${authorizerURL}/authorize`;
const authorizerRef = new Authorizer({
  clientID: authorizerClientID,
  authorizerURL: authorizerURL,
  redirectURL: redirectUri,
});
```

## Step 8: Setup Expo AuthSession

Configure `useAuthRequest` hook with above configs

> Note: Use `offline_access` in scope if you want to get refresh token and want to perform silent refresh when user comes back to app. If your app is data sensitive we do not recommend using refresh token (example banking / finance app)

```js
const [request, result, promptAsync] = AuthSession.useAuthRequest(
  {
    redirectUri,
    clientId: authorizerClientID,
    // id_token will return a JWT token
    responseType: "token",
    // use offline access to get a refresh token and perform silent refresh in background
    scopes: ["openid", "profile", "email", "offline_access"],
    extraParams: {
      // ideally, this will be a random value
      nonce: "nonce",
    },
  },
  { authorizationEndpoint }
);
```

## Step 9: Listen to the authentication process change

Get auth session result and set refresh token in secure store for silent refresh.
You also get the access token, id token for the further usage

```js
const authorizerRefreshTokenKey = `authorizer_refresh_token`;

useEffect(() => {
  async function setResult() {
    if (result) {
      if (result.params.refresh_token) {
        await SecureStore.setItemAsync(
          authorizerRefreshTokenKey,
          result.params.refresh_token
        );
      }

      if (result.error) {
        Alert.alert(
          "Authentication error",
          result.params.error_description || "something went wrong"
        );
        return;
      }

      if (result.type === "success") {
        // Retrieve the JWT token and decode it
        const jwtToken = result.params.id_token;
        const decoded = jwtDecode(jwtToken);

        const { email } = decoded;
        setEmail(email);
      }
    }
  }
  setResult();
}, [result]);
```

## Step 10: Silent Refresh

Perform Silent Refresh. Note silent refresh will give you new access token, id token and refresh token.
You can use access token & id token for further API requests.

```js
// on init of app silently refresh token if it exists
useEffect(() => {
  async function silentRefresh() {
    try {
      const refreshToken = await SecureStore.getItemAsync(
        authorizerRefreshTokenKey
      );
      if (refreshToken) {
        try {
          const res = await authorizerRef.getToken({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          });
          await SecureStore.setItemAsync(
            "authorizer_refresh_token",
            res.refresh_token
          );
          setEmail(jwtDecode(res.id_token).email);
        } catch (err) {
          console.error(err);
          await SecureStore.deleteItemAsync(authorizerRefreshTokenKey);
        }
      }
    } catch (error) {
      setEmail(null);
      await SecureStore.deleteItemAsync(authorizerRefreshTokenKey);
    } finally {
      setLoading(false);
    }
  }
  silentRefresh();
}, []);
```

Also you can perform silent refresh when access token / id token expires. You also get `expires_in` in the response of token which you can use. So you can set time interval after which it should fetch new tokens.
