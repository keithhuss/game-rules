# iOS app — design and handoff

Agreed 2026-08-15. Written so a session with no memory of that conversation can
pick this up. Read this **and** the repo's `CLAUDE.md` before starting.

## Why the app exists

One location where these sheets get used has very poor mobile service. The
website is useless there. The app must work with **no connectivity at all**,
from a cold install onward.

## Shape

A SwiftUI app wrapping a `WKWebView` that serves the already-built site out of
the app. Not a native re-implementation — the site is already responsive,
theme-aware, self-contained, and carries eleven inline SVG diagrams that SwiftUI
cannot render without redrawing every one of them as a `Path` or PDF asset.

- **Project:** `~/Code/Xcode/GameRules`, bundle id `Kendall.GameRules`
- **Content source:** this repo. It stays the single source of truth; the app
  never holds its own copy of the rules.

## The one real obstacle: absolute asset paths

The built HTML links assets by absolute path (`/assets/style.css`). Loaded from
a `file://` URL those resolve against the **filesystem root**, not the bundle,
and every page renders unstyled. This is the same failure that produced a
4-page unstyled PDF from `scripts/build-pdfs.mjs` before it was switched to
serving over HTTP — see `CLAUDE.md`.

**Solution: a `WKURLSchemeHandler` on a custom scheme.** Load
`gamerules://local/index.html`; absolute paths then resolve against that scheme
and the handler maps them into the content directory. No embedded HTTP server,
no rewriting the site, offline by construction.

Do **not** try to fix this by building with a relative `PATH_PREFIX` — Eleventy's
`url` filter emits absolute paths and the diagrams and stylesheet all depend on
them resolving from a single root.

## Content delivery: two layers

Bundling alone would mean an App Store submission for every rules correction.
This repo's history shows how often those land — the eight-ball break exception,
snooker's first-contact rule, the spotting locations. That is not viable.

**1. Bundled baseline.** A copy of `_site` ships inside the app. A fresh install
with no signal works immediately. This is the floor.

**2. Over-the-air content updates.** Served from the same GitHub Pages site, so
there is no new infrastructure:

- The deploy workflow emits `manifest.json` at the site root — at minimum a
  `version` (use the git SHA the build came from) and a human-readable date.
- The workflow also emits `content.zip` containing the whole `_site` payload.
- The app fetches `manifest.json` when it has connectivity, compares against the
  version it has, and if newer downloads `content.zip`, unpacks to a staging
  directory, validates it (`index.html` present and non-empty at minimum), then
  atomically swaps it into Application Support.
- The scheme handler serves from the downloaded copy when one is valid, and
  falls back to the bundled copy otherwise. A corrupt or half-written download
  must never brick the app.

Check on launch, at most hourly, silently. Add a manual "Check for updates" in
settings for when a change is known to have just landed.

**Show the content date in the app** ("Rules updated 14 August 2026"). Silent
staleness is this pattern's failure mode.

**Keep OTA content strictly data.** The pages have essentially no JavaScript and
it must stay that way — shipping executable code over the air is the part of
this pattern Apple cares about, and there is no reason to go near it.

## Also agreed

- **Ship the PDFs too**, in the bundle and in `content.zip`. They roughly double
  the payload and the whole thing is still comfortably under 2 MB. Being able to
  print or AirDrop a sheet with no signal is the point of the app.
- **The print button needs replacing.** `window.print()` does nothing useful in
  a web view. In the app it becomes a native share sheet offering that game's
  PDF. Either hide the web button via injected CSS and use a toolbar item, or
  intercept the navigation.
- Dark and light already follow the system via `prefers-color-scheme`; nothing
  to do.

## Work on this repo's side

- Emit `manifest.json` and `content.zip` in `.github/workflows/deploy.yml`.
- An export script that builds the site and copies `_site` into the Xcode
  project as a **folder reference** (blue folder), so the directory structure
  survives into the bundle. Run it whenever the app is built for release.
- Both should reuse the existing `npm run check`, so broken content cannot be
  exported into the app any more than it can be deployed to the web.

## Toolchain note

As of 2026-08-15 `xcode-select` points at `/Applications/Xcode-beta.app`
(Xcode 27.0, Swift 6.4) and command-line builds work. The older note in the
RestaurantsPi project about `xcode-select` pointing at CommandLineTools is
stale.
