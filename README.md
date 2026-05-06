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

## Docs

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — read when wiring a new program or understanding cross-cutting structure (the load-bearing mental model + cookbook).
- [`docs/V1_API.md`](./docs/V1_API.md) — read when integrating against `/v1/runs` (full wire contract + payload schemas + curl examples).
- [`docs/IDEAS.md`](./docs/IDEAS.md) — read when looking for the innovation backlog or shipped game-changers (R1/R2/R3 + v3 tracks).
- [DEPLOY.md](./DEPLOY.md) — read when shipping to Vercel or rotating env config.
- [`/openapi.json`](https://studio.pluck.run/openapi.json) — read when generating SDKs against `/v1/runs` (auto-generated OpenAPI 3.1; re-run `pnpm openapi:build` after any RunSpec / RunRecord / pipeline-validators / redactor change).
- [`/api/mcp/manifest.json`](https://studio.pluck.run/api/mcp/manifest.json) — read when writing MCP bridges (auto-generated discovery document parallel to OpenAPI; drives `@sizls/pluck-mcp`).

## Source for the Bureau programs

[github.com/sizls/pluck](https://github.com/sizls/pluck)
