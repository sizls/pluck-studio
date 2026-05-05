# Pluck Studio

Operator UI for [Pluck Bureau](https://github.com/sizls/pluck) — the public web surface at `studio.pluck.run` hosting the hacking & security programs (DRAGNET, NUCLEI, CUSTODY, etc.).

## Tech

- Next.js 15 (App Router)
- React 19
- TypeScript

## Setup

The Studio depends on private `@sizls/*` packages from npm. You need an NPM_TOKEN with read access to the `@sizls` scope.

```bash
# Set NPM_TOKEN (also works via ~/.npmrc)
export NPM_TOKEN=npm_xxxxxxxxxxxx

# Install
pnpm install
```

## Develop

```bash
pnpm dev          # http://localhost:3030
pnpm typecheck
pnpm test
pnpm build
```

## Deploy

See [DEPLOY.md](./DEPLOY.md). Vercel project: `pluck-studio` in the `directives` scope.

## Public API

The `/v1/runs` surface is documented in [`docs/V1_API.md`](./docs/V1_API.md)
and published as an auto-generated OpenAPI 3.1 spec at
[`/openapi.json`](https://studio.pluck.run/openapi.json). Re-run
`pnpm openapi:build` after any RunSpec / RunRecord / pipeline-validators
/ redactor change.

## Source for the Bureau programs

[github.com/sizls/pluck](https://github.com/sizls/pluck)
