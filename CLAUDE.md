# Game Rules — project context

Static site publishing printable rules sheets for classic games.
Eleventy → GitHub Pages, with a PDF rendered per game by headless Chrome.

**Repo:** `keithhuss/game-rules` (**public** — deliberately, so GitHub Pages and
Actions minutes are free on the Free plan; there are no secrets in this repo and
nothing should ever be added that assumes privacy)
**Live:** https://keithhuss.github.io/game-rules/
**Location:** `~/Code/game-rules`

## Why this isn't on the Pi

Considered and rejected 2026-08-13. The Pi runs inn-critical services —
doorbell and booking alerts through `notify.php`, the Roku channel, the guest
kiosk, Time Machine backups. A public content site is the one workload that
deliberately attracts strangers, and the inn's residential uplink and
unprotected power (UPS still uninstalled) make it a poor host for something
people bookmark. Keep this off the Pi.

## Layout

```
src/
  index.njk              index page, lists collections.games
  _data/site.json        site title, tagline, default footer note
  _includes/base.njk     html shell, site nav
  _includes/game.njk     masthead, PDF/print buttons, glossary, footer
  _includes/…            (add new layouts here)
  assets/style.css       the entire design system — one file, no per-game CSS
  games/<slug>.md        one file per game
scripts/build-pdfs.mjs   renders _site/games/<slug>.pdf
.github/workflows/deploy.yml
```

## Things that will bite

- **`build-pdfs.mjs` must stay async.** It runs a static server in the same
  Node process that spawns Chrome. An `execFileSync` there blocks the event
  loop, the server never answers, and Chrome times out. It uses promisified
  `execFile` for exactly this reason.
- **PDFs are rendered over HTTP, not `file://`.** The built HTML links assets
  by absolute path; over `file://` those resolve to the filesystem root and you
  silently get an unstyled 4-page PDF instead of a styled 2-page one.
- **Safari does not render the two-column print layout. Unresolved.**
  Chrome prints the intended two-column sheet; Safari prints single-column and
  longer. Removing `column-span: all` (moving the masthead outside the `.flow`
  multicol container, 2026-08-13) did **not** fix it — the current best guess
  is that WebKit doesn't apply CSS multicol inside a paginated context at all,
  which no restructuring would work around. The `.flow` structure was kept
  anyway as it's cleaner, but don't credit it with a fix that never happened.
  **The PDF is the canonical print artifact** — it's Chrome-rendered, so it's
  correct in two columns no matter which browser the visitor uses. Treat the
  page's own Print button as a convenience.
- **Check print changes in Safari, not just Chrome.** The PDF pipeline is
  Chrome-only, so a Chrome-clean layout proves nothing about what ⌘P gives.
  Both use the same fonts (Iowan Old Style / Avenir Next), so metrics match —
  it's the layout algorithms that diverge.
- **`PATH_PREFIX`** is `/game-rules/` in the workflow because it's a project
  page. Change to `/` if a custom domain is ever pointed at it.
- **Rule numbers are a CSS counter**, never typed. Don't number `##` headings.
- **Print palette uses `!important`.** The dark-theme guard
  (`:root:not([data-theme="light"])`) is more specific than a bare `:root`, so
  without it, printing from a dark-mode browser pulls the dark tokens.
- Node was installed via Homebrew on 2026-08-13 specifically for this project;
  it wasn't previously on this Mac.

## Adding a game

See README.md — front matter fields, the `##`/`###`/`>` conventions, and the
`.dot` and `.diagram` helper classes. No per-game CSS; extend `style.css` so
every sheet benefits.

## History

- **2026-08-13** — Project created. Built from an English billiards rules sheet
  originally written as a one-off HTML file in `~/Downloads`; the print layout
  (two-column US Letter, one continuous column stream) was worked out there
  first and became the shared stylesheet.
