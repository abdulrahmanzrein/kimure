const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CreaDdfPendingProvider,
  CREA_DDF_BLOCKED_REASON,
  CREA_DDF_PENDING_ACCESS_DISCLAIMER
} = require("../src/listings/crea-ddf-pending.provider");
const { MockListingsProvider, MOCK_LISTINGS } = require("../src/listings/mock-listings.provider");
const {
  RepliersPreviewProvider,
  REPLIERS_PREVIEW_DISCLAIMER,
  buildRepliersSearchBody
} = require("../src/listings/repliers-preview.provider");
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
  "src/listings/repliers-preview.provider.ts",
  "src/listings/mock-listings.provider.ts"
];

function createService() {
  return new ListingsService(
    new ListingsProviderRegistry(
      new MockListingsProvider(),
      new CreaDdfPendingProvider(),
      new RepliersPreviewProvider()
    )
  );
}

async function run() {
  requiredFiles.forEach((file) => {
    assert.equal(fs.existsSync(path.join(apiRoot, file)), true, `${file} should exist`);
  });

  const mockProvider = new MockListingsProvider();
  const creaProvider = new CreaDdfPendingProvider();
  const repliersProvider = new RepliersPreviewProvider();
  const registry = new ListingsProviderRegistry(mockProvider, creaProvider, repliersProvider);
  const service = new ListingsService(registry);
  const response = await service.search({
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
  assert.equal(registry.getProvider("repliers_preview").source, "repliers_preview");
  assert.equal(registry.getProvider("repliers_preview").providerStatus, "preview_not_configured");
  assert.equal(registry.getProvider("unknown").source, "mock_provider");
  assert.equal(mockProvider.source, "mock_provider");
  assert.equal(mockProvider.providerStatus, "mock_only");

  const creaResponse = await service.search({
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

  const repliersDisabled = await service.search({
    provider: "repliers_preview",
    location: "Toronto"
  });

  assert.equal(repliersDisabled.source, "repliers_preview");
  assert.equal(repliersDisabled.providerStatus, "preview_disabled");
  assert.equal(repliersDisabled.blockedReason, "repliers_provider_disabled");
  assert.equal(repliersDisabled.disclaimer, REPLIERS_PREVIEW_DISCLAIMER);
  assert.equal(repliersDisabled.results.length, 0);

  assert.equal(
    repliersProvider.getReadiness({
      REPLIERS_ENABLED: "true",
      REPLIERS_PROVIDER_CALLS_ENABLED: "true",
      REPLIERS_API_BASE_URL: "https://api.repliers.io"
    }).blockedReason,
    "repliers_api_key_missing"
  );
  assert.equal(
    repliersProvider.getReadiness({
      REPLIERS_ENABLED: "true",
      REPLIERS_PROVIDER_CALLS_ENABLED: "false",
      REPLIERS_API_BASE_URL: "https://api.repliers.io",
      REPLIERS_API_KEY: "redacted-test-key"
    }).blockedReason,
    "repliers_provider_calls_disabled"
  );
  assert.equal(
    repliersProvider.getReadiness({
      REPLIERS_ENABLED: "true",
      REPLIERS_PROVIDER_CALLS_ENABLED: "true",
      REPLIERS_API_BASE_URL: "https://example.invalid",
      REPLIERS_API_KEY: "redacted-test-key"
    }).blockedReason,
    "repliers_base_url_invalid"
  );

  const repliersBody = buildRepliersSearchBody({
    provider: "repliers_preview",
    location: "Toronto",
    type: "condo",
    maxPrice: 750000,
    intent: "investment"
  });
  assert.equal(repliersBody.city, "Toronto");
  assert.equal(repliersBody.type, "condo");
  assert.equal(repliersBody.maxPrice, 750000);
  assert.equal(repliersBody.keywords, "investment");
  assert.equal(JSON.stringify(repliersBody).includes("redacted-test-key"), false);

  let fetchCalled = false;
  const repliersReady = await repliersProvider.searchResponse(
    { provider: "repliers_preview", location: "Toronto", maxPrice: 750000 },
    {
      env: {
        REPLIERS_ENABLED: "true",
        REPLIERS_PROVIDER_CALLS_ENABLED: "true",
        REPLIERS_API_BASE_URL: "https://api.repliers.io",
        REPLIERS_API_KEY: "redacted-test-key"
      },
      fetchImpl: async (url, options) => {
        fetchCalled = true;
        assert.equal(url, "https://api.repliers.io/listings");
        assert.equal(options.method, "POST");
        assert.equal(options.headers["Content-Type"], "application/json");
        assert.equal(options.headers["REPLIERS-API-KEY"], "redacted-test-key");
        assert.equal(JSON.stringify(options.body).includes("redacted-test-key"), false);

        return {
          ok: true,
          json: async () => ({
            listings: [
              {
                id: "sample-1",
                listPrice: 725000,
                class: "condo",
                address: {
                  city: "Toronto",
                  state: "ON",
                  neighborhood: "Sample District"
                },
                details: {
                  numBedrooms: 2,
                  numBathrooms: 2,
                  sqft: 850,
                  style: "Condo Apartment"
                },
                status: "preview_sample"
              }
            ]
          })
        };
      }
    }
  );

  assert.equal(fetchCalled, true);
  assert.equal(repliersReady.source, "repliers_preview");
  assert.equal(repliersReady.providerStatus, "preview_ready");
  assert.equal(repliersReady.results.length, 1);
  assert.equal(repliersReady.results[0].sourceProvider, "repliers_preview");
  assert.equal(repliersReady.results[0].isLiveProviderData, false);
  assert.equal(repliersReady.results[0].providerStatus, "preview_ready");
  assert.equal(JSON.stringify(repliersReady).includes("redacted-test-key"), false);
  assert.equal(JSON.stringify(repliersReady).includes("REPLIERS-API-KEY"), false);
  assert.equal(JSON.stringify(repliersReady).includes("isLiveProviderData\":true"), false);

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
  const repliersSource = fs.readFileSync(
    path.join(apiRoot, "src/listings/repliers-preview.provider.ts"),
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
  assert.equal(repliersSource.includes("https://api.repliers.io"), true);
  assert.equal(repliersSource.includes("REPLIERS_API_KEY="), false);
  assert.equal(repliersSource.includes("REPLIERS_API_SECRET"), false);
  assert.equal(repliersSource.includes("REPLIERS-API-KEY"), true);
  assert.equal(allListingSource.includes("https://www.realtor.ca"), false);
  assert.equal(allListingSource.includes("https://realtor.ca"), false);
  assert.equal(allListingSource.includes("isLiveProviderData: true"), false);

  console.log("Listings contract check passed.");
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
