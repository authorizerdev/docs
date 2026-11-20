# SurrealDB docs contribution: Authorizer as an authentication provider

`authorizer-integration.mdx` is a guide written in the format of SurrealDB's own
docs (`surrealdb/docs.surrealdb.com`, `src/content/learn/tutorials/walkthroughs/`),
next to their Auth0 and AWS Cognito guides. It is kept here until it is
submitted upstream as a pull request, together with one line in that
directory's `overview.mdx` under "Authentication".

Before submitting:

- Replace `<AUTHORIZER_MIN_VERSION>` with the first release that stamps a
  `kid` header on tokens (planned: 2.5.0, authorizerdev/authorizer#904).
- Re-run the guide end to end against that release.

Verified (2026-11-19) against SurrealDB 4.0.1 and Authorizer with #904
applied: every SurrealQL block, the HTTP example, and the JavaScript snippet
(`@authorizerdev/authorizer-js` 4.0.0 + `surrealdb` 2.2.2). Users were
isolated, role permissions applied, and tampered, `alg=none` and forged HS256
tokens were rejected.

Authorizer's own docs page for the same setup is
`docs/integrations/surrealdb.md`.
