#!/usr/bin/env node
/**
 * Build the site and package it for the GameRules iOS app.
 *
 * Produces content.zip at the repo root — the same payload the deploy
 * workflow serves for over-the-air updates (see .github/workflows/deploy.yml)
 * — and copies it into the Xcode project as Content.zip, the bundled
 * baseline for a cold install with no connectivity.
 *
 * The app ships this as a single zip resource rather than a folder
 * reference: adding files through the Xcode MCP tooling flattens nested
 * resource paths (proved by a throwaway test build on 2026-08-16), so a
 * multi-file _site copy would silently lose its directory structure the
 * same way absolute asset paths do over file://. A single zip file has
 * nothing to flatten, and the app unpacks it with the same unzip code path
 * used for OTA updates. See GameRules/CLAUDE.md.
 *
 * Reuses `npm run check`, so broken content can't ship in the app any more
 * than it can ship to the web. Run manually whenever the app needs a fresh
 * bundled baseline, then rebuild the app in Xcode.
 */

import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(".");
const SITE = join(ROOT, "_site");
const CONTENT_ZIP = join(ROOT, "content.zip");
const IOS_PROJECT_DIR = resolve(ROOT, "../Xcode/GameRules/GameRules/GameRules");

function run(cmd, args, options = {}) {
  execFileSync(cmd, args, { stdio: "inherit", ...options });
}

console.log("Building site...");
run("npm", ["run", "build"]);
run("npm", ["run", "check"]);
run("npm", ["run", "pdfs"]);

console.log("Writing manifest.json...");
const version = execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
const date = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
writeFileSync(join(SITE, "manifest.json"), JSON.stringify({ version, date }));

console.log("Zipping content.zip...");
if (existsSync(CONTENT_ZIP)) rmSync(CONTENT_ZIP);
run("zip", ["-r", "-X", CONTENT_ZIP, "."], { cwd: SITE });

if (!existsSync(IOS_PROJECT_DIR)) {
  console.warn(`iOS project not found at ${IOS_PROJECT_DIR} — leaving content.zip at the repo root.`);
  process.exit(0);
}

console.log("Copying Content.zip into the Xcode project...");
run("cp", [CONTENT_ZIP, join(IOS_PROJECT_DIR, "Content.zip")]);

console.log("Done. Rebuild GameRules in Xcode to pick up the new bundled content.");
