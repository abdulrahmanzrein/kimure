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
  REPLIERS_NO_FILTER_MATCHES_DISCLAIMER,
  REPLIERS_PREVIEW_DISCLAIMER,
  REPLIERS_PROVIDER_DISCLAIMER,
  buildRepliersSearchBody,
  normalizeRepliersListings
} = require("../src/listings/repliers-preview.provider");
const { ListingsProviderRegistry } = require("../src/listings/listings-provider.registry");
const {
  ListingsService,
  MOCK_LISTINGS_DISCLAIMER,
  parseNumber
} = require("../src/listings/listings.service");

const apiRoot = path.resolve(__dirname, "..");
const requiredFiles = [
  "scripts/run-repliers-preview-image-shape-smoke.js",
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
  assert.equal(parseNumber("$700,00"), 700000);
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
    location: "Ottawa, Toronto, Calgary",
    type: "townhome",
    minPrice: 450000,
    maxPrice: 750000,
    bedrooms: 3,
    intent: "investment"
  });
  assert.equal(repliersBody.city, "Ottawa");
  assert.equal(repliersBody.type, "townhouse");
  assert.equal(repliersBody.minPrice, 450000);
  assert.equal(repliersBody.maxPrice, 750000);
  assert.equal(repliersBody.bedrooms, 3);
  assert.equal(repliersBody.keywords, "investment");
  assert.equal(repliersBody.hasImages, true);
  assert.equal(Array.isArray(repliersBody.fields), true);
  assert.equal(repliersBody.fields.includes("images[3]"), true);
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
        const requestBody = JSON.parse(String(options.body));
        assert.equal(requestBody.city, "Toronto");
        assert.equal(requestBody.maxPrice, 750000);

        return {
          ok: true,
          json: async () => ({
            listings: [
              {
                id: "sample-1",
                listPrice: 725000,
                class: "condo",
                photoCount: 29,
                images: [
                  "area/IMG-N8418368_1.jpg",
                  {
                    large: "https://cdn.example.test/repliers/sample-condo-2.jpg"
                  }
                ],
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
  assert.equal(repliersReady.disclaimer, REPLIERS_PREVIEW_DISCLAIMER);
  assert.equal(repliersReady.results.length, 1);
  assert.equal(repliersReady.results[0].sourceProvider, "repliers_preview");
  assert.equal(repliersReady.results[0].isLiveProviderData, false);
  assert.equal(repliersReady.results[0].providerStatus, "preview_ready");
  assert.equal(repliersReady.results[0].imageUrl, "https://cdn.repliers.io/area/IMG-N8418368_1.jpg");
  assert.equal(repliersReady.results[0].imageAlt.includes("listing image"), true);
  assert.equal(JSON.stringify(repliersReady.results[0]).includes("sample data"), true);
  assert.equal(repliersReady.results[0].imageCount, 29);
  assert.equal(repliersReady.results[0].id, "repliers-preview-1");
  assert.equal(JSON.stringify(repliersReady.results[0]).includes("sample-1"), false);
  assert.equal(JSON.stringify(repliersReady).includes("redacted-test-key"), false);
  assert.equal(JSON.stringify(repliersReady).includes("REPLIERS-API-KEY"), false);
  assert.equal(JSON.stringify(repliersReady).includes("isLiveProviderData\":true"), false);

  const mixedPreviewBody = {
    listings: [
      {
        title: "Single Family Residence",
        listPrice: 369000,
        class: "Single Family Residence",
        photoCount: 4,
        images: ["area/austin.jpg"],
        address: { city: "Austin", state: "TX", neighborhood: "South Austin" },
        details: { numBedrooms: 4, numBathrooms: 2, sqft: 1752 },
        status: "preview_sample"
      },
      {
        title: "Townhouse",
        listPrice: 279000,
        class: "Townhouse",
        photoCount: 3,
        images: ["area/lago.jpg"],
        address: { city: "Lago Vista", state: "TX", neighborhood: "Lago Vista" },
        details: { numBedrooms: 3, numBathrooms: 3, sqft: 1153 },
        status: "preview_sample"
      },
      {
        title: "Condominium",
        listPrice: 249900,
        class: "Condominium",
        photoCount: 5,
        images: ["area/charlotte.jpg"],
        address: { city: "Charlotte", state: "NC", neighborhood: "Uptown" },
        details: { numBedrooms: 3, numBathrooms: 2, sqft: 1184 },
        status: "preview_sample"
      }
    ]
  };

  const austinFiltered = await repliersProvider.searchResponse(
    { provider: "repliers_preview", location: "Austin", maxPrice: 400000 },
    {
      env: {
        REPLIERS_ENABLED: "true",
        REPLIERS_PROVIDER_CALLS_ENABLED: "true",
        REPLIERS_API_BASE_URL: "https://api.repliers.io",
        REPLIERS_API_KEY: "redacted-test-key"
      },
      fetchImpl: async (_url, options) => {
        const requestBody = JSON.parse(String(options.body));
        assert.equal(requestBody.city, "Austin");
        assert.equal(requestBody.maxPrice, 400000);
        return { ok: true, json: async () => mixedPreviewBody };
      }
    }
  );

  assert.equal(austinFiltered.providerStatus, "preview_ready");
  assert.equal(austinFiltered.results.length, 1);
  assert.equal(austinFiltered.results[0].title, "Single Family Residence");
  assert.equal(JSON.stringify(austinFiltered).includes("Charlotte"), false);
  assert.equal(JSON.stringify(austinFiltered).includes("Lago Vista"), false);

  const charlotteCondoFiltered = await repliersProvider.searchResponse(
    {
      provider: "repliers_preview",
      location: "Charlotte",
      type: "condo",
      maxPrice: 300000
    },
    {
      env: {
        REPLIERS_ENABLED: "true",
        REPLIERS_PROVIDER_CALLS_ENABLED: "true",
        REPLIERS_API_BASE_URL: "https://api.repliers.io",
        REPLIERS_API_KEY: "redacted-test-key"
      },
      fetchImpl: async (_url, options) => {
        const requestBody = JSON.parse(String(options.body));
        assert.equal(requestBody.city, "Charlotte");
        assert.equal(requestBody.type, "condo");
        assert.equal(requestBody.maxPrice, 300000);
        return { ok: true, json: async () => mixedPreviewBody };
      }
    }
  );

  assert.equal(charlotteCondoFiltered.results.length, 1);
  assert.equal(charlotteCondoFiltered.results[0].title, "Condominium");
  assert.equal(charlotteCondoFiltered.results[0].price, 249900);
  assert.equal(JSON.stringify(charlotteCondoFiltered).includes("Austin"), false);
  assert.equal(JSON.stringify(charlotteCondoFiltered).includes("Townhouse"), false);

  const impossibleFiltered = await repliersProvider.searchResponse(
    {
      provider: "repliers_preview",
      location: "Charlotte",
      type: "detached",
      maxPrice: 100000
    },
    {
      env: {
        REPLIERS_ENABLED: "true",
        REPLIERS_PROVIDER_CALLS_ENABLED: "true",
        REPLIERS_API_BASE_URL: "https://api.repliers.io",
        REPLIERS_API_KEY: "redacted-test-key"
      },
      fetchImpl: async () => ({ ok: true, json: async () => mixedPreviewBody })
    }
  );

  assert.equal(impossibleFiltered.providerStatus, "preview_ready");
  assert.equal(impossibleFiltered.blockedReason, undefined);
  assert.equal(impossibleFiltered.results.length, 0);
  assert.equal(impossibleFiltered.disclaimer, REPLIERS_NO_FILTER_MATCHES_DISCLAIMER);
  assert.equal(JSON.stringify(impossibleFiltered).includes("mock_provider"), false);

  let productionFetchCalled = false;
  const repliersProduction = await repliersProvider.searchResponse(
    { provider: "repliers_preview", location: "Toronto", maxPrice: 750000 },
    {
      env: {
        REPLIERS_ENABLED: "true",
        REPLIERS_ENVIRONMENT: "production",
        REPLIERS_PROVIDER_CALLS_ENABLED: "true",
        REPLIERS_API_BASE_URL: "https://api.repliers.io",
        REPLIERS_API_KEY: "redacted-test-key"
      },
      fetchImpl: async () => {
        productionFetchCalled = true;
        return {
          ok: true,
          json: async () => ({
            listings: [
              {
                title: "Provider Listing",
                listPrice: 725000,
                class: "condo",
                photoCount: 1,
                images: ["area/IMG-N8418368_1.jpg"],
                address: { city: "Toronto", state: "ON", neighborhood: "Provider District" },
                details: { numBedrooms: 2, numBathrooms: 2, sqft: 850 },
                status: "available"
              }
            ]
          })
        };
      }
    }
  );

  assert.equal(productionFetchCalled, true);
  assert.equal(repliersProduction.providerStatus, "production_ready");
  assert.equal(repliersProduction.disclaimer, REPLIERS_PROVIDER_DISCLAIMER);
  assert.equal(repliersProduction.results[0].providerStatus, "production_ready");
  assert.equal(repliersProduction.results[0].isLiveProviderData, false);
  assert.equal(JSON.stringify(repliersProduction).includes("sample data"), false);
  assert.equal(JSON.stringify(repliersProduction).includes("repliers preview"), false);
  assert.equal(JSON.stringify(repliersProduction).includes("not live MLS"), false);
  assert.equal(JSON.stringify(repliersProduction).includes("isLiveProviderData\":true"), false);

  const unsafeImageListings = normalizeRepliersListings({
    listings: [
      {
        images: [
          "javascript:alert(1)",
          "data:image/png;base64,abc",
          "file:///tmp/image.jpg",
          "blob:https://example.test/id",
          "../private/image.jpg",
          "area/safe-preview.webp"
        ]
      },
      {
        images: ["https://cdn.example.test/repliers/absolute-safe.jpg"]
      }
    ]
  });

  assert.equal(unsafeImageListings[0].imageUrl, "https://cdn.repliers.io/area/safe-preview.webp");
  assert.equal(unsafeImageListings[0].imageCount, 1);
  assert.equal(unsafeImageListings[1].imageUrl, "https://cdn.example.test/repliers/absolute-safe.jpg");

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
  const repliersSmokeSource = fs.readFileSync(
    path.join(apiRoot, "scripts/run-repliers-preview-image-shape-smoke.js"),
    "utf8"
  );
  const packageJson = JSON.parse(fs.readFileSync(path.join(apiRoot, "package.json"), "utf8"));
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
  assert.equal(repliersSource.includes("https://cdn.repliers.io"), true);
  assert.equal(repliersSource.includes("REPLIERS_IMAGE_CDN_BASE_URL"), true);
  assert.equal(repliersSource.includes("javascript:"), true);
  assert.equal(repliersSource.includes("data:"), true);
  assert.equal(repliersSource.includes("../"), true);
  assert.equal(repliersSource.includes("REPLIERS_API_KEY="), false);
  assert.equal(repliersSource.includes("REPLIERS_API_SECRET"), false);
  assert.equal(repliersSource.includes("REPLIERS-API-KEY"), true);
  assert.equal(packageJson.scripts["smoke:repliers-image-shape"], "node scripts/run-repliers-preview-image-shape-smoke.js");
  assert.equal(repliersSmokeSource.includes("REPLIERS_IMAGE_SHAPE_SMOKE_ENABLED"), true);
  assert.equal(repliersSmokeSource.includes("hasImages: true"), true);
  assert.equal(repliersSmokeSource.includes("images[5]"), true);
  assert.equal(repliersSmokeSource.includes("topLevelKeys"), true);
  assert.equal(repliersSmokeSource.includes("firstImageShape"), true);
  assert.equal(repliersSmokeSource.includes("printSafe(body"), false);
  assert.equal(repliersSmokeSource.includes("printSafe(response"), false);
  assert.equal(repliersSmokeSource.includes("printSafe(headers"), false);
  assert.equal(repliersSmokeSource.includes("console.log"), false);
  assert.equal(repliersSmokeSource.includes("raw"), false);
  assert.equal(allListingSource.includes("https://www.realtor.ca"), false);
  assert.equal(allListingSource.includes("https://realtor.ca"), false);
  assert.equal(allListingSource.includes("providerStatus === \"live_ready\""), true);
  assert.equal(allListingSource.includes("isLiveProviderData: true"), false);

  console.log("Listings contract check passed.");
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
