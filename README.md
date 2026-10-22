# Interstate 90's Detroit

Cloudflare Pages static site. No build system or WordPress needed.

## Deploy

Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → select `cchandler313/i90sdet` → `main` branch.

- Framework preset: None
- Build command: `exit 0` (recommended for static HTML with Pages Functions)
- Build output directory: `.` (repository root)

Test the generated `*.pages.dev` preview before attaching the production domain `interstate90sdet.com`.

## Editing

The website is self-contained in `index.html`; its content object near the bottom controls upcoming shows, recent shows, and artists. Add upcoming shows in `upcomingShows` using entries like `{date:"2026-11-14",venue:"Venue",location:"City, Michigan",time:"8:00 PM",url:"https://..."}`. Use verified dates only. Commit changes to `main` to trigger Pages deployment.

## Important

The live WordPress site remains separate until the domain is intentionally moved. This is an initial redesign; original media and a user-friendly CMS are not yet migrated.

## Publishing shows and YouTube videos

Edit [content.json](https://github.com/cchandler313/i90sdet/edit/main/content.json) on GitHub. Click Commit changes to publish after Cloudflare Pages is connected to the `main` branch.

For an upcoming show, add an object inside `upcomingShows`:

```json
{"date":"2026-11-14","venue":"Example venue","location":"Detroit, Michigan","time":"8:00 PM","url":"https://example.com/event"}
```

Dates use YYYY-MM-DD. Old dates automatically disappear from upcoming shows. The `url` must be an HTTPS address; omit it when there is no event or ticket link.

For a YouTube video, add an object inside `videos`:

```json
{"title":"Live at Example Venue","url":"https://www.youtube.com/watch?v=VIDEO_ID"}
```

YouTube watch, shorts, embed, and youtu.be links are supported. Visitors can play videos directly from the homepage. No video files need to be uploaded. Each entry needs a comma between objects, and the JSON must remain valid.

**Currently, GitHub editing is the publishing mechanism**, not a client-facing login/dashboard. A true protected dashboard with one-click publishing requires a server-side GitHub integration or Cloudflare Worker (and authentication). Don't place API tokens in static page code.

## Band admin dashboard

The admin UI is at `/admin/`, and a Cloudflare Pages Function at `/api/admin/content` publishes edits to the GitHub `main` branch. It supports adding/editing/deleting upcoming shows, moving shows to recent stops, and adding/editing/deleting YouTube entries.

**Required configuration before using it:**

1. Deploy this repo as a **Git-connected Cloudflare Pages project**, not a direct-upload static project. Make sure Pages Functions are enabled and available; both `/admin/` and `/api/admin/content` must resolve.
2. In Cloudflare Zero Trust → Access → Applications, create a **self-hosted** application protecting `<your-preview-or-production-hostname>/admin/*` and one protecting `<your-preview-or-production-hostname>/api/admin/*` (or equivalent path policies), with an **Allow** policy listing only the client editors' specific emails. A path-specific Access app's **AUD tag** is distinct from the other app's; the API app's AUD is the value to configure below. Avoid a policy that allows all emails.
3. In the Pages project → Settings → Variables and Secrets, set `CF_ACCESS_TEAM_DOMAIN` to the exact issuer hostname, e.g. `https://YOUR-TEAM.cloudflareaccess.com` (no trailing slash). Set `CF_ACCESS_AUD` to the **Application AUD tag for the API's Access application**.
4. Create a fine-grained GitHub personal access token for **only** `cchandler313/i90sdet`, with Repository permissions → Contents: Read and write. Store it as an encrypted Pages secret named `GITHUB_TOKEN`. Never add the token to a GitHub file, HTML, or browser localStorage.
5. Redeploy after adding bindings/secrets. Visit `/admin/`, sign in via the client editor's permitted email, create an event or video, and click **Publish changes**. The API verifies the signed Cloudflare Access JWT using Cloudflare's published JWKS, then commits the data to GitHub. Pages redeploys via the Git integration.

**Security notes:** The API fails closed if any required variable or Access JWT is missing. Protect BOTH the dashboard and the API paths with Access policies. A copied or guessed dashboard URL alone does not grant publishing rights. Do not use a wildcard Allow Everyone policy. A GitHub token can be rotated/revoked independently. Cloudflare Access identity must be validated before publishing; this server-side code performs signature verification as defense in depth.

The dashboard is a basic CMS, not a full image upload or blog system. `content.json` is intentionally public because the site needs it for rendering. The admin includes conflict detection using the current GitHub file SHA; reload if a concurrent editor changes the file.

## Diagnosing a 404 from `/api/admin/content`

Open `/api/health` on the **same** pages.dev hostname. It should return JSON containing `\"ok\":true`. If it also returns 404, Pages Functions were not deployed: confirm the latest `main` commit was deployed using **Git integration** (not dashboard drag-and-drop), project root is repo root, build command `exit 0`, output directory `.`, and redeploy. If health succeeds while admin API is 404, check Cloudflare Access application rules and Functions logs. If the admin API returns 401 or 503, follow its error message: configure Access JWT verification variables and repository-scoped GitHub token as instructed above. Do not switch the client's domain until publishing is verified.
