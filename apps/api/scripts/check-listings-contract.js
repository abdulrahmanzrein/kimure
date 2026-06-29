const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CreaDdfPendingProvider,
  CREA_DDF_BLOCKED_REASON,
  CREA_DDF_PENDING_ACCESS_DISCLAIMER
} = require("../src/listings/crea-ddf-pending.provider");
const { MockListingsProvider, MOCK_LISTINGS } = require("../src/listings/mock-listings.provider");
const { ListingsProviderRegistry } = require("../src/listings/listings-provider.registry");
const {
  ListingsService,
  MOCK_LISTINGS_DISCLAIMER,
  parseNumber
} = require("../src/listings/listings.service");

const apiRoot = path.resolve(__dirname, "..");
const requiredFiles = [
  "src/listings/listings.controller.ts",
  "src/listings/listings.service.ts",
  "src/listings/listings.module.ts",
  "src/listings/listing.types.ts",
  "src/listings/listings-provider.interface.ts",
  "src/listings/listings-provider.registry.ts",
  "src/listings/crea-ddf-pending.provider.ts",
  "src/listings/mock-listings.provider.ts"
];

requiredFiles.forEach((file) => {
  assert.equal(fs.existsSync(path.join(apiRoot, file)), true, `${file} should exist`);
});

const mockProvider = new MockListingsProvider();
const creaProvider = new CreaDdfPendingProvider();
const registry = new ListingsProviderRegistry(mockProvider, creaProvider);
const service = new ListingsService(registry);
const response = service.search({
  location: "Ottawa",
  maxPrice: "$700,000",
  bedrooms: "3",
  intent: "primary"
});

assert.equal(response.source, "mock_provider");
assert.equal(response.providerStatus, "mock_only");
assert.equal(response.disclaimer, MOCK_LISTINGS_DISCLAIMER);
assert.equal(response.disclaimer.includes("mock/sample records"), true);
assert.equal(response.disclaimer.includes("licensed listing provider"), true);
assert.equal(response.results.length > 0, true);
assert.equal(parseNumber("$650,000"), 650000);
assert.equal(registry.getActiveProvider().source, "mock_provider");
assert.equal(registry.getActiveProvider().providerStatus, "mock_only");
assert.equal(registry.getProvider("crea_ddf").source, "crea_ddf_pending_access");
assert.equal(registry.getProvider("crea_ddf").providerStatus, "pending_access");
assert.equal(registry.getProvider("unknown").source, "mock_provider");
assert.equal(mockProvider.source, "mock_provider");
assert.equal(mockProvider.providerStatus, "mock_only");

const creaResponse = service.search({
  provider: "crea_ddf",
  location: "Toronto",
  maxPrice: "$900,000"
});

assert.equal(creaResponse.source, "crea_ddf_pending_access");
assert.equal(creaResponse.providerStatus, "pending_access");
assert.equal(creaResponse.blockedReason, CREA_DDF_BLOCKED_REASON);
assert.equal(creaResponse.disclaimer, CREA_DDF_PENDING_ACCESS_DISCLAIMER);
assert.equal(creaResponse.results.length, 0);
assert.equal(creaProvider.search({ location: "Ottawa" }).length, 0);
assert.equal(creaProvider.getReadiness({}).canAttemptProviderCall, false);
assert.equal(creaProvider.getReadiness({}).blockedReason, CREA_DDF_BLOCKED_REASON);
assert.equal(JSON.stringify(creaResponse).includes("isLiveProviderData\":true"), false);

const requiredResultFields = [
  "id",
  "title",
  "type",
  "price",
  "location",
  "addressSummary",
  "bedrooms",
  "bathrooms",
  "propertySize",
  "listingStatus",
  "imageUrl",
  "sourceProvider",
  "isLiveProviderData",
  "matchSignals"
];

MOCK_LISTINGS.forEach((listing) => {
  requiredResultFields.forEach((field) => {
    assert.equal(Object.prototype.hasOwnProperty.call(listing, field), true, `${field} is required`);
  });

  assert.equal(listing.sourceProvider, "mock_provider");
  assert.equal(listing.isLiveProviderData, false);
  assert.equal(Array.isArray(listing.matchSignals), true);
  assert.equal(String(listing.id).startsWith("mock-"), true);
  assert.equal(JSON.stringify(listing).includes("Realtor.ca"), false);
  assert.equal(JSON.stringify(listing).includes("CREA"), false);
  assert.equal(JSON.stringify(listing).includes("MLS"), false);
});

const creaSource = fs.readFileSync(
  path.join(apiRoot, "src/listings/crea-ddf-pending.provider.ts"),
  "utf8"
);
const allListingSource = requiredFiles
  .map((file) => fs.readFileSync(path.join(apiRoot, file), "utf8"))
  .join("\n");

assert.equal(creaSource.includes("fetch("), false);
assert.equal(creaSource.includes("axios"), false);
assert.equal(creaSource.includes("http.get"), false);
assert.equal(creaSource.includes("http.request"), false);
assert.equal(creaSource.includes("https.request"), false);
assert.equal(creaSource.includes("CREA_DDF_CLIENT_SECRET"), false);
assert.equal(creaSource.includes("CREA_DDF_ACCESS_TOKEN="), false);
assert.equal(creaSource.includes("REALTOR.ca"), true);
assert.equal(creaSource.includes("never scrapes REALTOR.ca"), true);
assert.equal(allListingSource.includes("https://www.realtor.ca"), false);
assert.equal(allListingSource.includes("https://realtor.ca"), false);
assert.equal(allListingSource.includes("isLiveProviderData: true"), false);

console.log("Listings contract check passed.");
