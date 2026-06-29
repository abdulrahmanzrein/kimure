const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildListingContextQuery,
  buildSafeListingContext
} = require("../src/ai/ai.controller");
const { ListingsService } = require("../src/listings/listings.service");
const { ListingsProviderRegistry } = require("../src/listings/listings-provider.registry");
const { MockListingsProvider } = require("../src/listings/mock-listings.provider");
const { CreaDdfPendingProvider } = require("../src/listings/crea-ddf-pending.provider");

const controllerPath = path.resolve(__dirname, "../src/ai/ai.controller.ts");
const controllerSource = fs.readFileSync(controllerPath, "utf8");

assert.equal(controllerSource.includes("ListingsService"), true);
assert.equal(controllerSource.includes("listingContext"), true);
assert.equal(controllerSource.includes("credit-profile"), true);
assert.equal(controllerSource.includes("mortgage"), true);
assert.equal(controllerSource.includes("isLiveProviderData: true"), false);

["scout", "rental", "analyze", "valuate", "investment-planner", "chat"].forEach(
  (tool) => {
    assert.equal(controllerSource.includes(`"${tool}"`), true);
  }
);

const query = buildListingContextQuery({
  question: "Find matching properties",
  filters: {
    location: "Ottawa",
    maxPrice: "$700,000",
    propertyType: "detached",
    bedrooms: "3",
    preferences: ["primary residence"]
  }
});

assert.equal(query.location, "Ottawa");
assert.equal(query.maxPrice, 700000);
assert.equal(query.type, "detached");
assert.equal(query.bedrooms, 3);
assert.equal(query.intent, "primary residence");

const listings = new ListingsService(
  new ListingsProviderRegistry(new MockListingsProvider(), new CreaDdfPendingProvider())
).search(query);
const context = buildSafeListingContext(listings, query);
const serialized = JSON.stringify(context);

assert.equal(context.source, "mock_provider");
assert.equal(context.providerStatus, "mock_only");
assert.equal(context.isLiveProviderData, false);
assert.equal(context.results.length > 0, true);

context.results.forEach((result) => {
  assert.equal(result.sourceProvider, "mock_provider");
  assert.equal(result.isLiveProviderData, false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "imageUrl"), false);
});

assert.equal(serialized.includes("sourceResponse"), false);
assert.equal(serialized.includes("contentBase64"), false);
assert.equal(serialized.includes("token"), false);
assert.equal(serialized.includes("secret"), false);
assert.equal(serialized.includes("apiKey"), false);
assert.equal(serialized.includes("Realtor.ca"), false);

const pendingListings = new ListingsService(
  new ListingsProviderRegistry(new MockListingsProvider(), new CreaDdfPendingProvider())
).search({
  provider: "crea_ddf",
  location: "Vancouver"
});
const pendingContext = buildSafeListingContext(pendingListings, {
  provider: "crea_ddf",
  location: "Vancouver"
});
const pendingSerialized = JSON.stringify(pendingContext);

assert.equal(pendingContext.source, "crea_ddf_pending_access");
assert.equal(pendingContext.providerStatus, "pending_access");
assert.equal(pendingContext.isLiveProviderData, false);
assert.equal(pendingContext.results.length, 0);
assert.equal(pendingSerialized.includes("crea_ddf_access_not_configured"), false);
assert.equal(pendingSerialized.includes("sourceResponse"), false);
assert.equal(pendingSerialized.includes("contentBase64"), false);
assert.equal(pendingSerialized.includes("token"), false);
assert.equal(pendingSerialized.includes("secret"), false);
assert.equal(pendingSerialized.includes("https://www.realtor.ca"), false);

console.log("AI listing context check passed.");
