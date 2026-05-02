# Deploying Pluck Studio to studio.pluck.run

The Vercel project `pluck-studio` lives in the `directives` scope (id `prj_bZqMMQtBl15kCqa0opSPuZwkYFYX`).

## One-time setup

1. **Vercel CLI auth** (operator-side)
   ```bash
   npx vercel login
   ```
2. **Connect the Vercel project to GitHub**
   - Vercel dashboard -> Project `pluck-studio` -> Settings -> Git
   - Connect to `sizls/pluck-studio`, branch `main`
   - Root Directory: leave blank (vanilla Next.js at repo root)
   - Framework: `Next.js` (auto-detected)
   - Build Command: leave blank (default `next build`)
   - Install Command: `pnpm install`
3. **Set NPM_TOKEN env var on Vercel**
   - Settings -> Environment Variables
   - Name: `NPM_TOKEN`, Value: `npm_xxxxxxxxxxxx` (read access to `@sizls` scope)
   - Apply to: Production + Preview + Development
4. **Domain**
   - Settings -> Domains -> add `studio.pluck.run`
   - Vercel returns DNS instructions (typically CNAME to `cname.vercel-dns.com`)
   - GoDaddy -> DNS -> add CNAME `studio` pointing to the Vercel target

## Per-deploy

Push to `main` -> Vercel auto-builds -> auto-promotes to `studio.pluck.run`.

Manual deploys (rare):
```bash
npx vercel          # preview
npx vercel --prod   # promote to studio.pluck.run
```

## Local dev

```bash
export NPM_TOKEN=npm_xxxxxxxxxxxx   # or set in ~/.npmrc
pnpm install
pnpm dev            # http://localhost:3030
pnpm build          # production build
```

## Notes

- Studio's `@sizls/pluck-bureau-*` deps are private npm packages. The `.npmrc` reads `NPM_TOKEN` from the environment; without it, install fails.
- Studio bundles `pluck-bureau-ui` as vendored source in `src/components/bureau-ui/` (no separate npm package).
