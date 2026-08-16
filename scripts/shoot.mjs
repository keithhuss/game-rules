#!/usr/bin/env node
/**
 * Screenshot a built page, in either theme.
 *
 *   npm run shot -- one-pocket
 *   npm run shot -- one-pocket --theme light --height 2000
 *
 * Exists so checking a page never needs a backgrounded throwaway server. A
 * shell `&` defers execution past the approval-time safety checks and so always
 * prompts; this does the same job inside one foreground process that serves,
 * shoots and exits. It also mirrors build-pdfs.mjs: pages are served over HTTP
 * rather than opened as file:// URLs, because the built HTML links its assets
 * by absolute path and would otherwise render unstyled.
 *
 * Output goes to _shots/, which is gitignored.
 */

import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// Must be async: the server below runs in this same process, so a *Sync spawn
// would block the event loop and Chrome's requests would never be answered.
const run = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "_site");
const SHOTS = join(ROOT, "_shots");
const PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/+$/, "");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const slug = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1]?.startsWith("--") !== true);

if (!slug) {
  console.error("Usage: npm run shot -- <slug> [--theme dark|light] [--width N] [--height N]");
  process.exit(1);
}

const theme = flag("theme", "dark");
const width = Number(flag("width", 1100));
const height = Number(flag("height", 1600));

const page = slug === "index" ? join(SITE, "index.html") : join(SITE, "games", slug, "index.html");
if (!existsSync(page)) {
  console.error(`No built page for "${slug}" — run \`npm run build\` first.`);
  process.exit(1);
}

const CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean).find((p) => existsSync(p));

if (!CHROME) {
  console.error("No Chrome found. Set CHROME_PATH.");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let path = decodeURIComponent(url.pathname);
  if (PREFIX && path.startsWith(PREFIX)) path = path.slice(PREFIX.length);
  if (path.endsWith("/")) path += "index.html";

  const file = join(SITE, normalize(path));
  if (!file.startsWith(SITE) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }

  // Stamp the theme onto <html> so both palettes can be shot deterministically,
  // rather than depending on the OS appearance Chrome happens to inherit.
  if (extname(file) === ".html") {
    const html = readFileSync(file, "utf8").replace(/<html\b/, `<html data-theme="${theme}"`);
    res.writeHead(200, { "content-type": MIME[".html"] });
    res.end(html);
    return;
  }

  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});

await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const { port } = server.address();

mkdirSync(SHOTS, { recursive: true });
const out = join(SHOTS, `${slug}-${theme}.png`);
const url = slug === "index"
  ? `http://127.0.0.1:${port}${PREFIX}/`
  : `http://127.0.0.1:${port}${PREFIX}/games/${slug}/`;

const args = [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-color-profile=srgb",
  `--window-size=${width},${height}`,
  `--screenshot=${out}`,
  url,
];
if (process.env.CI) args.unshift("--no-sandbox");

try {
  await run(CHROME, args, { maxBuffer: 16 * 1024 * 1024 });
  if (!existsSync(out)) throw new Error("Chrome exited cleanly but wrote no file");
  console.log(out);
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  server.close();
  process.exit(1);
}

server.close();
