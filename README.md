# Game Rules

Printable rules sheets for classic games. Each game is one page that summarises
the whole game — scoring, fouls, terminology — and prints cleanly on a single
sheet of US Letter, with a matching PDF generated automatically.

Built with [Eleventy](https://www.11ty.dev/) and published to GitHub Pages.

## Local development

```bash
npm install
npm start          # live preview at http://localhost:8080
```

Other scripts:

```bash
npm run build      # build the site into _site/
npm run pdfs       # render a PDF for each game (needs Chrome installed)
npm run all        # build, then render PDFs
```

`npm run pdfs` drives headless Chrome, so it honours the same `@media print`
rules the browser uses — the PDF and what you get from ⌘P cannot drift apart.
It finds Chrome automatically on macOS and Linux; set `CHROME_PATH` to override.

## Adding a game

Create `src/games/<slug>.md`. The front matter carries the page furniture and
the glossary; the body is ordinary Markdown.

```yaml
---
layout: game.njk
title: Cribbage
eyebrow: Two players · 121 points · Pegging board
blurb: One-line summary, shown on the index page.
standfirst: >-
  A sentence or two introducing the game, shown under the title.
footnote: Optional. Overrides the site-wide footer note.
glossary:
  - term: Nob
    definition: The jack of the same suit as the starter card. Worth 1.
---
```

Conventions inside the body:

| You write | You get |
| --- | --- |
| `## Heading` | A numbered rule. Numbers come from a CSS counter, so inserting a rule renumbers the rest by itself — never type them. |
| `### Heading` | An unnumbered sub-label inside a rule. |
| `> text` | The tinted callout box. |
| A Markdown table | Automatically wrapped so wide tables scroll instead of breaking the page. |
| `<span class="dot red">` | A small coloured token for table cells — `red`, `yel`, `wht`, `both`. |

Raw HTML is allowed, which is how the billiards table diagram is done: an
inline `<svg class="diagram">` inside a `<figure>`. Diagram parts use the
classes `.edge`, `.pocket`, `.marking` and `.spot` so they follow the theme
rather than hard-coding colours.

That's the whole system — no per-game CSS. If a game needs something the
shared stylesheet doesn't have, add it to `src/assets/style.css` so every
game gets it.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
site, renders the PDFs with the Chrome preinstalled on the runner, and
publishes to GitHub Pages.

The site is served from `/game-rules/`, set via `PATH_PREFIX` in the workflow.
**If you point a custom domain at it, change `PATH_PREFIX` to `/`** — templates
run every URL through Eleventy's `url` filter, so that one variable is the only
thing to update.

## Notes on the design

The stylesheet defines a light palette on `:root` and redefines the tokens for
dark twice — once behind `prefers-color-scheme` and once behind
`[data-theme="dark"]` — because a viewer on "system" has no attribute stamped
at all. Components only ever read tokens, never raw colours.

The print block sets the whole sheet as one continuous two-column stream with
the masthead spanning it. Doing it that way, rather than letting each block
balance separately, is what keeps a rules sheet to two pages instead of three.
The print palette uses `!important` because the dark-theme guard is a more
specific selector than a bare `:root`, and would otherwise win when printing
from a browser in dark mode.
