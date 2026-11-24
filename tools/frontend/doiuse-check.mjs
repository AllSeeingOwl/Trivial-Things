// Lists CSS features in the given files that the TV browsers in tv-browsers.txt don't support.
// doiuse reads each stylesheet statically, so it can't see fallbacks. The features below are
// used on purpose, each with a fallback or as a harmless extra; anything else it finds fails
// the check. test_tv_compat.py makes sure the fallbacks named here stay in place.
import postcss from "postcss";
import doiuse from "doiuse";
import { readFileSync } from "node:fs";

const ALLOWED = {
  "css-grid": "board grid has a flexbox fallback under @supports not (display: grid)",
  "flexbox-gap": "old engines get margins instead, under @supports not (inset: 0)",
  "css-math-functions": "clamp() type sizes only apply under @supports (width: clamp(...)); fixed sizes otherwise",
  "css-focus-visible": "only used as :focus:not(:focus-visible) after a plain :focus ring; old engines keep the ring",
  "css-not-sel-list": "false alarm: only simple :not(x) selectors are used",
  "css-overflow": "false alarm: only single-value overflow is used",
  "mdn-text-decoration-shorthand": "false alarm: only text-decoration: none is used",
  "css3-cursors": "cursor hints are ignored harmlessly where unsupported",
  "font-family-system-ui": "font stacks fall back to named fonts",
  "prefers-reduced-motion": "an extra for browsers that support it",
  "css-font-rendering-controls": "font-display is a loading hint; without it the font loads the browser's default way",
};

const browsers = readFileSync(new URL("./tv-browsers.txt", import.meta.url), "utf8")
  .split("\n").map((s) => s.trim()).filter(Boolean);
let problems = 0;
for (const file of process.argv.slice(2)) {
  const css = readFileSync(file, "utf8");
  await postcss([doiuse({
    browsers,
    ignore: Object.keys(ALLOWED),
    onFeatureUsage: (u) => {
      problems++;
      console.log(`${file}:${u.usage.source.start.line}: ${u.featureData.title} (${u.feature})`);
    },
  })]).process(css, { from: file });
}
if (problems) {
  console.log(`${problems} CSS feature use(s) that older smart-TV browsers don't support. Add a fallback, or if it's safe, add it to ALLOWED with the reason.`);
  process.exit(1);
}
console.log(`CSS OK for: ${browsers.join(", ")}`);
