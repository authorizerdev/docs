# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Documentation website for [Authorizer](https://authorizer.dev), built with **Docusaurus v3.9.2**. Live at https://docs.authorizer.dev.

## Commands

```bash
npm start          # Dev server with hot reload
npm run build      # Build static site to /build
npm run serve      # Serve built site locally
npm run typecheck  # TypeScript type checking
npm run clear      # Clear build cache
```

Node.js >= 20.0 required.

## Architecture

- **docs/** — Current v2.x documentation (markdown/MDX files)
- **versioned_docs/version-1.x/** — Archived v1.x docs (unmaintained)
- **src/css/custom.css** — Brand colors and theme customization
- **src/pages/** — Custom non-doc pages
- **static/img/** — Images, logos, favicons
- **docusaurus.config.ts** — Main site config (metadata, navbar, footer, versioning, syntax highlighting)
- **sidebars.ts** — Navigation structure with two sidebars: `docsSidebar` and `sdksSidebar`
- **versions.json** — Tracks doc versions (currently `["1.x"]`)

## Documentation Structure

Docs are organized into sections defined in `sidebars.ts`:
- **Core** — Server config, databases, endpoints, GraphQL API, email
- **Getting Started** — Quick start guide
- **Deployment** — Platform-specific guides (Docker, K8s, Heroku, Fly.io, Railway, Render, etc.)
- **Integrations** — Hasura, React Native, GatsbyJS
- **Migration** — v1 to v2 upgrade guide
- **SDKs** — JS, React, Go, Svelte, Vue, Flutter

## Key Details

- Versioning: v2.x is current/latest, v1.x shows an unmaintained banner
- Syntax highlighting configured for: Go, Bash, GraphQL, YAML, TOML, Dart
- Brand color: Blue (`#3B82F6`) with light/dark mode support
- GitHub repo for edit links: `authorizerdev/authorizer-docs`
