#!/usr/bin/env node
/**
 * Builds the modular web/ sources + offline vendor assets (Tailwind CSS + PDF.js)
 * + latest APPS_SCRIPT_AppSync.gs code into android/app/src/main/assets/app/.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const WEB_DIR = path.join(ROOT, "web");
const OUT_DIR = path.join(ROOT, "android", "app", "src", "main", "assets", "app");
const APPS_SCRIPT_PATH = path.join(ROOT, "APPS_SCRIPT_AppSync.gs");

function escapeHtmlText(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirFiles(srcDir, destDir, filterFn) {
  ensureDir(destDir);
  for (const name of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, name);
    const stat = fs.statSync(src);
    if (!stat.isFile()) continue;
    if (filterFn && !filterFn(name)) continue;
    fs.copyFileSync(src, path.join(destDir, name));
  }
}

function main() {
  const indexTplPath = path.join(WEB_DIR, "index.html");
  if (!fs.existsSync(indexTplPath)) throw new Error("Missing web/index.html");
  if (!fs.existsSync(APPS_SCRIPT_PATH)) throw new Error("Missing APPS_SCRIPT_AppSync.gs");

  const appsScriptRaw = fs.readFileSync(APPS_SCRIPT_PATH, "utf8");
  const indexTpl = fs.readFileSync(indexTplPath, "utf8");
  const placeholder = "<!-- __APPS_SCRIPT_CODE_BLOCK__ -->";
  if (!indexTpl.includes(placeholder)) {
    throw new Error("Placeholder " + placeholder + " not found in web/index.html");
  }

  const builtHtml = indexTpl.replace(placeholder, escapeHtmlText(appsScriptRaw));
  if (builtHtml.includes(placeholder)) {
    throw new Error("Failed to replace Apps Script placeholder");
  }

  ensureDir(OUT_DIR);
  ensureDir(path.join(OUT_DIR, "css"));
  ensureDir(path.join(OUT_DIR, "js"));
  ensureDir(path.join(OUT_DIR, "vendor"));

  fs.writeFileSync(path.join(OUT_DIR, "index.html"), builtHtml, "utf8");

  // Copy redirect stubs
  for (const stub of ["fee_management.html", "gst_client_tracker.html", "gst_json_generator.html", "gst_portal.html", "master_etsy_editor.html"]) {
    const src = path.join(WEB_DIR, stub);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT_DIR, stub));
  }

  // Copy modular CSS & JS
  copyDirFiles(path.join(WEB_DIR, "css"), path.join(OUT_DIR, "css"), name => name !== "tailwind-input.css");
  copyDirFiles(path.join(WEB_DIR, "js"), path.join(OUT_DIR, "js"), name => name.endsWith(".js"));

  // Bundle offline PDF.js from node_modules
  const pdfBuildDir = path.dirname(require.resolve("pdfjs-dist/build/pdf.min.js", { paths: [ROOT] }));
  fs.copyFileSync(path.join(pdfBuildDir, "pdf.min.js"), path.join(OUT_DIR, "vendor", "pdf.min.js"));
  fs.copyFileSync(path.join(pdfBuildDir, "pdf.worker.min.js"), path.join(OUT_DIR, "vendor", "pdf.worker.min.js"));

  // Compile offline Tailwind CSS across web/index.html and web/js/*.js
  const twCli = require.resolve("tailwindcss/lib/cli.js", { paths: [ROOT] });
  execFileSync(process.execPath, [
    twCli,
    "-c", path.join(WEB_DIR, "tailwind.config.js"),
    "-i", path.join(WEB_DIR, "css", "tailwind-input.css"),
    "-o", path.join(OUT_DIR, "vendor", "tailwind.min.css"),
    "--minify"
  ], { cwd: ROOT, stdio: "inherit" });

  // Sanity assertions on build output
  const forbiddenCdn = /cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com/i;
  if (forbiddenCdn.test(builtHtml)) {
    throw new Error("Built index.html still contains external CDN URL!");
  }
  const requiredOutputs = [
    "index.html",
    "css/design-system.css",
    "vendor/tailwind.min.css",
    "vendor/pdf.min.js",
    "vendor/pdf.worker.min.js",
    "js/jna-pdf.js",
    "js/initial-data.js",
    "js/tracker-and-sync.js",
    "js/etsy-parser.js",
    "js/fee-module.js",
    "js/json-generator.js",
    "js/master-etsy.js",
    "js/ui-helpers.js",
    "js/gstr2b-parser.js",
    "js/portal-module.js"
  ];
  for (const rel of requiredOutputs) {
    const full = path.join(OUT_DIR, rel);
    if (!fs.existsSync(full) || fs.statSync(full).size === 0) {
      throw new Error("Missing or empty build artifact: " + rel);
    }
  }
  console.log("Built web assets cleanly -> " + path.relative(ROOT, OUT_DIR));
}

if (require.main === module) {
  main();
}

module.exports = { main, escapeHtmlText };
