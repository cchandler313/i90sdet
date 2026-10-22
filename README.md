# Interstate 90's Detroit — Cloudflare Worker

This project now targets **Cloudflare Workers with Static Assets**, not Pages. The deployable configuration is `wrangler.jsonc` and `worker.js`, with browser files in `public/`.

## Deploy from existing Workers Git-connected project

In Cloudflare Dashboard → Workers & Pages → `i90sdet` → Settings / Builds, keep the existing `cchandler313/i90sdet` Git connection and `main` branch. Configure:

- Root directory: repository root
- Build command: `npm install` (or leave blank if Cloudflare installs dependencies automatically)
- Deploy command: `npx wrangler deploy` (essential; do **not** deploy as static assets only)
- Worker name: `i90sdet`, as in `wrangler.jsonc`.

The native Worker serves `/` and `/admin/` from `public/` and handles `/api/health` and `/api/admin/content` in `worker.js`.

After deployment, visit `https://i90sdet.cchandler313.workers.dev/api/health`. Expected: `{"ok":true,"service":"i90sdet-worker",...}`. If it still says 404, Cloudflare is not deploying the new `worker.js` via Wrangler; inspect the deployment's Git commit, build logs, deploy command and Wrangler config.

## Protected band admin publishing

Admin path: `/admin/`. Protect both `/admin/*` and `/api/admin/*` with Cloudflare Zero Trust Access applications and allowlisted editor emails. The API independently verifies Access JWT signatures. Configure the **Worker** (not Pages) publishing secret:
- `GITHUB_TOKEN`: fine-grained GitHub token with repository `cchandler313/i90sdet` Contents read/write only.
- Optional extra security: `CF_ACCESS_TEAM_DOMAIN` (`https://YOUR-TEAM.cloudflareaccess.com`) and `CF_ACCESS_AUD` (the API Access application audience). Without these, the Worker verifies the signed Cloudflare Access JWT using the Cloudflare issuer from the token and restricts verified identity to the two approved email addresses.

The admin writes to `public/content.json` on the GitHub `main` branch, which must trigger a new Git-connected Worker deployment. Never store secrets in `public/`, GitHub, or the frontend.

## Data and editing

Website show dates and videos are read from `public/content.json`. The `content.json` copy at repo root is an obsolete Pages-era file; do not edit it.

**Before switching the client's production domain**, confirm health responds, admin data loads, add/publish a test show, see it on the public preview, remove it, and verify videos render. Until then leave WordPress live.

**OTP setup:** The publishing API no longer requires manually entering `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`; however, protecting **both** `/admin/*` and `/api/admin/*` with the band's Cloudflare Access OTP application remains essential. Set `GITHUB_TOKEN` as an encrypted Worker secret before attempting to load or publish content. For stronger isolation to one specific Access application, optionally supply the team domain and AUD values.
