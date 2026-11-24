// Fails if the given scripts use browser APIs that the TV browsers in tv-browsers.txt lack
// (eslint-plugin-compat), or anything newer than ES5 syntax.
// Run from anywhere: node lint-tv-apis.mjs <files relative to the repo root>
import { ESLint } from "eslint";
import compat from "eslint-plugin-compat";
import globals from "globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const browsers = readFileSync(path.join(here, "tv-browsers.txt"), "utf8")
  .split("\n").map((s) => s.trim()).filter(Boolean);

const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [{
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 5, sourceType: "script", globals: { ...globals.browser } },
    plugins: { compat },
    settings: { browsers, polyfills: [] },
    rules: { "compat/compat": "error" },
  }],
});
const files = process.argv.slice(2);
const results = await eslint.lintFiles(files);
const formatter = await eslint.loadFormatter("stylish");
const errors = results.reduce((n, r) => n + r.errorCount, 0);
const linted = results.filter((r) => !r.messages.some((m) => /ignored/.test(m.message))).length;
if (linted !== files.length) {
  console.log(`Only ${linted} of ${files.length} file(s) were linted.`);
  process.exit(2);
}
if (errors) {
  console.log(formatter.format(results));
  process.exit(1);
}
console.log(`APIs and syntax OK in ${linted} file(s) for: ${browsers.join(", ")}`);
