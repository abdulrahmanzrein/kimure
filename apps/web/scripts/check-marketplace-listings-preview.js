const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/marketplace.html"), "utf8");
const js = fs.readFileSync(
  path.join(root, "public/assets/js/marketplace.js"),
  "utf8"
);
const css = fs.readFileSync(
  path.join(root, "public/assets/css/marketplace.css"),
  "utf8"
);
const listingsPreviewJs = sliceBetween(
  js,
  "function buildProviderListingsQuery",
  "async function getAccessToken"
);

[
  "marketplace-listings-preview",
  "mpProviderListingsForm",
  "mpProviderSelector",
  "Sample provider",
  "CREA DDF pending access",
  "CREA DDF access is prepared but pending approval/configuration",
  "No REALTOR.ca scraping or live CREA listing data is used in this preview"
].forEach((required) => {
  assert.equal(html.includes(required), true, `${required} is missing from marketplace.html`);
});

[
  'provider === "crea_ddf"',
  'params.set("provider", provider)',
  'response.providerStatus === "pending_access"',
  'response.source === "crea_ddf_pending_access"',
  "CREA DDF access is prepared but pending approval/configuration",
  "No live CREA/DDF listing data is being displayed yet",
  "formatBlockedReason",
  "Loading sample listings"
].forEach((required) => {
  assert.equal(js.includes(required), true, `${required} is missing from marketplace.js`);
});

assert.equal(css.includes(".mp-provider-status.is-pending"), true);
assert.equal(listingsPreviewJs.includes("innerHTML"), false, "listings preview code must not use innerHTML");
assert.equal(listingsPreviewJs.includes("textContent"), true, "listings preview code should render dynamic values with textContent");
assert.equal(js.includes("isLiveProviderData: true"), false);
assert.equal(html.includes("Live CREA listing data is used"), false);

[
  "CREA_DDF_CLIENT_ID",
  "CREA_DDF_CLIENT_SECRET",
  "CREA_DDF_ACCESS_TOKEN",
  "MLS_PASSWORD",
  "MLS_TOKEN",
  "Authorization",
  "Bearer ",
  "https://www.realtor.ca",
  "https://realtor.ca",
  "api.crea",
  "ddfapi"
].forEach((forbidden) => {
  assert.equal(html.includes(forbidden), false, `${forbidden} must not appear in marketplace.html`);
  assert.equal(listingsPreviewJs.includes(forbidden), false, `${forbidden} must not appear in listings preview JS`);
});

console.log("Marketplace listings preview checks passed.");

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `${start} was not found`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `${end} was not found after ${start}`);
  return source.slice(startIndex, endIndex);
}
