---
sidebar_position: 7
title: Email Verification Contract
---

# Email verification contract

Authorizer resolves a local account from an email address in several flows —
password signup, magic link, and every social/enterprise federated login. This
page states when an address counts as **verified**, why federated logins are
held to that bar, and what you need to configure.

:::warning Behaviour change in 2.4.0

A social login whose provider does not attest the email address is now refused.
See [Upgrading](#upgrading) for what to configure if this affects your
deployment.
:::

## Why an address must be attested

OAuth 2.0 carries no identity claims at all. OpenID Connect added `email` — and
alongside it a **separate `email_verified` boolean**, precisely because `email`
on its own proves nothing about who controls the mailbox.

That distinction matters here because the email address is what selects the
local account. It decides signup-versus-login, and the login branch merges the
incoming federated identity into whatever account already holds the address. If
an attacker can make a provider assert an address they do not own, they land in
that account's session.

This is the [nOAuth](https://www.descope.com/blog/post/noauth) attack class.
Microsoft Entra is the sharp case:

- Entra **v2 ID tokens carry no `email_verified` claim at all**.
- Entra's `email` is a *mutable, unverified* directory attribute — any tenant
  admin can set it to any string, including someone else's address.
- The multi-tenant endpoints (`common`, `organizations`, `consumers`) sign with
  Microsoft's **global** keys, so a token minted in a free attacker-owned tenant
  has a valid signature and a valid `aud`. Only the tenant distinguishes it.

So: register a free Entra tenant, set a user's `email` to `victim@example.com`,
click "Login with Microsoft", and without this contract you are in the victim's
account.

## The three connection classes

Authorizer treats connections the same way Auth0 does:

| Connection class | Is the address attested? | Behaviour |
|---|---|---|
| **Database** (password signup) | No — nobody has vouched for it | `email_verified` is `false` until the user clicks the verification link Authorizer mails them (requires `--enable-email-verification=true`; with verification disabled the address is marked verified at signup) |
| **Social** (Google, Apple, GitHub, …) | Usually yes — the provider vouches | The provider's own signal is imported directly; no separate verification round-trip |
| **Enterprise / Azure AD / OIDC** | **Not guaranteed** — enterprise directories do not promise it | Requires an explicit trust decision from you (see below) |

## Per-provider signal

Each provider is read from the signal that provider actually emits. There is no
single claim that works everywhere, and treating one provider's silence as
another's "true" is exactly what creates the vulnerability.

| Provider | Signal | Notes |
|---|---|---|
| Google | `email_verified` (ID token) | Standard OIDC |
| Apple | `email_verified` (ID token) | Documented as "a string or Boolean value" — both forms accepted |
| Twitch | `email_verified` (ID token) | Standard OIDC |
| LinkedIn | `email_verified` (userinfo) | Both bool and quoted-string forms accepted |
| Microsoft | `xms_edov`, **or** a trusted tenant | No `email_verified` exists on Entra v2 — see below |
| GitHub | verified by construction | Both the public `/user` email and the `/user/emails` fallback are filtered to verified addresses |

## How a user verifies

With `--enable-email-verification`, `signup` creates the verification request
and sends the mail before returning "Verification email has been sent. Please
check your inbox". Clicking that link is the normal path and needs nothing else.

**The link is valid for 30 minutes.** If it expires or never arrives:

| Route | Who drives it | Notes |
|---|---|---|
| **`resend_verify_email`** | the user | The primary recovery. Mints a fresh link for the same address, and mints one even when no pending request remains. Gated on the address actually being unverified, so it cannot be used as an open mailer. |
| **Password login** | the user | An unverified account's password login emails an OTP instead; verifying that OTP marks the address verified. |
| **`_update_user { email_verified: true }`** | an admin | The escape hatch when the user genuinely cannot receive mail. |
| Forgot password | the user | Completing a token reset also verifies the address — a side effect of proving mailbox control, not the route to reach for. |

## Hard requirement: verification needs a working email service

:::danger

`--enable-email-verification=true` with no SMTP configured is a **fatal startup
error** in 2.4.0.

Every route in the table above terminates at the same mailbox, so without a mail
path a user is created unverified and can never recover — and an unverified
account also blocks a federated login for that address.

Set `--smtp-host`, `--smtp-port` and `--smtp-sender-email` — all three — or turn
email verification off.
:::

## This is not the same as Auth0's post-login email check

A post-login Action like:

```js
exports.onExecutePostLogin = async (event, api) => {
  if (!event.user.email_verified) {
    api.access.deny('Please verify your email address before logging in.');
  }
};
```

is a **login policy**: "should this user, whoever they are, be let in before
confirming their own address?" It is reasonably opt-in, and Authorizer's
equivalent is `--enable-email-verification`.

What this page describes is **identity resolution**: "which local account does
this federated assertion refer to?" Getting that wrong does not inconvenience
the legitimate user — it hands their account to somebody else. Which is why the
default is secure and the escape hatch is narrowed rather than total.

## What a refusal looks like

The callback returns `400` before any local account lookup, so no account is
created and no existing account is touched:

```json
{
  "error": "email_not_verified",
  "error_description": "The identity provider did not confirm that you own this email address."
}
```

An `oauth_email_unverified` security metric and an audit event are recorded.

## Upgrading

Most deployments need no change — Google, Apple, GitHub, Discord, Facebook,
LinkedIn, Twitch, Twitter and Roblox all supply a signal already.

**If you use Microsoft login**, pick one:

- pin `--microsoft-tenant-id` to your tenant (single-tenant deployments — the
  common case, and the best option);
- set `--microsoft-allowed-tenants` to the tenants you serve (multi-tenant SaaS);
- enable the `xms_edov` optional claim in your Entra app registration.

### Compatibility mode

If you need more time, `--oauth-allow-unverified-provider-email=true` is a
stopgap — existing users keep working and cross-credential takeover stays
blocked.

It does **not** disable the check. An unattested address still cannot cross into
an account owned by another credential; it only re-permits same-provider
linking, which leaves two Entra tenants able to collide on one address. The
server logs a warning on every boot while it is set.

It is not a substitute for one of the three fixes above.

## Operator actions in the dashboard

The Users table exposes both operator routes per user, shown only when the
relevant identifier is actually unverified:

- **Mark Email Verified** — asserts the address is good without mailing
  anything. Sends only `email_verified`; deliberately not `email`, since that
  param drives the change-address flow (which clears verification and mails a
  new link).
- **Resend Verification Email** — mails a fresh link so the user proves it
  themselves. Preferred when you have no independent reason to trust the
  address.
- **Mark Phone Verified** — the phone equivalent.
