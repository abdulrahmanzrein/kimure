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
  "async function saveListing"
);

[
  "marketplace-listings-preview",
  "mpProviderListingsForm",
  "mpProviderSelector",
  '<select name="provider" id="mpProviderSelector">',
  "Sample provider",
  '<option value="repliers_preview">Repliers preview data</option>',
  "Repliers preview data",
  "Marketplace AI uses selected listing provider context when available",
  "preview data clearly labeled",
  "Repliers preview data is sample data for integration testing",
  "No live MLS data is displayed in preview mode",
  "No listings match those filters yet"
].forEach((required) => {
  assert.equal(html.includes(required), true, `${required} is missing from marketplace.html`);
});

[
  'provider === "crea_ddf"',
  'provider === "repliers_preview"',
  'params.set("provider", provider)',
  "isRepliersPreviewResponse",
  "REPLIERS PREVIEW",
  "SAMPLE DATA",
  "PROVIDER LISTING",
  "PROVIDER DATA",
  "VERIFIED SOURCE",
  "INTERNAL LISTING",
  "TEAM-CONTROLLED",
  "SAMPLE PROVIDER",
  "PREVIEW CARD",
  "getListingDisplayMode",
  "getListingBadgeLabels",
  "mp-provider-image",
  "mp-provider-photo",
  "appendNode(imageWrap, \"img\", \"mp-provider-photo\")",
  "mp-provider-image-placeholder",
  "Preview image",
  "image.addEventListener(\"error\"",
  "imageUrl",
  "imageAlt",
  "imageCount",
  "mp-provider-photo-count",
  "truncateText",
  "mp-provider-description",
  "Preview details",
  "mp-ai-context-note",
  "AI provider context:",
  "formatAiProviderContextLabel",
  "Repliers preview",
  "Repliers preview is not configured or returned no sample listings",
  "No live MLS listing data is being displayed",
  "getSelectedListingsProvider",
  'document.getElementById("mpProviderSelector")',
  "selectedListingProviderFields",
  "marketplaceAiMetadata",
  'listingProvider: provider || "mock_provider"',
  'provider: provider || "mock_provider"',
  "var listingProvider = getSelectedListingsProvider()",
  "provider: selectedProviderFields.provider",
  "listingProvider: selectedProviderFields.listingProvider",
  "provider: listingProvider || undefined",
  'response.providerStatus === "pending_access"',
  'response.source === "crea_ddf_pending_access"',
  "formatBlockedReason",
  "Loading listings"
].forEach((required) => {
  assert.equal(js.includes(required), true, `${required} is missing from marketplace.js`);
});

assert.equal(css.includes(".mp-provider-status.is-pending"), true);
assert.equal(css.includes(".mp-provider-image"), true);
assert.equal(css.includes("aspect-ratio: 16 / 10"), true);
assert.equal(css.includes(".mp-provider-photo"), true);
assert.equal(css.includes(".mp-provider-preview-cta"), true);
assert.equal(css.includes(".mp-ai-context-note"), true);
assert.equal(listingsPreviewJs.includes("innerHTML"), false, "listings preview code must not use innerHTML");
assert.equal(listingsPreviewJs.includes("textContent"), true, "listings preview code should render dynamic values with textContent");
assert.equal(listingsPreviewJs.includes("appendNode(body, \"p\", \"mp-provider-description\", truncateText"), true);
assert.equal(js.includes("isLiveProviderData: true"), false);
assert.equal(html.includes("crea_ddf"), false);
assert.equal(html.includes("CREA"), false);
assert.equal(html.includes("DDF"), false);
assert.equal(html.includes("REALTOR"), false);
assert.equal(html.includes("Live CREA listing data is used"), false);

[
  "CREA_DDF_CLIENT_ID",
  "CREA_DDF_CLIENT_SECRET",
  "CREA_DDF_ACCESS_TOKEN",
  "REPLIERS_API_KEY",
  "REPLIERS-API-KEY",
  "REPLIERS_API_BASE_URL",
  "MLS_PASSWORD",
  "MLS_TOKEN",
  "Authorization",
  "Bearer ",
  "https://www.realtor.ca",
  "https://realtor.ca",
  "https://api.repliers.io",
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
