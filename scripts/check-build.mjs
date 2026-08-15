#!/usr/bin/env node
/**
 * Validate the built site before it ships.
 *
 * Exists because of a real bug that reached production: a blank line inside an
 * inline <svg> in a Markdown file ends the HTML block, so markdown-it resumes
 * Markdown parsing and wraps the rest in <p> tags — *inside* the SVG. The HTML
 * parser then bails out of foreign content and the browser drops every shape
 * after that point, leaving the labels as loose text on the page. It is silent:
 * the build succeeds and the SVG is still present in the source.
 *
 * Run after `eleventy`; see `npm run check`.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SITE = resolve("_site");
const GAMES = join(SITE, "games");

if (!existsSync(GAMES)) {
  console.error(`No ${GAMES} — run \`npm run build\` first.`);
  process.exit(1);
}

const failures = [];
const note = (page, msg) => failures.push(`${page}: ${msg}`);

const slugs = readdirSync(GAMES).filter(
  (n) => statSync(join(GAMES, n)).isDirectory() && existsSync(join(GAMES, n, "index.html"))
);

if (slugs.length === 0) {
  console.error("No built game pages found.");
  process.exit(1);
}

for (const slug of slugs) {
  const html = readFileSync(join(GAMES, slug, "index.html"), "utf8");
  const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) || [];

  for (const svg of svgs) {
    // The bug this script exists for.
    const strays = (svg.match(/<\/?p>/g) || []).length;
    if (strays) {
      note(slug, `${strays} stray <p> tag(s) inside an <svg> — a blank line in the SVG source ends the Markdown HTML block`);
    }
    // A diagram that lost its shapes is broken even without a stray <p>.
    const shapes = (svg.match(/<(circle|rect|path|line|polygon)\b/g) || []).length;
    if (shapes === 0) note(slug, "an <svg> contains no shapes");
  }

  if (!html.includes("assets/style.css")) note(slug, "no stylesheet link");
  if (!/<h1[\s>]/.test(html)) note(slug, "no <h1>");
}

// Every game should be reachable from the index.
const index = readFileSync(join(SITE, "index.html"), "utf8");
for (const slug of slugs) {
  if (!index.includes(`games/${slug}/`)) note(slug, "not linked from the index page");
}

console.log(`Checked ${slugs.length} pages.`);

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

console.log("All checks passed.");
