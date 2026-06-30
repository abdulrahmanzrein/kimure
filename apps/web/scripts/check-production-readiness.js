const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const publicRoot = path.join(root, "public");
const htmlFiles = fs
  .readdirSync(publicRoot)
  .filter((file) => file.endsWith(".html"))
  .map((file) => path.join(publicRoot, file));
const jsFiles = fs
  .readdirSync(path.join(publicRoot, "assets/js"))
  .filter((file) => file.endsWith(".js"))
  .map((file) => path.join(publicRoot, "assets/js", file));

const html = htmlFiles.map(read).join("\n");
const js = jsFiles.map(read).join("\n");
const publicText = html + "\n" + js;
const homeHtml = read(path.join(publicRoot, "index.html"));

[
  "You're signed in (demo).",
  "Marketplace Category Preview",
  "Preview card",
  "Sample fit",
  "Sample ROI view",
  "sample UI content",
  "gateway mock mode",
  "fake sandbox identity",
  "Mortgage Pre-Approval",
  "pre-qualification",
  "Préapprobation hypothécaire",
  "Application mobile — bientôt",
  "$860K",
  "$1.42M",
  "$320K",
  "View Details",
  "partner-slot"
].forEach((forbidden) => {
  assert.equal(publicText.includes(forbidden), false, `${forbidden} should not appear in public UI text`);
});

[
  "dashboard.html",
  "credit-profile.html",
  "mortgage.html",
  "marketplace.html",
  "onboarding-form.html",
  "js-auth-dashboard",
  "js-auth-credit",
  "js-auth-mortgage",
  "js-auth-sign-out"
].forEach((required) => {
  assert.equal(publicText.includes(required), true, `${required} is missing from connected app navigation/CTA surface`);
});

assert.equal(html.includes("Repliers provider integration"), true);
assert.equal(html.includes("not live MLS data"), true);
assert.equal(homeHtml.includes("Provider-backed marketplace search"), true);
assert.equal(homeHtml.includes("AI property matching"), true);
assert.equal(homeHtml.includes("Mortgage/readiness calculator"), true);
assert.equal(homeHtml.includes("Credit readiness / financial profile"), true);
assert.equal(homeHtml.includes('href="marketplace.html"'), true);
assert.equal(homeHtml.includes('href="dashboard.html"'), true);
assert.equal(homeHtml.includes('href="onboarding-form.html"'), true);
assert.equal(homeHtml.includes("provider-backed listing workflows"), true);
assert.equal(homeHtml.includes("partner-pill"), true);
assert.equal(html.includes("Sandbox only"), true);
assert.equal(html.includes("not production"), true);
assert.equal(publicText.includes("Estimate only. Not financial, mortgage, legal, tax, or approval advice."), true);

[
  "GEMINI_API_KEY",
  "REPLIERS_API_KEY",
  "EQUIFAX_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "sourceResponse",
  "contentBase64",
  "rawProviderPayload",
  "rawModelPayload",
  "assessment_id_hash",
  "credit_mortgage_handoff"
].forEach((forbidden) => {
  assert.equal(publicText.includes(forbidden), false, `${forbidden} must not appear in public web files`);
});

console.log("Production readiness web check passed.");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}
