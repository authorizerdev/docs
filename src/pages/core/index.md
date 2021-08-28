---
title: Authorizer core
layout: ../../layouts/Main.astro
---

Authorizer is developed using [Golang](https://golang.org/). Authorizer core comes with:

- GraphQL API
- Email and Password login
- OAuth login
- Forgot password
- Update profile API
- Web application with a login page, sign up page, and forgot-password page. These can save hundreds of hours 🕰️
- Secure session management with [HTTP cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)

## How Authorizer is secure?

One can authorize users in two ways:

1. Using HTTP Only cookie
2. Using JWT bearer token as part of `Authorization` header

On successful login, Authorizers server sends [HTTP cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) to the browser. Client applications can use `credentials:`include option in`fetch` for further authorization. User don't need to save this cookie in [`localStorage`](https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector/Local_Storage_Session_Storage) or [`sessionStorage`](https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector/Local_Storage_Session_Storage). This helps us prevent [XSS](https://owasp.org/www-community/attacks/xss/) or [CSRF](https://en.wikipedia.org/wiki/Cross-site_request_forgery) attack.

Client applications can also save `accessToken` received on successful login in memory and use it as JWT bearer token as `Authorization` header.

## Why Golang?

- High performant
- Uses [gin](https://github.com/gin-gonic/gin#gin-web-framework) web framework, with best [benchmarks](<(https://github.com/gin-gonic/gin#benchmarks)>)

## Why GraphQL API?

- Isomorphic schema
- Client applications can request the data that is only required
- In the future, we can stitch with other schema and offer schema-based permissions and user graph

> **Note:** You can always use GraphQL API as a rest API with the appropriate request body
