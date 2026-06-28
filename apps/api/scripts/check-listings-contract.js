const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
  "src/listings/mock-listings.provider.ts"
];

requiredFiles.forEach((file) => {
  assert.equal(fs.existsSync(path.join(apiRoot, file)), true, `${file} should exist`);
});

const mockProvider = new MockListingsProvider();
const registry = new ListingsProviderRegistry(mockProvider);
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
assert.equal(mockProvider.source, "mock_provider");
assert.equal(mockProvider.providerStatus, "mock_only");

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

console.log("Listings contract check passed.");
