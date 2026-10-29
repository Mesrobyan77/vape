import { chromium } from "@playwright/test";

const url = process.env.HYDRATION_URL || "http://localhost:3111/hy";

// Mimic what ColorZilla does: stamp an attribute on <body> before React hydrates.
const EXT_ATTR = "cz-shortcut-listen";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript((attr) => {
  const stamp = () => {
    if (document.body && !document.body.hasAttribute(attr)) document.body.setAttribute(attr, "true");
  };
  stamp();
  new MutationObserver(stamp).observe(document, { childList: true, subtree: true });
}, EXT_ATTR);

const consoleErrors = [];
const hydrationErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") consoleErrors.push(msg.text().slice(0, 200));
  const text = `${msg.text()} ${msg.location()?.url ?? ""}`;
  if (/hydrat/i.test(text)) hydrationErrors.push(`${msg.type()}: ${msg.text().slice(0, 240)}`);
});
page.on("pageerror", (err) => {
  if (/hydrat/i.test(String(err))) hydrationErrors.push(`pageerror: ${String(err).slice(0, 240)}`);
});

await page.goto(url, { waitUntil: "load", timeout: 120000 });
await page.waitForTimeout(6000);

const attrSurvived = await page.evaluate((attr) => document.body.hasAttribute(attr), EXT_ATTR);
console.log(`URL: ${url}`);
console.log(`extension attribute present on <body>: ${attrSurvived}`);
console.log(`console error/warning lines: ${consoleErrors.length}`);
console.log(`hydration-related console lines: ${hydrationErrors.length}`);
for (const line of hydrationErrors) console.log(`  ${line}`);

await browser.close();
process.exit(hydrationErrors.length > 0 ? 1 : 0);
