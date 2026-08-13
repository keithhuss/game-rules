#!/usr/bin/env node
/**
 * Render every built game page to a print-ready PDF beside it.
 *
 *   _site/games/english-billiards/index.html  ->  _site/games/english-billiards.pdf
 *
 * Uses headless Chrome, which honours the @media print block in style.css —
 * so the PDF and what the browser prints stay in step by construction.
 *
 * The pages are served over a temporary localhost server rather than opened
 * as file:// URLs: the built HTML links assets by absolute path, which over
 * file:// resolves to the filesystem root and silently yields an unstyled
 * PDF. Serving them mirrors production exactly, pathPrefix included.
 *
 * Run after `eleventy`; see `npm run all`.
 */

import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { promisify } from "node:util";

// Must be the async form: the static server below runs in this same process,
// so a *Sync spawn would block the event loop and Chrome's requests would
// never be answered.
const run = promisify(execFile);

const SITE = resolve("_site");
const GAMES = join(SITE, "games");

// "/game-rules/" -> "/game-rules";  "/" -> ""
const PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/+$/, "");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));

if (!chrome) {
  console.error(
    "No Chrome/Chromium found. Set CHROME_PATH, or install Chrome to skip this step.\nLooked in:\n  " +
      CHROME_CANDIDATES.join("\n  ")
  );
  process.exit(1);
}

if (!existsSync(GAMES)) {
  console.error(`No ${GAMES} directory — run \`npm run build\` first.`);
  process.exit(1);
}

const slugs = readdirSync(GAMES).filter(
  (name) =>
    statSync(join(GAMES, name)).isDirectory() &&
    existsSync(join(GAMES, name, "index.html"))
);

if (slugs.length === 0) {
  console.error(`No built game pages found in ${GAMES}.`);
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

// Tracks what each render actually loaded, so a page that renders with no
// stylesheet fails the build instead of quietly producing an unstyled PDF.
let servedCss = 0;
let missed = [];

const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (PREFIX && path.startsWith(PREFIX)) path = path.slice(PREFIX.length);
  if (path.endsWith("/")) path += "index.html";

  // normalize() collapses any ../ before we join, so requests stay in _site
  const file = join(SITE, normalize(path));
  if (!file.startsWith(SITE) || !existsSync(file) || statSync(file).isDirectory()) {
    if (!path.endsWith("favicon.ico")) missed.push(req.url);
    res.writeHead(404).end("not found");
    return;
  }

  if (extname(file) === ".css") servedCss++;
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});

await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const { port } = server.address();

let failed = 0;

for (const slug of slugs) {
  const out = join(GAMES, `${slug}.pdf`);
  const url = `http://127.0.0.1:${port}${PREFIX}/games/${slug}/`;

  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--virtual-time-budget=5000",
    `--print-to-pdf=${out}`,
    url,
  ];

  // GitHub's runners need the sandbox disabled.
  if (process.env.CI) args.unshift("--no-sandbox");

  servedCss = 0;
  missed = [];

  try {
    await run(chrome, args, { maxBuffer: 16 * 1024 * 1024 });
    if (!existsSync(out)) throw new Error("Chrome exited cleanly but wrote no file");
    if (servedCss === 0) {
      throw new Error(
        `page loaded no stylesheet — the PDF would be unstyled.\n` +
          `    PATH_PREFIX is ${JSON.stringify(process.env.PATH_PREFIX || "(unset)")}; ` +
          `it must match the value used for the build.\n` +
          (missed.length ? `    404s: ${missed.slice(0, 5).join(", ")}` : "")
      );
    }
    console.log(`  ${slug}.pdf`);
  } catch (err) {
    failed++;
    console.error(`  FAILED ${slug}: ${err.message}`);
  }
}

server.close();
console.log(`\n${slugs.length - failed}/${slugs.length} PDFs written to _site/games/`);
process.exit(failed > 0 ? 1 : 0);
