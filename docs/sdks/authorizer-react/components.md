---
sidebar_position: 2
title: Components
---

# Components

`@authorizerdev/authorizer-react` exports the few components that you can use in your react application. This will help you build authentication and authorization faster for your application.

## Table of contents

- [`AuthorizerProvider`](#authorizerprovider)
- [`Authorizer`](#authorizer)
- [`AuthorizerSignup`](#authorizersignup)
- [`AuthorizerBasicAuthLogin`](#authorizerbasicauthlogin)
- [`AuthorizerMagicLinkLogin`](#authorizermagiclinklogin)
- [`AuthorizerSocialLogin`](#authorizersociallogin)
- [`AuthorizerPasskeyLogin`](#authorizerpasskeylogin)
- [`AuthorizerForgotPassword`](#authorizerforgotpassword)
- [`AuthorizerResetPassword`](#authorizerresetpassword)
- [`AuthorizerVerifyOtp`](#authorizerverifyotp)
- [`AuthorizerTOTPScanner`](#authorizertotpscanner)
- [`AuthorizerMFASetup`](#authorizermfasetup)
- [`AuthorizerPasskeyRegister`](#authorizerpasskeyregister)

## `AuthorizerProvider`

`AuthorizerProvider` is the container component that wraps all the Authorizer components. It binds the backend configuration in the app and renders various views accordingly.

### Props

- `config`: Object to configure the `authorizer` backend URL and redirect URL. It accepts JSON object with following keys

| Key             | Type                   | Description                                                                                                                  | Required |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `authorizerURL` | `string`               | Authorizer backend URL                                                                                                       | `true`   |
| `redirectURL`   | `string`               | Frontend application URL or the page where you want to redirect user post login. Default value is `window.location.origin` | `true`   |
| `clientID`      | `string`               | Your client identifier (the value of `--client-id` flag used when starting the server)                                      | `false`  |
| `protocol`      | `'graphql' \| 'rest'`  | Wire transport for API calls. Default is `'graphql'`. Use `'rest'` to route calls through the typed REST endpoints instead. | `false`  |

> **Note:** `'grpc'` is not supported in `authorizer-react` because browsers cannot speak raw gRPC. Use `'graphql'` (default) or `'rest'`.

`AuthorizerProvider` also accepts one prop alongside `config` (not nested inside it):

- `onStateChangeCallback={async (newState) => {}}`: Async callback fired whenever the context state (`user`, `token`, `loading`, `config`) changes.

### Sample Usage

```jsx
import { AuthorizerProvider } from '@authorizerdev/authorizer-react'

const App = () => {
  return (
    <AuthorizerProvider
      config={{
        authorizerURL: 'http://localhost:8080',
        redirectURL: window.location.origin,
        clientID: 'YOUR_CLIENT_ID',
        protocol: 'graphql', // or 'rest'
      }}
      onStateChangeCallback={async (newState) => {}}
    >
      {/* rest of your components */}
    </AuthorizerProvider>
  )
}
```

## `Authorizer`

A core component that includes:

- social logins (incl. Discord, when enabled on the backend)
- passkey ("Sign in with a passkey") login, shown automatically when the browser supports WebAuthn
- signup view
- login view
- forgot password view
- multi-factor authentication setup, verification, and locked-account screens, driven by the backend's response to login/signup/passkey requests

Pre configured component that shows various login/signup options based on the backend configurations. Make sure it is used as Child of `AuthorizerProvider`.

### Props

- `onLogin={(loginResponse)=>{}}`: event called when login form is submitted successfully.
- `onSignup={(signupResponse)=>{}}`: event called when signup form is submitted successfully.
- `onMagicLinkLogin={(magicLinkResponse)=>{}}`: event called when magic link login form is submitted successfully.
- `onForgotPassword={(forgotPasswordResponse)=>{}}`: called when forgot password form is submitted successfully.
- `onPasswordReset={()=>{}}`: called after a password reset completes from the forgot-password OTP flow.
- `onCancelMfa={()=>{}}`: optional. When provided, a "Back" link is shown on the MFA setup/verify screens (rendered when the URL carries MFA-redirect params, e.g. after an OAuth or magic-link continuation) so the host can send the user elsewhere, such as back to the login URL with the MFA params cleared.
- `roles={string[]}`: optional. Restricts which roles a login/signup grants, e.g. `roles={['user']}`.
- `signupFieldsOverrides={FormFieldsOverrides}`: optional. Lets you relabel, reword the placeholder of, hide, or make optional the `given_name`, `family_name`, `email_or_phone_number`, `password`, and `confirmPassword` fields on the signup form. Each field accepts `{ label?, placeholder?, hide?, notRequired? }`.

### Sample Usage

```jsx
import { Authorizer } from '@authorizerdev/authorizer-react'

const LoginPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Login / Signup</h1>
      <br />
      <Authorizer
        onLogin={(loginResponse) => {}}
        onMagicLinkLogin={(magicLinkResponse) => {}}
        onSignup={(signupResponse) => {}}
        onForgotPassword={(forgotPasswordResponse) => {}}
      />
    </>
  )
}
```

## `AuthorizerSignup`

A component to render basic authentication singup form. Make sure it is used as Child of `AuthorizerProvider`.

### Props

- `onSignup={(response)=>{}}`: event called when signup form is submitted successfully.
- `roles={string[]}`: optional. Restricts which roles the created account is granted.
- `fieldOverrides={FormFieldsOverrides}`: optional. Per-field `{ label?, placeholder?, hide?, notRequired? }` overrides for `given_name`, `family_name`, `email_or_phone_number`, `password`, and `confirmPassword`.

### Sample Usage

```jsx
import { AuthorizerSignup } from '@authorizerdev/authorizer-react'

const SignupPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Signup</h1>
      <br />
      <AuthorizerSignup onSignup={(response) => {}} />
    </>
  )
}
```

## `AuthorizerBasicAuthLogin`

A component to render basic authentication login form. Make sure this is used as Child of `AuthorizerProvider`.

### Props

- `onLogin={(response)=>{}}`: event called when login form is submitted successfully.
- `roles={string[]}`: optional. Restricts which roles the login grants.

### Sample Usage

```jsx
import { AuthorizerBasicAuthLogin } from '@authorizerdev/authorizer-react'

const LoginPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Login</h1>
      <br />
      <AuthorizerBasicAuthLogin onLogin={(response) => {}} />
    </>
  )
}
```

## `AuthorizerMagicLinkLogin`

A component to render magic link login form. Make sure this is used as Child of `AuthorizerProvider`.

### Props

- `onMagicLinkLogin={(response)=>{}}`: event called when magic link login form is submitted successfully.
- `roles={string[]}`: optional. Restricts which roles the login grants.

### Sample Usage

```jsx
import { AuthorizerMagicLinkLogin } from '@authorizerdev/authorizer-react'

const LoginPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Login</h1>
      <br />
      <AuthorizerMagicLinkLogin onMagicLinkLogin={(response) => {}} />
    </>
  )
}
```

## `AuthorizerSocialLogin`

A component to render list of social media login buttons based on backend configurations (Google, GitHub, Facebook, LinkedIn, Apple, Twitter, Microsoft, Twitch, Roblox, and Discord — each shown only when its corresponding `is_*_login_enabled` flag is on). Clicking a button navigates the browser directly to the provider's OAuth flow (`{authorizerURL}/oauth_login/{provider}`); there are no submit callbacks. Make sure this is used as Child of `AuthorizerProvider`.

### Props

It has no required props. Both are normally supplied for you when composed inside `Authorizer`.

- `urlProps={Record<string, any>}`: optional. `state`/`scope`/`redirect_uri` (or `redirectURL`) forwarded onto the OAuth redirect URL.
- `roles={string[]}`: optional. Restricts which roles the resulting login grants.

### Sample Usage

```jsx
import { AuthorizerSocialLogin } from '@authorizerdev/authorizer-react'

const LoginPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Login / Signup</h1>
      <br />
      <AuthorizerSocialLogin />
    </>
  )
}
```

## `AuthorizerPasskeyLogin`

Renders a "Sign in with a passkey" button that performs a passwordless, usernameless (discoverable-credential) WebAuthn login. Unlike social login, there is no backend config flag for this — it renders purely based on browser support (`isWebauthnSupported()`), and renders nothing when the browser can't do WebAuthn or when the org enforces MFA (`config.is_mfa_enforced`), since passkey-as-sole-factor would let a user skip a required second factor. Make sure this is used as Child of `AuthorizerProvider`.

If the account resolved by the passkey ceremony needs a second factor, this component internally takes over and renders the MFA setup, verification, or locked-account screen instead of the button — see [`AuthorizerMFASetup`](#authorizermfasetup) and [`AuthorizerVerifyOtp`](#authorizerverifyotp).

### Props

- `onLogin={(data)=>{}}`: event called when the passkey login (or the MFA step that follows it) completes successfully.
- `onStepChange={(step)=>{}}`: optional. Fired whenever the component switches between `'button' | 'mfa-setup' | 'mfa-verify' | 'locked'`. Useful when rendering other login options alongside this component, so they can be hidden while an MFA screen is showing.

### Sample Usage

```jsx
import { AuthorizerPasskeyLogin } from '@authorizerdev/authorizer-react'

const LoginPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Login</h1>
      <br />
      <AuthorizerPasskeyLogin onLogin={(data) => {}} />
    </>
  )
}
```

## `AuthorizerForgotPassword`

A component to render forgot password form. Make sure this is used as Child of `AuthorizerProvider`.

### Props

No props exposed for this components

### Sample Usage

```jsx
import { AuthorizerForgotPassword } from '@authorizerdev/authorizer-react'

const ForgotPasswordPage = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Forgot Password?</h1>
      <br />
      <AuthorizerForgotPassword onForgotPassword={(response) => {}} />
    </>
  )
}
```

## `AuthorizerResetPassword`

A component that can be used to reset the password. This component can be used in the page, which is configured with the backend as `RESET_PASSWORD_URL`, check [environment variables](/core/server-config) for more details. This component validates the token in the URL sent via email to the user and helps resetting the password.

### Props

- `onReset={(response) => {}}`: optional. Called when reset form is submitted. If omitted, the component redirects the browser to `redirect_uri` (from the URL) or the configured `redirectURL` on success.
- `showOTPInput={boolean}`: optional, default `false`. Renders an OTP field above the password fields — used for the mobile/phone forgot-password flow, where `AuthorizerForgotPassword` renders this component itself with `showOTPInput` set.
- `phone_number={string}`: optional. The phone number the OTP was sent to; required alongside `showOTPInput` for the phone reset flow.

### Sample Usage

```jsx
import { AuthorizerResetPassword } from '@authorizerdev/authorizer-react'

const ResetPassword = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Reset Password</h1>
      <br />
      <AuthorizerResetPassword onReset={(response) => {}} />
    </>
  )
}
```

## `AuthorizerVerifyOtp`

A component to render the OTP/MFA verification form. It handles email/SMS OTP and TOTP codes, and — when offered alongside a code factor — a "Verify with a passkey" WebAuthn option. On SMS OTP it also attempts WebOTP auto-fill (`navigator.credentials.get({ otp: ... })`) so supporting browsers can fill the code automatically. Make sure it is used as Child of `AuthorizerProvider`.

### Props

- `email={string}`: optional. User email address the OTP was sent to. Not required for MFA continuations resolved purely from the session cookie (e.g. an OAuth-redirect or passkey-primary-login continuation, where the frontend never learns the identifier).
- `phone_number={string}`: optional. User phone number the OTP was sent to, as an alternative to `email`.
- `is_totp={boolean}`: optional, default `false`. Set when the pending factor is an authenticator-app (TOTP) code rather than an emailed/texted OTP — changes the help text and disables WebOTP/resend.
- `offerWebauthnVerify={boolean}`: optional, default `false`. Shows the "Verify with a passkey" button above the code form when the account also has webauthn as an available MFA factor.
- `hasCodeFactor={boolean}`: optional, default `false`. Whether a code-based factor (TOTP, or a verified email/SMS OTP) actually exists to fall back on. When `false` and `offerWebauthnVerify` is `true`, passkey is the only option and the code form is hidden entirely.
- `hasSmsOtp={boolean}`: optional, default `false`. True specifically when the pending code factor is SMS-delivered — gates the WebOTP auto-fill call, which only makes sense for an incoming SMS.
- `onBack={()=>{}}`: optional. When provided, a "Back" link lets the user leave this challenge (e.g. return to the login screen) instead of being stuck mid-verification.
- `onLogin={(response)=>{}}`: event called when the verify-OTP form (or passkey verification) is submitted successfully.

### Sample Usage

```jsx
import { AuthorizerVerifyOtp } from '@authorizerdev/authorizer-react'

const VerifyOtp = () => {
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Verify OTP</h1>
      <br />
      <AuthorizerVerifyOtp
        email="foo@bar.com"
        hasCodeFactor
        onLogin={(response) => {}}
      />
    </>
  )
}
```

## `AuthorizerTOTPScanner`

Shown right after a user opts into authenticator-app (TOTP) MFA: renders the QR code to scan, the setup key as a manual-entry fallback (with a copy button), the one-time recovery codes (copy/download/print), and then hands off to [`AuthorizerVerifyOtp`](#authorizerverifyotp) to confirm the first code. Make sure it is used as Child of `AuthorizerProvider`.

You normally won't render this directly — [`AuthorizerMFASetup`](#authorizermfasetup) renders it for you once TOTP enrolment data is available.

### Props

- `authenticator_scanner_image={string}`: required. Base64-encoded QR code image (rendered as `data:image/jpeg;base64,...`).
- `authenticator_secret={string}`: required. The manual-entry setup key shown alongside the QR code.
- `authenticator_recovery_codes={string[]}`: required. One-time recovery codes shown once, with copy/download/print actions.
- `email={string}`: optional. Forwarded to the OTP-confirmation step.
- `phone_number={string}`: optional. Forwarded to the OTP-confirmation step.
- `onLogin={(response)=>{}}`: optional. Forwarded to the OTP-confirmation step; called once the first TOTP code is verified.
- `setView={(v)=>{}}`: optional. Forwarded to the OTP-confirmation step for view-switching hosts (e.g. `Authorizer`'s internal login/signup view state).

### Sample Usage

```jsx
import { AuthorizerTOTPScanner } from '@authorizerdev/authorizer-react'

const TotpSetup = ({ enrollment }) => {
  return (
    <AuthorizerTOTPScanner
      authenticator_scanner_image={enrollment.authenticator_scanner_image}
      authenticator_secret={enrollment.authenticator_secret}
      authenticator_recovery_codes={enrollment.authenticator_recovery_codes}
      onLogin={(response) => {}}
    />
  )
}
```

## `AuthorizerMFASetup`

The hub where a signed-in (or mid-login) user opts into the MFA methods the server offers: authenticator app (TOTP), passkey, email one-time code, and SMS one-time code. Only methods you flag as `available` are shown, so users only ever see real options. TOTP and passkey have complete in-component enrolment flows ([`AuthorizerTOTPScanner`](#authorizertotpscanner) and [`AuthorizerPasskeyRegister`](#authorizerpasskeyregister)); email/SMS OTP are sent and confirmed via [`AuthorizerVerifyOtp`](#authorizerverifyotp) directly through the SDK, or delegated to your own UI via `onSetupMethod`. Make sure it is used as Child of `AuthorizerProvider`.

`Authorizer` (and `AuthorizerSignup` / `AuthorizerBasicAuthLogin` / `AuthorizerPasskeyLogin`) already render this automatically when the backend offers MFA setup during login/signup — you mainly need this directly to build a custom "Security settings" page where a user can add a second factor later.

### Props

- `availableMfaMethods={AvailableMfaMethods}`: required. `{ totp?: boolean; passkey?: boolean; emailOtp?: boolean; smsOtp?: boolean }` — which methods to offer. An omitted/`false` value hides that method entirely.
- `totpEnrollment={{ authenticator_scanner_image, authenticator_secret, authenticator_recovery_codes }}`: optional. When present, choosing "Set up" for TOTP renders `AuthorizerTOTPScanner` inline with this data immediately. When absent, the component fetches it for you via the SDK's `totpMfaSetup`, unless `onSetupMethod` is supplied.
- `onSetupMethod={(method: MfaMethod)=>{}}`: optional escape hatch. Called instead of the default SDK-driven flow when the user picks a method your host wants to handle itself (`'totp' | 'passkey' | 'email_otp' | 'sms_otp'`).
- `heading={string}`: optional, default `"Add a second step to sign in"`. Heading text above the method list.
- `loginContext={{ email?, phone_number?, state?, onComplete }}`: optional. Present only for the login-time (withheld-token) MFA offer, as opposed to a settings-page "add a second factor" hub. Adds a "Skip for now" action, and completing a method calls `onComplete` with the token the server issues (instead of just closing/refreshing, as a settings-page usage would).
- `onBack={()=>{}}`: optional. Shows a "Back" link on the top-level method list so the host can let the user leave MFA setup entirely.
- `passkeyRegistered={boolean}`: optional. Whether the signed-in user already has a passkey registered, so the passkey row can show an "Enabled" badge and "Manage" instead of "Set up".

It also exports two supporting types:

- `AvailableMfaMethods` — the shape of the `availableMfaMethods` prop.
- `MfaMethod` — `'totp' | 'passkey' | 'email_otp' | 'sms_otp'`, the union passed to `onSetupMethod`.

### Sample Usage

```jsx
import { AuthorizerMFASetup } from '@authorizerdev/authorizer-react'

const SecuritySettings = () => {
  return (
    <AuthorizerMFASetup
      availableMfaMethods={{ totp: true, passkey: true, emailOtp: true }}
      heading="Add a second step to sign in"
    />
  )
}
```

## `AuthorizerPasskeyRegister`

Lets a signed-in user enrol a new passkey (WebAuthn credential) as an MFA / passwordless method, and optionally lists their already-registered passkeys. Complements [`AuthorizerPasskeyLogin`](#authorizerpasskeylogin), which only handles the login ceremony. Since passkey support is a browser capability rather than a server config flag, this renders an "unsupported" notice — instead of nothing — when the browser can't run the WebAuthn ceremony, since in a settings context the user needs to know why the option is missing. Make sure it is used as Child of `AuthorizerProvider`.

### Props

- `onSuccess={(data)=>{}}`: optional. Called after a passkey is successfully registered. During the login-time MFA-offer path (see `mfaSetup` below) this carries the `access_token` issued by completing a withheld MFA offer; a plain settings-page add never sets it.
- `name={string}`: optional. A friendly name for the credential (e.g. `"MacBook Touch ID"`). When omitted, an inline text field is shown so the user can name it themselves.
- `showCredentials={boolean}`: optional, default `false`. Shows the list of already-registered passkeys above the add button. Requires an authenticated session (calls `webauthnCredentials`), so it's off by default.
- `mfaSetup={{ email?, phoneNumber?, state? }}`: optional. Present only during a token-withheld login-time MFA offer — authenticates the registration ceremony via the MFA session cookie instead of a bearer token (there isn't one yet), and completing it issues the previously-withheld token.

### Sample Usage

```jsx
import { AuthorizerPasskeyRegister } from '@authorizerdev/authorizer-react'

const SecuritySettings = () => {
  return (
    <AuthorizerPasskeyRegister
      showCredentials
      onSuccess={(data) => {}}
    />
  )
}
```
