# Interstate 90's Detroit — Cloudflare Worker

This site deploys to Cloudflare Workers at `i90sdet.cchandler313.workers.dev`, with static assets in `public/` and a native SQLite-backed Durable Object for editable show and video content.

## Deploy

Existing Worker: `i90sdet`, Git repository `cchandler313/i90sdet`, branch `main`.

- Build command: `npm install`
- Deploy command: `npx wrangler deploy`
- Project root: repository root (`/`)
- Configuration: `wrangler.jsonc`, which automatically provisions the `BandContent` Durable Object class and `BAND_CONTENT` binding.

No `GITHUB_TOKEN`, D1 database ID, KV namespace ID, or manual storage configuration is needed. Wrangler provisions the storage on deployment. Cloudflare Durable Objects are supported on Workers Free and Paid (free-tier limits apply).

## Sign-in and editing

The public homepage is accessible to everyone. Cloudflare Access OTP must protect **both** `/admin/*` and `/api/admin/*` on the Worker hostname. The API independently validates Cloudflare's signed token and accepts only these two verified email identities:

- cchandler313@gmail.com
- schembrivicki@gmail.com

Optional extra app-specific verification: `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`. These are not required for the existing OTP setup.

Go to `/admin/` to add/edit/remove events or YouTube videos, then click **Publish changes**. Publishing writes directly to Durable Object storage and becomes visible on the public site immediately. No code deployment occurs on each content edit.

The original content from `public/content.json` is automatically used to seed the store on the first admin visit, preserving the existing show history, artist list and YouTube channel playlist. Thereafter the authoritative content lives in the Durable Object; changing `public/content.json` in GitHub does not overwrite saved edits.

## Health and verification

Open `/api/health`. A working release responds with `"revision":"storage-v1"` and `"storage":"available"`. Test admin OTP, adding and publishing a show, public display, and removal before switching the client's production WordPress domain.

Security: never disable Cloudflare Access protection on the admin and API paths. Content is edited only through the authenticated API. Public `/content.json` contains only published information.

Backups: data now resides in Cloudflare's Durable Object storage, not GitHub. Arrange regular content exports before production launch if off-platform backups are required.
