# Interstate 90's Detroit

Cloudflare Pages static site. No build system or WordPress needed.

## Deploy

Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → select `cchandler313/i90sdet` → `main` branch.

- Framework preset: None
- Build command: leave blank
- Build output directory: `/` (repository root)

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
