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
- **The published PDFs are not in the site's typeface.** The runner has no Apple
  fonts, so CI renders them in Liberation Serif/Sans rather than Iowan Old Style
  and Avenir Next — different look, different metrics, so page counts differ
  from a local `npm run pdfs`. Non-Mac visitors get Georgia/Arial for the same
  reason. Open question, deferred 2026-08-14: the fix is self-hosting an
  open-licensed pair (Charter is already second in the stack and close in feel).
- **A numeric table column is opt-in**, marked right-aligned in Markdown
  (`| ---: |`). The CSS keys off that for tabular figures and `nowrap`. Don't
  reinstate "last column is numeric" — prose in a last column then can't wrap,
  and the table is forced wider than the measure.
- **Don't invert the black ball for dark mode.** It was briefly rendered near
  white so it wouldn't vanish; that made a row labelled "Black" show a white
  dot. It stays black in both themes and is kept legible by a ring on the dot
  and the stroke the diagram balls already carry. `--ball-black-ink` (the
  numeral on a black ball) is deliberately identical in both themes.
- **Permission allowlist lives in `.claude/settings.json`** and is committed.
  Two traps, both hit on 2026-08-14: a settings file created mid-session isn't
  loaded until Claude Code restarts in the directory; and a prefix rule cannot
  match a compound shell command, so `export …; cd … && npm run build | tail`
  prompts every time and offers no always-allow. Run plain single commands —
  `git -C <path> commit -m … -m …`, `npm --prefix <path> run build`.
  `/opt/homebrew/bin` is already on PATH; no export is needed.
- **Print palette uses `!important`.** The dark-theme guard
  (`:root:not([data-theme="light"])`) is more specific than a bare `:root`, so
  without it, printing from a dark-mode browser pulls the dark tokens.
- Node was installed via Homebrew on 2026-08-13 specifically for this project;
  it wasn't previously on this Mac.

## Adding a game

See README.md — front matter fields, the `##`/`###`/`>` conventions, and the
`.dot` and `.diagram` helper classes. No per-game CSS; extend `style.css` so
every sheet benefits.

Diagram vocabulary built up so far, all in `style.css`:

| Class | For |
| --- | --- |
| `.edge` `.pocket` `.marking` `.spot` `.sight` | Table outline, pockets, baulk/D lines, spots, rail diamonds |
| `.ball` | A ball: fill plus stroke |
| `.ball-solid` `.ball-eight` `.ball-yellow` … `.ball-black` | Fills; declared after `.ball` so they win on `class="ball ball-blue"` |
| `.ball-outline` | Re-stroking a ball over a stripe band. Needed because a CSS `fill` beats a `fill="none"` attribute, so a plain `.ball` paints over the band |
| `.ball-band` | A stripe, clipped to the ball with a `clipPath` |
| `.ball-pip` `.ball-number` | The pale disc and numeral a numbered ball carries |
| `.red-ball` | Packed reds, drawn small with no stroke |
| `.pocket-a` `.pocket-b` | Seven-ball's two sets of three pockets |
| `.diagram.compact` | Caps portrait diagrams, whose labels otherwise scale up and shout |

Table diagrams share a 560×280 viewBox (2:1 playing area, 4 units per inch) and
the same eighteen-sight path. Reuse those coordinates for a new table.

## Writing the rules themselves

Every accuracy problem found so far was the same shape: a rule stated as an
absolute in one section while another section quietly carved out an exception.
The individual sentence was defensible each time; the sheet was still wrong to
someone reading only the section they needed. Four examples, all corrected —
eight-ball's "pocketing the 8 before clearing your group" needed *except on the
break*; its 8-first foul read as though it only applied on an open table;
snooker's foul list never plainly said the cue ball must hit a ball **on**
first; snooker's rack said "as close as possible to the pink" without saying
which side. **The break is where most exceptions live — check it against every
absolute you write.**

Verify rather than infer. Seven-ball was researched instead of extrapolated from
nine-ball, which caught two errors that would otherwise have shipped: the pocket
restriction applies only to the 7, and an illegal 7 is an outright loss rather
than a respot. Where sources genuinely disagree — seven-ball has no governing
body — say so in a closing section instead of silently picking one.

## History

- **2026-08-13** — Project created. Built from an English billiards rules sheet
  originally written as a one-off HTML file in `~/Downloads`; the print layout
  (two-column US Letter, one continuous column stream) was worked out there
  first and became the shared stylesheet.
- **2026-08-14** — Four more sheets: eight-ball, nine-ball, snooker and
  seven-ball, all cue games. Grew the diagram vocabulary above (racks, snooker's
  six colours as theme tokens, rail sights on all three table diagrams).
  Numeric table columns became opt-in; the black ball stopped inverting in dark
  mode. Added the committed permission allowlist. Fonts in the published PDFs
  remain an open question.

  Next games are wide open — nothing in the system assumes cue sports. A
  card or board game would exercise the parts that are still cue-shaped: the
  `.dot`/ball classes and the 560×280 table viewBox. The sheet structure
  (front-matter glossary, `##` per rule, `>` callout, a closing variations
  table) carries over unchanged.
