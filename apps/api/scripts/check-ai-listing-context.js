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
const {
  getMockToolResponse
} = require("../../ai-gateway/src/services/mockAiService");

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
  metadata: {
    listingProvider: "mock_provider"
  },
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
assert.equal(query.provider, undefined);

const listings = new ListingsService(
  new ListingsProviderRegistry(new MockListingsProvider(), new CreaDdfPendingProvider())
).search(query);
const context = buildSafeListingContext(listings, query);
const serialized = JSON.stringify(context);

assert.equal(context.source, "mock_provider");
assert.equal(context.providerStatus, "mock_only");
assert.equal(context.blockedReason, null);
assert.equal(context.isLiveProviderData, false);
assert.equal(context.resultCount, context.results.length);
assert.equal(context.providerGuidance.dataMode, "mock_sample_preview");
assert.equal(context.providerGuidance.instruction.includes("mock/sample"), true);
assert.equal(context.providerGuidance.instruction.includes("Do not describe it as live CREA"), true);
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

const pendingQuery = buildListingContextQuery({
  metadata: { listingProvider: "crea_ddf" },
  filters: { location: "Vancouver" }
});

assert.equal(pendingQuery.provider, "crea_ddf");
assert.equal(pendingContext.source, "crea_ddf_pending_access");
assert.equal(pendingContext.providerStatus, "pending_access");
assert.equal(pendingContext.blockedReason, "crea_ddf_access_not_configured");
assert.equal(pendingContext.isLiveProviderData, false);
assert.equal(pendingContext.resultCount, 0);
assert.equal(pendingContext.results.length, 0);
assert.equal(pendingContext.providerGuidance.dataMode, "pending_access_no_live_listings");
assert.equal(pendingContext.providerGuidance.instruction.includes("Do not invent live CREA/DDF listings"), true);
assert.equal(pendingContext.providerGuidance.instruction.includes("MLS IDs"), true);
assert.equal(pendingSerialized.includes("crea_ddf_access_not_configured"), true);
assert.equal(pendingSerialized.includes("sourceResponse"), false);
assert.equal(pendingSerialized.includes("contentBase64"), false);
assert.equal(pendingSerialized.includes("token"), false);
assert.equal(pendingSerialized.includes("secret"), false);
assert.equal(pendingSerialized.includes("https://www.realtor.ca"), false);

const pendingMockResponse = getMockToolResponse("scout", {
  question: "Find real live MLS/CREA listings in Vancouver.",
  listingContext: pendingContext
});
const pendingMockSerialized = JSON.stringify(pendingMockResponse);

assert.equal(pendingMockResponse.summary.includes("CREA DDF access is pending"), true);
assert.equal(
  pendingMockResponse.keyInsights.some((item) =>
    item.includes("no live CREA, MLS, IDX, or REALTOR.ca listing data")
  ),
  true
);
assert.equal(
  pendingMockResponse.recommendations.some((item) =>
    item.includes("until CREA DDF access")
  ),
  true
);
assert.equal(/MLS[-\s]?\d{4,}/i.test(pendingMockSerialized), false);
assert.equal(pendingMockSerialized.includes("sourceResponse"), false);
assert.equal(pendingMockSerialized.includes("contentBase64"), false);
assert.equal(pendingMockSerialized.includes("https://www.realtor.ca"), false);

const mockProviderResponse = getMockToolResponse("scout", {
  listingContext: context
});

assert.equal(mockProviderResponse.summary.includes("sample/provider-ready preview data"), true);
assert.equal(JSON.stringify(mockProviderResponse).includes("live CREA listings are connected"), false);

console.log("AI listing context check passed.");
