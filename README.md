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

## Video vault and historic event migration (Oct 22, 2026)

The public homepage now has a **Browse All Videos** popup. It supports the official YouTube channel's complete uploads playlist (browse inside the embedded playlist), individual video clips, and individual YouTube embeds that can be recovered from the old WordPress videos page. Newly added individual clips in the admin show up in the vault.

The **Full Show History** popup supports text search and year filtering. It displays the verified past performances stored in `recentShows` alongside archived WordPress announcements, which are labeled using their **publication date** rather than pretending it is the performance date.

The original WordPress blog has more than twenty archive pages going back to at least 2020. On the first admin dashboard load without imported archive entries, the dashboard automatically calls `POST /api/admin/import`; admins can also use **Import / update history** to retry. The server tries the WordPress REST API, then the site's RSS pagination, then public blog archive HTML. It stores de-duplicated post titles, published dates, excerpts, and source URLs in the Cloudflare Durable Object. Existing admin changes are preserved.

On first deployment of this version, `public/content.json` seeds the **confirmed upcoming October 24, 2026 Wild Willy's show** and 47 verified past-show records. The Durable Object applies this versioned seed merge once without replacing editor-created entries.

**Verification required:** The WordPress importer executes at runtime and has not been confirmed live from this chat. After deploying, visit the admin and confirm that the history import reports a nonzero archive count. If it fails, use the retry button; preserving the WordPress backup/export is recommended before changing the live domain. The full uploaded YouTube list comes from the channel's playlist, and the importer may recover more individual embeds if they exist in the legacy page HTML.

## October 22 — Restored individual YouTube clips and latest-video feature

The legacy WordPress `/videos/` page exposes eight individual YouTube embeds. Their verified video IDs and titles are now stored in `public/content.json` alongside the original full channel uploads playlist.

The Video Vault displays those eight clips as separately selectable, searchable items; the complete YouTube uploads playlist remains available as an additional choice. The right side of the homepage Video Vault teaser now embeds the first individual video rather than showing a text-only archive card. At migration time that is **This Is How We Do It**, listed first on the WordPress Videos page. This is the latest featured clip in the WordPress ordering, not a claim of newest YouTube upload by timestamp.

A versioned Durable Object seed merge (`video-import-20261022-v3`) imports the clips into live Cloudflare storage once without overwriting pre-existing editor-created entries. Admin-created videos added afterward appear first in the video gallery and homepage featured player. The migration marker is retained after subsequent admin saves, so deliberate deletions are not reversed.

After deployment, refresh the homepage and open the Video Vault. Expect eight individually browsable legacy clips plus the complete uploads playlist. If an older Worker version is cached, check the latest deployed GitHub commit and refresh. The original WordPress domain remains unchanged.

## Event Details popup (Oct 22, 2026)

Upcoming events now display a **DETAILS** button that opens a first-party styled popup, not a link back to WordPress. The October 24 Wild Willy's show has migrated show facts (date, time, location, no cover), a polished description based on the original post, and its original WordPress image URL. The original source URL is retained as internal migration provenance (`sourceUrl`) but is not used as a public event link or ticket link.

Editors can publish `description`, `image`, `admission`, and `ticketUrl` for future shows in the protected admin dashboard. The event modal renders sanitized text and HTTPS image URLs. For the migrated event, `details.paragraphs` retains the long-form post story in addition to the editable summary.

### Preserving the original event artwork

The first time the event popup loads the migrated photo, the public Worker route `/event-media/wild-willys-2026-10-24` attempts to fetch the image from the still-live WordPress origin and store binary chunks inside the Cloudflare Durable Object. Subsequent requests use the stored copy (response header `x-i90s-photo-cache: stored`). If the cache request fails while WordPress remains live, the popup falls back to the original image URL; however, **a successful cache fetch must be verified before moving the production domain**, otherwise the original image may not survive retirement of WordPress.

To verify preservation: on the preview Worker domain, load `/event-media/wild-willys-2026-10-24` and confirm it displays an image, then check the response header `x-i90s-photo-cache: stored` on a subsequent request. Keep WordPress available until the image has been copied successfully.

This revision uses the one-time seed tag `event-details-20261022-v4` to add the detailed event data to an already-populated Cloudflare content store without deleting editor-created content or videos.
