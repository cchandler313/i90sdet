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
