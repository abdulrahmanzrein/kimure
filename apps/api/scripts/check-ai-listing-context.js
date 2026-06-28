const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildListingContextQuery,
  buildSafeListingContext
} = require("../src/ai/ai.controller");
const { ListingsService } = require("../src/listings/listings.service");
const { MockListingsProvider } = require("../src/listings/mock-listings.provider");

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

const listings = new ListingsService(new MockListingsProvider()).search(query);
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

console.log("AI listing context check passed.");
