---
title: React Native
layout: ../../layouts/Main.astro
---

### Example of using authorizer with react-native expo

## Step 1:

Have authorizer instance up and running. Check [docs](https://docs.authorizer.dev/getting-started/)

Get authorizer client id from your dashboard

- Open authorizer instance endpoint in browser
- Go to environment variables tab and you will see client id field

## Step 2:

Install expo cli

```
npm install --global expo-cli
```

## Step 3:

Bootstrap project

```
expo init with-react-native-expo
```

Select blank default app

## Step 4:

Install dependencies

- `npm install @authorizerdev/authorizer-js expo-auth-session expo-random expo-secure-store expo-web-browser jwt-decode react-native-base64`

## Step 5:

Create redirect url

```js
const useProxy = false;
const redirectUri = AuthSession.makeRedirectUri({ useProxy });
```

## Step 6:

Configure Authorizer Client

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

## Step 7

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

## Step 8

Listen to auth result and set refresh token in secure store for silent refresh / get user info

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

## Step 9 [Optional]

Perform Silent Refresh

```js
// on init silently refresh token if it exists
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
